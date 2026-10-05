<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDemoStore } from '@/stores/demo'
import { changhuaAreas } from '@/stores/areas'
import PublicIcon from '@/components/PublicIcon.vue'
import PublicBrand from '@/components/PublicBrand.vue'
import { invitationSamples, verifyInvitationCode, eventWeekday } from '@/services/invitationService'
import { demoInvitations } from '@/utils/demoInvitations'
import { createBookingDraft } from '@/utils/bookingDraft'
import { lookupQualification, qualificationFor, qualificationSamples, screeningItems, updateScreeningSelection, qualificationReasons } from '@/services/qualificationService'
import { verifyContactPhone, verifyContactEmail } from '@/services/contactVerificationService'
import { stationEvents, stationSearchOptions, stationSlots } from '@/services/stationService'
import { availableTownships, bowelInstitutions, institutionsInTownship, scheduleRows, scheduleSummary, upcomingPickupDates } from '@/services/bowelScreeningService'
import { buildBookedTrackingRecord } from '@/services/bowelTrackingService'
import { demoMinimumAges, demoPeople, normalizeIdentity, verifyDemoEligibility } from '@/utils/demoEligibility'

const router = useRouter()
const route = useRoute()
const { events, reservations, providers, tracking } = storeToRefs(useDemoStore())
const stage = ref('home')
const program = ref('')
const screening = ref('')
const invite = ref('')
const matchedInvitation = ref(null)
const invitationError = ref('')
const checkingInvitation = ref(false)
const additionalIntent = ref('none')
const area = ref('全部')
const date = ref('')
const searchMode = ref('area')
const eligibilityReturnStage = ref('noInvite')
const event = ref(null)
const provider = ref(null)
const slot = ref('')
const extraScreenings = ref([])
const selectedScreenings = ref([])
const extraPlans = ref([])
const completionRecords = ref([])
const lookupMatches = ref([])
const sameAddress = ref(false)
const profileEditing = ref(false)
const profileSnapshot = ref(null)
const profileVerifiedIdentity = ref('')
const person = reactive({ identity: '', name: '', birth: '', household: '', current: '', householdCounty: '彰化縣', householdArea: '彰化市', householdVillage: '', householdDetail: '', currentCounty: '彰化縣', currentArea: '彰化市', currentVillage: '', currentDetail: '', phone: '', email: '' })
const counties = ['彰化縣', '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市', '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣']
const villageSamples = { 彰化市: ['南興里', '光南里', '福安里', '其他'], 員林市: ['三和里', '民生里', '仁美里', '其他'], 鹿港鎮: ['順興里', '永安里', '其他'], 田中鎮: ['東路里', '西路里', '其他'] }
const villagesFor = area => villageSamples[area] || ['其他']
const lookup = reactive({ identity: '', phone: '' })
const found = ref(null)
const phoneCode = ref('')
const emailCode = ref('')
const verifiedEmail = ref('')
const verifiedPhone = ref('')
const phoneInputCode = ref('')
const emailInputCode = ref('')
const phoneDeadline = ref(0)
const emailDeadline = ref(0)
const emailIssuedTo = ref('')
watch(() => person.phone, () => { phoneCode.value = ''; phoneInputCode.value = ''; verifiedPhone.value = '' })
watch(() => person.email, () => { emailCode.value = ''; emailInputCode.value = ''; emailIssuedTo.value = ''; verifiedEmail.value = '' })
const lookupCode = ref('')
const inputCode = ref('')
const codeDeadline = ref(0)
const notice = ref('')
const eligibilityError = ref('')
const eligibilityVerified = ref(null)
const lookupBirth = ref('')
const qualifiedScreenings = ref([])
const qualificationResult = ref(null)
const profileSource = ref('registry')
watch([() => person.identity, screening, program], () => {
  eligibilityError.value = ''
  eligibilityVerified.value = null
  extraScreenings.value = []
  extraPlans.value = []
  additionalIntent.value = 'none'
}, { flush: 'sync' })
watch(invite, () => { invitationError.value = '' })

function rejectEligibility(reason) {
  const details = {
    identity: '請檢查身分證字號，或使用下方提供的模擬資料測試。',
    age: '模擬名冊中的年齡未達所選項目的 DEMO 門檻，無法繼續預約。',
    completed: '模擬名冊已有此項目的篩檢紀錄，無法再次預約。',
    data: '請選擇篩檢項目並重新驗證。',
  }
  eligibilityError.value = details[reason] || details.data
  window.alert('資料輸入錯誤或不符合資格')
}

function confirmEligibility() {
  const result = verifyDemoEligibility(person.identity, screening.value)
  if (!result.eligible) return rejectEligibility(result.reason)
  hydrateBasicProfile(result.person)
  person.identity = result.person.identity
  person.name = result.person.name
  person.birth = result.person.birth
  eligibilityVerified.value = { identity: person.identity, screening: screening.value, program: program.value }
  eligibilityError.value = ''
  stage.value = 'search'
}
async function lookupGeneralEligibility() {
  const availableScreenings = screeningItems.filter(item => item.route === 'bowel'
    ? bowelInstitutions.some(place => upcomingPickupDates(place).length)
    : stationEvents(events.value, item.value, { reservations: reservations.value, availableOnly: true }).length).map(item => item.value)
  const result = await lookupQualification(person.identity, lookupBirth.value, { reservations: reservations.value, availableScreenings })
  if (!result.ok) return tell(result.error)
  qualificationResult.value = result
  qualifiedScreenings.value = result.results.filter(item => item.canBook).map(item => item.value)
  selectedScreenings.value = []
  person.identity = result.identity
  person.birth = result.birth
  profileSource.value = result.basicProfile.source
  if (profileSource.value === 'registry') hydrateBasicProfile({ identity: result.identity, ...result.basicProfile })
  else {
    Object.assign(person, { name: '', householdCounty: '彰化縣', householdArea: '', householdVillage: '', householdDetail: '', currentVillage: '', currentDetail: '' })
    profileEditing.value = true
    profileVerifiedIdentity.value = result.identity
  }
  stage.value = 'noInvite'
}

