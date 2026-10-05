const stationScreenings = ['子宮頸抹片', '乳房攝影']

export function stationSlots(event, screening, reservations = []) {
  if (!event || !stationScreenings.includes(screening)) return []
  const start = Number(event.start.slice(0, 2)) * 60 + Number(event.start.slice(3))
  const end = Number(event.end.slice(0, 2)) * 60 + Number(event.end.slice(3))
  const step = Number(event.interval || 30)
  const periods = Math.max(1, Math.floor((end - start) / step))
  const quota = event.capacityByScreening?.[screening] ?? event.capacity
  const used = event.bookedByScreening?.[screening] ?? reservations.filter(record => record.eventId === event.id && record.screening === screening && record.status !== '已取消').length
  const configured = event.slotCapacityByScreening?.[screening] || event.slotCapacity || {}
  const format = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  const slots = []
  for (let minute = start; minute + step <= end; minute += step) {
    const label = `${format(minute)}－${format(minute + step)}`
    const assigned = reservations.filter(record => record.eventId === event.id && record.screening === screening && record.slot === label && record.status !== '已取消').length
    const capacity = configured[label]?.public ?? Math.max(1, Math.floor(quota / periods))
    const closed = !!configured[label]?.closed
    slots.push({ label, closed, left: closed ? 0 : Math.max(0, Math.min(capacity - assigned, quota - used)) })
  }
  return slots
}

export function stationEvents(events, screening, { today = new Date(), area = '', date = '', reservations = [], availableOnly = false } = {}) {
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const through = new Date(from); through.setDate(through.getDate() + 30)
  return events.filter(event => {
    if (event.type !== '衛生局所設站' || !event.screenings.includes(screening)) return false
    const eventDate = new Date(`${event.date}T00:00:00`)
    if (eventDate < from || eventDate > through || area && event.area !== area || date && event.date !== date) return false
    return !availableOnly || stationSlots(event, screening, reservations).some(slot => slot.left > 0)
  }).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
}

export function stationSearchOptions(events, screening, options = {}) {
  const available = stationEvents(events, screening, { ...options, area: '', date: '', availableOnly: true })
  return { areas: [...new Set(available.map(event => event.area))], dates: [...new Set(available.map(event => event.date))] }
}
