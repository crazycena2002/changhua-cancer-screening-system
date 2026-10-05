import test from 'node:test'
import assert from 'node:assert/strict'
import { verifyContactEmail, verifyContactPhone } from './contactVerificationService.js'

test('手機必填且驗證碼正確未過期才可繼續', () => {
  const data = { phone: '0912345678', code: '123456', input: '123456', deadline: 101, now: 100 }
  assert.equal(verifyContactPhone(data).ok, true)
  assert.equal(verifyContactPhone({ ...data, code: '' }).ok, false)
  assert.equal(verifyContactPhone({ ...data, input: '000000' }).ok, false)
  assert.equal(verifyContactPhone({ ...data, now: 102 }).ok, false)
})

test('E-mail 未填可跳過；已填則必須通過同頁驗證', () => {
  const data = { email: 'demo@example.test', issuedTo: 'demo@example.test', code: '654321', input: '654321', deadline: 101, now: 100 }
  assert.equal(verifyContactEmail({ ...data, email: '' }).ok, true)
  assert.equal(verifyContactEmail(data).ok, true)
  assert.equal(verifyContactEmail({ ...data, code: '' }).ok, false)
  assert.equal(verifyContactEmail({ ...data, issuedTo: 'other@example.test' }).ok, false)
  assert.equal(verifyContactEmail({ ...data, now: 102 }).ok, false)
})
