import { bowelInstitutions } from './bowelScreeningService.js'
import { canRollbackBowelStatus, normalizeTrackingRecord, rollbackBowelStatus, transitionBowelStatus } from './bowelTrackingService.js'
import { canAccess } from '../utils/accessPolicy.js'

const operatorName = actor => actor?.name || actor?.role || 'system'
const centerName = actor => String(actor?.healthCenterName || actor?.institutionName || actor?.organizationName || actor?.institution?.name || '').replace(/（DEMO）$/, '').trim()
const institutionName = record => record.institution || record.provider || ''
const institutionType = record => record.institutionType || record.category || ''
const townshipOf = record => record.township || record.area || ''
const issueDateOf = record => String(record.pickedUpAt || '').slice(0, 10)

export const returnExportHeaders = Object.freeze(['姓名', '身分證', '手機號碼', '預約編號', '發管日期', '發管單位', '發管單位鄉鎮', '繳管狀態', '繳管日期', '匯出時間'])

export function canUseBowelReturns(actor) {
  return ['衛生局承辦', '衛生所承辦'].includes(actor?.role) && canAccess(actor, 'bowel.return')
}

export function isInBowelHealthCenterScope(actor, record, institutions = bowelInstitutions) {
  const township = townshipOf(record)
  if (!township) return false
  if (actor.role === '衛生局承辦') return true
  const ownTownship = actor.township || actor.area || actor.institution?.township
  if (!ownTownship || township !== ownTownship) return false
  const entry = institutions.find(item => item.id === record.institutionId || item.institution === institutionName(record))
  const ownCenter = centerName(actor) || (() => {
    const centers = institutions.filter(item => item.township === ownTownship && item.institutionType === '衛生所')
    return centers.length === 1 ? centers[0].institution : ''
  })()
  const affiliated = record.healthCenterName || entry?.healthCenterContact?.name || (institutionType(record) === '衛生所' ? institutionName(record) : '')
  return !!ownCenter && affiliated === ownCenter && ['衛生所', '藥局'].includes(institutionType(record))
}

export function canAccessBowelReturnRecord(actor, record, institutions = bowelInstitutions) {
  if (!canUseBowelReturns(actor)) return false
  const township = townshipOf(record)
  return isInBowelHealthCenterScope(actor, record, institutions)
    && canAccess({ ...actor, area: actor.area || actor.township || actor.institution?.township }, 'bowel.return', { area: township })
}

export function normalizeReturnRecord(record, reservations = []) {
  const row = normalizeTrackingRecord(record)
  const reservation = reservations.find(item => String(item.id) === String(row.reservationId))
  return {
    ...row,
    institutionName: institutionName(row),
    institutionType: institutionType(row),
    issueDate: issueDateOf(row),
    returnStatus: ['RETURNED', 'SENT_TO_LAB'].includes(row.currentStatus) ? '已繳管' : '未繳管',
    phone: row.phone || reservation?.phone || '',
  }
}

export function queryBowelReturns(records, { actor, filters = {}, reservations = [], institutions = bowelInstitutions } = {}) {
  if (!canUseBowelReturns(actor)) return []
  const identity = String(filters.identity || '').trim().toUpperCase()
  return records.filter(row => canAccessBowelReturnRecord(actor, row, institutions))
    .map(row => normalizeReturnRecord(row, reservations))
    .filter(row => {
      if (!['PICKED_UP', 'RETURNED', 'SENT_TO_LAB'].includes(row.currentStatus)) return false
      if (filters.reservationId && row.bowelReservationId !== filters.reservationId) return false
      if (identity && String(row.identity || '').toUpperCase() !== identity) return false
      if (filters.state && filters.state !== '全部' && row.returnStatus !== filters.state) return false
      if (filters.category && filters.category !== '全部' && row.institutionType !== filters.category) return false
      if (filters.from && row.issueDate < filters.from) return false
      if (filters.to && row.issueDate > filters.to) return false
      return true
    }).sort((a, b) => (a.institutionType === '衛生所' ? 0 : 1) - (b.institutionType === '衛生所' ? 0 : 1)
      || b.issueDate.localeCompare(a.issueDate) || String(a.bowelReservationId).localeCompare(String(b.bowelReservationId)))
}

export function selectableReturnIds(rows, actor, institutions = bowelInstitutions) {
  return rows.filter(row => row.currentStatus === 'PICKED_UP' && canAccessBowelReturnRecord(actor, row, institutions)).map(row => String(row.id))
}

