import { ageOnDate, demoMinimumAges, isValidIdentity, normalizeIdentity } from '../utils/demoEligibility.js'

export const screeningItems = Object.freeze([
  { value: '子宮頸抹片', screeningType: 'cervical', label: '子宮頸抹片檢查', route: 'station' },
  { value: '乳房攝影', screeningType: 'mammography', label: '乳房攝影檢查', route: 'station' },
  { value: '大腸癌篩檢', screeningType: 'bowel', label: '糞便潛血檢查', route: 'bowel' },
])

export const qualificationReasons = Object.freeze({
  AGE_NOT_ELIGIBLE: '您目前尚未達本項篩檢適用年齡。',
  AGE_EXCEEDED: '您目前超出本項篩檢適用年齡範圍。',
  RECENTLY_SCREENED: '您近期已完成此項篩檢，目前尚未到再次篩檢時間。',
  ALREADY_BOOKED: '您已有此項篩檢預約，請先查詢原預約。',
  NOT_IN_ELIGIBLE_GROUP: '您目前不符合此項篩檢資格。',
  NO_AVAILABLE_PROGRAM: '目前沒有可預約的此項篩檢服務。',
})

export function updateScreeningSelection(current, item, canBook) {
  if (!canBook) return [...current]
  return current.includes(item) ? current.filter(value => value !== item) : [...current, item]
}

// All records and age/completion rules here are local DEMO fixtures, not official eligibility.
export const qualificationSamples = Object.freeze([
  { identity: 'A200000003', birth: '1970-03-01', name: '設站測試甲', resident: true, householdCounty: '彰化縣', householdArea: '彰化市', householdVillage: '南興里', householdDetail: '測試路 3 號', completedScreenings: ['乳房攝影', '大腸癌篩檢'], scenario: '僅子宮頸抹片' },
  { identity: 'A200000058', birth: '1970-03-01', name: '設站測試乙', resident: true, householdCounty: '彰化縣', householdArea: '彰化市', householdVillage: '光南里', householdDetail: '測試路 58 號', completedScreenings: ['子宮頸抹片', '大腸癌篩檢'], scenario: '僅乳房攝影' },
  { identity: 'A200000012', birth: '1965-01-01', name: '測試民眾甲', resident: true, householdCounty: '彰化縣', householdArea: '彰化市', householdVillage: '南興里', householdDetail: '測試路 1 號', completedScreenings: [], scenario: '子宮頸抹片、乳房攝影及糞便潛血檢查' },
  { identity: 'A200000067', birth: '1965-01-01', name: '設站測試丙', resident: true, householdCounty: '彰化縣', householdArea: '員林市', householdVillage: '三和里', householdDetail: '測試路 67 號', completedScreenings: ['子宮頸抹片', '乳房攝影'], scenario: '僅糞便潛血檢查' },
  { identity: 'A200000021', birth: '1965-01-01', name: '測試民眾乙', resident: true, householdCounty: '彰化縣', householdArea: '員林市', householdVillage: '三和里', householdDetail: '示範路 2 號', completedScreenings: ['子宮頸抹片', '乳房攝影', '大腸癌篩檢'], scenario: '目前無可預約資格' },
  { identity: 'A200000076', birth: '1965-01-01', name: '', resident: false, householdCounty: '', householdArea: '', householdVillage: '', householdDetail: '', completedScreenings: [], scenario: '非縣民，自行填寫姓名與戶籍地址' },
])

export function qualificationFor(identity, birth, { reservations = [], today = new Date(), people = qualificationSamples, availableScreenings = screeningItems.map(item => item.value), maximumAges = {} } = {}) {
  const normalized = normalizeIdentity(identity)
  const person = people.find(item => item.identity === normalized)
  if (!isValidIdentity(normalized) || !person || person.birth !== birth) return { ok: false, error: '身分證字號與出生年月日未符合 DEMO 名冊，請核對測試資料。' }
  const age = ageOnDate(birth, today)
  const results = screeningItems.map(item => {
    const minimum = demoMinimumAges[item.value]
    const alreadyBooked = reservations.some(record => record.identity === normalized && record.screening === item.value && record.status !== '已取消')
    const reasonCode = age < minimum ? 'AGE_NOT_ELIGIBLE'
      : maximumAges[item.value] != null && age > maximumAges[item.value] ? 'AGE_EXCEEDED'
        : person.completedScreenings.includes(item.value) ? 'RECENTLY_SCREENED'
          : alreadyBooked ? 'ALREADY_BOOKED'
            : person.excludedScreenings?.includes(item.value) ? 'NOT_IN_ELIGIBLE_GROUP'
              : !availableScreenings.includes(item.value) ? 'NO_AVAILABLE_PROGRAM' : null
    const reason = ({ AGE_NOT_ELIGIBLE: 'age', AGE_EXCEEDED: 'ageExceeded', RECENTLY_SCREENED: 'completed', ALREADY_BOOKED: 'booked', NOT_IN_ELIGIBLE_GROUP: 'group', NO_AVAILABLE_PROGRAM: 'unavailable' })[reasonCode] || ''
    return {
      ...item,
      eligible: !reasonCode,
      canBook: !reasonCode,
      reasonCode,
      reasonMessage: reasonCode ? qualificationReasons[reasonCode] : '',
      description: `DEMO 規則：年滿 ${minimum} 歲，且模擬名冊未記錄已完成此項篩檢。`,
      decision: reasonCode ? qualificationReasons[reasonCode] : '您目前符合此項篩檢資格。',
      reason,
    }
  })
  return {
    ok: true,
    identity: normalized,
    birth,
    results,
    basicProfile: {
      source: person.resident ? 'registry' : 'self',
      name: person.resident ? person.name : '',
      birth,
      householdCounty: person.resident ? person.householdCounty : '',
      householdArea: person.resident ? person.householdArea : '',
      householdVillage: person.resident ? person.householdVillage : '',
      householdDetail: person.resident ? person.householdDetail : '',
    },
  }
}

export async function lookupQualification(identity, birth, options = {}) {
  return qualificationFor(identity, birth, options)
}
