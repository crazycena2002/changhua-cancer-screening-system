const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const dayNames = { monday: '星期一', tuesday: '星期二', wednesday: '星期三', thursday: '星期四', friday: '星期五', saturday: '星期六', sunday: '星期日' }
const dateAfter = days => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const nextWeekday = weekday => {
  const today = new Date()
  let days = (weekday - today.getDay() + 7) % 7
  if (!days) days = 7
  return dateAfter(days)
}
const weekdays = {
  monday: [{ start: '08:30', end: '11:30' }, { start: '13:00', end: '16:30' }],
  tuesday: [{ start: '08:30', end: '11:30' }, { start: '13:00', end: '16:30' }],
  wednesday: [{ start: '08:30', end: '11:30' }, { start: '13:00', end: '16:30' }],
  thursday: [{ start: '08:30', end: '11:30' }, { start: '13:00', end: '16:30' }],
  friday: [{ start: '08:30', end: '11:30' }, { start: '13:00', end: '16:30' }],
  saturday: [], sunday: [],
}

// DEMO institution directory. weeklySchedule is independent of event dates and 30-minute quotas.
export const bowelInstitutions = [
  { id: 'BO-101', institution: '田中鎮衛生所', institutionType: '衛生所', township: '田中鎮', address: '彰化縣田中鎮斗中路一段 222 號', phone: '04-8742053', weeklySchedule: structuredClone(weekdays), specialClosures: [nextWeekday(2)], healthCenterContact: { name: '田中鎮衛生所', phone: '04-8742053' } },
  { id: 'BO-102', institution: '喜喜藥局', institutionType: '藥局', township: '田中鎮', address: '彰化縣田中鎮斗中路一段 201 號', phone: '04-8801111', weeklySchedule: { monday: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '20:30' }], tuesday: [{ start: '09:00', end: '20:30' }], wednesday: [{ start: '09:00', end: '20:30' }], thursday: [{ start: '09:00', end: '20:30' }], friday: [{ start: '09:00', end: '20:30' }], saturday: [{ start: '09:00', end: '17:00' }], sunday: [] }, specialClosures: [nextWeekday(3)], healthCenterContact: { name: '田中鎮衛生所', phone: '04-8742053' } },
  { id: 'BO-103', institution: '彰化市南區衛生所', institutionType: '衛生所', township: '彰化市', address: '彰化縣彰化市旭光路 166 號', phone: '04-7112345', weeklySchedule: { ...structuredClone(weekdays), monday: [{ start: '08:00', end: '12:00' }, { start: '13:00', end: '17:00' }] }, specialClosures: [], healthCenterContact: { name: '彰化市南區衛生所', phone: '04-7112345' } },
  { id: 'BO-104', institution: '安康藥局', institutionType: '藥局', township: '員林市', address: '彰化縣員林市民生路 88 號', phone: '04-8322222', weeklySchedule: { monday: [{ start: '09:00', end: '20:00' }], tuesday: [{ start: '09:00', end: '20:00' }], wednesday: [{ start: '09:00', end: '20:00' }], thursday: [{ start: '09:00', end: '20:00' }], friday: [{ start: '09:00', end: '20:00' }], saturday: [{ start: '09:00', end: '18:00' }], sunday: [{ start: '10:00', end: '14:00' }] }, specialClosures: [], healthCenterContact: { name: '員林市衛生所', phone: '04-8320315' } },
]

export function scheduleRows(institution) {
  return Object.entries(dayNames).map(([day, label]) => ({ day, label, periods: institution.weeklySchedule?.[day] || [] }))
}

export function scheduleSummary(institution) {
  return scheduleRows(institution).filter(row => row.periods.length).map(row => `${row.label} ${row.periods.map(period => `${period.start}－${period.end}`).join('、')}`).join('；')
}

export function isPickupOpenOn(institution, dateString) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || institution.specialClosures?.includes(dateString)) return false
  const date = new Date(`${dateString}T12:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== dateString) return false
  return !!institution.weeklySchedule?.[dayKeys[date.getUTCDay()]]?.length
}

export function upcomingPickupDates(institution, { from = new Date(), days = 30 } = {}) {
  const dates = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let offset = 0; offset <= days; offset++) {
    const value = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    if (isPickupOpenOn(institution, value)) dates.push(value)
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

export function institutionsInTownship(township, institutions = bowelInstitutions) {
  return institutions.filter(item => item.township === township && upcomingPickupDates(item).length > 0)
}

export function availableTownships(townships, institutions = bowelInstitutions) {
  return townships.map(township => ({ township, available: institutionsInTownship(township, institutions).length > 0 }))
}

export async function lookupBowelInstitutions(township) {
  return institutionsInTownship(township)
}