function hasVerifiedEligibility() {
  if (program.value === 'integrated') {
    if (matchedInvitation.value?.code === invite.value && matchedInvitation.value?.identity === person.identity) return true
    stage.value = 'invite'; tell('請先驗證邀約碼'); return false
  }
  if (['station', 'bowel'].includes(program.value) && qualificationResult.value?.identity === normalizeIdentity(person.identity)) {
    const current = qualificationFor(person.identity, person.birth, { reservations: reservations.value })
    if (current.ok && current.results.some(item => item.value === screening.value && item.eligible)) return true
    stage.value = 'noInvite'; tell('資格或既有預約已變更，請重新選擇項目'); return false
  }
  const result = verifyDemoEligibility(person.identity, screening.value)
  const verified = eligibilityVerified.value
  if (result.eligible && verified?.identity === normalizeIdentity(person.identity) && verified.screening === screening.value && verified.program === program.value && person.birth === result.person.birth) return true
  stage.value = 'eligibility'
  rejectEligibility(result.eligible ? 'data' : result.reason)
  return false
}
const title = computed(() => ({ integrated: '整篩預約專區', station: '衛生局所設站預約', bowel: '腸篩專案預約' })[program.value] || '開始預約')
const eligibleEvents = computed(() => program.value === 'station'
  ? searchMode.value === 'date' && !date.value ? [] : stationEvents(events.value, screening.value, { area: searchMode.value === 'area' && area.value !== '全部' ? area.value : '', date: searchMode.value === 'date' ? date.value : '', reservations: reservations.value })
  : events.value.filter(e => {
  if (e.type !== (program.value === 'integrated' ? '整合式篩檢' : '衛生局所設站')) return false
  if (screening.value && !e.screenings.includes(screening.value)) return false
  if (program.value === 'integrated') {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return new Date(`${e.date}T00:00:00`) >= today && slotsFor(e, '整合式篩檢').some(item => item.left > 0)
  }
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const lastDay = new Date(today); lastDay.setDate(lastDay.getDate() + 30)
  const eventDay = new Date(`${e.date}T00:00:00`)
  if (eventDay < today || eventDay > lastDay) return false
  return searchMode.value === 'date' ? (!date.value || e.date === date.value) : (area.value === '全部' || e.area === area.value)
}))
const stationOptions = computed(() => stationSearchOptions(events.value, screening.value, { reservations: reservations.value }))
const eligibleProviders = computed(() => providers.value.filter(p => area.value === '全部' || p.area === area.value))
const bowelTownships = computed(() => availableTownships(areas, bowelInstitutions))
const bowelProviders = computed(() => institutionsInTownship(area.value, bowelInstitutions))
const pickupRows = computed(() => provider.value ? scheduleRows(provider.value).filter(row => row.periods.length) : [])
const pickupDates = computed(() => provider.value ? upcomingPickupDates(provider.value).slice(0, 5) : [])
const areas = changhuaAreas
const selectedPlace = computed(() => program.value === 'bowel' ? provider.value : event.value)
const flowLabels = computed(() => [program.value === 'integrated' ? '輸入邀約碼' : '確認資格', program.value === 'bowel' ? '選擇領管院所' : '選擇場次', '聯絡方式與驗證', '基本資料與加選'])
const flowStep = computed(() => ({ invite: 1, eligibility: 1, search: 2, slots: 2, bowelTownship: 2, bowelConfirm: 2, phone: 3, profile: 4, suggestions: 4, additional: 4, done: 4 })[stage.value] || 0)
const transitionKey = computed(() => stage.value === 'lookupVerify' ? 'lookup' : stage.value)
const preservedPageHeight = ref(0)
const stepSection = ref(null)
watch(stage, () => {
  preservedPageHeight.value = Math.ceil(window.scrollY + window.innerHeight + 1)
})
function ensureStepVisible() {
  const section = stepSection.value
  if (!section) return
  const bounds = section.getBoundingClientRect()
  if (bounds.bottom < Math.min(200, window.innerHeight / 4) || bounds.top > window.innerHeight - 100) {
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
    section.scrollIntoView({ behavior, block: 'start' })
  }
}
function tell(value) { notice.value = value; setTimeout(() => { if (notice.value === value) notice.value = '' }, 4200) }
function code() { return String(Math.floor(100000 + Math.random() * 900000)) }
function chooseProgram(value) {
  program.value = value; screening.value = value === 'bowel' ? '大腸癌篩檢' : ''
  area.value = '全部'; date.value = ''; searchMode.value = 'area'
  event.value = null; provider.value = null; slot.value = ''
  invite.value = ''; matchedInvitation.value = null; invitationError.value = ''
  profileEditing.value = false; additionalIntent.value = 'none'
  selectedScreenings.value = []
  Object.assign(person, { identity: '', name: '', birth: '', phone: '', email: '', household: '', current: '', currentVillage: '', currentDetail: '' })
  stage.value = value === 'integrated' ? 'invite' : 'eligibility'
}
function openGeneralEntry() {
  program.value = ''; screening.value = ''; invite.value = ''; matchedInvitation.value = null
  event.value = null; provider.value = null; slot.value = ''; qualifiedScreenings.value = []
  selectedScreenings.value = []; person.identity = ''; lookupBirth.value = ''; qualificationResult.value = null; stage.value = 'identityLookup'
}
function chooseScreening(value) {
  if (!qualifiedScreenings.value.includes(value) || !qualificationResult.value?.results.some(item => item.value === value && item.canBook)) return tell('此項目目前不可預約，請查看原因')
  screening.value = value
  program.value = value === '大腸癌篩檢' ? 'bowel' : 'station'
  extraScreenings.value = selectedScreenings.value.filter(item => item !== value)
  additionalIntent.value = extraScreenings.value.length ? 'requested' : 'none'
  event.value = null; provider.value = null; slot.value = ''; area.value = '全部'
  eligibilityVerified.value = { identity: person.identity, screening: value, program: program.value }
  stage.value = value === '大腸癌篩檢' ? 'bowelTownship' : 'search'
}
function toggleGeneralScreening(item) {
  selectedScreenings.value = updateScreeningSelection(selectedScreenings.value, item.value, item.canBook)
}
function startSelectedScreenings() {
  if (!selectedScreenings.value.length) return tell('請至少勾選一項可預約篩檢')
  chooseScreening(selectedScreenings.value[0])
}
function setStationSearchMode(mode) { searchMode.value = mode; area.value = '全部'; date.value = '' }
async function confirmInvite() {
  if (checkingInvitation.value) return
  checkingInvitation.value = true
  matchedInvitation.value = null
  let result
  try { result = await verifyInvitationCode(invite.value) }
  catch { result = { ok: false, error: '目前無法驗證邀約碼，請稍後重試。' } }
  checkingInvitation.value = false
  if (!result.ok) { invitationError.value = result.error; return }
  const match = result.invitation
  invite.value = match.code
  matchedInvitation.value = match
  invitationError.value = ''
  hydrateBasicProfile(match)
  Object.assign(person, {
    identity: match.identity, name: match.name, birth: match.birth,
    householdCounty: match.householdCounty, householdArea: match.householdArea,
    householdVillage: match.householdVillage, householdDetail: match.householdDetail,
    currentCounty: '彰化縣', currentArea: '彰化市',
    currentVillage: '', currentDetail: '',
    household: '', current: '',
  })
  sameAddress.value = true
  person.currentCounty = person.householdCounty
  person.currentArea = person.householdArea
  person.currentVillage = person.householdVillage
  person.currentDetail = person.householdDetail
  stage.value = 'search'
}
function chooseEvent(value) { if (program.value === 'station' ? !stationSlots(value, screening.value, reservations.value).some(item => item.left > 0) : value.booked >= value.capacity) return; if (event.value?.id !== value.id) slot.value = ''; event.value = value; stage.value = 'slots' }
function chooseSlot(label) { if (slotsFor(event.value).some(item => item.label === label && item.left > 0)) slot.value = label }
function chooseProvider(value) { provider.value = value; stage.value = 'bowelConfirm' }
function confirmBowelInstitution() {
  if (!hasVerifiedEligibility() || !provider.value || !upcomingPickupDates(provider.value).length) return tell('請選擇目前提供領管服務的院所')
  stage.value = 'phone'
}
function slotsFor(value, item = screening.value || '整合式篩檢') {
  if (value?.type === '衛生局所設站' && ['子宮頸抹片', '乳房攝影'].includes(item)) return stationSlots(value, item, reservations.value)
  const start = Number(value.start.slice(0, 2)) * 60 + Number(value.start.slice(3))
  const end = Number(value.end.slice(0, 2)) * 60 + Number(value.end.slice(3))
  const step = Number(value.interval || 30)
  const output = []
  const configured = value.slotCapacityByScreening?.[item] || value.slotCapacity || {}
  const fmt = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  for (let n = start; n + step <= end; n += step) {
    const label = `${fmt(n)}－${fmt(n + step)}`
    const assigned = reservations.value.filter(r => r.eventId === value.id && r.slot === label && r.screening === item && r.status !== '已取消').length
    const limit = configured[label]?.public ?? Math.max(1, Math.floor(value.capacity / Math.max(1, Math.floor((end - start) / step))))
    const closed = !!configured[label]?.closed
    const left = closed ? 0 : Math.max(0, Math.min(limit - assigned, value.capacity - value.booked))
    output.push({ label, left, closed })
  }
  return output
}
function sendPhone(forLookup = false) {
  const number = forLookup ? lookup.phone : person.phone
  if (!/^09\d{8}$/.test(number)) { tell('請輸入 10 碼手機號碼'); return false }
  if (forLookup) {
    lookupCode.value = code(); inputCode.value = ''; codeDeadline.value = Date.now() + 5 * 60000
  } else {
    phoneCode.value = code(); phoneInputCode.value = ''; verifiedPhone.value = ''; phoneDeadline.value = Date.now() + 5 * 60000
  }
  tell('已產生本機 DEMO 驗證碼')
  return true
}
function beginLookupVerification() { if (sendPhone(true)) stage.value = 'lookupVerify' }
function checkPhone(forLookup = false) {
  if (!forLookup) return confirmContact()
  const expected = forLookup ? lookupCode.value : phoneCode.value
  if (!expected || Date.now() > codeDeadline.value || inputCode.value !== expected) return tell('驗證碼錯誤或已過期，請重新產生')
  if (forLookup) {
    lookupMatches.value = reservations.value.filter(r => r.identity === normalizeIdentity(lookup.identity) && r.phone === lookup.phone && r.status !== '已取消')
    found.value = lookupMatches.value[0] || null
    if (!found.value) return tell('查無符合的 DEMO 預約資料')
    stage.value = 'lookupResult'
  } else stage.value = 'profile'
  inputCode.value = ''
}
function confirmPhoneCode() {
  const result = verifyContactPhone({ phone: person.phone, code: phoneCode.value, input: phoneInputCode.value, deadline: phoneDeadline.value })
  if (!result.ok) { tell(result.error); return false }
  verifiedPhone.value = person.phone
  return true
}
function confirmEmailCode() {
  if (!person.email) { verifiedEmail.value = ''; return true }
  const result = verifyContactEmail({ email: person.email, issuedTo: emailIssuedTo.value, code: emailCode.value, input: emailInputCode.value, deadline: emailDeadline.value })
  if (!result.ok) { tell(result.error); return false }
  verifiedEmail.value = person.email
  return true
}
function confirmContact() {
  if (!confirmPhoneCode() || !confirmEmailCode()) return
  stage.value = 'profile'
}
function hasVerifiedContact() {
  if (verifiedPhone.value === person.phone && verifiedPhone.value && (!person.email || verifiedEmail.value === person.email)) return true
  stage.value = 'phone'
  tell('請先完成手機及已填寫的電子郵件驗證')
  return false
}
function saveProfile() {
  if (profileEditing.value) return tell('請先儲存基本資料修改，再完成預約')
  if (!hasVerifiedEligibility()) return
  if (!/^[A-Z][A-Z0-9]{4,9}$/.test(person.identity.toUpperCase())) return tell('請輸入 5 至 10 碼大寫英數身分證字號')
  if (!person.name.trim() || !person.birth || !person.householdVillage || !person.householdDetail.trim() || (!sameAddress.value && (!person.currentVillage || !person.currentDetail.trim()))) return tell('請完成必填基本資料與地址')
  if (!person.householdArea.trim() || (!sameAddress.value && !person.currentArea.trim())) return tell('請填寫戶籍與現居地址的鄉鎮市區')
  person.household = `${person.householdCounty}${person.householdArea}${person.householdVillage}${person.householdDetail}`
  person.current = sameAddress.value ? person.household : `${person.currentCounty}${person.currentArea}${person.currentVillage}${person.currentDetail}`
  if (otherQualificationRows.value.length) stage.value = 'suggestions'
  else complete()
}
function sendEmail() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) return tell('請輸入有效的 E-mail')
  emailIssuedTo.value = person.email; verifiedEmail.value = ''
  emailCode.value = code(); emailInputCode.value = ''; emailDeadline.value = Date.now() + 15 * 60000
  tell('已產生本機 DEMO 信箱驗證碼')
}
function complete() {
  if (!hasVerifiedEligibility()) return
  if (!hasVerifiedContact()) return
  if (!validatePlans()) return
  const batchId = `CH${Date.now()}`
  const createdAt = new Date().toISOString().slice(0, 10)
  const records = bookingPlans.value.map((plan, index) => ({ id: `${batchId}-${index + 1}`, batchId, identity: normalizeIdentity(person.identity), name: person.name.trim(), birth: person.birth, household: person.household, address: person.current, phone: person.phone, email: person.email, eventId: plan.event?.id || null, providerId: plan.program === 'bowel' ? null : plan.provider?.id || null, ...(plan.program === 'bowel' ? { institutionId: plan.provider?.id || null, institutionType: plan.provider?.institutionType || '', township: plan.provider?.township || '', pickupSchedule: plan.provider ? scheduleSummary(plan.provider) : '' } : {}), screening: plan.screening, slot: plan.program === 'bowel' ? '' : plan.slot || plan.provider?.hours || '', source: '自行預約', status: '已預約', program: plan.program, createdAt, ...(['integrated', 'station', 'bowel'].includes(plan.program) ? { reservationType: plan.program, invitationCode: plan.program === 'integrated' ? invite.value : '', bookingDraft: bookingDraft.value } : {}) }))
  // Validate the entire batch before mutating any booking or capacity.
  for (const [index, record] of records.entries()) {
    const plan = bookingPlans.value[index]
    if (plan.event) {
      plan.event.booked++
      if (plan.program === 'station') {
        if (!plan.event.bookedByScreening) plan.event.bookedByScreening = {}
        const knownBooked = plan.event.bookedByScreening[plan.screening] ?? reservations.value.filter(value => value.eventId === plan.event.id && value.screening === plan.screening && value.status !== '已取消').length
        plan.event.bookedByScreening[plan.screening] = knownBooked + 1
      }
    }
    if (plan.provider) {
      const booked = buildBookedTrackingRecord(record, plan.provider, tracking.value)
      record.bowelReservationId = booked.bowelReservationId
      tracking.value.unshift(booked)
    }
  }
  reservations.value.unshift(...records)
  completionRecords.value = records
  found.value = records[0]
  stage.value = 'done'
}
function cancelReservation() {
  if (!found.value || !window.confirm('確定取消這筆 DEMO 預約？')) return
  found.value.status = '已取消'
  const tracked = tracking.value.find(item => item.reservationId === found.value.id)
  if (tracked && tracked.state === '已預約') tracked.state = '已取消'
  const match = events.value.find(e => e.id === found.value.eventId)
  if (match) {
    match.booked = Math.max(0, match.booked - 1)
    if (found.value.program === 'station' && match.bookedByScreening) match.bookedByScreening[found.value.screening] = Math.max(0, (match.bookedByScreening[found.value.screening] || 0) - 1)
  }
  window.alert('您已成功取消！本機 DEMO 不會寄送通知。')
  lookupMatches.value = lookupMatches.value.filter(record => record.status !== '已取消')
  found.value = lookupMatches.value[0] || null
  if (!found.value) stage.value = 'lookup'
}
function bookAnotherScreening() { screening.value = ''; event.value = null; slot.value = ''; phoneCode.value = ''; emailCode.value = ''; inputCode.value = ''; eligibilityReturnStage.value = 'noInvite'; stage.value = 'identityLookup' }
function back() {
  const previous = { identityLookup: 'home', noInvite: 'identityLookup', invite: 'home', eligibility: eligibilityReturnStage.value, suggestions: 'profile', search: program.value === 'integrated' ? 'invite' : 'noInvite', slots: 'search', bowelTownship: 'noInvite', bowelConfirm: 'bowelTownship', additional: 'suggestions', phone: program.value === 'bowel' ? 'bowelConfirm' : 'slots', profile: 'phone', lookupVerify: 'lookup', lookupResult: 'lookup' }
  const target = previous[stage.value] || 'home'
  if (target === 'home') router.push('/booking')
  else stage.value = target
}

