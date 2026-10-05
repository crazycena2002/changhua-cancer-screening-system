// 異常提醒獨立於管件生命週期，不覆寫「已接收／已領取」等實際業務狀態。
const DAY = 86400000
const elapsedDays = (date, now) => {
  const start = Date.parse(`${String(date || '').slice(0, 10)}T00:00:00+08:00`)
  return Number.isFinite(start) ? Math.floor((now - start) / DAY) : -1
}

export function tubeFollowUp(record, now = Date.now()) {
  if (record.state === '已接收') {
    const days = elapsedDays(record.receivedAt, now)
    if (days >= 14) return { label: '退管', days, actionable: true }
    if (days >= 7) return { label: '未領取', days, actionable: true }
  }
  if (record.state === '已領取' && !record.tubeReturned) {
    const days = elapsedDays(record.pickedUpAt, now)
    if (days >= 14) return { label: '報廢', days, actionable: true }
    if (days >= 7) return { label: '未繳回', days, actionable: true }
  }
  return null
}
