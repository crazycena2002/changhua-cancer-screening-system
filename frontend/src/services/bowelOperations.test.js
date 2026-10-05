import test from 'node:test'
import assert from 'node:assert/strict'
import { canOperateBowelStep, canRollbackBowelStep, confirmBowelStep, derivedBowelFollowUp, rollbackBowelStep, transitionBowelStatus } from './bowelTrackingService.js'

const now = Date.parse('2026-10-05T12:00:00+08:00')
const bureau = { organizationCode: 'BUREAU', role: '衛生局承辦', name: '局端甲' }
const center = { organizationCode: 'HC-TANAKA', role: '衛生所承辦', name: '所端乙', area: '田中鎮' }
const pharmacy = { organizationCode: 'PHARMACY-1', role: '藥局人員', name: '藥局丙', area: '田中鎮', provider: '喜喜藥局' }
const base = (state = '已派送', overrides = {}) => ({ id: '153707020001', bowelReservationId: '153707020001', name: '測試民眾', identity: 'N123456789', area: '田中鎮', provider: '喜喜藥局', category: '藥局', date: '2026-09-01', printAt: '2026-09-02', state, statusHistory: [], ...overrides })

test('DISPATCHED 確認接收會記錄時間、操作者與狀態歷程', () => {
  const received = confirmBowelStep(base(), 'RECEIVED', { actor: center, at: now })
  assert.equal(received.currentStatus, 'RECEIVED')
  assert.equal(received.receivedAt, new Date(now).toISOString())
  assert.equal(received.receivedBy, '所端乙')
  assert.equal(received.statusUpdatedAt, received.receivedAt)
  assert.deepEqual(received.statusHistory.at(-1), { previousStatus: 'DISPATCHED', currentStatus: 'RECEIVED', changedAt: now, changedBy: '所端乙', action: 'CONFIRM_RECEIVED' })
})

test('RECEIVED 領管需要核對後四碼，更新 pickedUpAt 並移除未領取提醒', () => {
  const receivedAt = Date.parse('2026-09-27T09:00:00+08:00')
  const received = confirmBowelStep(base(), 'RECEIVED', { actor: pharmacy, at: receivedAt })
  assert.equal(derivedBowelFollowUp(received, now).code, 'UNCLAIMED')
  assert.throws(() => confirmBowelStep(received, 'PICKED_UP', { actor: pharmacy, identitySuffix: '0000', at: now }), /後四碼不符/)
  const pickedUp = confirmBowelStep(received, 'PICKED_UP', { actor: pharmacy, identitySuffix: '6789', at: now })
  assert.equal(pickedUp.currentStatus, 'PICKED_UP')
  assert.equal(pickedUp.pickedUpAt, new Date(now).toISOString())
  assert.equal(pickedUp.pickedUpBy, '藥局丙')
  assert.equal(pickedUp.statusUpdatedAt, pickedUp.pickedUpAt)
  assert.equal(pickedUp.statusHistory.at(-1).action, 'CONFIRM_PICKUP')
  assert.equal(pickedUp.statusHistory.at(-1).previousStatus, 'RECEIVED')
  assert.equal(derivedBowelFollowUp(pickedUp, now), null)
})

test('allowedNextStates 拒絕 BOOKED、DISPATCHED、RECEIVED 的跳級操作', () => {
  assert.throws(() => transitionBowelStatus(base('已預約'), 'RECEIVED'), /不允許/)
  assert.throws(() => transitionBowelStatus(base('已預約'), 'PICKED_UP'), /不允許/)
  assert.throws(() => transitionBowelStatus(base(), 'PICKED_UP'), /不允許/)
  assert.throws(() => transitionBowelStatus(base('已接收'), 'RETURNED'), /不允許/)
  assert.throws(() => confirmBowelStep(base('已預約'), 'RECEIVED', { actor: bureau, at: now }), /只有已派送/)
  assert.throws(() => confirmBowelStep(base(), 'PICKED_UP', { actor: bureau, identitySuffix: '6789', at: now }), /只有已接收/)
})

