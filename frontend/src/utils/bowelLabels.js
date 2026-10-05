export const labelStorageKey = 'changhua-bowel-labels-demo-v1'
const fields = ['id', 'reservationId', 'barcode', 'name', 'identity', 'area', 'provider', 'category', 'date', 'state', 'printAt', 'issuedAt', 'returnedAt']
export const isLabelCode = value => /^\d{12}$/.test(value)

export function createLabelCode(used = new Set()) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12))
    const code = Array.from(bytes, byte => byte % 10).join('')
    if (!used.has(code)) return code
  }
  throw new Error('條碼產生失敗，請再試一次')
}

export function assignLabelCodes(records) {
  const used = new Set(records.filter(record => isLabelCode(record.barcode)).map(record => record.barcode))
  for (const record of records) {
    if (isLabelCode(record.barcode)) continue
    record.barcode = createLabelCode(used)
    used.add(record.barcode)
  }
}

export function labelSnapshot(records) {
  return { type: 'changhua-bowel-demo-labels', version: 1, exportedAt: new Date().toISOString(), records: records.map(record => ({ ...Object.fromEntries(fields.map(field => [field, String(record[field] || '')])), tubeReturned: !!record.tubeReturned, returnedAtTs: record.returnedAtTs || 0, returnHistory: (record.returnHistory || []).map(receipt => ({ id: receipt.id, at: receipt.at, undoneAt: receipt.undoneAt || 0, before: { state: receipt.before.state, tubeReturned: !!receipt.before.tubeReturned, returnedAt: receipt.before.returnedAt || '', returnedAtTs: receipt.before.returnedAtTs || 0 } })) })) }
}

const validTime = value => Number.isSafeInteger(value) && value >= 0 && value <= 8_640_000_000_000_000
function parseReturnHistory(record) {
  if (record.returnedAtTs !== undefined && !validTime(record.returnedAtTs)) throw new Error('名冊包含無效的繳管時間')
  const history = record.returnHistory || []
  if (!Array.isArray(history) || history.length > 1000) throw new Error('名冊包含無效的繳管紀錄')
  const ids = new Set()
  return history.map(receipt => {
    const before = receipt?.before
    if (!receipt || typeof receipt.id !== 'string' || !receipt.id || receipt.id.length > 300 || ids.has(receipt.id) || !validTime(receipt.at) || !validTime(receipt.undoneAt) || !before || typeof before.state !== 'string' || before.state.length > 200 || typeof before.tubeReturned !== 'boolean' || typeof before.returnedAt !== 'string' || before.returnedAt.length > 200 || !validTime(before.returnedAtTs)) throw new Error('名冊包含無效或重複的繳管紀錄')
    ids.add(receipt.id)
    return { id: receipt.id, at: receipt.at, undoneAt: receipt.undoneAt, before: { state: before.state, tubeReturned: before.tubeReturned, returnedAt: before.returnedAt, returnedAtTs: before.returnedAtTs } }
  })
}

export function parseLabelSnapshot(text) {
  if (text.length > 2_000_000) throw new Error('名冊檔案過大，請使用系統匯出的 DEMO 名冊')
  let data
  try { data = JSON.parse(text) } catch { throw new Error('檔案不是有效的 JSON 名冊') }
  if (data?.type !== 'changhua-bowel-demo-labels' || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 1000) throw new Error('名冊格式不符合，請使用系統匯出的 DEMO 名冊')
  const ids = new Set(), codes = new Set()
  return data.records.map(record => {
    if (!record || fields.some(field => record[field] !== undefined && (typeof record[field] !== 'string' || record[field].length > 200)) || !record.id || !record.name || !record.identity || !record.provider || !record.state || !isLabelCode(record.barcode) || typeof record.tubeReturned !== 'boolean') throw new Error('名冊包含不完整或無效的標籤資料')
    if (ids.has(record.id) || codes.has(record.barcode)) throw new Error('名冊的預約編號或條碼重複，無法匯入')
    ids.add(record.id); codes.add(record.barcode)
    return { ...Object.fromEntries(fields.map(field => [field, record[field] || ''])), tubeReturned: record.tubeReturned, returnedAtTs: record.returnedAtTs || 0, returnHistory: parseReturnHistory(record) }
  })
}

export function readStoredLabels(storage) {
  try { const text = storage.getItem(labelStorageKey); return text ? parseLabelSnapshot(text) : [] } catch { return [] }
}

export function mergeLabelRecords(current, incoming) {
  const records = [...new Map([...current, ...incoming].map(record => [record.id, record])).values()]
  const codes = records.map(record => record.barcode).filter(Boolean)
  if (new Set(codes).size !== codes.length) throw new Error('條碼與現有名冊重複，請重新確認匯入資料')
  return records
}

export function persistLabels(records, storage) {
  try { storage.setItem(labelStorageKey, JSON.stringify(labelSnapshot(records))); return true } catch { return false }
}

export function matchLabel(records, input) {
  const barcode = String(input).trim()
  if (!isLabelCode(barcode)) return { error: '請輸入或掃描標籤下方的 12 碼數字條碼', record: null }
  const matches = records.filter(record => record.barcode === barcode)
  if (matches.length > 1) return { error: '此條碼對應多筆資料，請重新確認名冊', record: null }
  if (!matches.length) return { error: '查無此條碼。若由另一台裝置產生，請先匯入該裝置的 DEMO 名冊', record: null }
  return { error: '', record: matches[0] }
}
