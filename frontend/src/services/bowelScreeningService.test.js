import test from 'node:test'
import assert from 'node:assert/strict'
import { availableTownships, bowelInstitutions, institutionsInTownship, isPickupOpenOn, scheduleRows, upcomingPickupDates } from './bowelScreeningService.js'
import { qualificationFor } from './qualificationService.js'

test('腸篩資格可獨立進入領管類別，與設站類別分開', () => {
  const result = qualificationFor('A200000067', '1965-01-01', { today: new Date('2026-10-05T12:00:00') })
  assert.equal(result.results.find(item => item.value === '大腸癌篩檢').route, 'bowel')
  assert.equal(result.results.find(item => item.value === '大腸癌篩檢').eligible, true)
  assert.equal(result.results.find(item => item.value === '乳房攝影').route, 'station')
})

test('鄉鎮篩選包含衛生所與藥局，無院所鄉鎮不可選', () => {
  const tanaka = institutionsInTownship('田中鎮')
  assert.deepEqual(new Set(tanaka.map(item => item.institutionType)), new Set(['衛生所', '藥局']))
  assert.deepEqual(institutionsInTownship('鹿港鎮'), [])
  assert.deepEqual(availableTownships(['田中鎮', '鹿港鎮']), [{ township: '田中鎮', available: true }, { township: '鹿港鎮', available: false }])
})

test('每週資料可表示多個時段、單一時段及公休', () => {
  const rows = scheduleRows(bowelInstitutions[0])
  assert.equal(rows.find(row => row.day === 'monday').periods.length, 2)
  assert.equal(scheduleRows(bowelInstitutions[1]).find(row => row.day === 'tuesday').periods.length, 1)
  assert.equal(rows.find(row => row.day === 'sunday').periods.length, 0)
})

test('特殊公休不列入可領管日期', () => {
  const institution = { weeklySchedule: { monday: [{ start: '09:00', end: '12:00' }] }, specialClosures: ['2026-10-05'] }
  assert.equal(isPickupOpenOn(institution, '2026-10-05'), false)
  assert.equal(isPickupOpenOn(institution, '2026-10-12'), true)
  assert.deepEqual(upcomingPickupDates(institution, { from: new Date('2026-10-05T12:00:00'), days: 7 }), ['2026-10-12'])
})
