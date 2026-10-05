import { changhuaAreas } from '../stores/areas.js'
import { canAccess } from '../utils/accessPolicy.js'
import { tubeFollowUp } from '../utils/tubeFollowUp.js'
import { taipeiDay } from '../utils/tubeOperations.js'

export const bowelStatuses = Object.freeze({
  BOOKED: { code: 'BOOKED', label: '已預約', order: 1, allowedNextStates: ['DISPATCHED'] },
  DISPATCHED: { code: 'DISPATCHED', label: '已派送', order: 2, allowedNextStates: ['RECEIVED'] },
  RECEIVED: { code: 'RECEIVED', label: '已接收', order: 3, allowedNextStates: ['PICKED_UP'] },
  PICKED_UP: { code: 'PICKED_UP', label: '已領取', order: 4, allowedNextStates: ['RETURNED'] },
  RETURNED: { code: 'RETURNED', label: '已繳回', order: 5, allowedNextStates: ['SENT_TO_LAB'] },
  SENT_TO_LAB: { code: 'SENT_TO_LAB', label: '已送驗', order: 6, allowedNextStates: [] },
})
export const bowelFollowUpStatuses = Object.freeze({
  UNCLAIMED: { code: 'UNCLAIMED', label: '未領取' },
  RETURN_TUBE: { code: 'RETURN_TUBE', label: '退管' },
  OVERDUE_RETURN: { code: 'OVERDUE_RETURN', label: '未繳回' },
  DISCARDED: { code: 'DISCARDED', label: '報廢' },
})
const codeByLabel = Object.fromEntries(Object.values(bowelStatuses).map(status => [status.label, status.code]))
const followUpCodeByLabel = Object.fromEntries(Object.values(bowelFollowUpStatuses).map(status => [status.label, status.code]))
const townshipCodes = Object.fromEntries(changhuaAreas.map((township, index) => [township, String(3701 + index).padStart(4, '0')]))
const institutionCodes = { 衛生所: '01', 藥局: '02' }
const day = value => typeof value === 'number' ? taipeiDay(value) : String(value || '').slice(0, 10)
const iso = value => typeof value === 'number' ? new Date(value).toISOString() : value || ''

export function statusCode(value) {
  return bowelStatuses[value] ? value : codeByLabel[value] || ''
}

export function generateBowelReservationId({ township, institutionType, institutionId, institutionCode, existingIds = [], at = new Date() }) {
  const town = townshipCodes[township]
  // DEMO directory IDs end in a two-digit institution code; the real code must come from the institution API.
  const institution = institutionCode || String(institutionId || '').match(/(\d{2})$/)?.[1] || institutionCodes[institutionType]
  if (!town || !/^\d{2}$/.test(institution || '')) throw new Error('缺少有效的鄉鎮或院所代碼')
  const rocYear = String((at.getFullYear() - 1911) % 100).padStart(2, '0')
  const prefix = `${rocYear}${town}${institution}`
  const used = existingIds.filter(id => /^\d{12}$/.test(String(id)) && String(id).startsWith(prefix)).map(id => Number(String(id).slice(8)))
  const sequence = Math.max(0, ...used) + 1
  if (sequence > 9999) throw new Error('DEMO 領管流水碼已用完')
  return `${prefix}${String(sequence).padStart(4, '0')}`
}

export function normalizeTrackingRecord(record) {
  const currentStatus = statusCode(record.state || record.currentStatus) || 'BOOKED'
  const previousStatus = Object.hasOwn(record, 'previousState') ? statusCode(record.previousState) : statusCode(record.previousStatus)
  return {
    ...record,
    bowelReservationId: record.bowelReservationId || record.id,
    reservationId: record.reservationId || '',
    currentStatus,
    state: bowelStatuses[currentStatus].label,
    statusUpdatedAt: iso(record.statusUpdatedAt || record.changedAt || record.printAt || record.date),
    receivedAt: record.receivedAt || '',
    receivedBy: record.receivedBy || '',
    pickedUpAt: record.pickedUpAt || '',
    pickedUpBy: record.pickedUpBy || '',
    returnedAt: record.returnedAt || '',
    sentToLabAt: record.sentToLabAt || '',
    sentToLabBy: record.sentToLabBy || '',
    institution: record.institution || record.provider || '',
    township: record.township || record.area || '',
    previousStatus,
    changedAt: record.changedAt || 0,
    changedBy: record.changedBy || '',
    statusHistory: Array.isArray(record.statusHistory) ? record.statusHistory.map(item => ({ ...item })) : [],
  }
}

export function derivedBowelFollowUp(record, now = Date.now()) {
  const normalized = normalizeTrackingRecord(record)
  const reminder = tubeFollowUp({
    state: normalized.state,
    receivedAt: day(normalized.receivedAt),
    pickedUpAt: day(normalized.pickedUpAt),
    tubeReturned: normalized.tubeReturned || ['RETURNED', 'SENT_TO_LAB'].includes(normalized.currentStatus),
  }, now)
  return reminder ? { ...bowelFollowUpStatuses[followUpCodeByLabel[reminder.label]], days: reminder.days } : null
}

