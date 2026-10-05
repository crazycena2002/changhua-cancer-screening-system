import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccessLabelRecord, canUseBowelLabels, labelActionReason, labelExportRows, processLabelBatch, queryLabelRecords, selectableLabelIds, sortLabelPrintData } from './bowelLabelService.js'
import { canRollbackBowelStatus } from './bowelTrackingService.js'

const now = Date.parse('2026-10-05T12:00:00+08:00')
const bureau = { organizationCode: 'BUREAU', role: '衛生局承辦', name: '局端甲' }
const center = { organizationCode: 'CENTER', role: '衛生所承辦', area: '田中鎮', healthCenterName: '田中鎮衛生所', name: '所端乙' }
const pharmacy = { organizationCode: 'PHARMACY', role: '藥局人員', area: '田中鎮', provider: '喜喜藥局' }
const booked = (id = '153707020001', overrides = {}) => ({ id, bowelReservationId: id, name: '王小明', identity: 'N123456789', area: '田中鎮', provider: '喜喜藥局', category: '藥局', date: '2026-10-02', state: '已預約', printAt: '', statusHistory: [], ...overrides })

test('BOOKED 首次列印會派送、留下時間、操作者和狀態歷程', () => {
  const result = processLabelBatch([booked()], ['153707020001'], 'PRINT', { actor: center, now })
  assert.equal(result.successCount, 1)
  assert.equal(result.failureCount, 0)
  const row = result.updates[0].record
  assert.equal(row.currentStatus, 'DISPATCHED')
  assert.equal(row.printStatus, 'PRINTED')
  assert.equal(row.printedAt, new Date(now).toISOString())
  assert.equal(row.printedBy, '所端乙')
  assert.deepEqual(row.statusHistory.at(-1), { previousStatus: 'BOOKED', currentStatus: 'DISPATCHED', changedAt: now, changedBy: '所端乙', action: 'PRINT' })
  assert.equal(row.printHistory.at(-1).action, 'PRINT')
  assert.equal(result.printData[0].reservationId, row.id)
  assert.equal(result.printData[0].identity, row.identity)
  assert.equal(result.printData[0].institutionType, '藥局')
  assert.equal(result.printData[0].reservationDate, row.date)
  assert.equal(Object.hasOwn(result.printData[0], 'statusHistory'), false)
  assert.equal(canRollbackBowelStatus(row, center, now + 1000), false)
  assert.equal(queryLabelRecords([row], { actor: center, filters: { printStatus: 'PRINTED' } }).length, 1)
})

test('補印維持 DISPATCHED，累計補印次數但不偽造狀態轉換', () => {
  const first = processLabelBatch([booked()], ['153707020001'], 'PRINT', { actor: bureau, now }).updates[0].record
  const result = processLabelBatch([first], [first.id], 'PRINT', { actor: bureau, now: now + 60000 })
  const row = result.updates[0].record
  assert.equal(row.currentStatus, 'DISPATCHED')
  assert.equal(row.printedAt, first.printedAt)
  assert.equal(row.reprintCount, 1)
  assert.equal(row.reprintedAt, new Date(now + 60000).toISOString())
  assert.equal(row.statusHistory.length, first.statusHistory.length)
  assert.equal(row.printHistory.at(-1).action, 'REPRINT')
  assert.deepEqual(result.printData.map(item => item.reservationId), [first.id])
})

test('取消列印回到 BOOKED，清空列印時間並新增逆向狀態歷程', () => {
  const first = processLabelBatch([booked()], ['153707020001'], 'PRINT', { actor: center, now }).updates[0].record
  const result = processLabelBatch([first], [first.id], 'CANCEL_PRINT', { actor: center, now: now + 86400000 })
  const row = result.updates[0].record
  assert.equal(row.currentStatus, 'BOOKED')
  assert.equal(row.printStatus, 'UNPRINTED')
  assert.equal(row.printedAt, '')
  assert.equal(row.printAt, '')
  assert.deepEqual(row.statusHistory.at(-1), { previousStatus: 'DISPATCHED', currentStatus: 'BOOKED', changedAt: now + 86400000, changedBy: '所端乙', action: 'CANCEL_PRINT' })
  assert.equal(row.printHistory.at(-1).action, 'CANCEL_PRINT')
  assert.equal(queryLabelRecords([row], { actor: center, filters: { printStatus: 'UNPRINTED' } }).length, 1)
})

