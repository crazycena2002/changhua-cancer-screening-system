import test from 'node:test'
import assert from 'node:assert/strict'
import { findTubeRecord, receiveTube, returnError, undoTubeReturn, undoReturnError, todayReturns, taipeiDay, undoReturnWindow } from './tubeOperations.js'
import { labelSnapshot, parseLabelSnapshot } from './bowelLabels.js'
const timestamp = Date.parse('2026-10-02T12:00:00+08:00')
const sample = () => ({ id: '133707020001', barcode: '123456789012', name: '測試甲', identity: 'N123456789', provider: '田中鎮衛生所', state: '已領取', tubeReturned: false, returnedAt: '' })
test('scanner lookup accepts barcode, reservation id and exact identity; ambiguous records are rejected', () => {
  const record = sample()
  for (const value of [record.barcode, record.id, ' n123456789 ']) assert.equal(findTubeRecord([record], value).record, record)
  assert.match(findTubeRecord([record], '').error, /請輸入/)
  assert.match(findTubeRecord([record], '000000000000').error, /查無/)
  assert.match(findTubeRecord([record, { ...record, id: '2', barcode: '222222222222' }], record.identity).error, /多筆/)
})
test('receiving updates only a picked-up tube once and retains a before snapshot', () => {
  const record = sample(), result = receiveTube(record, timestamp)
  assert.equal(result.error, '')
  assert.equal(record.state, '已繳回'); assert.equal(record.tubeReturned, true)
  assert.equal(record.returnedAt, '2026-10-02'); assert.equal(record.returnedAtTs, timestamp)
  assert.deepEqual(result.receipt.before, { state: '已領取', tubeReturned: false, returnedAt: '', returnedAtTs: 0 })
  assert.match(receiveTube(record, timestamp + 1).error, /重複/)
  assert.equal(record.returnHistory.length, 1)
  for (const state of ['已預約', '已派送', '已接收', '已取消', '退管', '報廢', '已送驗']) assert.ok(returnError({ ...sample(), state }))
})
test('return can be restored inside ten minutes; the exact deadline and backwards clock are blocked', () => {
  for (const elapsed of [undoReturnWindow - 1, undoReturnWindow, -1]) {
    const record = sample(), { receipt } = receiveTube(record, timestamp)
    const error = undoTubeReturn(record, receipt, timestamp + elapsed)
    assert.equal(!!error, elapsed !== undoReturnWindow - 1)
    if (!error) { assert.equal(record.state, '已領取'); assert.equal(record.tubeReturned, false); assert.equal(record.returnedAt, ''); assert.ok(receipt.undoneAt) }
  }
})
test('downstream transitions and stale or already restored receipts cannot be undone', () => {
  const record = sample(), { receipt } = receiveTube(record, timestamp)
  record.state = '已送驗'
  assert.match(undoReturnError(record, receipt, timestamp + 1), /狀態已變更/)
  record.state = '已繳回'; assert.equal(undoTubeReturn(record, receipt, timestamp + 2), '')
  assert.ok(undoTubeReturn(record, receipt, timestamp + 3))
  receiveTube(record, timestamp + 4)
  assert.ok(undoTubeReturn(record, receipt, timestamp + 5))
  assert.equal(record.returnHistory.length, 2)
})
test('local roster round trip preserves return audit and permits undo without losing barcode', () => {
  const record = sample(); receiveTube(record, timestamp)
  const restored = parseLabelSnapshot(JSON.stringify(labelSnapshot([record])))[0]
  assert.equal(undoTubeReturn(restored, restored.returnHistory[0], timestamp + 1), '')
  assert.equal(restored.barcode, record.barcode)
  assert.equal(restored.tubeReturned, false)
  const corrupt = labelSnapshot([record]); corrupt.records[0].returnHistory[0].at = 'invalid'
  assert.throws(() => parseLabelSnapshot(JSON.stringify(corrupt)))
})
test('today history uses Taipei dates and retains restored receipts in the audit', () => {
  const record = sample(); const previousDay = Date.parse('2026-10-01T23:59:59+08:00')
  const { receipt } = receiveTube(record, previousDay); undoTubeReturn(record, receipt, previousDay + 500)
  const today = Date.parse('2026-10-02T00:00:01+08:00'); receiveTube(record, today)
  assert.equal(taipeiDay(today), '2026-10-02')
  assert.equal(todayReturns([record], today).length, 1)
  assert.equal(todayReturns([record], previousDay).length, 1)
})