export function transitionBowelStatus(record, nextCode, { changedAt = Date.now(), changedBy = 'system' } = {}) {
  const current = normalizeTrackingRecord(record)
  if (!bowelStatuses[current.currentStatus].allowedNextStates.includes(nextCode)) throw new Error('不允許跳過糞管業務狀態')
  const next = bowelStatuses[nextCode]
  const history = [...current.statusHistory, { previousStatus: current.currentStatus, currentStatus: nextCode, changedAt, changedBy }]
  const dateField = { RECEIVED: 'receivedAt', PICKED_UP: 'pickedUpAt', RETURNED: 'returnedAt', SENT_TO_LAB: 'sentToLabAt' }[nextCode]
  return {
    ...current,
    currentStatus: nextCode,
    state: next.label,
    statusUpdatedAt: new Date(changedAt).toISOString(),
    previousStatus: current.currentStatus,
    previousState: current.state,
    changedAt,
    changedBy,
    statusHistory: history,
    ...(dateField ? { [dateField]: taipeiDay(changedAt) } : {}),
  }
}

export function canRollbackBowelStatus(record, actor, now = Date.now()) {
  const normalized = normalizeTrackingRecord(record)
  // Label printing has its own inverse operation, which also restores print metadata.
  if (['PRINT', 'CANCEL_PRINT'].includes(normalized.statusHistory.at(-1)?.action)) return false
  if (!normalized.previousStatus || !normalized.changedAt || now < normalized.changedAt) return false
  if (['衛生局承辦', '系統管理員'].includes(actor?.role)) return true
  return now - normalized.changedAt < 10 * 60 * 1000
}

export function rollbackBowelStatus(record, actor, now = Date.now()) {
  const current = normalizeTrackingRecord(record)
  if (!canRollbackBowelStatus(current, actor, now)) throw new Error('目前無法復原此狀態')
  const restored = current.previousStatus
  const dateField = { RECEIVED: 'receivedAt', PICKED_UP: 'pickedUpAt', RETURNED: 'returnedAt', SENT_TO_LAB: 'sentToLabAt' }[current.currentStatus]
  return {
    ...current,
    currentStatus: restored,
    state: bowelStatuses[restored].label,
    statusUpdatedAt: new Date(now).toISOString(),
    previousStatus: '',
    previousState: '',
    changedAt: 0,
    changedBy: actor?.name || actor?.role || 'system',
    statusHistory: [...current.statusHistory, { previousStatus: current.currentStatus, currentStatus: restored, changedAt: now, changedBy: actor?.name || actor?.role || 'system' }],
    ...(dateField ? { [dateField]: '' } : {}),
    ...(current.currentStatus === 'RECEIVED' ? { receivedBy: '' } : {}),
    ...(current.currentStatus === 'PICKED_UP' ? { pickedUpBy: '' } : {}),
    ...(current.currentStatus === 'RETURNED' ? { returnedBy: '', tubeReturned: false, returnedAtTs: 0 } : {}),
    ...(current.currentStatus === 'SENT_TO_LAB' ? { sentToLabBy: '' } : {}),
  }
}

const operationalSteps = Object.freeze({ RECEIVED: { previous: 'DISPATCHED', permission: 'bowel.receive', action: 'CONFIRM_RECEIVED' }, PICKED_UP: { previous: 'RECEIVED', permission: 'bowel.pickup', action: 'CONFIRM_PICKUP' } })

export function canOperateBowelStep(record, nextCode, actor) {
  const step = operationalSteps[nextCode]
  const current = normalizeTrackingRecord(record)
  if (!step) return { allowed: false, reason: '此作業不屬於接收或領管流程' }
  if (current.currentStatus !== step.previous) return { allowed: false, reason: `只有${bowelStatuses[step.previous].label}的採檢管可執行此作業` }
  if (!['衛生局承辦', '衛生所承辦', '醫療院所人員', '藥局人員', '系統管理員'].includes(actor?.role)) return { allowed: false, reason: '目前身分不可操作採檢管' }
  const township = current.township
  const institution = current.institution
  const actorTownship = actor?.area || actor?.township || actor?.institution?.township || ''
  const actorInstitution = actor?.provider || actor?.institutionName || actor?.organizationName || actor?.institution?.name || ''
  if (actor?.role === '衛生所承辦' && (!actorTownship || actorTownship !== township)) return { allowed: false, reason: '只能操作所轄鄉鎮的採檢管' }
  if (['藥局人員', '醫療院所人員'].includes(actor?.role) && (!actorInstitution || actorInstitution !== institution)) return { allowed: false, reason: '只能操作自己院所的採檢管' }
  const scopedActor = { ...actor, area: actor?.area || actorTownship, provider: ['藥局人員', '醫療院所人員'].includes(actor?.role) ? actorInstitution : actor?.provider }
  if (!canAccess(scopedActor, step.permission, { area: township, provider: institution })) return { allowed: false, reason: '目前機構沒有此項操作權限' }
  return { allowed: true, reason: '' }
}

