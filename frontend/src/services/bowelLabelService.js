import { bowelInstitutions } from './bowelScreeningService.js'
import { bowelStatuses, normalizeTrackingRecord, transitionBowelStatus } from './bowelTrackingService.js'
import { canAccess } from '../utils/accessPolicy.js'
import { createLabelCode, isLabelCode } from '../utils/bowelLabels.js'
import { taipeiDay } from '../utils/tubeOperations.js'

export const labelPrintStatuses = Object.freeze({
  UNPRINTED: '尚未列印',
  PRINTED: '完成列印',
})

export const labelExportHeaders = Object.freeze(['預約編號', '姓名', '身分證', '預約日期', '衛生所／藥局名稱', '鄉鎮', '列印狀態', '列印時間'])

const operatorName = actor => actor?.name || actor?.role || 'system'
const centerName = actor => String(actor?.healthCenterName || actor?.institutionName || actor?.organizationName || actor?.institution?.name || '').replace(/（DEMO）$/, '').trim()
const townshipOf = record => record.township || record.area || ''
const institutionOf = record => record.institution || record.provider || ''
const typeOf = record => record.institutionType || record.category || ''

export function normalizeLabelRecord(record) {
  const normalized = normalizeTrackingRecord(record)
  const printedAt = record.printedAt || record.printAt || ''
  return {
    ...normalized,
    institutionType: typeOf(record),
    printStatus: printedAt || record.printStatus === 'PRINTED' ? 'PRINTED' : 'UNPRINTED',
    printedAt,
    printedBy: record.printedBy || '',
    reprintedAt: record.reprintedAt || '',
    reprintCount: Number(record.reprintCount || 0),
    printHistory: Array.isArray(record.printHistory) ? record.printHistory.map(item => ({ ...item })) : [],
  }
}

export function canUseBowelLabels(actor) {
  return ['衛生局承辦', '衛生所承辦'].includes(actor?.role) && canAccess(actor, 'bowel.label')
}

export function canAccessLabelRecord(actor, record, institutions = bowelInstitutions) {
  if (!canUseBowelLabels(actor)) return false
  const township = townshipOf(record)
  if (!township || !canAccess(actor, 'bowel.label', { area: township })) return false
  if (actor.role === '衛生局承辦') return true
  const actorTownship = actor.township || actor.area || actor.institution?.township
  if (!actorTownship || township !== actorTownship) return false
  const name = institutionOf(record)
  const directoryEntry = institutions.find(item => item.id === record.institutionId || item.institution === name)
  const affiliatedCenter = record.healthCenterName || directoryEntry?.healthCenterContact?.name || (typeOf(record) === '衛生所' ? name : '')
  const ownCenter = centerName(actor) || (() => {
    const centers = institutions.filter(item => item.township === actorTownship && item.institutionType === '衛生所')
    return centers.length === 1 ? centers[0].institution : ''
  })()
  return !!ownCenter && affiliatedCenter === ownCenter && ['衛生所', '藥局'].includes(typeOf(record))
}

export function labelActionReason(record, action) {
  const row = normalizeLabelRecord(record)
  if (action === 'PRINT') {
    if (row.currentStatus === 'BOOKED' && row.printStatus === 'UNPRINTED') return ''
    if (row.currentStatus === 'DISPATCHED' && row.printStatus === 'PRINTED') return ''
    return '只有已預約且未列印可首次列印，或已派送且完成列印可補印'
  }
  if (action === 'CANCEL_PRINT') {
    return row.currentStatus === 'DISPATCHED' && row.printStatus === 'PRINTED' ? '' : '只有已派送且完成列印的紀錄可取消列印'
  }
  return '不支援此標籤操作'
}

export function queryLabelRecords(records, { actor, filters = {}, institutions = bowelInstitutions } = {}) {
  if (!canUseBowelLabels(actor)) return []
  return records.filter(record => canAccessLabelRecord(actor, record, institutions)).map(normalizeLabelRecord).filter(record => {
    if (filters.category && filters.category !== '全部' && record.institutionType !== filters.category) return false
    if (filters.printStatus && filters.printStatus !== '全部' && record.printStatus !== filters.printStatus) return false
    return filters.printStatus !== 'UNPRINTED' || record.currentStatus === 'BOOKED'
  }).sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.bowelReservationId).localeCompare(String(b.bowelReservationId)))
}

