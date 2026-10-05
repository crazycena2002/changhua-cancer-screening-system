// 僅供本機展示：這些門檻及資料不是實際公費篩檢規則或名冊。
export const demoMinimumAges = Object.freeze({
  子宮頸抹片: 30,
  乳房攝影: 40,
  大腸癌篩檢: 45,
})

export const demoPeople = Object.freeze([
  { identity: 'A200000012', name: '測試民眾甲', birth: '1965-01-01', completedScreenings: [], scenario: '年齡符合，未做過篩檢' },
  { identity: 'A200000021', name: '測試民眾乙', birth: '1965-01-01', completedScreenings: ['子宮頸抹片', '乳房攝影', '大腸癌篩檢'], scenario: '年齡符合，已做過篩檢' },
  { identity: 'A200000030', name: '測試民眾丙', birth: '2008-01-01', completedScreenings: [], scenario: '年齡未符合' },
])

export function normalizeIdentity(value) {
  return String(value ?? '').trim().toUpperCase()
}

export function isValidIdentity(value) {
  const identity = normalizeIdentity(value)
  if (!/^[A-Z][12]\d{8}$/.test(identity)) return false
  const letterCodes = { A: 10, B: 11, C: 12, D: 13, E: 14, F: 15, G: 16, H: 17, I: 34, J: 18, K: 19, L: 20, M: 21, N: 22, O: 35, P: 23, Q: 24, R: 25, S: 26, T: 27, U: 28, V: 29, W: 32, X: 30, Y: 31, Z: 33 }
  const letter = letterCodes[identity[0]]
  const digits = [Math.floor(letter / 10), letter % 10, ...identity.slice(1).split('').map(Number)]
  const weights = [1, 9, 8, 7, 6, 5, 4, 3, 2, 1, 1]
  return digits.reduce((sum, digit, index) => sum + digit * weights[index], 0) % 10 === 0
}

export function ageOnDate(birth, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null
  const [year, month, day] = birth.split('-').map(Number)
  const birthday = new Date(year, month - 1, day)
  if (birthday.getFullYear() !== year || birthday.getMonth() !== month - 1 || birthday.getDate() !== day || birthday > today) return null
  const beforeBirthday = today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)
  return today.getFullYear() - year - Number(beforeBirthday)
}

export function verifyDemoEligibility(identity, screening, { today = new Date(), people = demoPeople } = {}) {
  const normalized = normalizeIdentity(identity)
  if (!isValidIdentity(normalized)) return { eligible: false, reason: 'identity' }
  const person = people.find(item => item.identity === normalized)
  if (!person) return { eligible: false, reason: 'identity' }
  const minimumAge = demoMinimumAges[screening]
  const age = ageOnDate(person.birth, today)
  if (minimumAge === undefined || age === null) return { eligible: false, reason: 'data' }
  if (age < minimumAge) return { eligible: false, reason: 'age' }
  if (!Array.isArray(person.completedScreenings)) return { eligible: false, reason: 'data' }
  if (person.completedScreenings.includes(screening)) return { eligible: false, reason: 'completed' }
  return { eligible: true, person, age }
}