const basicProfileKeys = ['name', 'householdCounty', 'householdArea', 'householdVillage', 'householdDetail', 'currentCounty', 'currentArea', 'currentVillage', 'currentDetail']
function hydrateBasicProfile(source) {
  const address = source.householdDetail ? source : demoInvitations.find(item => item.identity === source.identity)
  Object.assign(person, { name: source.name, birth: source.birth, householdCounty: address?.householdCounty || '彰化縣', householdArea: address?.householdArea || '彰化市', householdVillage: address?.householdVillage || '南興里', householdDetail: address?.householdDetail || '模擬路 3 號' })
  if (profileVerifiedIdentity.value !== source.identity) {
    Object.assign(person, { currentCounty: '彰化縣', currentArea: '彰化市', currentVillage: '', currentDetail: '' })
    if (profileVerifiedIdentity.value) Object.assign(person, { phone: '', email: '' })
  }
  profileVerifiedIdentity.value = source.identity; profileEditing.value = false; sameAddress.value = false
}
function beginProfileEdit() { profileSnapshot.value = { ...Object.fromEntries(basicProfileKeys.map(key => [key, person[key]])), sameAddress: sameAddress.value }; profileEditing.value = true }
function cancelProfileEdit() { if (profileSnapshot.value) { const { sameAddress: originalSameAddress, ...fields } = profileSnapshot.value; Object.assign(person, fields); sameAddress.value = originalSameAddress }; profileSnapshot.value = null; profileEditing.value = false }
function finishProfileEdit() {
  if (!person.name.trim() || !person.householdArea.trim() || !person.householdVillage || !person.householdDetail.trim()) return tell('請填寫姓名與完整戶籍地址')
  if (!sameAddress.value && (!person.currentArea.trim() || !person.currentVillage || !person.currentDetail.trim())) return tell('請填寫完整現居地址，或勾選同戶籍地址')
  person.household = `${person.householdCounty}${person.householdArea}${person.householdVillage}${person.householdDetail}`
  person.current = sameAddress.value ? person.household : `${person.currentCounty}${person.currentArea}${person.currentVillage}${person.currentDetail}`
  profileEditing.value = false; profileSnapshot.value = null; tell('基本資料修改已儲存於本次預約草稿')
}
function reverifyIdentity() { profileEditing.value = false; event.value = null; provider.value = null; slot.value = ''; stage.value = program.value === 'integrated' ? 'invite' : qualificationResult.value ? 'identityLookup' : 'eligibility' }
function availableProgramScreenings() {
  return screeningItems.filter(item => item.route === 'bowel'
    ? bowelInstitutions.some(place => upcomingPickupDates(place).length)
    : stationEvents(events.value, item.value, { reservations: reservations.value, availableOnly: true }).length).map(item => item.value)
}
const otherQualificationRows = computed(() => {
  const result = qualificationFor(person.identity, person.birth, { reservations: reservations.value, availableScreenings: availableProgramScreenings() })
  if (result.ok) return result.results.filter(item => item.value !== screening.value)
  return screeningItems.filter(item => item.value !== screening.value).map(item => {
    const eligible = verifyDemoEligibility(person.identity, item.value).eligible
    const canBook = eligible && availableProgramScreenings().includes(item.value)
    const reasonCode = canBook ? null : eligible ? 'NO_AVAILABLE_PROGRAM' : 'NOT_IN_ELIGIBLE_GROUP'
    return { ...item, eligible, canBook, reasonCode, reasonMessage: reasonCode ? qualificationReasons[reasonCode] : '' }
  })
})
const otherEligibleScreenings = computed(() => otherQualificationRows.value.filter(item => item.canBook).map(item => item.value))
function toggleAdditional(item) { extraScreenings.value = updateScreeningSelection(extraScreenings.value, item.value, item.canBook) }
function continueFromSuggestions() {
  extraScreenings.value = extraScreenings.value.filter(item => otherEligibleScreenings.value.includes(item))
  additionalIntent.value = extraScreenings.value.length ? 'requested' : 'declined'
  if (extraScreenings.value.length) prepareExtras()
  else { extraPlans.value = []; complete() }
}
const bookingDraft = computed(() => createBookingDraft({
  reservationType: program.value,
  invitationCode: program.value === 'integrated' ? invite.value : '',
  selectedEvent: event.value,
  selectedTimeSlot: slot.value,
  bowelScreening: program.value === 'bowel' && provider.value ? { screeningType: '糞便潛血檢查', township: provider.value.township, institution: provider.value.institution, institutionType: provider.value.institutionType, weeklySchedule: provider.value.weeklySchedule, specialClosures: provider.value.specialClosures, selectedInstitution: { id: provider.value.id, institution: provider.value.institution, address: provider.value.address, phone: provider.value.phone, healthCenterContact: provider.value.healthCenterContact } } : null,
  phone: person.phone,
  basicProfile: { source: program.value === 'integrated' ? 'invitation' : profileSource.value, identity: person.identity, name: person.name, birth: person.birth, householdAddress: person.household, currentAddress: person.current },
  qualificationResult: program.value === 'integrated'
    ? screeningItems.map(item => ({ ...item, eligible: otherEligibleScreenings.value.includes(item.value), description: '本機 DEMO 資格判斷', decision: otherEligibleScreenings.value.includes(item.value) ? '符合其他篩檢加選資格' : '目前未列入加選項目' }))
    : qualificationResult.value?.results || [],
  additionalScreening: { decision: additionalIntent.value, eligible: otherEligibleScreenings.value, selected: extraPlans.value.map(plan => ({ screening: plan.screening, eventId: plan.eventId, timeSlot: plan.slot })) },
  selectedScreenings: [program.value === 'integrated' ? 'integrated' : screeningItems.find(item => item.value === screening.value)?.screeningType, ...extraScreenings.value.map(value => screeningItems.find(item => item.value === value)?.screeningType)].filter(Boolean),
  email: person.email,
}))
const screeningLabel = item => item === '大腸癌篩檢' ? '糞便潛血檢查' : item
const planEvent = plan => events.value.find(item => item.id === plan.eventId)
const planProvider = plan => bowelInstitutions.find(item => item.id === plan.providerId)
function extraEvents(item) {
  if (program.value === 'station') return stationEvents(events.value, item, { reservations: reservations.value }).sort((a, b) => Number(b.id === event.value?.id) - Number(a.id === event.value?.id) || a.date.localeCompare(b.date))
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const lastDay = new Date(today); lastDay.setDate(lastDay.getDate() + 30)
  return events.value.filter(value => value.type === '衛生局所設站' && value.screenings.includes(item) && new Date(`${value.date}T00:00:00`) >= today && new Date(`${value.date}T00:00:00`) <= lastDay)
    .sort((a, b) => Number(b.id === event.value?.id) - Number(a.id === event.value?.id) || a.date.localeCompare(b.date))
}
function continueFromSlots() {
  if (!hasVerifiedEligibility()) return
  if (program.value !== 'bowel' && (!event.value || !slotsFor(event.value).some(item => item.label === slot.value && item.left > 0))) return tell('請選擇尚有名額的預約時段')
  stage.value = 'phone'
}
function prepareExtras() {
  const allowed = otherEligibleScreenings.value
  extraPlans.value = extraScreenings.value.filter(item => allowed.includes(item)).map(item => {
    const previous = extraPlans.value.find(plan => plan.screening === item)
    if (previous) return previous
    const sameEvent = extraEvents(item).find(value => value.id === event.value?.id && slotsFor(value, item).some(time => time.left > 0))
    return { screening: item, program: item === '大腸癌篩檢' ? 'bowel' : 'station', eventId: item === '大腸癌篩檢' ? '' : sameEvent?.id || '', township: '', providerId: '', slot: '' }
  })
  additionalIntent.value = extraPlans.value.length ? 'requested' : 'declined'
  stage.value = extraPlans.value.length ? 'additional' : 'profile'
}
function removeExtra(item) {
  extraScreenings.value = extraScreenings.value.filter(value => value !== item)
  extraPlans.value = extraPlans.value.filter(plan => plan.screening !== item)
  if (program.value === 'station' && !extraPlans.value.length) additionalIntent.value = 'declined'
}
const bookingPlans = computed(() => [
  { screening: screening.value || '整合式篩檢', program: program.value, event: program.value === 'bowel' ? null : event.value, provider: program.value === 'bowel' ? provider.value : null, slot: program.value === 'bowel' ? '' : slot.value },
  ...extraPlans.value.map(plan => ({ screening: plan.screening, program: plan.program, event: plan.program === 'station' ? planEvent(plan) : null, provider: plan.program === 'bowel' ? planProvider(plan) : null, slot: plan.slot })),
])
function validatePlans() {
  for (const [index, plan] of bookingPlans.value.entries()) {
    const fail = message => { stage.value = index ? 'additional' : plan.program === 'bowel' ? 'bowelTownship' : 'slots'; tell(`${screeningLabel(plan.screening)}：${message}`); return false }
    const qualified = ['station', 'bowel'].includes(plan.program) && qualificationResult.value?.identity === normalizeIdentity(person.identity)
      ? qualificationFor(person.identity, person.birth, { reservations: reservations.value }).results?.some(item => item.value === plan.screening && item.eligible)
      : verifyDemoEligibility(person.identity, plan.screening).eligible
    if (plan.program !== 'integrated' && (!qualified || reservations.value.some(record => record.identity === normalizeIdentity(person.identity) && record.screening === plan.screening && record.status !== '已取消'))) return fail('資格已變更或已有預約，請重新確認')
    if (plan.program === 'bowel') { if (!plan.provider || !upcomingPickupDates(plan.provider).length) return fail('請選擇目前提供領管服務的院所'); continue }
    if (!plan.event || !plan.event.screenings.includes(plan.screening) && plan.program !== 'integrated') return fail('請選擇可預約場次')
    if (!slotsFor(plan.event, plan.screening).some(time => time.label === plan.slot && time.left > 0)) return fail('請選擇尚有名額的時段')
    const required = bookingPlans.value.filter(value => value.event?.id === plan.event.id && (plan.program === 'integrated' || value.screening === plan.screening)).length
    const available = plan.program === 'station' ? (plan.event.capacityByScreening?.[plan.screening] ?? plan.event.capacity) - (plan.event.bookedByScreening?.[plan.screening] ?? 0) : plan.event.capacity - plan.event.booked
    if (available < required) {
      stage.value = extraPlans.value.length ? 'additional' : 'slots'
      tell(`同場次剩餘名額不足以預約 ${required} 個項目，請更換場次或移除加選項目`)
      return false
    }
  }
  return true
}
function continueFromExtras() { if (validatePlans()) { additionalIntent.value = extraPlans.value.length ? 'requested' : 'declined'; complete() } }
const recordPlace = record => bowelInstitutions.find(item => item.id === record?.institutionId) || events.value.find(item => item.id === record?.eventId) || providers.value.find(item => item.id === record?.providerId)
const pickupScheduleForRecord = record => record?.pickupSchedule || (recordPlace(record)?.weeklySchedule ? scheduleSummary(recordPlace(record)) : recordPlace(record)?.hours || '')
const lookupSamples = computed(() => {
  const fixtures = [
    { identity: 'A200000021', phone: '0911000021', name: '查詢測試乙', description: '兩筆預約，可測試切換與個別取消', records: [{ id: 'CH-LOOKUP-21-1', screening: '子宮頸抹片' }, { id: 'CH-LOOKUP-21-2', screening: '乳房攝影' }] },
    { identity: 'A200000030', phone: '0911000030', name: '查詢測試丙', description: '一筆預約，可測試查詢及取消', records: [{ id: 'CH-LOOKUP-30-1', screening: '大腸癌篩檢' }] },
    { identity: 'A200000049', phone: '0911000049', name: '查無資料測試', description: '無預約，驗證後顯示查無資料', records: [] },
  ]
  const current = reservations.value.find(record => record.status !== '已取消' && /^09\d{8}$/.test(record.phone) && !record.id.startsWith('CH-LOOKUP-'))
  if (current) fixtures.unshift({ identity: current.identity, phone: current.phone, name: current.name, description: '剛建立的預約，可確認各篩檢資料是否帶入', records: [] })
  return fixtures
})
function fillLookupSample(sample) {
  // Only an explicit test-data button creates these isolated local fixtures.
  const place = events.value.find(item => item.id === 1)
  const missing = sample.records.filter(record => !reservations.value.some(value => value.id === record.id))
  if (missing.length && (!place || place.capacity - place.booked < missing.length)) return tell('測試場次名額不足，請先取消其他測試預約')
  for (const record of missing) {
    reservations.value.push({ ...record, identity: sample.identity, phone: sample.phone, name: sample.name, birth: '1965-01-01', address: '彰化縣彰化市模擬路 1 號', eventId: place.id, slot: '10:00－10:30', source: '模擬查詢資料', status: '已預約', program: 'station' })
    place.booked++
  }
  Object.assign(lookup, { identity: sample.identity, phone: sample.phone })
  lookupCode.value = ''; inputCode.value = ''; found.value = null; lookupMatches.value = []; stage.value = 'lookup'
  tell('已帶入測試資料，請產生手機驗證碼')
}
watch([() => lookup.identity, () => lookup.phone], () => { lookupCode.value = ''; inputCode.value = ''; found.value = null; lookupMatches.value = [] })

