import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessBowelReturnRecord, canRollbackBowelReturn, canUseBowelReturns, lookupBowelReturn, parseReturnQrPayload, processBowelReturnBatch, queryBowelReturns, returnExportHeaders, returnExportRows, rollbackBowelReturn, selectableReturnIds } from './bowelReturnService.js'
import { derivedBowelFollowUp } from './bowelTrackingService.js'

const now = Date.parse('2026-10-05T12:00:00+08:00')
const bureau = { organizationCode: 'BUREAU', role: '衛生局承辦', name: '局端甲' }
const center = { organizationCode: 'CENTER', role: '衛生所承辦', area: '田中鎮', healthCenterName: '田中鎮衛生所', name: '所端乙' }
const yuanlin = { organizationCode: 'YUANLIN', role: '衛生所承辦', area: '員林市', healthCenterName: '員林市衛生所', name: '所端丙' }
const pharmacy = { organizationCode: 'PHARMACY', role: '藥局人員', area: '田中鎮', provider: '喜喜藥局' }
const admin = { organizationCode: 'ADMIN', role: '系統管理員', name: '管理員' }
const picked = (id = '153707010001', extra = {}) => ({ id, bowelReservationId: id, name: '王小明', identity: 'N123456789', phone: '0912345678', area: '田中鎮', provider: '田中鎮衛生所', category: '衛生所', date: '2026-09-20', issuedAt: '2026-09-20', pickedUpAt: '2026-10-01T09:00:00+08:00', state: '已領取', tubeReturned: false, statusHistory: [], ...extra })

test('PICKED_UP 繳管寫入生命週期、日期、操作者與歷程，逾期提醒立即消失', () => {
  const overdue = picked('153707010001', { pickedUpAt: '2026-09-25T09:00:00+08:00' })
  assert.equal(derivedBowelFollowUp(overdue, now)?.code, 'OVERDUE_RETURN')
  const result = processBowelReturnBatch([overdue], [overdue.id], { actor: center, now })
  assert.equal(result.successCount, 1)
  const row = result.updates[0].record
  assert.equal(row.currentStatus, 'RETURNED')
  assert.equal(row.returnedAt, new Date(now).toISOString())
  assert.equal(row.returnedBy, '所端乙')
  assert.equal(row.statusUpdatedAt, new Date(now).toISOString())
  assert.equal(row.tubeReturned, true)
  assert.deepEqual(row.statusHistory.at(-1), { previousStatus: 'PICKED_UP', currentStatus: 'RETURNED', changedAt: now, changedBy: '所端乙', action: 'CONFIRM_RETURN' })
  assert.equal(row.returnHistory.at(-1).operator, '所端乙')
  assert.equal(derivedBowelFollowUp(row, now), null)
})

test('14 天報廢提醒在繳回後消失，已繳管不可重複建立歷程', () => {
  const overdue = picked('153707010002', { pickedUpAt: '2026-09-20T09:00:00+08:00' })
  assert.equal(derivedBowelFollowUp(overdue, now)?.code, 'DISCARDED')
  const row = processBowelReturnBatch([overdue], [overdue.id], { actor: bureau, now }).updates[0].record
  assert.equal(derivedBowelFollowUp(row, now), null)
  const again = processBowelReturnBatch([row], [row.id], { actor: bureau, now: now + 1000 })
  assert.equal(again.successCount, 0)
  assert.equal(again.failureCount, 1)
  assert.equal(row.statusHistory.length, 1)
})

test('BOOKED、DISPATCHED、RECEIVED 不可直接繳管，批次可部分成功', () => {
  const records = [picked(), ...['已預約', '已派送', '已接收'].map((state, i) => picked(`15370701000${i + 2}`, { state }))]
  const result = processBowelReturnBatch(records, records.map(row => row.id), { actor: bureau, now })
  assert.equal(result.successCount, 1)
  assert.equal(result.failureCount, 3)
  assert.equal(result.updates[0].record.currentStatus, 'RETURNED')
})

test('身分證完整查詢、無資料提示與 QR 預約編號／身分證解析皆不改狀態', () => {
  const record = picked()
  assert.equal(lookupBowelReturn([record], record.identity, { actor: center, mode: 'identity' }).record.id, record.id)
  assert.match(lookupBowelReturn([record], 'N100000000', { actor: center, mode: 'identity' }).error, /找不到/)
  assert.equal(parseReturnQrPayload(record.id).value, record.id)
  assert.equal(parseReturnQrPayload(JSON.stringify({ reservationId: record.id, currentStatus: 'RETURNED' })).value, record.id)
  assert.equal(lookupBowelReturn([record], record.id, { actor: center }).record.id, record.id)
  assert.equal(lookupBowelReturn([record], record.identity, { actor: center }).record.id, record.id)
  assert.deepEqual(queryBowelReturns([record, picked('153707010099')], { actor: center, filters: { reservationId: record.id } }).map(row => row.id), [record.id])
  assert.equal(record.state, '已領取')
  assert.equal(record.statusHistory.length, 0)
  assert.equal(parseReturnQrPayload('garbage'), null)
  assert.match(lookupBowelReturn([record], 'garbage', { actor: center }).error, /格式無效/)
  assert.match(lookupBowelReturn([record], '999999999999', { actor: center }).error, /找不到/)
})