export function confirmBowelStep(record, nextCode, { actor, identitySuffix = '', at = Date.now() } = {}) {
  const permission = canOperateBowelStep(record, nextCode, actor)
  if (!permission.allowed) throw new Error(permission.reason)
  const current = normalizeTrackingRecord(record)
  if (nextCode === 'PICKED_UP') {
    const entered = String(identitySuffix).trim().toUpperCase()
    const expected = String(current.identity || '').slice(-4).toUpperCase()
    if (!/^[A-Z0-9]{4}$/.test(entered) || !expected || entered !== expected) throw new Error('身分證後四碼不符，請重新核對民眾資料')
  }
  const operator = actor.name || actor.role
  const updated = transitionBowelStatus(current, nextCode, { changedAt: at, changedBy: operator })
  const timestamp = new Date(at).toISOString()
  updated.statusHistory.at(-1).action = operationalSteps[nextCode].action
  if (nextCode === 'RECEIVED') Object.assign(updated, { receivedAt: timestamp, receivedBy: operator })
  if (nextCode === 'PICKED_UP') Object.assign(updated, { pickedUpAt: timestamp, pickedUpBy: operator })
  return updated
}

export function canRollbackBowelStep(record, actor, now = Date.now()) {
  const current = normalizeTrackingRecord(record)
  const step = operationalSteps[current.currentStatus]
  const lastAction = current.statusHistory.at(-1)?.action
  if (!step || lastAction !== step.action) return false
  const previous = current.previousStatus
  if (previous !== step.previous) return false
  return canOperateBowelStep({ ...current, currentStatus: previous, state: bowelStatuses[previous].label }, current.currentStatus, actor).allowed
    && canRollbackBowelStatus(current, actor, now)
}

export function rollbackBowelStep(record, actor, now = Date.now()) {
  if (!canRollbackBowelStep(record, actor, now)) throw new Error('目前沒有權限或已超過可復原期限')
  return rollbackBowelStatus(record, actor, now)
}

export function buildBookedTrackingRecord(reservation, institution, existing = [], now = Date.now()) {
  const id = generateBowelReservationId({ township: institution.township, institutionType: institution.institutionType, institutionId: institution.id, institutionCode: institution.reservationCode, existingIds: existing.map(item => item.bowelReservationId || item.id), at: new Date(now) })
  const createdAt = taipeiDay(now)
  return normalizeTrackingRecord({
    id, bowelReservationId: id, reservationId: reservation.id, name: reservation.name, identity: reservation.identity,
    area: institution.township, township: institution.township, provider: institution.institution, institution: institution.institution,
    category: institution.institutionType, date: createdAt, issuedAt: createdAt, state: bowelStatuses.BOOKED.label,
    currentStatus: 'BOOKED', statusUpdatedAt: new Date(now).toISOString(), printAt: '', tubeReturned: false,
    statusHistory: [{ previousStatus: null, currentStatus: 'BOOKED', changedAt: now, changedBy: 'system' }],
  })
}

export function queryBowelTracking(records, { actor, filters = {}, now = Date.now() } = {}) {
  const townshipScope = actor?.township || actor?.area || actor?.institution?.township || ''
  return records.map(normalizeTrackingRecord).filter(record => {
    if (actor?.role === '衛生所承辦' && (!townshipScope || record.township !== townshipScope)) return false
    if (!canAccess({ ...actor, area: actor?.area || townshipScope }, 'bowel.read', { area: record.township, provider: record.institution })) return false
    const followUp = derivedBowelFollowUp(record, now)
    const updated = record.currentStatus !== 'BOOKED' || record.statusHistory.length > 1
    return (!filters.township || filters.township === '全部' || record.township === filters.township)
      && (!filters.institution || filters.institution === '全部' || record.institution === filters.institution)
      && (!filters.updated || filters.updated === '全部' || (filters.updated === '已更新') === updated)
      && (!filters.month || String(record.date).slice(0, 7) === filters.month)
      && (!filters.identity || record.identity?.toUpperCase().includes(filters.identity.trim().toUpperCase()))
      && (!filters.currentStatus || filters.currentStatus === '全部' || record.currentStatus === filters.currentStatus)
      && (!filters.followUp || filters.followUp === '全部' || followUp?.code === filters.followUp)
  }).map(record => ({ ...record, specialStatus: derivedBowelFollowUp(record, now) }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.bowelReservationId).localeCompare(String(b.bowelReservationId)))
}

export const trackingExportHeaders = Object.freeze(['鄉鎮別', '醫療院所', '預約編號', '姓名', '身分證', '預約日期', '目前狀態', '最新狀態時間', '特殊追蹤狀態'])
export function trackingExportRows(filteredRecords) {
  return filteredRecords.map(record => [record.township, record.institution, record.bowelReservationId, record.name, record.identity, record.date, bowelStatuses[record.currentStatus]?.label || '', record.statusUpdatedAt, record.specialStatus?.label || ''])
}
