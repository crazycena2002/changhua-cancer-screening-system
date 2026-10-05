import test from 'node:test'
import assert from 'node:assert/strict'
import { stationEvents, stationSearchOptions, stationSlots } from './stationService.js'

const today = new Date('2026-10-05T12:00:00')
const events = [
  { id: 1, type: '衛生局所設站', date: '2026-10-08', area: '彰化市', start: '08:00', end: '09:00', interval: 30, screenings: ['子宮頸抹片', '乳房攝影'], capacity: 10, capacityByScreening: { 子宮頸抹片: 2, 乳房攝影: 2 }, bookedByScreening: { 子宮頸抹片: 0, 乳房攝影: 2 }, slotCapacityByScreening: { 子宮頸抹片: { '08:00－08:30': { public: 0 } } } },
  { id: 2, type: '衛生局所設站', date: '2026-10-10', area: '鹿港鎮', start: '08:00', end: '09:00', interval: 30, screenings: ['乳房攝影'], capacity: 2, bookedByScreening: { 乳房攝影: 2 } },
  { id: 3, type: '衛生局所設站', date: '2026-11-20', area: '彰化市', start: '08:00', end: '09:00', interval: 30, screenings: ['子宮頸抹片'], capacity: 2 },
]

test('不同篩檢使用各自名額，額滿時段不可選', () => {
  const cervical = stationSlots(events[0], '子宮頸抹片')
  const breast = stationSlots(events[0], '乳房攝影')
  assert.equal(cervical[0].left, 0)
  assert.ok(cervical[1].left > 0)
  assert.ok(breast.every(slot => slot.left === 0))
})

test('近 30 天搜尋選項排除完全無可預約場次的鄉鎮與日期', () => {
  assert.deepEqual(stationEvents(events, '子宮頸抹片', { today }).map(event => event.id), [1])
  assert.deepEqual(stationSearchOptions(events, '乳房攝影', { today }), { areas: [], dates: [] })
  assert.deepEqual(stationSearchOptions(events, '子宮頸抹片', { today }), { areas: ['彰化市'], dates: ['2026-10-08'] })
})
