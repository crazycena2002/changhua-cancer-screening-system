import test from 'node:test'
import assert from 'node:assert/strict'
import { matchesAdminTask, summarizeAdminTasks } from './adminTasks.js'

test('counts each pending stage once and excludes completed or exceptional records', () => {
  const records = ['已預約', '已派送', '已接收', '已領取', '已繳回', '已送驗', '退管', '報廢'].map(state => ({ state, printAt: '', tubeReturned: false }))
  const summary = summarizeAdminTasks(records)
  assert.deepEqual(summary.map(task => task.count), [1, 1, 1, 1, 1])
  assert.equal(summary.reduce((sum, task) => sum + task.count, 0), 5)
})

test('counts follow status changes and use the same predicates as destination lists', () => {
  const record = { state: '已預約', printAt: '', tubeReturned: false }
  assert.equal(matchesAdminTask(record, 'labels'), true)
  record.state = '已派送'; record.printAt = '2026-10-02'
  assert.equal(matchesAdminTask(record, 'labels'), false)
  assert.equal(matchesAdminTask(record, 'receive'), true)
  record.state = '已領取'
  assert.equal(matchesAdminTask(record, 'return'), true)
  record.tubeReturned = true; record.state = '已繳回'
  assert.equal(matchesAdminTask(record, 'return'), false)
  assert.equal(matchesAdminTask(record, 'send'), true)
})

test('empty records and already processed labels or tubes do not inflate totals', () => {
  assert.ok(summarizeAdminTasks([]).every(task => task.count === 0))
  assert.equal(matchesAdminTask({ state: '已預約', printAt: '2026-10-02' }, 'labels'), false)
  assert.equal(matchesAdminTask({ state: '已領取', tubeReturned: true }, 'return'), false)
  assert.equal(matchesAdminTask({ state: '已預約' }, 'unknown'), false)
})
