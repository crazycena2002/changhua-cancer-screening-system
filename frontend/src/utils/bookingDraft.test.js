import test from 'node:test'
import assert from 'node:assert/strict'
import { createBookingDraft } from './bookingDraft.js'

test('整篩草稿保存約定欄位，且活動與資格陣列採快照', () => {
  const selectedEvent = { id: 2, date: '2026-10-12', location: '員林市衛生所', address: '測試地址', start: '09:00', end: '12:00', screenings: ['子宮頸抹片'] }
  const draft = createBookingDraft({ reservationType: 'integrated', invitationCode: '3701000012', selectedEvent, selectedTimeSlot: '09:00－09:15', phone: '0912345678', basicProfile: { identity: 'A200000012', name: '測試民眾甲' }, additionalScreening: { decision: 'requested', eligible: ['乳房攝影'] }, email: '' })
  assert.deepEqual(Object.keys(draft), ['reservationType', 'invitationCode', 'selectedEvent', 'selectedTimeSlot', 'phone', 'basicProfile', 'qualificationResult', 'additionalScreening', 'email'])
  selectedEvent.screenings.push('乳房攝影')
  assert.deepEqual(draft.selectedEvent.screenings, ['子宮頸抹片'])
  assert.equal(draft.additionalScreening.decision, 'requested')
})

test('設站草稿保存兩項不同場次與時段及加選意願', () => {
  const selected = [{ screening: '乳房攝影', eventId: 3, timeSlot: '10:00－10:30' }]
  const draft = createBookingDraft({
    reservationType: 'station', selectedEvent: { id: 1, date: '2026-10-08', location: '彰化市南區衛生所', screenings: ['子宮頸抹片', '乳房攝影'] },
    selectedTimeSlot: '08:00－08:30', phone: '0912345678', basicProfile: { source: 'registry', identity: 'A200000012' },
    qualificationResult: [{ value: '乳房攝影', eligible: true }],
    additionalScreening: { decision: 'requested', eligible: ['乳房攝影'], selected }, email: '',
  })
  selected[0].timeSlot = '11:00－11:30'
  assert.equal(draft.selectedTimeSlot, '08:00－08:30')
  assert.deepEqual(draft.additionalScreening.selected, [{ screening: '乳房攝影', eventId: 3, timeSlot: '10:00－10:30' }])
  assert.equal(draft.basicProfile.source, 'registry')
})

test('腸篩草稿保存領管院所與每週時間，且不要求設站時段', () => {
  const weeklySchedule = { monday: [{ start: '08:30', end: '11:30' }, { start: '13:00', end: '16:30' }], sunday: [] }
  const draft = createBookingDraft({
    reservationType: 'bowel', phone: '0912345678', basicProfile: { source: 'registry', identity: 'A200000067' },
    qualificationResult: [{ value: '大腸癌篩檢', eligible: true }],
    additionalScreening: { decision: 'none', eligible: [], selected: [] },
    bowelScreening: { screeningType: '糞便潛血檢查', township: '田中鎮', institution: '田中鎮衛生所', institutionType: '衛生所', weeklySchedule, specialClosures: ['2026-10-13'], selectedInstitution: { id: 'BO-101', address: '測試路 1 號', phone: '04-1234567' } }, email: '',
  })
  weeklySchedule.monday[0].start = '10:00'
  assert.equal(draft.bowelScreening.weeklySchedule.monday[0].start, '08:30')
  assert.equal(draft.bowelScreening.selectedInstitution.id, 'BO-101')
  assert.equal('selectedTimeSlot' in draft, false)
  assert.equal(draft.selectedEvent, null)
})

test('多選項目與邀約資料修改分別保存快照', () => {
  const invitation = { identity: 'A200000012', birth: '1965-01-01', name: '原始姓名', householdDetail: '原始地址' }
  const profile = { ...invitation, name: '修正姓名', householdDetail: '修正地址' }
  const selectedScreenings = ['cervical', 'mammography', 'bowel']
  const draft = createBookingDraft({ reservationType: 'integrated', basicProfile: profile, selectedScreenings, additionalScreening: { selected: [{ screening: '大腸癌篩檢', institutionId: 'BO-101' }] } })
  profile.name = '之後變更'
  selectedScreenings.pop()
  assert.equal(draft.basicProfile.name, '修正姓名')
  assert.equal(invitation.name, '原始姓名')
  assert.deepEqual(draft.selectedScreenings, ['cervical', 'mammography', 'bowel'])
})