test('追蹤天數只從 receivedAt 或 pickedUpAt 起算，不用預約日或列印日', () => {
  const old = base('已接收', { date: '2026-08-01', printAt: '2026-08-02' })
  assert.equal(derivedBowelFollowUp(old, now), null)
  assert.equal(derivedBowelFollowUp({ ...old, receivedAt: '2026-09-28T09:00:00+08:00' }, now).code, 'UNCLAIMED')
  assert.equal(derivedBowelFollowUp({ ...old, receivedAt: '2026-09-21T09:00:00+08:00' }, now).code, 'RETURN_TUBE')
  const pickedUp = base('已領取', { date: '2026-08-01', printAt: '2026-08-02', receivedAt: '2026-08-03T09:00:00+08:00' })
  assert.equal(derivedBowelFollowUp(pickedUp, now), null)
  assert.equal(derivedBowelFollowUp({ ...pickedUp, pickedUpAt: '2026-09-28T09:00:00+08:00' }, now).code, 'OVERDUE_RETURN')
  assert.equal(derivedBowelFollowUp({ ...pickedUp, pickedUpAt: '2026-09-21T09:00:00+08:00' }, now).code, 'DISCARDED')
})

test('服務層依角色、鄉鎮與院所拒絕越權接收或領管', () => {
  assert.equal(canOperateBowelStep(base(), 'RECEIVED', bureau).allowed, true)
  assert.equal(canOperateBowelStep(base(), 'RECEIVED', center).allowed, true)
  assert.equal(canOperateBowelStep(base(), 'RECEIVED', pharmacy).allowed, true)
  assert.equal(canOperateBowelStep(base(), 'RECEIVED', { ...center, area: '彰化市' }).allowed, false)
  assert.equal(canOperateBowelStep(base(), 'RECEIVED', { ...pharmacy, provider: '別家藥局' }).allowed, false)
  assert.equal(canOperateBowelStep(base(), 'RECEIVED', { organizationCode: 'USER', role: '一般使用者' }).allowed, false)
  assert.throws(() => confirmBowelStep(base(), 'RECEIVED', { actor: { ...pharmacy, provider: '別家藥局' }, at: now }), /只能操作自己院所/)
})

test('接收及領管可依 10 分鐘規則復原，並清除對應時間與操作者', () => {
  const received = confirmBowelStep(base(), 'RECEIVED', { actor: center, at: now })
  assert.equal(canRollbackBowelStep(received, center, now + 9 * 60000), true)
  assert.equal(canRollbackBowelStep(received, center, now + 10 * 60000), false)
  assert.equal(canRollbackBowelStep(received, bureau, now + 10 * 60000), true)
  assert.equal(canRollbackBowelStep(received, { ...center, area: '彰化市' }, now + 60000), false)
  assert.throws(() => rollbackBowelStep(received, center, now + 10 * 60000), /期限/)
  const returnedToDispatched = rollbackBowelStep(received, center, now + 60000)
  assert.equal(returnedToDispatched.currentStatus, 'DISPATCHED')
  assert.equal(returnedToDispatched.receivedAt, '')
  assert.equal(returnedToDispatched.receivedBy, '')
  assert.equal(returnedToDispatched.statusHistory.at(-1).currentStatus, 'DISPATCHED')
  const pickedUp = confirmBowelStep(received, 'PICKED_UP', { actor: center, identitySuffix: '6789', at: now + 120000 })
  const returnedToReceived = rollbackBowelStep(pickedUp, center, now + 180000)
  assert.equal(returnedToReceived.currentStatus, 'RECEIVED')
  assert.equal(returnedToReceived.pickedUpAt, '')
  assert.equal(returnedToReceived.pickedUpBy, '')
  assert.equal(returnedToReceived.receivedAt, received.receivedAt)
})