export function parseReturnQrPayload(payload) {
  const input = String(payload || '').trim()
  if (!input || input.length > 500) return null
  let value = input
  if (input.startsWith('{')) {
    try {
      const parsed = JSON.parse(input)
      value = parsed.reservationId || parsed.bowelReservationId || parsed.identityId || parsed.identity || ''
    } catch { return null }
  }
  value = String(value).trim().toUpperCase()
  if (/^\d{12}$/.test(value)) return { type: 'reservationId', value }
  if (/^[A-Z][12]\d{8}$/.test(value)) return { type: 'identity', value }
  return null
}

export function lookupBowelReturn(records, payload, { actor, mode = 'qr', reservations = [], institutions = bowelInstitutions } = {}) {
  const parsed = mode === 'identity' ? (/^[A-Z][12]\d{8}$/.test(String(payload || '').trim().toUpperCase()) ? { type: 'identity', value: String(payload).trim().toUpperCase() } : null) : parseReturnQrPayload(payload)
  if (!parsed) return { record: null, error: mode === 'identity' ? '請輸入完整且有效的身分證字號' : 'QR 內容格式無效，請確認預約編號或身分證資訊' }
  const matches = queryBowelReturns(records, { actor, reservations, institutions }).filter(row => parsed.type === 'reservationId' ? row.bowelReservationId === parsed.value : String(row.identity).toUpperCase() === parsed.value)
  if (!matches.length) return { record: null, error: '權限範圍內找不到此筆領管紀錄' }
  if (matches.length > 1) return { record: null, error: '找到多筆紀錄，請使用預約編號查詢' }
  return { record: matches[0], error: '' }
}

export function processBowelReturnBatch(records, selectedIds, { actor, now = Date.now(), institutions = bowelInstitutions } = {}) {
  const byId = new Map(records.map(record => [String(record.id), record]))
  const updates = []
  const failures = []
  const timestamp = new Date(now).toISOString()
  for (const id of new Set(selectedIds.map(String))) {
    const record = byId.get(id)
    if (!record) { failures.push({ id, reason: '找不到紀錄' }); continue }
    if (!canAccessBowelReturnRecord(actor, record, institutions)) { failures.push({ id, reason: '沒有此筆資料的繳管操作權限' }); continue }
    const current = normalizeTrackingRecord(record)
    if (current.currentStatus !== 'PICKED_UP') { failures.push({ id, reason: '只有已領取且未繳回的採檢管可繳管' }); continue }
    const updated = transitionBowelStatus(current, 'RETURNED', { changedAt: now, changedBy: operatorName(actor) })
    updated.statusHistory.at(-1).action = 'CONFIRM_RETURN'
    const returnHistory = Array.isArray(current.returnHistory) ? current.returnHistory.map(item => ({ ...item })) : []
    returnHistory.push({ id: `${id}-${now}-${returnHistory.length}`, at: now, operator: operatorName(actor), undoneAt: 0,
      before: { state: current.state, tubeReturned: !!current.tubeReturned, returnedAt: current.returnedAt || '', returnedAtTs: current.returnedAtTs || 0 } })
    Object.assign(updated, { returnedAt: timestamp, returnedBy: operatorName(actor), tubeReturned: true, returnedAtTs: now, returnHistory })
    updates.push({ id, record: updated })
  }
  return { updates, failures, successCount: updates.length, failureCount: failures.length }
}

export function canRollbackBowelReturn(record, actor, now = Date.now(), institutions = bowelInstitutions) {
  const current = normalizeTrackingRecord(record)
  const scopeAllowed = actor?.role === '系統管理員' ? canAccess(actor, 'bowel.return', { area: current.township }) : canAccessBowelReturnRecord(actor, current, institutions)
  return scopeAllowed && current.currentStatus === 'RETURNED' && current.previousStatus === 'PICKED_UP'
    && current.statusHistory.at(-1)?.action === 'CONFIRM_RETURN' && canRollbackBowelStatus(current, actor, now)
}

export function rollbackBowelReturn(record, actor, now = Date.now(), institutions = bowelInstitutions) {
  if (!canRollbackBowelReturn(record, actor, now, institutions)) throw new Error('目前沒有權限或已超過可復原期限')
  const updated = rollbackBowelStatus(record, actor, now)
  updated.statusHistory.at(-1).action = 'ROLLBACK_RETURN'
  updated.returnHistory = (record.returnHistory || []).map(item => ({ ...item, undoneAt: !item.undoneAt && item.at === record.changedAt ? now : item.undoneAt }))
  return updated
}

export function returnExportRows(filteredRows, exportedAt = new Date().toISOString()) {
  return filteredRows.map(row => [row.name, row.identity, row.phone, row.bowelReservationId, row.issueDate, row.institutionName, row.township, row.returnStatus, row.returnedAt, exportedAt])
}