watch([() => route.name, () => route.query.action], ([name, action]) => {
  if (action === 'lookup') { stage.value = 'lookup'; return }
  if (name === 'bookingInvitation') chooseProgram('integrated')
  else if (name === 'bookingGeneral') openGeneralEntry()
  else if (name === 'booking') stage.value = 'home'
}, { immediate: true })

const preselected = events.value.find(e => String(e.id) === String(route.query.eventId))
if (preselected) { program.value = preselected.type === '整合式篩檢' ? 'integrated' : preselected.type === '腸篩專案' ? 'bowel' : 'station'; event.value = preselected.type === '腸篩專案' ? null : preselected; screening.value = preselected.type === '腸篩專案' ? '大腸癌篩檢' : preselected.screenings[0]; stage.value = program.value === 'integrated' ? 'invite' : 'identityLookup' }
if (route.query.action === 'lookup') stage.value = 'lookup'
</script>

<template>
  <div class="booking-flow natural-surface min-h-screen bg-[#f8f6f0] text-[#2f493a]" :style="preservedPageHeight ? { minHeight: `${preservedPageHeight}px` } : undefined">
    <header class="border-b border-[#d8ddce] bg-white"><div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4"><PublicBrand @click="router.push('/')" /><button class="shrink-0 rounded-lg border border-[#d8ddce] px-3 py-2 text-sm font-normal text-[#526c4b] hover:bg-[#e7ecdf]" @click="router.push('/')">返回首頁</button></div></header>
    <main class="mx-auto max-w-6xl px-5 py-9 sm:py-12">
      <p class="sr-only" aria-live="polite" aria-atomic="true">{{ flowStep ? `目前第 ${flowStep} 步：${flowLabels[flowStep - 1]}` : ['home', 'noInvite'].includes(stage) ? '請選擇預約方式或篩檢項目' : '查詢或取消預約' }}</p>
      <Transition name="booking-step" @after-enter="ensureStepVisible">
      <div :key="transitionKey" :class="['mx-auto', ['home', 'noInvite'].includes(stage) ? '' : 'max-w-4xl']"><div class="mb-8"><nav aria-label="目前位置" class="mb-7 text-sm text-[#59695a]"><button class="underline-offset-4 hover:underline" @click="router.push('/')">首頁</button><span class="mx-2" aria-hidden="true">›</span><span aria-current="page">我要預約篩檢</span></nav><h1 class="text-3xl font-normal tracking-[-0.025em] sm:text-4xl">{{ stage === 'home' ? '開始預約' : stage === 'identityLookup' ? '查詢篩檢資格' : stage === 'noInvite' ? '篩檢資格查詢結果' : flowStep ? title : '查詢／取消預約' }}</h1><p class="mt-3 text-base leading-7 text-[#59695a]">{{ stage === 'home' ? '請選擇我有邀約碼或一般篩檢預約。' : stage === 'identityLookup' ? '先查詢名冊與篩檢資格。' : stage === 'noInvite' ? '請查看各項 DEMO 資格判定與可預約項目。' : flowStep ? '依照下方步驟填寫，即可完成預約。' : '使用身分證字號與手機號碼查詢已建立的預約。' }}</p></div>
      <div v-if="stage === 'home'" class="mb-7 flex flex-col gap-3 rounded-xl border border-[#d8ddce] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p class="text-base font-normal">已經預約了嗎？</p><p class="mt-1 text-sm leading-6 text-[#59695a]">查看預約資訊，或取消已建立的預約。</p></div>
        <button class="inline-flex min-h-11 shrink-0 items-center justify-center gap-3 self-start rounded-lg border border-[#b6c3a8] px-4 py-2 text-sm font-normal text-[#526c4b] hover:bg-[#e7ecdf] sm:self-auto" @click="stage = 'lookup'"><svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>查詢／取消預約</button>
      </div>
      <div v-if="flowStep" class="mb-8 rounded-2xl bg-[#e7ecdf] px-5 py-6 sm:px-7"><div class="flex items-center justify-between gap-3 text-sm text-[#23554b]"><span>預約進度</span><span>第 {{ flowStep }} 步，共 {{ flowLabels.length }} 步</span></div><div class="mt-4 flex gap-1.5 sm:hidden" aria-hidden="true"><span v-for="n in flowLabels.length" :key="n" :class="['h-1.5 flex-1 rounded-full', n <= flowStep ? 'bg-[#526c4b]' : 'bg-[#d8ddce]']"></span></div><p class="mt-3 text-base sm:hidden">目前：{{ flowLabels[flowStep - 1] }}</p><ol class="mt-6 hidden grid-cols-5 gap-2 sm:grid"><li v-for="(label, index) in flowLabels" :key="label" :aria-current="flowStep === index + 1 ? 'step' : undefined" :class="['relative min-w-0 border-t pt-4 text-center text-xs leading-5', index + 1 <= flowStep ? 'border-[#526c4b] text-[#526c4b]' : 'border-[#b6c3a8] text-[#59695a]']"><span :class="['absolute -top-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border text-xs', index + 1 <= flowStep ? 'border-[#526c4b] bg-[#526c4b] text-white' : 'border-[#b6c3a8] bg-[#e7ecdf] text-[#59695a]']">{{ index + 1 }}</span>{{ label }}</li></ol></div>
      <section ref="stepSection" :class="['home', 'noInvite'].includes(stage) ? '' : 'card p-6 md:p-8'">
        <div v-if="stage === 'home'" class="grid gap-5 md:grid-cols-2">
          <button class="booking-choice booking-choice--invite group" @click="router.push('/booking/invitation')"><span class="booking-choice__icon bg-[#e7ecdf] text-[#286a4e]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M12 5v2m0 3v4m0 3v2"/></svg></span><span class="block text-2xl font-normal text-[#2f493a]">我有邀約碼</span><span class="mt-2 block text-base leading-7 text-[#59695a]">已收到衛生所簡訊、明信片或邀約通知的民眾，可使用邀約碼快速預約。</span><span class="booking-choice__action bg-[#526c4b] text-white">使用邀約碼 <span aria-hidden="true">→</span></span></button>
          <button class="booking-choice booking-choice--public group" @click="router.push('/booking/general')"><span class="booking-choice__icon bg-[#f1ebdf] text-[#59695a]"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/></svg></span><span class="block text-2xl font-normal text-[#2f493a]">一般篩檢預約</span><span class="mt-2 block text-base leading-7 text-[#59695a]">未持有邀約碼，或想查詢自己目前符合哪些癌症篩檢資格，可由此開始。</span><span class="booking-choice__action bg-[#746750] text-white">查詢篩檢資格 <span aria-hidden="true">→</span></span></button>
        </div>
        <form v-else-if="stage === 'identityLookup'" class="space-y-5" @submit.prevent="lookupGeneralEligibility">
          <h2 class="text-xl font-normal">查詢名冊與篩檢資格</h2>
          <p class="text-base leading-7 text-[#59695a]">請先輸入身分證字號及出生年月日，系統會顯示目前符合資格的篩檢項目。此頁只使用模擬名冊，請勿輸入真實個資。</p>
          <div class="grid gap-4 sm:grid-cols-2"><div><label class="label" for="general-identity">身分證字號</label><input id="general-identity" v-model.trim="person.identity" class="field uppercase" maxlength="10" autocomplete="off" required></div><div><label class="label" for="general-birth">出生年月日</label><input id="general-birth" v-model="lookupBirth" type="date" class="field" required></div></div>
          <div class="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" class="btn-secondary" @click="back">返回預約方式</button><button class="btn-primary">查詢資格</button></div>
          <details class="border-t border-[#d8ddce] pt-5 text-sm text-[#59695a]"><summary class="cursor-pointer py-2 text-[#526c4b]">查看模擬測試資料</summary><button v-for="sample in qualificationSamples" :key="sample.identity" type="button" class="mt-3 mr-3 min-h-11 rounded-lg border border-[#d8ddce] px-3" @click="person.identity = sample.identity; lookupBirth = sample.birth">{{ sample.scenario }} · {{ sample.identity }} · {{ sample.birth }}</button></details>
        </form>
        <div v-else-if="stage === 'noInvite'" class="space-y-5">
          <p class="text-base leading-7 text-[#59695a]">以下使用本機 DEMO 名冊與規則判定；正式資格仍須由承辦單位核對。</p>
          <div class="grid gap-4 md:grid-cols-3">
            <label v-for="item in qualificationResult?.results || []" :key="item.value" :class="['screening-option', item.canBook ? 'cursor-pointer' : 'screening-option--disabled cursor-not-allowed']">
               <PublicIcon name="guide" class="mb-4 h-8 w-8" />
               <span class="mb-3 flex items-center gap-3"><input type="checkbox" class="h-5 w-5 shrink-0" :checked="selectedScreenings.includes(item.value)" :disabled="!item.canBook" :aria-label="item.label" @change="toggleGeneralScreening(item)"><span>{{ item.canBook ? '可預約' : '目前不可預約' }}</span></span>
               <h3 class="text-2xl font-normal">{{ item.label }}</h3>
               <p class="mt-3 text-base leading-7 text-[#59695a]">資格說明：{{ item.description }}</p>
               <p class="mt-3 text-base leading-7" :class="item.canBook ? 'text-[#40573c]' : 'text-[#8b3327]'">{{ item.canBook ? '系統判定：您目前符合此項篩檢資格。' : `不可預約原因：${item.reasonMessage}` }}</p>
            </label>
           </div>
           <p v-if="qualifiedScreenings.length" class="text-base leading-7 text-[#59695a]">可勾選一項或多項；後續各項目會分別選擇場次、時段或領管院所，聯絡與基本資料只需填寫一次。</p>
           <button v-if="qualifiedScreenings.length" type="button" class="btn-primary" :disabled="!selectedScreenings.length" @click="startSelectedScreenings">開始預約所選 {{ selectedScreenings.length }} 項篩檢</button>
          <p v-if="!qualifiedScreenings.length" role="status" class="rounded-xl bg-[#f1ebdf] p-4 text-base leading-7">目前沒有符合 DEMO 資格的項目。請核對各項條件；如需協助，請聯絡衛生局或衛生所。</p>
          <button class="rounded-lg px-3 py-2 text-sm text-[#40573c] underline-offset-4 hover:underline" @click="back">← 返回資格查詢</button>
        </div>
        <div v-else-if="stage === 'invite'" class="space-y-5">
          <h2 class="text-xl font-normal">輸入邀約碼</h2>
          <p class="text-sm leading-6 text-[#59695a]">邀約碼共 10 碼，由 4 碼鄉鎮代碼與 6 碼身分證號碼組成。此頁使用模擬名冊，請輸入下方測試邀約碼。</p>
          <div><label class="label" for="booking-invite">邀約碼</label><input id="booking-invite" v-model="invite" class="field" maxlength="11" inputmode="numeric" autocomplete="off" placeholder="例如 3701 000012" :aria-invalid="!!invitationError" :aria-describedby="invitationError ? 'invitation-error' : undefined" @keyup.enter="confirmInvite"><p v-if="invitationError" id="invitation-error" role="alert" class="mt-2 text-base leading-7 text-[#9b342b]">{{ invitationError }}</p></div>
          <p class="text-sm leading-6 text-[#59695a]">確認後，會將對應的身分證字號、姓名、出生日期與地址帶入後續「基本資料」步驟；手機與電子郵件仍需自行填寫。</p>
          <div class="flex flex-wrap gap-3"><button class="btn-secondary" @click="back">返回預約方式</button><button class="btn-primary" :disabled="checkingInvitation" @click="confirmInvite">{{ checkingInvitation ? '驗證中…' : '確認邀約碼' }}</button></div>
          <div class="border-t border-[#d8ddce] pt-5">
            <h3 class="text-base font-normal">模擬測試資料</h3>
            <p class="mt-2 text-sm leading-6 text-[#59695a]">可使用兩組邀約碼，核對後續帶入的資料是否一致。</p>
            <ul class="mt-4 divide-y divide-[#d8ddce]">
              <li v-for="sample in invitationSamples" :key="sample.code" class="py-4 first:pt-0">
                <div class="flex flex-wrap items-center justify-between gap-3"><p class="text-base tabular-nums">{{ sample.code }}</p><button type="button" class="min-h-11 rounded-lg border border-[#d8ddce] px-3 py-2 text-sm text-[#526c4b] hover:bg-[#e7ecdf]" @click="invite = sample.code">填入此邀約碼</button></div>
                <p class="mt-2 text-sm leading-7 text-[#59695a]">{{ sample.name }} · {{ sample.identity }}<br>出生日期：{{ sample.birth }}<br>戶籍地址：{{ sample.householdCounty }}{{ sample.householdArea }}{{ sample.householdVillage }}{{ sample.householdDetail }}</p>
              </li>
            </ul>
            <p class="text-sm leading-6 text-[#59695a]">以上皆為本機模擬資料，不會查詢實際邀約名冊。</p>
          </div>
        </div>
        <form v-else-if="stage === 'eligibility'" class="space-y-5" novalidate @submit.prevent="confirmEligibility">
          <h2 class="text-xl font-normal">確認篩檢資格</h2>
          <p class="text-base leading-7 text-[#59695a]">請輸入身分證字號，確認年齡及所選項目的篩檢紀錄。符合資格後，即可選擇場次。</p>
          <div v-if="program === 'station'"><label class="label" for="booking-screening">篩檢項目</label><select id="booking-screening" v-model="screening" class="field"><option disabled value="">請選擇</option><option v-for="item in ['子宮頸抹片', '乳房攝影', '大腸癌篩檢']" :key="item">{{ item }}</option></select></div>
          <div v-else class="rounded-xl bg-[#e7ecdf] p-4">糞便潛血檢查 · 領取檢體管</div>
          <div>
            <label class="label" for="booking-eligibility-identity">身分證字號</label>
            <input id="booking-eligibility-identity" v-model="person.identity" class="field uppercase" type="text" maxlength="10" autocomplete="off" autocapitalize="characters" :spellcheck="false" :aria-invalid="!!eligibilityError" :aria-describedby="eligibilityError ? 'eligibility-hint eligibility-error' : 'eligibility-hint'" placeholder="請輸入 1 碼英文及 9 碼數字">
            <p id="eligibility-hint" class="mt-2 text-sm leading-6 text-[#59695a]">本機 DEMO 僅比對模擬名冊，請使用下方測試資料，勿輸入真實個資。</p>
          </div>
          <div v-if="eligibilityError" id="eligibility-error" role="alert" class="rounded-xl border border-[#e5b8ad] bg-[#fff3ef] p-4 text-[#8b3327]">
            <p class="font-normal">資料輸入錯誤或不符合資格</p>
            <p class="mt-1 text-sm leading-6">{{ eligibilityError }}</p>
          </div>
          <p class="text-sm leading-6 text-[#59695a]">DEMO 門檻：{{ screening ? `${screening === '大腸癌篩檢' ? '糞便潛血檢查' : screening}須滿 ${demoMinimumAges[screening]} 歲` : '請先選擇篩檢項目' }}，且未做過該項目。此為模擬規則，報到時仍會核對實際資格。</p>
          <div class="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" class="btn-secondary" @click="back">返回選擇</button><button type="submit" class="btn-primary">驗證資格並繼續</button></div>
          <details class="border-t border-[#d8ddce] pt-5 text-sm text-[#59695a]">
            <summary class="cursor-pointer py-2 text-[#526c4b]">查看模擬測試資料</summary>
            <ul class="mt-3 space-y-4">
              <li v-for="sample in demoPeople" :key="sample.identity"><p>{{ sample.scenario }}</p><p class="mt-1 tabular-nums">{{ sample.identity }} · 出生日期 {{ sample.birth }}</p></li>
            </ul>
            <p class="mt-4 leading-6">字號錯誤或不在模擬名冊，也會驗證失敗；年齡由名冊的出生日期計算。</p>
          </details>
        </form>
        <div v-else-if="stage === 'suggestions'" class="space-y-6">
          <h2 class="text-2xl font-normal">其他篩檢資格</h2>
          <p class="text-base leading-7 text-[#59695a]">您目前同時符合以下篩檢資格，可依需求選擇是否一併預約。全部不勾選也可以繼續原本預約。</p>
          <p class="rounded-xl bg-[#e7ecdf] p-4 text-base leading-7">目前預約：{{ screeningLabel(screening || '整合式篩檢') }} · {{ event?.location || provider?.institution }} · {{ slot || (provider ? scheduleSummary(provider) : '') }}</p>
          <div class="space-y-3"><label v-for="item in otherQualificationRows" :key="item.value" :class="['block rounded-xl border p-4', item.canBook ? 'cursor-pointer border-[#d8ddce]' : 'cursor-not-allowed border-[#dce2df] bg-[#eef1ef] text-[#687571]']"><span class="flex items-center gap-3 text-lg"><input type="checkbox" class="h-5 w-5 shrink-0" :checked="extraScreenings.includes(item.value)" :disabled="!item.canBook" @change="toggleAdditional(item)">{{ item.label }}</span><span v-if="!item.canBook" class="mt-2 block text-sm leading-6 text-[#8b3327]">不可預約原因：{{ item.reasonMessage }}</span><span v-else class="mt-2 block text-sm leading-6 text-[#59695a]">{{ item.route === 'bowel' ? '加選後須選擇領管鄉鎮與院所。' : '加選後須選擇場次與時段。' }}</span></label></div>
          <div class="flex flex-col-reverse gap-3 sm:flex-row"><button class="btn-secondary" @click="back">返回基本資料</button><button class="btn-primary" @click="continueFromSuggestions">{{ extraScreenings.length ? `繼續預約加選的 ${extraScreenings.length} 項` : '不加選，完成原預約' }}</button></div>
        </div>
        <div v-else-if="stage === 'bowelTownship'" class="space-y-5">
          <h2 class="text-2xl font-normal">選擇領管鄉鎮與院所</h2>
          <p class="text-base leading-7 text-[#59695a]">本次預約的是領取糞便採檢管的地點；請選擇方便前往的鄉鎮與衛生所或藥局。</p>
          <div><label class="label" for="bowel-township">領管鄉鎮</label><select id="bowel-township" v-model="area" class="field"><option value="全部" disabled>請選擇鄉鎮</option><option v-for="item in bowelTownships" :key="item.township" :value="item.township" :disabled="!item.available">{{ item.township }}{{ item.available ? '' : '（目前無可領管院所）' }}</option></select></div>
          <div v-if="area !== '全部'" class="space-y-3">
            <h3 class="text-xl font-normal">{{ area }}可領管院所</h3>
            <button v-for="item in bowelProviders" :key="item.id" type="button" class="result-option" @click="chooseProvider(item)">
              <span class="block text-xl">{{ item.institution }} <span class="ml-2 text-sm text-[#59695a]">{{ item.institutionType }}</span></span>
              <span class="mt-1 block text-sm text-[#59695a]">{{ item.township }} · 地址：{{ item.address }}<br>電話：{{ item.phone }}</span>
              <span class="mt-3 block text-base leading-7">可領管星期與時間：</span>
              <span v-for="row in scheduleRows(item).filter(day => day.periods.length)" :key="row.day" class="block text-sm leading-6 text-[#59695a]">{{ row.label }}　{{ row.periods.map(period => period.start + '－' + period.end).join('、') }}</span>
              <span v-if="item.specialClosures.length" class="mt-2 block text-sm text-[#8b3327]">特殊公休：{{ item.specialClosures.join('、') }}，當日不可領管。</span>
            </button>
            <p v-if="!bowelProviders.length" class="py-8 text-center text-[#59695a]">此鄉鎮目前沒有可領管院所，請重新選擇。</p>
          </div>
          <button class="btn-secondary" @click="back">上一頁</button>
        </div>
        <div v-else-if="stage === 'bowelConfirm'" class="space-y-5">
          <h2 class="text-2xl font-normal">您選擇的領管地點</h2>
          <div class="rounded-xl bg-[#e7ecdf] p-5 text-base leading-7">
            <p class="text-xl">{{ provider?.institution }} <span class="ml-2 text-base text-[#59695a]">{{ provider?.institutionType }}</span></p>
            <p class="mt-2">糞便潛血檢查 · {{ provider?.township }}</p>
            <p>地址：{{ provider?.address }}</p><p>聯絡電話：{{ provider?.phone }}</p>
            <p class="mt-4">可領管星期與時間</p>
            <p v-for="row in pickupRows" :key="row.day">{{ row.label }}　{{ row.periods.map(period => period.start + '－' + period.end).join('、') }}</p>
            <p v-if="provider?.specialClosures?.length" class="mt-3 text-[#8b3327]">特殊公休：{{ provider.specialClosures.join('、') }}，當日不可領管。</p>
            <p v-if="pickupDates.length" class="mt-3 text-sm text-[#59695a]">近期可領管日期：{{ pickupDates.join('、') }}</p>
          </div>
          <p class="text-base leading-7 text-[#59695a]">請確認上述領管時間可以配合；若無法配合，請返回上一頁重新選擇。</p>
          <div class="flex flex-col-reverse gap-3 sm:flex-row"><button class="btn-secondary" @click="back">上一頁</button><button class="btn-primary" @click="confirmBowelInstitution">確定</button></div>
        </div>
        <div v-else-if="stage === 'search'" class="space-y-5"><h2 class="text-xl font-normal">{{ program === 'bowel' ? '選擇領管院所' : '選擇活動場次' }}</h2><div v-if="program === 'integrated' && matchedInvitation" class="rounded-xl bg-[#e7ecdf] p-5 text-base leading-7"><p class="text-lg">{{ matchedInvitation.name }} · {{ matchedInvitation.identity }}</p><p>出生年月日：{{ matchedInvitation.birth }}</p><p>戶籍地址：{{ matchedInvitation.householdCounty }}{{ matchedInvitation.householdArea }}{{ matchedInvitation.householdVillage }}{{ matchedInvitation.householdDetail }}</p><p class="mt-2 text-sm text-[#59695a]">邀約資料已帶入；請選擇可預約的整篩場次。</p></div><p v-if="program === 'station'" class="text-sm leading-6 text-[#59695a]">可依鄉鎮或日期尋找未來 30 天的可預約場次。</p><p v-else-if="program === 'bowel'" class="text-sm leading-6 text-[#59695a]">選擇方便前往領取檢體管的衛生所或藥局。</p><div v-if="program === 'station'" class="flex gap-2" role="group" aria-label="搜尋方式"><button :class="['search-tab', searchMode === 'area' ? 'search-tab--active' : '']" :aria-pressed="searchMode === 'area'" @click="setStationSearchMode('area')">依鄉鎮搜尋</button><button :class="['search-tab', searchMode === 'date' ? 'search-tab--active' : '']" :aria-pressed="searchMode === 'date'" @click="setStationSearchMode('date')">依日期搜尋</button></div><div v-if="program === 'bowel' || (program === 'station' && searchMode === 'area')"><label class="label" for="booking-area">鄉鎮市區</label><select id="booking-area" v-model="area" class="field"><option>全部</option><option v-for="item in areas" :key="item" :disabled="program === 'station' && !stationOptions.areas.includes(item)">{{ item }}{{ program === 'station' && !stationOptions.areas.includes(item) ? '（近 30 天無可預約場次）' : '' }}</option></select></div><div v-if="program === 'station' && searchMode === 'date'"><label class="label" for="booking-date">近期可預約日期</label><select id="booking-date" v-model="date" class="field"><option value="">請選擇日期</option><option v-for="item in stationOptions.dates" :key="item" :value="item">{{ item }}（{{ eventWeekday(item) }}）</option></select></div><div v-if="program === 'bowel'" class="space-y-3"><button v-for="p in eligibleProviders" :key="p.id" class="result-option" @click="chooseProvider(p)"><span class="block text-base">{{ p.name }} <span class="ml-2 text-xs text-[#526c4b]">{{ p.category }}</span></span><span class="mt-1 block text-sm text-[#59695a]">{{ p.hours }} · {{ p.address }}</span></button><p v-if="!eligibleProviders.length" class="py-8 text-center text-[#59695a]">這個鄉鎮目前沒有可預約的 DEMO 院所，請改選其他鄉鎮。</p></div><div v-else class="space-y-3"><button v-for="e in eligibleEvents" :key="e.id" class="result-option" :disabled="program === 'station' ? !slotsFor(e).some(time => time.left > 0) : e.booked >= e.capacity" @click="chooseEvent(e)"><span class="block text-base">{{ e.location }}</span><span class="mt-1 block text-sm text-[#59695a]">{{ e.date }}（{{ eventWeekday(e.date) }}） · {{ e.start }}－{{ e.end }}<br>{{ e.address }}</span><span v-if="program === 'station'" class="mt-2 block text-sm text-[#59695a]">提供項目：{{ e.screenings.map(screeningLabel).join('、') }}</span><span class="mt-2 block text-sm" :class="program === 'station' ? (slotsFor(e).some(time => time.left > 0) ? 'text-[#b3322c]' : 'text-[#687571]') : (e.booked >= e.capacity ? 'text-[#687571]' : 'text-[#b3322c]')">{{ program === 'station' ? (slotsFor(e).some(time => time.left > 0) ? '此項目尚有可預約時段' : '此項目已額滿') : (e.booked >= e.capacity ? '已額滿 · 剩餘 0 名' : `剩餘 ${e.capacity - e.booked} 名`) }}</span></button><p v-if="!eligibleEvents.length" class="py-8 text-center text-[#59695a]">{{ program === 'station' && searchMode === 'date' && !date ? '請先選擇近期可預約日期。' : '沒有符合條件的可預約場次，請改選其他鄉鎮或日期。' }}</p></div><button class="btn-secondary" @click="back">上一頁</button></div>
        <div v-else-if="stage === 'slots'" class="space-y-5"><h2 class="text-xl font-normal">確認場次與時段</h2><div class="rounded-2xl bg-[#e7ecdf] p-5"><p>{{ selectedPlace?.location || selectedPlace?.name }}</p><p class="mt-2 text-sm text-[#59695a]">{{ event?.date ? event.date + '（' + eventWeekday(event.date) + '）' : provider?.hours }} · {{ selectedPlace?.address }}</p></div><template v-if="program !== 'bowel'"><p class="text-sm text-[#59695a]">請選擇尚有名額的預約時段。</p><div class="grid gap-2 sm:grid-cols-2"><button v-for="item in slotsFor(event)" :key="item.label" :aria-pressed="slot === item.label" :disabled="item.left <= 0" :class="['rounded-xl border p-3 text-left text-sm', item.left <= 0 ? 'border-[#dce2df] bg-[#eef1ef] text-[#687571] cursor-not-allowed' : slot === item.label ? 'border-[#526c4b] bg-[#e7ecdf] text-[#526c4b]' : 'border-[#d8ddce]']" @click="chooseSlot(item.label)"><span>{{ item.label }}</span><span class="ml-2" :class="item.left > 0 ? 'text-[#b3322c]' : 'text-[#687571]'">{{ item.closed ? '暫停預約' : item.left > 0 ? `剩餘 ${item.left} 名` : '已額滿 · 剩餘 0 名' }}</span></button></div><p v-if="!slotsFor(event).some(item => item.left > 0)" class="text-sm text-[#59695a]">這個場次的時段已額滿，請返回選擇其他場次。</p></template><p v-else class="text-sm text-[#59695a]">請確認您可以配合院所的領管時間。</p><div class="flex flex-wrap gap-3"><button class="btn-secondary" @click="back">上一頁</button><button class="btn-primary" @click="continueFromSlots">確認並繼續</button></div></div>
        <div v-else-if="stage === 'additional'" class="space-y-6">
          <h2 class="text-2xl font-normal">選擇加選項目的場次</h2>
          <p class="text-base leading-7 text-[#59695a]">原本的預約已保留。若同場次提供加選檢查，會先帶入該場次，請再選擇時段；也可以選其他場次。</p>
          <div class="rounded-xl bg-[#e7ecdf] p-4 text-base leading-7"><p>已保留：{{ screeningLabel(screening || '整合式篩檢') }}</p><p>{{ event?.location }} · {{ event?.date }}</p><p>{{ slot }}</p></div>
          <fieldset v-for="plan in extraPlans" :key="plan.screening" class="min-w-0 space-y-4 rounded-xl border border-[#d8ddce] p-4 sm:p-5">
            <legend class="px-2 text-xl">{{ screeningLabel(plan.screening) }}</legend>
            <div class="flex justify-end"><button type="button" class="min-h-11 px-2 text-base text-[#59695a] underline underline-offset-4" @click="removeExtra(plan.screening)">移除這個加選項目</button></div>
            <div v-if="plan.screening === '大腸癌篩檢'"><label class="label" :for="'extra-route-' + plan.screening">預約方式</label><select :id="'extra-route-' + plan.screening" v-model="plan.program" class="field" @change="plan.eventId = ''; plan.providerId = ''; plan.slot = ''"><option value="bowel">至院所領取檢體管</option></select></div>
            <template v-if="plan.program === 'station'">
              <div><label class="label" :for="'extra-event-' + plan.screening">檢查場次</label><select :id="'extra-event-' + plan.screening" v-model="plan.eventId" class="field" @change="plan.slot = ''"><option value="">請選擇場次</option><option v-for="place in extraEvents(plan.screening)" :key="place.id" :value="place.id" :disabled="place.booked >= place.capacity || !slotsFor(place, plan.screening).some(time => time.left > 0)">{{ place.date }} · {{ place.location }}{{ place.id === event?.id ? '（與原項目同場次）' : '' }}{{ place.booked >= place.capacity || !slotsFor(place, plan.screening).some(time => time.left > 0) ? ' · 已額滿' : '' }}</option></select></div>
              <p v-if="!extraEvents(plan.screening).some(place => slotsFor(place, plan.screening).some(time => time.left > 0))" class="text-base leading-7 text-[#59695a]">目前沒有可預約場次，可移除此項目後繼續原本的預約。</p>
              <template v-if="planEvent(plan)"><p class="text-base leading-7 text-[#59695a]">{{ planEvent(plan).address }}<br>{{ planEvent(plan).start }}－{{ planEvent(plan).end }}</p>
                <div class="grid gap-3 sm:grid-cols-2" role="group" :aria-label="screeningLabel(plan.screening) + '預約時段'"><button v-for="time in slotsFor(planEvent(plan), plan.screening)" :key="time.label" type="button" :disabled="time.left <= 0" :aria-pressed="plan.slot === time.label" :class="['min-h-16 rounded-xl border p-3 text-left text-base', time.left <= 0 ? 'cursor-not-allowed border-[#dce2df] bg-[#eef1ef] text-[#687571]' : plan.slot === time.label ? 'border-[#526c4b] bg-[#e7ecdf]' : 'border-[#d8ddce]']" @click="plan.slot = time.label"><span class="block">{{ time.label }}</span><span class="mt-1 block" :class="time.left > 0 ? 'text-[#b3322c]' : 'text-[#687571]'">{{ time.closed ? '暫停預約' : time.left > 0 ? '剩餘 ' + time.left + ' 名' : '已額滿 · 剩餘 0 名' }}</span></button></div>
              </template>
            </template>
            <template v-else><div><label class="label" :for="'extra-township-' + plan.screening">領管鄉鎮</label><select :id="'extra-township-' + plan.screening" v-model="plan.township" class="field" @change="plan.providerId = ''"><option value="">請選擇鄉鎮</option><option v-for="item in bowelTownships" :key="item.township" :value="item.township" :disabled="!item.available">{{ item.township }}{{ item.available ? '' : '（無可領管院所）' }}</option></select></div><div v-if="plan.township"><label class="label" :for="'extra-provider-' + plan.screening">領管院所</label><select :id="'extra-provider-' + plan.screening" v-model="plan.providerId" class="field"><option value="">請選擇院所</option><option v-for="place in institutionsInTownship(plan.township, bowelInstitutions)" :key="place.id" :value="place.id">{{ place.institution }}（{{ place.institutionType }}）</option></select></div><p v-if="planProvider(plan)" class="rounded-xl bg-[#f1ebdf] p-4 text-base leading-7">{{ planProvider(plan).institution }} · {{ scheduleSummary(planProvider(plan)) }}<br>{{ planProvider(plan).address }}</p></template>
          </fieldset>
          <p v-if="!extraPlans.length" class="text-base text-[#59695a]">已移除所有加選項目，這次只預約原項目。</p>
          <div class="flex flex-col-reverse gap-3 sm:flex-row"><button class="btn-secondary" @click="back">返回加選確認</button><button class="btn-primary" @click="continueFromExtras">確認並繼續</button></div>
        </div>
        <form v-else-if="stage === 'phone'" class="space-y-6" novalidate @submit.prevent="confirmContact">
          <h2 class="text-xl font-normal">聯絡方式與驗證</h2>
          <div class="divide-y divide-[#d8ddce] rounded-xl bg-[#e7ecdf] px-4"><div v-for="plan in bookingPlans" :key="plan.screening" class="py-4 text-base leading-7"><p>{{ screeningLabel(plan.screening) }}</p><p>{{ plan.event?.location || plan.provider?.institution || plan.provider?.name }}</p><p>{{ plan.program === 'bowel' ? scheduleSummary(plan.provider) : `${plan.event?.date} ${plan.slot || plan.provider?.hours}` }}</p></div></div>
          <p class="text-base leading-7 text-[#59695a]">手機號碼須完成驗證。E-mail 為選填；若有填寫，也請在此頁完成驗證。</p>
          <div class="space-y-4">
            <div><label class="label" for="booking-phone">手機號碼（必填）</label><input id="booking-phone" v-model.trim="person.phone" class="field" maxlength="10" inputmode="tel" autocomplete="tel" placeholder="0912345678" aria-required="true"></div>
            <p role="status" class="text-sm" :class="verifiedPhone === person.phone && person.phone ? 'text-[#40573c]' : 'text-[#8b3327]'">手機：{{ verifiedPhone === person.phone && person.phone ? '已完成驗證' : '尚未驗證' }}</p>
            <button type="button" class="btn-secondary" @click="sendPhone()">{{ phoneCode ? '重新產生手機驗證碼' : '產生手機驗證碼' }}</button>
            <p v-if="phoneCode" id="demo-phone-code" class="text-sm leading-6 text-[#526c4b]" role="status">本機 DEMO 手機驗證碼：<span class="tracking-widest">{{ phoneCode }}</span>（5 分鐘內有效）</p>
            <div v-if="phoneCode"><label class="label" for="booking-phone-code">手機驗證碼</label><input id="booking-phone-code" v-model.trim="phoneInputCode" class="field" maxlength="6" inputmode="numeric" autocomplete="one-time-code"><button type="button" class="btn-secondary mt-3" @click="confirmPhoneCode">確認手機驗證碼</button></div>
          </div>
          <div class="space-y-4 border-t border-[#d8ddce] pt-6">
            <div><label class="label" for="booking-email">電子郵件（選填）</label><input id="booking-email" v-model.trim="person.email" type="email" class="field" autocomplete="email" placeholder="不填寫也可以繼續" aria-describedby="booking-email-hint"><p id="booking-email-hint" class="mt-2 text-sm leading-6 text-[#59695a]">若填寫電子郵件，請一併完成驗證；不需要時可留空。</p></div>
            <p role="status" class="text-sm" :class="!person.email || verifiedEmail === person.email ? 'text-[#40573c]' : 'text-[#8b3327]'">E-mail：{{ !person.email ? '選填' : verifiedEmail === person.email ? '已完成驗證' : '尚未驗證' }}</p>
            <template v-if="person.email">
              <button type="button" class="btn-secondary" @click="sendEmail">{{ emailCode ? '重新產生信箱驗證碼' : '產生信箱驗證碼' }}</button>
              <p v-if="emailCode" id="demo-email-code" class="text-sm leading-6 text-[#526c4b]" role="status">本機 DEMO 信箱驗證碼：<span class="tracking-widest">{{ emailCode }}</span>（15 分鐘內有效）</p>
              <div v-if="emailCode"><label class="label" for="booking-email-code">電子郵件驗證碼</label><input id="booking-email-code" v-model.trim="emailInputCode" class="field" maxlength="6" inputmode="numeric" autocomplete="off"><button type="button" class="btn-secondary mt-3" @click="confirmEmailCode">確認 E-mail 驗證碼</button></div>
            </template>
          </div>
          <p class="text-sm leading-6 text-[#59695a]">本機 DEMO 驗證碼顯示在畫面上，不會發送簡訊或 E-mail。</p>
          <div class="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" class="btn-secondary" @click="back">上一頁</button><button type="submit" class="btn-primary">下一步：基本資料</button></div>
        </form>
        <form v-else-if="stage === 'profile'" class="space-y-6" novalidate @submit.prevent="saveProfile">
          <div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-2xl font-normal">基本資料</h2><button v-if="!profileEditing" type="button" class="btn-secondary inline-flex items-center gap-2" @click="beginProfileEdit"><PublicIcon name="edit" class="h-5 w-5" />修改基本資料</button></div>
          <p class="text-base leading-7 text-[#59695a]">{{ program === 'integrated' ? '以下資料由邀約資料帶入，請確認內容是否正確。如需調整，可點選右上角「修改基本資料」。' : profileSource === 'self' ? '您不在 DEMO 彰化縣民名冊中，請自行填寫姓名與戶籍地址，再確認現居地址。' : 'DEMO 名冊已帶入姓名與戶籍地址；如需更正，請點「修改基本資料」。' }}</p>
          <div class="grid gap-4 sm:grid-cols-2"><div><label class="label" for="profile-identity">身分證字號（已驗證）</label><input id="profile-identity" :value="person.identity" class="field" readonly></div><div><label class="label" for="profile-birth">出生年月日（名冊資料）</label><input id="profile-birth" :value="person.birth" class="field" readonly></div></div>
          <fieldset :disabled="!profileEditing" class="space-y-5"><legend class="sr-only">姓名與戶籍地址</legend><div><label class="label" for="profile-name">姓名（必填）</label><input id="profile-name" v-model="person.name" class="field" required></div><div><label class="label">戶籍地址（必填）</label><div class="grid gap-3 sm:grid-cols-3"><select v-model="person.householdCounty" class="field" aria-label="戶籍縣市" @change="person.householdArea = person.householdCounty === '彰化縣' ? '彰化市' : ''; person.householdVillage = ''"><option v-for="item in counties" :key="item">{{ item }}</option></select><select v-if="person.householdCounty === '彰化縣'" v-model="person.householdArea" class="field" aria-label="戶籍鄉鎮" @change="person.householdVillage = ''"><option v-for="item in areas" :key="item">{{ item }}</option></select><input v-else v-model="person.householdArea" class="field" aria-label="戶籍鄉鎮" placeholder="鄉鎮市區" required><select v-model="person.householdVillage" class="field" aria-label="戶籍村里" required><option value="">選擇村里</option><option v-for="item in villagesFor(person.householdArea)" :key="item">{{ item }}</option></select></div><input v-model="person.householdDetail" class="field mt-3" aria-label="戶籍詳細地址" placeholder="詳細地址" required></div></fieldset>
          <div v-if="profileEditing" class="flex flex-wrap gap-3"><button type="button" class="btn-secondary" @click="cancelProfileEdit">取消修改</button><button type="button" class="btn-primary" @click="finishProfileEdit">儲存基本資料修改</button></div>
          <p class="text-base leading-7 text-[#59695a]">身分證或出生日期有誤？<button type="button" class="min-h-12 text-[#40573c] underline underline-offset-4" @click="reverifyIdentity">重新驗證身分</button></p>
          <fieldset :disabled="program === 'integrated' && !profileEditing" class="border-t border-[#d8ddce] pt-6"><h3 class="text-xl font-normal">目前居住地址</h3><label class="my-4 flex min-h-12 items-center gap-3 text-base"><input id="same-address" v-model="sameAddress" type="checkbox" class="h-5 w-5">現居地址同戶籍地址</label><p class="mb-4 text-base leading-7 text-[#59695a]">如需更改現居地址，請在修改模式中調整。</p><div v-if="!sameAddress"><div class="grid gap-3 sm:grid-cols-3"><select v-model="person.currentCounty" class="field" aria-label="現居縣市" @change="person.currentArea = person.currentCounty === '彰化縣' ? '彰化市' : ''; person.currentVillage = ''"><option v-for="item in counties" :key="item">{{ item }}</option></select><select v-if="person.currentCounty === '彰化縣'" v-model="person.currentArea" class="field" aria-label="現居鄉鎮" @change="person.currentVillage = ''"><option v-for="item in areas" :key="item">{{ item }}</option></select><input v-else v-model="person.currentArea" class="field" aria-label="現居鄉鎮" placeholder="鄉鎮市區" required><select v-model="person.currentVillage" class="field" aria-label="現居村里" required><option value="">選擇村里</option><option v-for="item in villagesFor(person.currentArea)" :key="item">{{ item }}</option></select></div><input id="profile-current-detail" v-model="person.currentDetail" class="field mt-3" aria-label="現居詳細地址" placeholder="請填寫目前居住的詳細地址" required></div><p v-else class="rounded-xl bg-[#e7ecdf] p-4 text-base leading-7">{{ person.householdCounty }}{{ person.householdArea }}{{ person.householdVillage }}{{ person.householdDetail }}</p></fieldset>
          <div class="space-y-3 border-t border-[#d8ddce] pt-6"><h3 class="text-xl font-normal">確認本次預約</h3><div class="divide-y divide-[#d8ddce] rounded-xl bg-[#e7ecdf] px-4"><div v-for="plan in bookingPlans" :key="plan.screening" class="py-4 text-base leading-7"><p>{{ screeningLabel(plan.screening) }}</p><p>{{ plan.event?.location || plan.provider?.institution || plan.provider?.name }}</p><p>{{ plan.program === 'bowel' ? scheduleSummary(plan.provider) : `${plan.event?.date} ${plan.slot || plan.provider?.hours}` }}</p></div></div></div>
          <div class="flex flex-col-reverse gap-3 sm:flex-row"><button type="button" class="btn-secondary" @click="back">上一頁</button><button type="submit" class="btn-primary" :disabled="profileEditing">{{ program === 'bowel' ? '確認基本資料' : '確認資料並檢查其他篩檢' }}</button></div>
        </form>
        <div v-else-if="stage === 'done'" class="space-y-5"><div class="flex h-14 w-14 items-center justify-center rounded-full bg-[#e7ecdf] text-2xl text-[#526c4b]" aria-hidden="true">✓</div><h2 class="text-2xl font-normal">預約完成</h2><p class="text-base leading-7 text-[#59695a]">{{ person.name }}，已為您建立 {{ completionRecords.length }} 筆 DEMO 預約。</p>
          <div v-for="record in completionRecords" :key="record.id" class="rounded-xl bg-[#e7ecdf] p-5 text-base leading-7"><template v-if="record.program === 'bowel'"><h3 class="text-xl font-normal">糞便潛血檢查</h3><p class="mt-2 break-all">領管預約編號：{{ record.bowelReservationId || record.id }}</p><p>領管院所：{{ recordPlace(record)?.institution || recordPlace(record)?.name }}</p><p>院所類型：{{ recordPlace(record)?.institutionType || recordPlace(record)?.category }}</p><p>地址：{{ recordPlace(record)?.address }}</p><p>聯絡電話：{{ recordPlace(record)?.phone }}</p><p class="mt-3">可領管星期與時間：</p><p v-if="!recordPlace(record)?.weeklySchedule">{{ pickupScheduleForRecord(record) }}</p><p v-for="row in recordPlace(record)?.weeklySchedule ? scheduleRows(recordPlace(record)).filter(day => day.periods.length) : []" :key="row.day">{{ row.label }}　{{ row.periods.map(period => period.start + '－' + period.end).join('、') }}</p><p v-if="recordPlace(record)?.specialClosures?.length" class="mt-2 text-[#8b3327]">特殊公休：{{ recordPlace(record).specialClosures.join('、') }}</p><p class="mt-3">所屬衛生所聯絡資訊：{{ recordPlace(record)?.healthCenterContact?.name || '待提供' }} · {{ recordPlace(record)?.healthCenterContact?.phone || '待提供' }}</p><p class="mt-3">收到領管通知後，請攜帶健保卡至預約地點領管。</p></template><template v-else><h3 class="text-xl font-normal">{{ screeningLabel(record.screening) }}</h3><p class="mt-2 break-all">預約編號：{{ record.id }}</p><p>{{ recordPlace(record)?.location || recordPlace(record)?.name }}</p><p>{{ recordPlace(record)?.date ? `${recordPlace(record).date}（${eventWeekday(recordPlace(record).date)}）` : '依院所領管時間' }} · {{ record.slot }}</p><p v-if="recordPlace(record)?.start">活動時間：{{ recordPlace(record).start }}－{{ recordPlace(record).end }}</p><p>活動地址：{{ recordPlace(record)?.address }}</p><p v-if="recordPlace(record)?.screenings?.length">篩檢項目：{{ recordPlace(record).screenings.join('、') }}</p><p v-if="recordPlace(record)?.phone">聯絡電話：{{ recordPlace(record).phone }}</p><p v-if="recordPlace(record)?.notes" class="mt-2 text-[#59695a]">{{ recordPlace(record).notes }}</p></template></div>
          <p v-if="program === 'integrated' && additionalIntent === 'requested'" class="rounded-xl bg-[#f1ebdf] p-4 text-base leading-7">您已表達一併預約其他篩檢的意願；其他項目尚未選擇場次，未建立預約。</p><p class="text-base leading-7 text-[#59695a]">請攜帶健保卡與身分證件。各項目會分別建立預約，可在「查詢／取消預約」查看或個別取消。本機 DEMO 不會寄送通知。</p><div class="flex flex-col-reverse gap-3 sm:flex-row"><button class="btn-secondary" @click="lookup.identity = person.identity; lookup.phone = person.phone; stage = 'lookup'">查詢／取消預約</button><button class="btn-primary" @click="router.push('/')">返回首頁</button></div></div>
        <div v-else-if="stage === 'lookup' || stage === 'lookupVerify'" class="space-y-5">
          <h2 class="text-2xl font-normal">查詢／取消預約</h2><p class="text-base leading-7 text-[#59695a]">輸入預約時使用的身分證字號與手機號碼，驗證後即可查看各筆預約。</p>
          <div><label class="label" for="lookup-identity">身分證字號</label><input id="lookup-identity" v-model.trim="lookup.identity" class="field uppercase" maxlength="10" autocomplete="off"></div><div><label class="label" for="lookup-phone">手機號碼</label><input id="lookup-phone" v-model.trim="lookup.phone" class="field" maxlength="10" inputmode="tel" autocomplete="tel"></div><button class="btn-secondary" @click="beginLookupVerification">{{ lookupCode ? '重新產生驗證碼' : '產生手機驗證碼' }}</button>
          <p v-if="lookupCode" id="demo-lookup-code" class="rounded-xl bg-[#f1ebdf] p-3 text-base text-[#526c4b]" role="status">本機 DEMO 驗證碼：<span>{{ lookupCode }}</span>（5 分鐘內有效）</p><div v-if="lookupCode"><label class="label" for="lookup-code">輸入驗證碼</label><input id="lookup-code" v-model.trim="inputCode" class="field" maxlength="6" inputmode="numeric" autocomplete="one-time-code" @keyup.enter="checkPhone(true)"></div><div class="flex flex-col-reverse gap-3 sm:flex-row"><button class="btn-secondary" @click="stage = 'home'">返回預約方式</button><button class="btn-primary" @click="checkPhone(true)">查詢預約</button></div>
          <div class="border-t border-[#d8ddce] pt-6"><h3 class="text-xl font-normal">模擬測試資料</h3><p class="mt-2 text-base leading-7 text-[#59695a]">一鍵帶入後，請產生驗證碼並完成查詢。測試預約只會建立在本機記憶體，不會發送簡訊。</p><ul class="mt-3 divide-y divide-[#d8ddce]"><li v-for="sample in lookupSamples" :key="sample.identity" class="py-4"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><p class="text-lg">{{ sample.name }}</p><p class="mt-1 text-base leading-7 text-[#59695a]">{{ sample.description }}<br>{{ sample.identity }} · {{ sample.phone }}</p></div><button type="button" class="btn-secondary" @click="fillLookupSample(sample)">{{ sample.records.length ? '建立並帶入測試資料' : '帶入測試資料' }}</button></div></li></ul><p class="text-sm leading-6 text-[#59695a]">已取消的測試預約不會再次建立。重新整理頁面可重置本機 DEMO；若有剛完成的預約，也會顯示於此供測試。</p></div>
        </div>
        <div v-else-if="stage === 'lookupResult'" class="space-y-5"><h2 class="text-2xl font-normal">您的預約</h2><p class="text-base leading-7 text-[#59695a]">找到 {{ lookupMatches.length }} 筆預約。請選擇要查看的項目，取消只會影響所選的這一筆。</p>
          <div><label class="label" for="lookup-reservation">選擇預約</label><select id="lookup-reservation" :value="found?.id" class="field" @change="found = lookupMatches.find(record => record.id === $event.target.value)"><option v-for="record in lookupMatches" :key="record.id" :value="record.id">{{ screeningLabel(record.screening) }} · {{ record.program === 'bowel' ? `領管地點：${recordPlace(record)?.institution || recordPlace(record)?.name}` : recordPlace(record)?.date || '院所領管' }} · {{ record.bowelReservationId || record.id }}</option></select></div>
          <div class="rounded-xl bg-[#f1ebdf] p-5 text-base leading-7"><p>{{ found?.name }}，您好</p><p class="break-all">預約編號：{{ found?.bowelReservationId || found?.id }}</p><p>項目：{{ screeningLabel(found?.screening) }}</p><template v-if="found?.program === 'bowel'"><p>領管地點：{{ recordPlace(found)?.institution || recordPlace(found)?.name }}（{{ recordPlace(found)?.institutionType || recordPlace(found)?.category }}）</p><p>可領管時間：{{ pickupScheduleForRecord(found) }}</p><p>地址：{{ recordPlace(found)?.address }}</p><p>聯絡電話：{{ recordPlace(found)?.phone }}</p></template><template v-else><p>場次：{{ recordPlace(found)?.location || recordPlace(found)?.name }}</p><p>日期：{{ recordPlace(found)?.date || '依院所領管時間' }}</p><p>時段：{{ found?.slot }}</p><p>地址：{{ recordPlace(found)?.address }}</p></template></div><div class="flex flex-col-reverse gap-3 sm:flex-row"><button class="btn-secondary" @click="stage = 'home'">返回預約方式</button><button class="btn-primary" @click="cancelReservation">取消這筆預約</button></div></div>
        </section>
      <p v-if="['home', 'noInvite'].includes(stage)" class="mt-5 text-xs leading-5 text-[#59695a]">本機 DEMO，請使用測試資料；驗證碼會顯示在畫面上，不會發送簡訊或 E-mail。</p>
      </div>
      </Transition>
    </main><div v-if="notice" role="status" class="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl bg-[#2f493a] px-5 py-3 text-sm font-semibold text-white shadow-xl">{{ notice }}</div>
  </div>
</template>

<style scoped>
.booking-flow {
  font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
}
.booking-step-enter-active {
  transition: opacity 340ms cubic-bezier(0.16, 1, 0.3, 1), transform 340ms cubic-bezier(0.16, 1, 0.3, 1);
  will-change: opacity, transform;
}
.booking-step-enter-from {
  opacity: 0.78;
  transform: translate3d(0, 10px, 0);
}
.booking-flow .card {
  border-color: #d8ddce;
  border-radius: 16px;
  box-shadow: 0 6px 20px rgba(47, 73, 58, .055);
}
.booking-flow .field {
  border-color: #d8ddce;
  color: #2f493a;
}
.booking-flow .field:focus {
  border-color: #526c4b;
  outline: 3px solid #e7ecdf;
}
.booking-flow .label {
  color: #59695a;
  font-weight: 400;
}
.booking-flow .btn-primary {
  background: #526c4b;
  font-weight: 400;
}
.booking-flow .btn-primary:hover {
  background: #40573c;
}
.booking-flow .btn-secondary {
  border-color: #d8ddce;
  color: #526c4b;
  font-weight: 400;
}
.booking-flow .btn-secondary:hover {
  background: #e7ecdf;
}
.booking-flow :is(.font-black, .font-bold, .font-semibold, b) {
  font-weight: 400;
}
.booking-flow .text-brand {
  color: #526c4b;
}
.booking-flow .bg-brand {
  background-color: #526c4b;
}
.booking-flow .border-brand {
  border-color: #526c4b;
}
.booking-flow :is(button, input, select):focus-visible {
  outline-color: #526c4b;
}
.booking-flow ::selection {
  background: #e3ead8;
  color: #2f493a;
}
.search-tab {
  min-height: 44px;
  border: 1px solid #d8ddce;
  border-radius: 10px;
  padding: 8px 14px;
  color: #59695a;
  font-size: 14px;
}
.search-tab:hover,
.search-tab--active {
  border-color: #526c4b;
  background: #e7ecdf;
  color: #526c4b;
}
.result-option {
  display: block;
  width: 100%;
  border: 1px solid #d8ddce;
  border-radius: 12px;
  padding: 16px;
  text-align: left;
}
.result-option:hover,
.result-option:focus-visible {
  border-color: #526c4b;
  background: #edf1e6;
}
.screening-option {
  display: flex;
  min-height: 184px;
  flex-direction: column;
  align-items: flex-start;
  border: 1px solid #d8ddce;
  border-radius: 14px;
  background: #fffdf8;
  padding: 24px;
  text-align: left;
}
.screening-option:not(.screening-option--disabled):hover,
.screening-option:not(.screening-option--disabled):focus-within {
  border-color: #526c4b;
  background: #edf1e6;
}
.screening-option--disabled,
.screening-option--disabled:hover {
  border-color: #dce2df;
  background: #eef1ef;
  color: #59695a;
}
.booking-choice {
  display: flex;
  min-height: 292px;
  flex-direction: column;
  align-items: flex-start;
  border: 1px solid #d8ddce;
  border-radius: 16px;
  padding: 28px;
  text-align: left;
  transition: border-color 180ms ease, background-color 180ms ease, transform 180ms ease;
}
.booking-choice:hover {
  transform: translateY(-3px);
}
.booking-choice:focus-visible {
  outline: 3px solid #40573c;
  outline-offset: 3px;
}
.booking-choice--invite {
  background: #edf1e6;
}
.booking-choice--invite:hover {
  border-color: #b6c3a8;
  background: #e3ead8;
}
.booking-choice--public {
  border-color: #d8ddce;
  background: #f1ebdf;
}
.booking-choice--public:hover {
  border-color: #b6c3a8;
  background: #eae2d2;
}
.booking-choice__icon {
  display: flex;
  width: 56px;
  height: 56px;
  align-items: center;
  justify-content: center;
  border-radius: 14px;
  margin-bottom: 24px;
}
.booking-choice__icon svg {
  width: 29px;
  height: 29px;
}
.booking-choice__action {
  display: flex;
  width: 100%;
  min-height: 56px;
  align-items: center;
  justify-content: space-between;
  border-radius: 10px;
  margin-top: auto;
  padding: 10px 16px;
  font-size: 18px;
  font-weight: 400;
}
@media (max-width: 767px) {
  .booking-choice {
    min-height: 252px;
    padding: 24px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .booking-step-enter-active {
    transition-duration: 60ms;
    will-change: auto;
  }
  .booking-step-enter-from {
    opacity: 0.85;
    transform: none;
  }
  .booking-choice {
    transition: none;
  }
  .booking-choice:hover {
    transform: none;
  }
}
.result-option:disabled {
  background: #eef1ef;
  border-color: #dce2df;
  color: #687571;
  cursor: not-allowed;
}
.result-option:disabled:hover { outline: none; border-color: #dce2df; }
.result-option:disabled span { color: #687571; }
</style>
