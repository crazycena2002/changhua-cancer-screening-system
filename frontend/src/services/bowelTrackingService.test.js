import test from 'node:test'
import assert from 'node:assert/strict'
import { bowelStatuses, buildBookedTrackingRecord, canRollbackBowelStatus, derivedBowelFollowUp, generateBowelReservationId, normalizeTrackingRecord, queryBowelTracking, rollbackBowelStatus, trackingExportRows, transitionBowelStatus } from './bowelTrackingService.js'

const now = Date.parse('2026-10-05T12:00:00+08:00')
const bureau = { role: '衛生局承辦', organizationCode: 'BUREAU' }
const center = { role: '衛生所承辦', organizationCode: 'HC-TANAKA', area: '田中鎮' }
const base = { id: '153707020001', reservationId: 'CH-1', name: '甲', identity: 'A200000012', area: '田中鎮', provider: '喜喜藥局', category: '藥局', date: '2026-09-01', state: '已預約', issuedAt: '2026-09-01', tubeReturned: false }

test('主要狀態順序與允許下一狀態固定', () => {
  const states = Object.values(bowelStatuses)
  assert.deepEqual(states.map(item => item.order), [1, 2, 3, 4, 5, 6])
  assert.deepEqual(states.map(item => item.code), ['BOOKED', 'DISPATCHED', 'RECEIVED', 'PICKED_UP', 'RETURNED', 'SENT_TO_LAB'])
  assert.deepEqual(bowelStatuses.RECEIVED.allowedNextStates, ['PICKED_UP'])
  assert.deepEqual(bowelStatuses.SENT_TO_LAB.allowedNextStates, [])
  assert.throws(() => transitionBowelStatus(base, 'PICKED_UP'), /不允許/)
})

test('接收 7/14 天與領取 7/14 天自動產生特殊狀態', () => {
  const dayAgo = days => new Date(now - days * 86400000).toISOString().slice(0, 10)
  assert.equal(derivedBowelFollowUp({ ...base, state: '已接收', receivedAt: dayAgo(7) }, now).code, 'UNCLAIMED')
  assert.equal(derivedBowelFollowUp({ ...base, state: '已接收', receivedAt: dayAgo(14) }, now).code, 'RETURN_TUBE')
  assert.equal(derivedBowelFollowUp({ ...base, state: '已領取', pickedUpAt: dayAgo(7) }, now).code, 'OVERDUE_RETURN')
  assert.equal(derivedBowelFollowUp({ ...base, state: '已領取', pickedUpAt: dayAgo(14) }, now).code, 'DISCARDED')
  assert.equal(derivedBowelFollowUp({ ...base, state: '已繳回', returnedAt: dayAgo(1) }, now), null)
})

test('12 碼民國年、鄉鎮、院所類型、流水碼由 service 產生', () => {
  const at = new Date('2026-10-05T12:00:00+08:00')
  assert.equal(generateBowelReservationId({ township: '田中鎮', institutionType: '藥局', at }), '153707020001')
  assert.equal(generateBowelReservationId({ township: '田中鎮', institutionType: '藥局', existingIds: ['153707020001'], at }), '153707020002')
  assert.equal(generateBowelReservationId({ township: '田中鎮', institutionType: '藥局', institutionId: 'BO-109', at }), '153707090001')
  assert.match(generateBowelReservationId({ township: '彰化市', institutionType: '衛生所', at }), /^\d{12}$/)
  const booked = buildBookedTrackingRecord({ id: 'CH-2', name: '甲', identity: 'A200000012' }, { township: '田中鎮', institutionType: '藥局', institution: '喜喜藥局' }, [base], now)
  assert.equal(booked.bowelReservationId, '153707020002')
  assert.equal(booked.reservationId, 'CH-2')
  assert.equal(booked.currentStatus, 'BOOKED')
  assert.equal(booked.statusHistory[0].currentStatus, 'BOOKED')
})

test('狀態歷程、前一狀態與 10 分鐘復原判斷', () => {
  const dispatched = transitionBowelStatus(base, 'DISPATCHED', { changedAt: now, changedBy: 'demo-staff' })
  assert.equal(dispatched.currentStatus, 'DISPATCHED')
  assert.equal(dispatched.previousStatus, 'BOOKED')
  assert.deepEqual(dispatched.statusHistory.at(-1), { previousStatus: 'BOOKED', currentStatus: 'DISPATCHED', changedAt: now, changedBy: 'demo-staff' })
  assert.equal(canRollbackBowelStatus(dispatched, center, now + 9 * 60000), true)
  assert.equal(canRollbackBowelStatus(dispatched, center, now + 10 * 60000), false)
  assert.equal(canRollbackBowelStatus(dispatched, bureau, now + 10 * 60000), true)
  const received = transitionBowelStatus(dispatched, 'RECEIVED', { changedAt: now + 1000, changedBy: 'demo-center' })
  assert.equal(received.statusHistory.length, 2)
  assert.equal(received.receivedAt, '2026-10-05')
  const restored = rollbackBowelStatus(received, center, now + 2 * 60000)
  assert.equal(restored.currentStatus, 'DISPATCHED')
  assert.equal(restored.receivedAt, '')
  assert.deepEqual(restored.statusHistory.at(-1), { previousStatus: 'RECEIVED', currentStatus: 'DISPATCHED', changedAt: now + 2 * 60000, changedBy: '衛生所承辦' })
  assert.equal(canRollbackBowelStatus(restored, center, now + 3 * 60000), false)
})

test('腸篩動態查詢及匯出使用同一批結果', () => {
  const other = normalizeTrackingRecord({ ...base, id: '153701010001', area: '彰化市', provider: '彰化市衛生所' })
  const received = normalizeTrackingRecord({ ...base, state: '已接收', receivedAt: '2026-09-21' })
  const rows = queryBowelTracking([received, other], { actor: center, now, filters: { month: '2026-09', currentStatus: 'RECEIVED', followUp: 'RETURN_TUBE' } })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].township, '田中鎮')
  assert.equal(rows[0].specialStatus.code, 'RETURN_TUBE')
  assert.equal(trackingExportRows(rows).length, rows.length)
  assert.equal(queryBowelTracking([received, other], { actor: bureau, now }).length, 2)
})