test('全選僅含目前篩選結果內可合法繳管的紀錄', () => {
  const rows = [picked(), picked('153707010002', { state: '已繳回', returnedAt: '2026-10-04T09:00:00+08:00' }), picked('153707010003', { category: '藥局', provider: '喜喜藥局' })]
  const filtered = queryBowelReturns(rows, { actor: center, filters: { category: '衛生所' } })
  assert.deepEqual(selectableReturnIds(filtered, center), ['153707010001'])
  assert.equal(filtered[1].returnStatus, '已繳管')
})

test('衛生局全區可查；衛生所只查自己與轄下藥局；藥局不得進入或操作', () => {
  const rows = [picked(), picked('153707020002', { provider: '喜喜藥局', category: '藥局' }), picked('153702020003', { area: '員林市', provider: '安康藥局', category: '藥局' })]
  assert.equal(queryBowelReturns(rows, { actor: bureau }).length, 3)
  assert.equal(queryBowelReturns(rows, { actor: center }).length, 2)
  assert.equal(queryBowelReturns(rows, { actor: yuanlin }).length, 1)
  assert.equal(queryBowelReturns(rows, { actor: pharmacy }).length, 0)
  assert.equal(canUseBowelReturns(pharmacy), false)
  assert.equal(canUseBowelReturns(admin), false)
  assert.equal(canAccessBowelReturnRecord(center, rows[2]), false)
  assert.equal(processBowelReturnBatch(rows, [rows[2].id], { actor: center, now }).failureCount, 1)
  assert.equal(processBowelReturnBatch(rows, [rows[0].id], { actor: pharmacy, now }).failureCount, 1)
})

test('發管日期取自 pickedUpAt；衛生所在前、藥局在後，同類由近到遠', () => {
  const rows = [picked('153707020001', { provider: '喜喜藥局', category: '藥局', pickedUpAt: '2026-10-05T09:00:00+08:00' }), picked('153707010002', { pickedUpAt: '2026-10-01T09:00:00+08:00' }), picked('153707010003', { pickedUpAt: '2026-10-04T09:00:00+08:00' })]
  const result = queryBowelReturns(rows, { actor: bureau })
  assert.deepEqual(result.map(row => row.id), ['153707010003', '153707010002', '153707020001'])
  assert.equal(result[0].issueDate, '2026-10-04')
  assert.notEqual(result[0].issueDate, result[0].issuedAt)
})

test('匯出只使用已篩選結果，含電話、編號與匯出時間', () => {
  const rows = [picked(), picked('153707020002', { provider: '喜喜藥局', category: '藥局' })]
  const filtered = queryBowelReturns(rows, { actor: center, filters: { category: '衛生所' } })
  const exported = returnExportRows(filtered, '2026-10-05T04:00:00.000Z')
  assert.equal(exported.length, 1)
  assert.equal(exported[0][2], '0912345678')
  assert.equal(exported[0][3], rows[0].id)
  assert.equal(exported[0][9], '2026-10-05T04:00:00.000Z')
  assert.equal(returnExportHeaders.length, exported[0].length)
})

test('繳管復原遵守 10 分鐘，清除 returnedAt 並留下逆向歷程', () => {
  const row = processBowelReturnBatch([picked()], ['153707010001'], { actor: center, now }).updates[0].record
  assert.equal(canRollbackBowelReturn(row, center, now + 9 * 60000), true)
  assert.equal(canRollbackBowelReturn(row, center, now + 10 * 60000), false)
  assert.equal(canRollbackBowelReturn(row, bureau, now + 86400000), true)
  assert.equal(canRollbackBowelReturn(row, admin, now + 86400000), true)
  const undone = rollbackBowelReturn(row, center, now + 9 * 60000)
  assert.equal(undone.currentStatus, 'PICKED_UP')
  assert.equal(undone.returnedAt, '')
  assert.equal(undone.returnedBy, '')
  assert.equal(undone.tubeReturned, false)
  assert.equal(undone.statusHistory.at(-1).action, 'ROLLBACK_RETURN')
  assert.equal(undone.returnHistory.at(-1).undoneAt, now + 9 * 60000)
  assert.throws(() => rollbackBowelReturn(row, center, now + 10 * 60000))
})
