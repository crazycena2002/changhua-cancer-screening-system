import test from 'node:test'
import assert from 'node:assert/strict'
import { canAccess, sectionPermissions } from './accessPolicy.js'

test('權限由機構、角色與功能共同決定', () => {
  const pharmacy = { organizationCode: 'P001', role: '藥局人員', provider: '甲藥局' }
  assert.equal(canAccess(pharmacy, sectionPermissions.tracking), true)
  assert.equal(canAccess(pharmacy, sectionPermissions.labels), false)
  assert.equal(canAccess(pharmacy, 'bowel.pickup', { provider: '甲藥局' }), true)
  assert.equal(canAccess(pharmacy, 'bowel.pickup', { provider: '乙藥局' }), false)
  assert.equal(canAccess(pharmacy, 'booking.export'), false)
  assert.equal(canAccess({ role: '系統管理員' }, 'booking.read'), false)
})
