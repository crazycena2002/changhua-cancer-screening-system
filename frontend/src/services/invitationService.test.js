import test from 'node:test'
import assert from 'node:assert/strict'
import { eventWeekday, verifyInvitationCode } from './invitationService.js'

test('邀約碼格式、名冊查詢與帶入資料由 service 處理', async () => {
  assert.match((await verifyInvitationCode('3701')).error, /10 碼/)
  assert.equal((await verifyInvitationCode('1234567890')).ok, false)
  const result = await verifyInvitationCode('3701 000012')
  assert.equal(result.ok, true)
  assert.equal(result.invitation.identity, 'A200000012')
  assert.equal(result.invitation.name, '測試民眾甲')
})

test('活動日期顯示台灣慣用星期', () => {
  assert.equal(eventWeekday('2026-10-05'), '星期一')
})