export function selectableLabelIds(records, action, actor, institutions = bowelInstitutions) {
  return records.filter(record => canAccessLabelRecord(actor, record, institutions) && !labelActionReason(record, action)).map(record => record.id)
}

export function buildLabelPrintData(record) {
  const row = normalizeLabelRecord(record)
  return {
    reservationId: row.bowelReservationId,
    name: row.name,
    identity: row.identity,
    institutionName: row.institution,
    institutionType: row.institutionType,
    reservationDate: row.date,
    barcode: isLabelCode(row.barcode) ? row.barcode : isLabelCode(row.bowelReservationId) ? row.bowelReservationId : '',
  }
}

export function sortLabelPrintData(data) {
  return [...data].sort((a, b) => a.institutionName.localeCompare(b.institutionName, 'zh-Hant') || a.reservationId.localeCompare(b.reservationId))
}

export function labelExportRows(filteredRecords) {
  return filteredRecords.map(record => {
    const row = normalizeLabelRecord(record)
    return [row.bowelReservationId, row.name, row.identity, row.date, row.institution, row.township, labelPrintStatuses[row.printStatus], row.printedAt]
  })
}

export function processLabelBatch(records, selectedIds, action, { actor, now = Date.now(), institutions = bowelInstitutions } = {}) {
  const byId = new Map(records.map(record => [String(record.id), record]))
  const usedCodes = new Set(records.map(record => record.barcode).filter(isLabelCode))
  const updates = []
  const printData = []
  const failures = []
  const operator = operatorName(actor)
  const timestamp = new Date(now).toISOString()
  for (const id of new Set(selectedIds.map(String))) {
    const raw = byId.get(id)
    if (!raw) { failures.push({ id, reason: '查無此筆預約，請重新查詢' }); continue }
    if (!canAccessLabelRecord(actor, raw, institutions)) { failures.push({ id, reason: '沒有此院所的標籤操作權限' }); continue }
    const reason = labelActionReason(raw, action)
    if (reason) { failures.push({ id, reason }); continue }
    const row = normalizeLabelRecord(raw)
    let next
    if (action === 'PRINT' && row.printStatus === 'UNPRINTED') {
      next = transitionBowelStatus(row, 'DISPATCHED', { changedAt: now, changedBy: operator })
      next.statusHistory.at(-1).action = 'PRINT'
      Object.assign(next, { printStatus: 'PRINTED', printedAt: timestamp, printAt: taipeiDay(now), printedBy: operator })
    } else if (action === 'PRINT') {
      next = { ...row, reprintedAt: timestamp, reprintedBy: operator, reprintCount: row.reprintCount + 1 }
    } else {
      next = {
        ...row, currentStatus: 'BOOKED', state: bowelStatuses.BOOKED.label, statusUpdatedAt: timestamp,
        previousStatus: 'DISPATCHED', previousState: bowelStatuses.DISPATCHED.label, changedAt: now, changedBy: operator,
        printStatus: 'UNPRINTED', printedAt: '', printAt: '', printedBy: '',
        statusHistory: [...row.statusHistory, { previousStatus: 'DISPATCHED', currentStatus: 'BOOKED', changedAt: now, changedBy: operator, action: 'CANCEL_PRINT' }],
      }
    }
    next.printHistory = [...row.printHistory, { action: action === 'PRINT' && row.printStatus === 'PRINTED' ? 'REPRINT' : action, operator, timestamp }]
    if (action === 'PRINT') {
      if (!isLabelCode(next.barcode)) next.barcode = isLabelCode(next.bowelReservationId) && !usedCodes.has(next.bowelReservationId) ? next.bowelReservationId : createLabelCode(usedCodes)
      usedCodes.add(next.barcode)
      printData.push(buildLabelPrintData(next))
    }
    updates.push({ id, record: next })
  }
  return { updates, printData: sortLabelPrintData(printData), successCount: updates.length, failureCount: failures.length, failures }
}
