import test from 'node:test'
import assert from 'node:assert/strict'
import { ageOnDate, demoPeople, isValidIdentity, verifyDemoEligibility } from './demoEligibility.js'

const today = new Date(2026, 9, 2)
test('只有身分資料有效、年齡符合且未做過該項目才能通過', () => {
  for (const screening of ['子宮頸抹片', '乳房攝影', '大腸癌篩檢']) {
    assert.equal(verifyDemoEligibility(demoPeople[0].identity, screening, { today }).eligible, true)
    assert.equal(verifyDemoEligibility(demoPeople[1].identity, screening, { today }).reason, 'completed')
    assert.equal(verifyDemoEligibility(demoPeople[2].identity, screening, { today }).reason, 'age')
  }
})
test('格式、檢查碼及名冊比對都必須通過，可接受小寫與前後空白', () => {
  for (const identity of ['', '1234567890', 'A200000013', 'A300000012', 'A123456789']) {
    assert.equal(verifyDemoEligibility(identity, '乳房攝影', { today }).eligible, false)
  }
  assert.equal(isValidIdentity('A123456789'), true) // 有效格式但未在模擬名冊
  assert.equal(verifyDemoEligibility(' a200000012 ', '乳房攝影', { today }).eligible, true)
})
test('門檻依實歲計算，生日當天通過，前一天不通過', () => {
  for (const [screening, age] of [['子宮頸抹片', 30], ['乳房攝影', 40], ['大腸癌篩檢', 45]]) {
    const person = { ...demoPeople[0], birth: `${2026-age}-10-02` }
    assert.equal(verifyDemoEligibility(person.identity, screening, { today, people: [person] }).eligible, true)
    assert.equal(verifyDemoEligibility(person.identity, screening, { today: new Date(2026, 9, 1), people: [person] }).reason, 'age')
  }
  assert.equal(ageOnDate('2000-02-30', today), null)
  assert.equal(ageOnDate('2030-01-01', today), null)
})
test('只檢查所選項目的已篩檢紀錄，缺少或錯誤資料不可通過', () => {
  const person = { ...demoPeople[0], completedScreenings: ['乳房攝影'] }
  assert.equal(verifyDemoEligibility(person.identity, '子宮頸抹片', { today, people: [person] }).eligible, true)
  assert.equal(verifyDemoEligibility(person.identity, '乳房攝影', { today, people: [person] }).reason, 'completed')
  assert.equal(verifyDemoEligibility(person.identity, '', { today }).eligible, false)
  for (const invalid of [{ ...person, birth: '' }, { ...person, completedScreenings: undefined }]) {
    assert.equal(verifyDemoEligibility(person.identity, '子宮頸抹片', { today, people: [invalid] }).eligible, false)
  }
})
