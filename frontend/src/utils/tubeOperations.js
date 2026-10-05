export const undoReturnWindow = 10 * 60 * 1000
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' })
export const taipeiDay = timestamp => dayFormatter.format(new Date(timestamp))
export function findTubeRecord(records, input) {
  const value = String(input).trim().toUpperCase()
  if (!value) return { error: '請輸入或貼上掃描結果', record: null }
  const matches = records.filter(record => record.barcode === value || record.id === value || record.identity === value)
  if (!matches.length) return { error: '查無符合條件的發管名單，請確認條碼或身分證字號。', record: null }
  if (matches.length > 1) return { error: '此資料有多筆發管紀錄，請使用管件的條碼確認。', record: null }
  return { error: '', record: matches[0] }
}
export function returnError(record) {
  if (record.tubeReturned || ['已繳回', '已送驗'].includes(record.state)) return '此管件已登記繳管，請勿重複登記。'
  if (record.state !== '已領取') return `目前狀態為「${record.state}」，請先核對領管紀錄。`
  return ''
}
export function receiveTube(record, now = Date.now()) {
  const error = returnError(record)
  if (error) return { error, receipt: null }
  const before = { state: record.state, tubeReturned: !!record.tubeReturned, returnedAt: record.returnedAt || '', returnedAtTs: record.returnedAtTs || 0 }
  const receipt = { id: `${record.id}-${now}-${record.returnHistory?.length || 0}`, at: now, undoneAt: 0, before }
  record.returnHistory ||= []
  record.returnHistory.push(receipt)
  Object.assign(record, { state: '已繳回', tubeReturned: true, returnedAt: taipeiDay(now), returnedAtTs: now })
  return { error: '', receipt }
}
export function undoReturnError(record, receipt, now = Date.now()) {
  if (receipt.undoneAt) return '這筆繳管已復原。'
  if (now < receipt.at || now - receipt.at >= undoReturnWindow) return '已超過 10 分鐘可返回期限。'
  if (record.state !== '已繳回' || !record.tubeReturned || record.returnedAtTs !== receipt.at || record.returnHistory?.at(-1)?.id !== receipt.id) return '管件狀態已變更，無法復原這筆繳管。'
  return ''
}
export function undoTubeReturn(record, receipt, now = Date.now()) {
  const error = undoReturnError(record, receipt, now)
  if (error) return error
  Object.assign(record, receipt.before)
  receipt.undoneAt = now
  return ''
}
export function todayReturns(records, now = Date.now()) {
  const day = taipeiDay(now)
  return records.flatMap(record => (record.returnHistory || []).filter(receipt => taipeiDay(receipt.at) === day).map(receipt => ({ record, receipt }))).sort((a, b) => b.receipt.at - a.receipt.at)
}
