import test from 'node:test'
import assert from 'node:assert/strict'
import { tubeFollowUp } from './tubeFollowUp.js'

const day = n => `2026-09-${String(30 - n).padStart(2, '0')}`
const now = Date.parse('2026-09-30T12:00:00+08:00')
test('接收後 7／14 天自動產生未領取與退管提醒，生命週期狀態不變', () => {
  const record = { state: '已接收', receivedAt: day(7) }
  assert.equal(tubeFollowUp(record, now).label, '未領取')
  record.receivedAt = day(14)
  assert.equal(tubeFollowUp(record, now).label, '退管')
  assert.equal(record.state, '已接收')
})
test('領取後 7／14 天自動產生未繳回與報廢提醒，繳回後清除', () => {
  const record = { state: '已領取', pickedUpAt: day(7), tubeReturned: false }
  assert.equal(tubeFollowUp(record, now).label, '未繳回')
  record.pickedUpAt = day(14)
  assert.equal(tubeFollowUp(record, now).label, '報廢')
  record.tubeReturned = true
  assert.equal(tubeFollowUp(record, now), null)
})
