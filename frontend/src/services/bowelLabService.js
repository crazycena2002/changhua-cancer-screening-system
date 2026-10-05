import { bowelInstitutions } from './bowelScreeningService.js'
import { isInBowelHealthCenterScope } from './bowelReturnService.js'
import { bowelStatuses, canRollbackBowelStatus, normalizeTrackingRecord, rollbackBowelStatus, transitionBowelStatus } from './bowelTrackingService.js'
import { canAccess } from '../utils/accessPolicy.js'

const operatorName = actor => actor?.name || actor?.role || 'system'
const datePart = value => String(value || '').slice(0, 10)

export const labExportHeaders = Object.freeze(['預約編號', '姓名', '身分證', '鄉鎮', '院所', '發管日期', '繳管日期', '送驗日期', '目前狀態', '匯出時間'])

export function canUseBowelLab(actor) {
  return ['衛生局承辦', '衛生所承辦'].includes(actor?.role) && canAccess(actor, 'bowel.sendToLab')
}

export function canAccessBowelLabRecord(actor, record, institutions = bowelInstitutions) {
  if (!canUseBowelLab(actor) || !isInBowelHealthCenterScope(actor, record, institutions)) return false
  const township = record.township || record.area || ''
  const scopedActor = { ...actor, area: actor.area || actor.township || actor.institution?.township }
  return canAccess(scopedActor, 'bowel.sendToLab', { area: township })
}

export function normalizeLabRecord(record) {
  const row = normalizeTrackingRecord(record)
  return {
    ...row,
    institutionName: row.institution || row.provider || '',
    issueDate: datePart(row.pickedUpAt),
    returnedDate: datePart(row.returnedAt),
    sentToLabDate: datePart(row.sentToLabAt),
  }
}

export function queryBowelLabRecords(records, { actor, filters = {}, institutions = bowelInstitutions } = {}) {
  if (!canUseBowelLab(actor)) return []
  const identity = String(filters.identity || '').trim().toUpperCase()
  const reservationId = String(filters.reservationId || '').trim()
  return records.filter(row => canAccessBowelLabRecord(actor, row, institutions)).map(normalizeLabRecord)
    .filter(row => {
      if (!['RETURNED', 'SENT_TO_LAB'].includes(row.currentStatus)) return false
      if (filters.township && filters.township !== '全部' && row.township !== filters.township) return false
      if (filters.institution && filters.institution !== '全部' && row.institutionName !== filters.institution) return false
      if (filters.returnFrom && row.returnedDate < filters.returnFrom) return false
      if (filters.returnTo && row.returnedDate > filters.returnTo) return false
      if (identity && String(row.identity || '').toUpperCase() !== identity) return false
      if (reservationId && row.bowelReservationId !== reservationId) return false
      if (filters.currentStatus && filters.currentStatus !== '全部' && row.currentStatus !== filters.currentStatus) return false
      return true
    }).sort((a, b) => b.returnedDate.localeCompare(a.returnedDate) || String(a.bowelReservationId).localeCompare(String(b.bowelReservationId)))
}

export function selectableLabIds(rows, actor, institutions = bowelInstitutions) {
  return rows.filter(row => row.currentStatus === 'RETURNED' && canAccessBowelLabRecord(actor, row, institutions)).map(row => String(row.id))
}

export function processBowelLabBatch(records, selectedIds, { actor, now = Date.now(), institutions = bowelInstitutions } = {}) {
  const byId = new Map(records.map(record => [String(record.id), record]))
  const updates = []
  const failures = []
  const timestamp = new Date(now).toISOString()
  for (const id of new Set(selectedIds.map(String))) {
    const record = byId.get(id)
    if (!record) { failures.push({ id, reason: '找不到紀錄' }); continue }
    if (!canAccessBowelLabRecord(actor, record, institutions)) { failures.push({ id, reason: '沒有此筆資料的送驗操作權限' }); continue }
    const current = normalizeTrackingRecord(record)
    if (current.currentStatus !== 'RETURNED') { failures.push({ id, reason: '只有已繳回的檢體可確認送驗' }); continue }
    const updated = transitionBowelStatus(current, 'SENT_TO_LAB', { changedAt: now, changedBy: operatorName(actor) })
    updated.statusHistory.at(-1).action = 'CONFIRM_SENT_TO_LAB'
    updated.statusHistory.at(-1).reason = '衛生所收回檢體，確認送驗'
    updated.sentToLabAt = timestamp
    updated.sentToLabBy = operatorName(actor)
    updates.push({ id, record: updated })
  }
  return { updates, failures, successCount: updates.length, failureCount: failures.length }
}

export function canRollbackBowelLab(record, actor, now = Date.now(), institutions = bowelInstitutions) {
  const current = normalizeTrackingRecord(record)
  const scopeAllowed = actor?.role === '系統管理員' ? canAccess(actor, 'bowel.sendToLab', { area: current.township }) : canAccessBowelLabRecord(actor, current, institutions)
  return scopeAllowed && current.currentStatus === 'SENT_TO_LAB' && current.previousStatus === 'RETURNED'
    && current.statusHistory.at(-1)?.action === 'CONFIRM_SENT_TO_LAB' && canRollbackBowelStatus(current, actor, now)
}

export function rollbackBowelLab(record, actor, now = Date.now(), institutions = bowelInstitutions) {
  if (!canRollbackBowelLab(record, actor, now, institutions)) throw new Error('目前沒有權限或已超過可復原期限')
  const updated = rollbackBowelStatus(record, actor, now)
  updated.statusHistory.at(-1).action = 'ROLLBACK_SENT_TO_LAB'
  return updated
}

export function labExportRows(filteredRows, exportedAt = new Date().toISOString()) {
  return filteredRows.map(row => [row.bowelReservationId, row.name, row.identity, row.township, row.institutionName, row.issueDate, row.returnedDate, row.sentToLabDate, bowelStatuses[row.currentStatus]?.label || '', exportedAt])
}
