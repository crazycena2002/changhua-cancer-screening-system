import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessBowelLabRecord, canRollbackBowelLab, canUseBowelLab, labExportHeaders, labExportRows, processBowelLabBatch, queryBowelLabRecords, rollbackBowelLab, selectableLabIds } from './bowelLabService.js'
import { derivedBowelFollowUp } from './bowelTrackingService.js'

const now = Date.parse('2026-10-05T12:00:00+08:00')
const bureau = { organizationCode: 'BUREAU', role: '衛生局承辦', name: '局端甲' }
const center = { organizationCode: 'CENTER', role: '衛生所承辦', area: '田中鎮', healthCenterName: '田中鎮衛生所', name: '所端乙' }
const pharmacy = { organizationCode: 'PHARMACY', role: '藥局人員', area: '田中鎮', provider: '喜喜藥局' }
const admin = { organizationCode: 'ADMIN', role: '系統管理員', name: '管理員' }
const returned = (id = '153707010001', extra = {}) => ({ id, bowelReservationId: id, name: '王小明', identity: 'N123456789', area: '田中鎮', provider: '田中鎮衛生所', category: '衛生所', date: '2026-09-20', pickedUpAt: '2026-09-25T09:00:00+08:00', returnedAt: '2026-10-02T09:00:00+08:00', returnedBy: '院所人員', state: '已繳回', tubeReturned: true, statusHistory: [], ...extra })

test('RETURNED 可送驗，記錄日期、操作者、最新時間及既有生命週期歷程', () => {
  const result = processBowelLabBatch([returned()], ['153707010001'], { actor: center, now })
  assert.equal(result.successCount, 1)
  const row = result.updates[0].record
  assert.equal(row.currentStatus, 'SENT_TO_LAB')
  assert.equal(row.sentToLabAt, new Date(now).toISOString())
  assert.equal(row.sentToLabBy, '所端乙')
  assert.equal(row.statusUpdatedAt, new Date(now).toISOString())
  assert.equal(row.returnedAt, '2026-10-02T09:00:00+08:00')
  assert.deepEqual(row.statusHistory.at(-1), { previousStatus: 'RETURNED', currentStatus: 'SENT_TO_LAB', changedAt: now, changedBy: '所端乙', action: 'CONFIRM_SENT_TO_LAB', reason: '衛生所收回檢體，確認送驗' })
})

test('PICKED_UP、RECEIVED 及更早狀態不可跳級送驗；已送驗不可重複送驗', () => {
  const rows = ['已預約', '已派送', '已接收', '已領取', '已送驗'].map((state, index) => returned(`15370701000${index + 2}`, { state }))
  const result = processBowelLabBatch(rows, rows.map(row => row.id), { actor: bureau, now })
  assert.equal(result.successCount, 0)
  assert.equal(result.failureCount, 5)
  assert.equal(rows.every(row => row.statusHistory.length === 0), true)
})

test('批次送驗逐筆處理，部分成功與失敗均回報原因', () => {
  const rows = [returned(), returned('153707010002', { state: '已領取' }), returned('153707010003', { area: '員林市', provider: '安康藥局', category: '藥局' })]
  const result = processBowelLabBatch(rows, [...rows.map(row => row.id), 'missing'], { actor: center, now })
  assert.equal(result.successCount, 1)
  assert.equal(result.failureCount, 3)
  assert.equal(result.updates[0].id, rows[0].id)
  assert.match(result.failures[0].reason, /只有已繳回/)
  assert.match(result.failures[1].reason, /權限/)
  assert.match(result.failures[2].reason, /找不到/)
})

test('預設只列已繳回；查詢可依鄉鎮、院所、繳管日期、身分證、預約編號與狀態', () => {
  const rows = [returned(), returned('153707020002', { provider: '喜喜藥局', category: '藥局', returnedAt: '2026-10-03T09:00:00+08:00' }), returned('153702020003', { area: '員林市', provider: '安康藥局', category: '藥局', state: '已送驗', sentToLabAt: '2026-10-04T09:00:00+08:00' })]
  assert.equal(queryBowelLabRecords(rows, { actor: bureau, filters: { currentStatus: 'RETURNED' } }).length, 2)
  const filtered = queryBowelLabRecords(rows, { actor: bureau, filters: { township: '田中鎮', institution: '喜喜藥局', returnFrom: '2026-10-03', returnTo: '2026-10-03', identity: 'N123456789', reservationId: '153707020002', currentStatus: '全部' } })
  assert.deepEqual(filtered.map(row => row.id), ['153707020002'])
  assert.deepEqual(queryBowelLabRecords(rows, { actor: bureau, filters: { currentStatus: 'SENT_TO_LAB' } }).map(row => row.id), ['153702020003'])
})

