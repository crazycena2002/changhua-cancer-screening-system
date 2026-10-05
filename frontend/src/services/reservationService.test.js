import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeReservation, queryReservations, reservationExportRows, reservationTimeDetail } from './reservationService.js'
import { canAccess } from '../utils/accessPolicy.js'

const events = [
  { id: 1, type: '整合式篩檢', date: '2026-10-10', location: '彰化市衛生所', area: '彰化市', address: '彰化路 1 號' },
  { id: 2, type: '衛生局所設站', date: '2026-10-11', location: '田中鎮衛生所', area: '田中鎮', address: '田中路 2 號' },
]
const institutions = [{ id: 'BO-102', institution: '喜喜藥局', institutionType: '藥局', township: '田中鎮', address: '田中路 3 號', weeklySchedule: { monday: [{ start: '09:00', end: '20:30' }] } }]
const records = [
  { id: 'I-1', program: 'integrated', eventId: 1, screening: '整合式篩檢', name: '甲', identity: 'A1', birth: '1965-01-01', phone: '0911000001', address: '彰化市地址', slot: '08:00－08:15', source: '自行預約', status: '已預約' },
  { id: 'S-1', program: 'station', eventId: 2, screening: '乳房攝影', name: '乙', identity: 'A2', birth: '1965-01-01', phone: '0911000002', address: '田中鎮地址', slot: '09:00－09:30', source: '輸入預約', status: '已預約' },
  { id: 'B-1', program: 'bowel', institutionId: 'BO-102', screening: '大腸癌篩檢', name: '丙', identity: 'A3', birth: '1965-01-01', phone: '0911000003', address: '田中鎮地址', createdAt: '2026-10-12', pickupSchedule: '星期一 09:00－20:30', source: '自行預約', status: '已預約', slot: '' },
]
const bureau = { role: '衛生局承辦', organizationCode: 'BUREAU' }
const center = { role: '衛生所承辦', organizationCode: 'HC-TANAKA', area: '田中鎮' }
const options = { events, institutions }

test('衛生局可查全區三類預約；衛生所只查所轄鄉鎮', () => {
  assert.deepEqual(queryReservations(records, { ...options, actor: bureau }).map(row => row.reservationId).sort(), ['B-1', 'I-1', 'S-1'])
  assert.deepEqual(queryReservations(records, { ...options, actor: center }).map(row => row.reservationId).sort(), ['B-1', 'S-1'])
  assert.equal(canAccess(center, 'booking.export'), true)
  const noScope = { role: '衛生所承辦', organizationCode: 'HC-UNKNOWN' }
  assert.deepEqual(queryReservations(records, { ...options, actor: noScope }), [])
})

test('預約來源與篩選後匯出一致', () => {
  const filtered = queryReservations(records, { ...options, actor: bureau, filters: { township: '田中鎮', source: 'public' } })
  assert.deepEqual(filtered.map(row => row.reservationId), ['B-1'])
  const exported = reservationExportRows(filtered)
  assert.equal(exported.length, filtered.length)
  assert.equal(exported[0][0], filtered[0].identityId)
  assert.equal(exported[0][9], '自行預約')
  assert.deepEqual(queryReservations(records, { ...options, actor: bureau, filters: { source: 'staff' } }).map(row => row.reservationId), ['S-1'])
})

test('腸篩以領管資訊表示，沒有一般時段', () => {
  const row = normalizeReservation(records[2], options)
  assert.equal(row.timeSlot, null)
  assert.equal(row.institutionName, '喜喜藥局')
  assert.equal(row.institutionType, '藥局')
  assert.match(reservationTimeDetail(row), /領管院所：喜喜藥局/)
  assert.doesNotMatch(reservationTimeDetail(row), /08:30－09:00/)
  assert.equal(normalizeReservation(records[0], options).program, 'integrated')
  assert.equal(normalizeReservation(records[1], options).timeSlot, '09:00－09:30')
})
