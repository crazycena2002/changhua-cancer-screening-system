import { canAccess } from '../utils/accessPolicy.js'
import { bowelInstitutions, scheduleSummary } from './bowelScreeningService.js'

export const reservationSourceLabels = Object.freeze({ public: '自行預約', staff: '輸入預約' })
export const reservationExportHeaders = Object.freeze(['身分證', '姓名', '出生年月日', '手機號碼', '現居地址', '鄉鎮別', '預約日期', '預約時段／領管資訊', '篩檢項目', '預約方式'])

export function normalizeReservation(record, { events = [], providers = [], institutions = bowelInstitutions } = {}) {
  const event = events.find(item => item.id === record.eventId) || record.event || null
  const institution = institutions.find(item => item.id === record.institutionId)
  const legacyProvider = providers.find(item => item.id === record.providerId)
  const program = record.program || (record.institutionId || record.providerId ? 'bowel' : event?.type === '整合式篩檢' ? 'integrated' : 'station')
  const bowel = program === 'bowel'
  const reservationSource = record.reservationSource || (record.source === '輸入預約' ? 'staff' : 'public')
  const rawScreening = record.screeningType || record.screening
  const screeningType = rawScreening === '大腸癌篩檢' ? '糞便潛血檢查' : rawScreening || ''
  return {
    reservationId: record.reservationId || record.id,
    program,
    screeningType,
    name: record.name || '',
    identityId: record.identityId || record.identity || '',
    birthDate: record.birthDate || record.birth || '',
    phone: record.phone || '',
    currentAddress: record.currentAddress || record.address || '',
    township: record.township || event?.area || institution?.township || legacyProvider?.area || '',
    reservationSource,
    createdAt: record.createdAt || '',
    status: record.status || '',
    event: bowel ? null : event ? { id: event.id, date: event.date, location: event.location, address: event.address } : null,
    reservationDate: bowel ? record.reservationDate || record.createdAt || record.date || '' : record.reservationDate || event?.date || record.createdAt || '',
    timeSlot: bowel ? null : record.timeSlot || record.slot || '',
    location: bowel ? '' : record.location || event?.location || '',
    institutionId: bowel ? record.institutionId || record.providerId || null : null,
    institutionName: bowel ? institution?.institution || legacyProvider?.name || record.institutionName || '' : '',
    institutionType: bowel ? institution?.institutionType || legacyProvider?.category || record.institutionType || '' : '',
    pickupSchedule: bowel ? record.pickupSchedule || (institution ? scheduleSummary(institution) : legacyProvider?.hours || '') : '',
    institutionAddress: bowel ? institution?.address || legacyProvider?.address || record.institutionAddress || '' : '',
  }
}

export function reservationTimeDetail(record) {
  return record.program === 'bowel'
    ? `領管院所：${record.institutionName}；可領管時間：${record.pickupSchedule}`
    : record.timeSlot || '未指定時段'
}

function actorTownship(actor) {
  return actor?.township || actor?.area || actor?.institution?.township || ''
}

export function queryReservations(records, { events = [], providers = [], institutions = bowelInstitutions, actor, filters = {} } = {}) {
  const townshipScope = actorTownship(actor)
  return records.map(record => normalizeReservation(record, { events, providers, institutions })).filter(record => {
    if (record.status === '已取消') return false
    if (actor?.role === '衛生所承辦' && (!townshipScope || record.township !== townshipScope)) return false
    if (!canAccess({ ...actor, area: actor?.area || townshipScope }, 'booking.read', { area: record.township })) return false
    const date = record.reservationDate
    return (!filters.from || date >= filters.from)
      && (!filters.to || date <= filters.to)
      && (!filters.township || filters.township === '全部' || record.township === filters.township)
      && (!filters.eventId || filters.eventId === '全部' || String(record.event?.id) === String(filters.eventId))
      && (!filters.screening || filters.screening === '全部' || record.screeningType === filters.screening || record.screeningType === (filters.screening === '大腸癌篩檢' ? '糞便潛血檢查' : filters.screening))
      && (!filters.source || filters.source === '全部' || record.reservationSource === filters.source)
  }).sort((a, b) => b.reservationDate.localeCompare(a.reservationDate) || a.reservationId.localeCompare(b.reservationId))
}

export function reservationExportRows(filteredRecords) {
  return filteredRecords.map(record => [
    record.identityId, record.name, record.birthDate, record.phone, record.currentAddress, record.township,
    record.reservationDate, reservationTimeDetail(record), record.screeningType, reservationSourceLabels[record.reservationSource] || record.reservationSource,
  ])
}