test('全選只包含目前篩選結果中有權限且處於 RETURNED 的紀錄', () => {
  const rows = [returned(), returned('153707020002', { provider: '喜喜藥局', category: '藥局' }), returned('153707010003', { state: '已送驗', sentToLabAt: '2026-10-04T09:00:00+08:00' })]
  const filtered = queryBowelLabRecords(rows, { actor: center, filters: { institution: '田中鎮衛生所', currentStatus: '全部' } })
  assert.deepEqual(selectableLabIds(filtered, center), ['153707010001'])
})

test('局端可查全區，衛生所限所轄衛生所與藥局，藥局不得查詢或送驗', () => {
  const rows = [returned(), returned('153707020002', { provider: '喜喜藥局', category: '藥局' }), returned('153702020003', { area: '員林市', provider: '安康藥局', category: '藥局' })]
  assert.equal(queryBowelLabRecords(rows, { actor: bureau }).length, 3)
  assert.equal(queryBowelLabRecords(rows, { actor: center }).length, 2)
  assert.equal(queryBowelLabRecords(rows, { actor: pharmacy }).length, 0)
  assert.equal(canUseBowelLab(admin), false)
  assert.equal(canAccessBowelLabRecord(center, rows[2]), false)
  assert.equal(processBowelLabBatch(rows, [rows[2].id], { actor: center, now }).failureCount, 1)
  assert.equal(processBowelLabBatch(rows, [rows[0].id], { actor: pharmacy, now }).failureCount, 1)
})

test('RETURNED 與 SENT_TO_LAB 不顯示未繳回或報廢提醒', () => {
  const overdue = returned('153707010001', { pickedUpAt: '2026-09-01T09:00:00+08:00' })
  assert.equal(derivedBowelFollowUp(overdue, now), null)
  const sent = processBowelLabBatch([overdue], [overdue.id], { actor: bureau, now }).updates[0].record
  assert.equal(derivedBowelFollowUp(sent, now + 20 * 86400000), null)
})

test('復原遵守 10 分鐘與既有管理角色規則，清除送驗欄位並留下逆向歷程', () => {
  const row = processBowelLabBatch([returned()], ['153707010001'], { actor: center, now }).updates[0].record
  assert.equal(canRollbackBowelLab(row, center, now + 9 * 60000), true)
  assert.equal(canRollbackBowelLab(row, center, now + 10 * 60000), false)
  assert.equal(canRollbackBowelLab(row, bureau, now + 86400000), true)
  assert.equal(canRollbackBowelLab(row, admin, now + 86400000), true)
  const undone = rollbackBowelLab(row, center, now + 9 * 60000)
  assert.equal(undone.currentStatus, 'RETURNED')
  assert.equal(undone.sentToLabAt, '')
  assert.equal(undone.sentToLabBy, '')
  assert.equal(undone.returnedAt, row.returnedAt)
  assert.equal(undone.statusHistory.at(-1).action, 'ROLLBACK_SENT_TO_LAB')
  assert.throws(() => rollbackBowelLab(row, center, now + 10 * 60000))
})

test('匯出只使用目前篩選結果，欄位完整', () => {
  const rows = [returned(), returned('153707020002', { provider: '喜喜藥局', category: '藥局' })]
  const filtered = queryBowelLabRecords(rows, { actor: center, filters: { institution: '喜喜藥局' } })
  const exportRows = labExportRows(filtered, '2026-10-05T04:00:00.000Z')
  assert.equal(exportRows.length, 1)
  assert.equal(exportRows[0][0], '153707020002')
  assert.equal(exportRows[0][9], '2026-10-05T04:00:00.000Z')
  assert.equal(labExportHeaders.length, exportRows[0].length)
})
