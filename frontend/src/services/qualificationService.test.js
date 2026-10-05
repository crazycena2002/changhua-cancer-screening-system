import test from 'node:test'
import assert from 'node:assert/strict'
import { qualificationFor, qualificationReasons, updateScreeningSelection } from './qualificationService.js'

const today = new Date('2026-10-05T12:00:00')
const lookup = (identity, birth = '1965-01-01', reservations = []) => qualificationFor(identity, birth, { today, reservations })
const eligible = result => result.results.filter(item => item.eligible).map(item => item.value)

test('DEMO 資格涵蓋單一子抹、單一乳攝、雙項、腸篩與無資格', () => {
  assert.deepEqual(eligible(lookup('A200000003', '1970-03-01')), ['子宮頸抹片'])
  assert.deepEqual(eligible(lookup('A200000058', '1970-03-01')), ['乳房攝影'])
  assert.deepEqual(eligible(lookup('A200000012')), ['子宮頸抹片', '乳房攝影', '大腸癌篩檢'])
  assert.deepEqual(eligible(lookup('A200000067')), ['大腸癌篩檢'])
  assert.deepEqual(eligible(lookup('A200000021')), [])
})

test('身分證與出生日期須相符；已預約項目不可重複進入', () => {
  assert.equal(lookup('A200000012', '2000-01-01').ok, false)
  assert.equal(lookup('A200000099').ok, false)
  const result = lookup('A200000012', '1965-01-01', [{ identity: 'A200000012', screening: '乳房攝影', status: '已預約' }])
  assert.equal(result.results.find(item => item.value === '乳房攝影').reason, 'booked')
  assert.equal(result.results.find(item => item.value === '子宮頸抹片').eligible, true)
})

test('縣民帶入名冊資料，非縣民資料來源標示為自行填寫', () => {
  assert.equal(lookup('A200000003', '1970-03-01').basicProfile.source, 'registry')
  const nonresident = lookup('A200000076')
  assert.equal(nonresident.basicProfile.source, 'self')
  assert.equal(nonresident.basicProfile.name, '')
  assert.equal(nonresident.basicProfile.householdDetail, '')
})

test('資格卡片提供集中原因碼、可預約狀態與多選防呆', () => {
  const age = qualificationFor('A200000030', '2008-01-01', { today, people: [{ identity: 'A200000030', birth: '2008-01-01', completedScreenings: [] }] })
  assert.equal(age.results[0].reasonCode, 'AGE_NOT_ELIGIBLE')
  assert.equal(age.results[0].reasonMessage, qualificationReasons.AGE_NOT_ELIGIBLE)
  assert.equal(age.results[0].canBook, false)
  const recent = lookup('A200000003', '1970-03-01').results.find(item => item.value === '乳房攝影')
  assert.equal(recent.reasonCode, 'RECENTLY_SCREENED')
  assert.match(recent.reasonMessage, /近期已完成/)
  const booked = lookup('A200000012', '1965-01-01', [{ identity: 'A200000012', screening: '乳房攝影', status: '已預約' }]).results[1]
  assert.equal(booked.reasonCode, 'ALREADY_BOOKED')
  const unavailable = qualificationFor('A200000012', '1965-01-01', { today, availableScreenings: ['子宮頸抹片'] }).results.find(item => item.value === '大腸癌篩檢')
  assert.equal(unavailable.reasonCode, 'NO_AVAILABLE_PROGRAM')
  const exceeded = qualificationFor('A200000012', '1965-01-01', { today, maximumAges: { 乳房攝影: 50 } }).results[1]
  assert.equal(exceeded.reasonCode, 'AGE_EXCEEDED')
  const excluded = qualificationFor('A200000012', '1965-01-01', { today, people: [{ identity: 'A200000012', birth: '1965-01-01', completedScreenings: [], excludedScreenings: ['乳房攝影'] }] }).results[1]
  assert.equal(excluded.reasonCode, 'NOT_IN_ELIGIBLE_GROUP')
  let selected = updateScreeningSelection([], '子宮頸抹片', true)
  selected = updateScreeningSelection(selected, '乳房攝影', true)
  assert.deepEqual(selected, ['子宮頸抹片', '乳房攝影'])
  assert.deepEqual(updateScreeningSelection(selected, '大腸癌篩檢', false), selected)
  assert.deepEqual(updateScreeningSelection(selected, '子宮頸抹片', true), ['乳房攝影'])
})