test('衛生所只能查自己衛生所和轄下藥局；局端可查全區，其他角色不可列印', () => {
  const rows = [
    booked('153707010001', { provider: '田中鎮衛生所', category: '衛生所' }),
    booked('153707020001'),
    booked('153707030001', { provider: '別區藥局', healthCenterName: '其他衛生所', category: '藥局' }),
    booked('153701010001', { area: '彰化市', provider: '彰化市南區衛生所', category: '衛生所' }),
  ]
  assert.deepEqual(queryLabelRecords(rows, { actor: center, filters: { printStatus: 'UNPRINTED' } }).map(row => row.id), ['153707010001', '153707020001'])
  assert.equal(queryLabelRecords(rows, { actor: bureau }).length, 4)
  assert.equal(queryLabelRecords(rows, { actor: pharmacy }).length, 0)
  assert.equal(canUseBowelLabels({ organizationCode: 'SYS', role: '系統管理員' }), false)
  assert.equal(canAccessLabelRecord(center, rows[2]), false)
  assert.equal(processLabelBatch(rows, [rows[2].id], 'PRINT', { actor: center, now }).failureCount, 1)
})

test('非法狀態不能靠列印回到 DISPATCHED；批次回報部分失敗', () => {
  const valid = booked()
  const invalid = booked('153707020002', { state: '已接收', printAt: '2026-10-03' })
  const result = processLabelBatch([valid, invalid], [valid.id, invalid.id, 'missing'], 'PRINT', { actor: bureau, now })
  assert.equal(result.successCount, 1)
  assert.equal(result.failureCount, 2)
  assert.equal(result.updates[0].id, valid.id)
  assert.match(result.failures[0].reason, /只有已預約/)
  assert.match(result.failures[1].reason, /查無/)
  assert.match(labelActionReason(invalid, 'CANCEL_PRINT'), /只有已派送/)
})

test('全選僅取目前篩選中可操作資料；匯出行數與篩選一致', () => {
  const unprinted = booked()
  const printed = booked('153707010002', { provider: '田中鎮衛生所', category: '衛生所', state: '已派送', printAt: '2026-10-04' })
  const advanced = booked('153707010003', { provider: '田中鎮衛生所', category: '衛生所', state: '已接收', printAt: '2026-10-04' })
  const rows = [unprinted, printed, advanced]
  const pending = queryLabelRecords(rows, { actor: center, filters: { printStatus: 'UNPRINTED' } })
  assert.deepEqual(selectableLabelIds(pending, 'PRINT', center), [unprinted.id])
  const done = queryLabelRecords(rows, { actor: center, filters: { printStatus: 'PRINTED', category: '衛生所' } })
  assert.equal(done.length, 2)
  assert.deepEqual(selectableLabelIds(done, 'CANCEL_PRINT', center), [printed.id])
  assert.equal(labelExportRows(done).length, done.length)
  assert.equal(labelExportRows(done)[0][6], '完成列印')
  const sorted = sortLabelPrintData([{ institutionName: '乙院所', reservationId: '2' }, { institutionName: '甲院所', reservationId: '2' }, { institutionName: '甲院所', reservationId: '1' }])
  assert.deepEqual(sorted.filter(item => item.institutionName === '甲院所').map(item => item.reservationId), ['1', '2'])
  assert.equal(Math.abs(sorted.findIndex(item => item.institutionName === '乙院所') - sorted.findIndex(item => item.institutionName === '甲院所')), 1)
})
