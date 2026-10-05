<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import JsBarcode from 'jsbarcode'
import BowelLabel from '@/components/BowelLabel.vue'
import bowelLabelStyles from '@/styles/bowel-label.css?inline'
import { labelSnapshot } from '@/utils/bowelLabels'
import { taipeiDay } from '@/utils/tubeOperations'
import { useDemoStore } from '@/stores/demo'
import AdminSampleData from '@/components/AdminSampleData.vue'
import { adminTaskDefinitions, matchesAdminTask } from '@/utils/adminTasks'
import { changhuaAreas } from '@/stores/areas'
import { canAccess } from '@/utils/accessPolicy'
import { queryReservations, reservationExportHeaders, reservationExportRows, reservationSourceLabels } from '@/services/reservationService'
import { bowelFollowUpStatuses, bowelStatuses, canOperateBowelStep, canRollbackBowelStep, confirmBowelStep, derivedBowelFollowUp, normalizeTrackingRecord, queryBowelTracking, rollbackBowelStep, statusCode, trackingExportHeaders, trackingExportRows } from '@/services/bowelTrackingService'
import { buildLabelPrintData, canUseBowelLabels, labelExportHeaders, labelExportRows, labelPrintStatuses, processLabelBatch, queryLabelRecords, selectableLabelIds } from '@/services/bowelLabelService'
import { canRollbackBowelReturn, canUseBowelReturns, lookupBowelReturn, processBowelReturnBatch, queryBowelReturns, returnExportHeaders, returnExportRows, rollbackBowelReturn, selectableReturnIds } from '@/services/bowelReturnService'
import { canRollbackBowelLab, canUseBowelLab, labExportHeaders, labExportRows, processBowelLabBatch, queryBowelLabRecords, rollbackBowelLab, selectableLabIds } from '@/services/bowelLabService'

const props = defineProps({ section: { type: String, required: true }, actor: { type: Object, required: true }, initialIdentity: { type: String, default: '' }, initialEventId: { type: Number, default: null }, initialTask: { type: String, default: '' } })
const has = (permission, record = null) => canAccess(props.actor, permission, record)
const taskScope = ref(adminTaskDefinitions.find(task => task.key === props.initialTask && task.section === props.section)?.key || '')
const scopedTask = computed(() => adminTaskDefinitions.find(task => task.key === taskScope.value))
function inTaskScope(record) { return !taskScope.value || matchesAdminTask(record, taskScope.value) }
function clearTaskScope() { taskScope.value = ''; chosenLabels.value = []; chosenTubes.value = []; chosenLab.value = [] }
const emit = defineEmits(['open-edit'])
const medicalTab = ref('partners')
const manualStep = ref(1)
const editMatches = ref([])
const specialRecord = ref(null)
const pendingBowelAction = ref(null)
const pickupIdentitySuffix = ref('')
const bowelActionError = ref('')
const { events, reservations, providers, medical, tracking } = storeToRefs(useDemoStore())
const pendingBowelRecord = computed(() => tracking.value.find(record => record.id === pendingBowelAction.value?.id))
const selectedTrackingDetail = computed(() => {
  const record = tracking.value.find(item => item.id === specialRecord.value?.id)
  return record ? normalizeTrackingRecord(record) : null
})
const titles = { medical: '醫療院所與時段名額', providers: '腸篩院所與公休設定', manual: '後台輸入預約', edit: '預約資料修改', roster: '預約名單清冊', tracking: '腸篩名單動態', labels: '腸篩標籤列印', tubes: '腸篩繳管作業', lab: '腸篩送驗作業' }
const notice = ref('')
const selectedEventId = ref(props.initialEventId || events.value.find(e => has('event.read', e))?.id)
const screening = ref('子宮頸抹片')
const partner = ref('彰化基督教醫院')
const partnerList = ref(['彰化基督教醫院'])
const sendCar = ref(false)
const carProvider = ref('彰化縣衛生局')
const slotDraft = ref({})
const providerFilter = reactive({ area: '全部', category: '全部', name: '全部' })
const providerId = ref(providers.value.find(p => has('bowel.read', p))?.id)
const providerDraft = reactive({ area: '田中鎮', category: '衛生所', name: '', phone: '', address: '', periods: [{ start: '08:30', end: '16:30' }], week: [true, true, true, true, true, false, false] })
const closureMonth = ref(0)
const closureDraft = ref([])
const providerTab = ref('list')
const scheduleOpen = ref(false)
const daySchedule = ref([])
const manual = reactive({ type: '整合式篩檢', identity: '', name: '', phone: '', birth: '', address: '', area: '彰化市', eventId: '', screening: '', slot: '' })
const manualSubmitting = ref(false)
const manualSuccess = ref(null)
const searchId = ref(props.initialIdentity)
const editing = ref(null)
const editDraft = reactive({ name: '', phone: '', email: '', address: '', eventId: '', providerId: '', slot: '', screening: '' })
const rosterFilter = reactive({ from: '', to: '', area: '全部', eventId: '全部', screening: '全部', source: '全部' })
const rosterApplied = ref({ ...rosterFilter })
const trackFilter = reactive({ area: '全部', provider: '全部', updated: '全部', state: '全部', followUp: '全部', identity: '', month: '' })
const trackApplied = ref({ ...trackFilter })
const labelFilter = reactive({ category: '全部', status: '尚未列印' })
const labelApplied = ref({ ...labelFilter })
const chosenLabels = ref([])
const router = useRouter()
const labelPreviewId = ref('')
const labelPreview = computed(() => {
  const record = labelResults.value.find(item => item.id === labelPreviewId.value)
  return record ? buildLabelPrintData(record) : null
})
const tubeFilter = reactive({ identity: '', state: '全部', category: '全部', from: '', to: '' })
const tubeApplied = ref({ ...tubeFilter })
const chosenTubes = ref([])
const qrOpen = ref(false)
const qrPayload = ref('')
const qrError = ref('')
const tubeMessage = ref('')
const labFilter = reactive({ township: '全部', institution: '全部', returnFrom: '', returnTo: '', identity: '', reservationId: '', currentStatus: 'RETURNED' })
const labApplied = ref({ ...labFilter })
const chosenLab = ref([])
const labConfirmOpen = ref(false)
const labMessage = ref('')
const statuses = Object.values(bowelStatuses)
const followUpStatuses = Object.values(bowelFollowUpStatuses)
const followUpNow = ref(Date.now())
let followUpTimer
onMounted(() => { followUpTimer = setInterval(() => { followUpNow.value = Date.now() }, 60000) })
onBeforeUnmount(() => clearInterval(followUpTimer))
const followUpFor = record => derivedBowelFollowUp(record, followUpNow.value)
const trackingHistoryLabel = item => ({ PRINT: '標籤列印／已派送', CANCEL_PRINT: '取消列印／已預約', CONFIRM_RECEIVED: '院所確認接收', CONFIRM_PICKUP: '民眾已領取', CONFIRM_RETURN: '採檢管已繳回', ROLLBACK_RETURN: '復原繳管／已領取', CONFIRM_SENT_TO_LAB: '衛生所確認送驗', ROLLBACK_SENT_TO_LAB: '復原送驗／已繳回' })[item.action] || bowelStatuses[item.currentStatus]?.label || item.currentStatus
function trackingHistoryTime(value) { if (!value) return '時間未提供'; if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) }
const partnerOptions = ['彰化基督教醫院', '秀傳紀念醫院', '彰化醫院', '員林基督教醫院', '衛生所']
const areas = changhuaAreas
const weekNames = ['一', '二', '三', '四', '五', '六', '日']
const copy = value => JSON.parse(JSON.stringify(value))
const selectedEvent = computed(() => events.value.find(e => e.id === Number(selectedEventId.value) && has('event.read', e)))
const readableEvents = computed(() => events.value.filter(e => has('event.read', e)))
const medicalScreenings = computed(() => selectedEvent.value?.type === '整合式篩檢' ? ['整合式篩檢'] : (selectedEvent.value?.screenings || []).filter(item => ['子宮頸抹片', '乳房攝影'].includes(item)))
const selectedProvider = computed(() => providers.value.find(p => p.id === Number(providerId.value) && has('bowel.read', p)))
const readableProviders = computed(() => providers.value.filter(p => has('bowel.read', p)))
const settingKey = computed(() => `${selectedEventId.value}:${screening.value}`)
const eventOptions = computed(() => manual.type === '腸篩專案' ? providers.value.filter(p => p.area === manual.area && has('bowel.read', p)).map(p => ({ id: p.id, date: p.category, location: p.name })) : events.value.filter(e => has('event.read', e) && e.type === manual.type && (manual.type === '整合式篩檢' || e.area === manual.area) && e.booked < e.capacity))
const manualPlace = computed(() => manual.type === '腸篩專案' ? providers.value.find(p => p.id === Number(manual.eventId)) : events.value.find(e => e.id === Number(manual.eventId)))
const providerResults = computed(() => providers.value.filter(p => has('bowel.read', p) && (providerFilter.area === '全部' || p.area === providerFilter.area) && (providerFilter.category === '全部' || p.category === providerFilter.category) && (providerFilter.name === '全部' || p.name === providerFilter.name)).sort((a, b) => (a.category === '衛生所' ? 0 : 1) - (b.category === '衛生所' ? 0 : 1)))
const rosterResults = computed(() => queryReservations(reservations.value, { events: events.value, providers: providers.value, actor: props.actor, filters: { ...rosterApplied.value, township: rosterApplied.value.area } }))
const rosterScopeLabel = computed(() => props.actor.role === '衛生所承辦' ? `${props.actor.township || props.actor.area || props.actor.institution?.township || '未設定'}轄區` : ['衛生局承辦', '系統管理員'].includes(props.actor.role) ? '彰化縣全區' : '依機構權限')
const trackResults = computed(() => queryBowelTracking(tracking.value.filter(inTaskScope), { actor: props.actor, now: followUpNow.value, filters: { township: trackApplied.value.area, institution: trackApplied.value.provider, updated: trackApplied.value.updated, month: trackApplied.value.month, identity: trackApplied.value.identity, currentStatus: trackApplied.value.state, followUp: trackApplied.value.followUp } }))
const trackingInstitutionOptions = computed(() => [...new Set(tracking.value.filter(r => has('bowel.read', r)).map(r => r.institution || r.provider))])
const rosterEventOptions = computed(() => events.value.filter(e => e.type !== '腸篩專案' && has('event.read', e) && (!rosterFilter.from || e.date >= rosterFilter.from) && (!rosterFilter.to || e.date <= rosterFilter.to) && (rosterFilter.area === '全部' || e.area === rosterFilter.area)))
const labelResults = computed(() => queryLabelRecords(tracking.value.filter(inTaskScope), { actor: props.actor, filters: { category: labelApplied.value.category, printStatus: labelApplied.value.status === '尚未列印' ? 'UNPRINTED' : 'PRINTED' } }))
const labelAction = computed(() => labelApplied.value.status === '尚未列印' ? 'PRINT' : 'CANCEL_PRINT')
const selectableLabels = computed(() => selectableLabelIds(labelResults.value, labelAction.value, props.actor))
const tubeResults = computed(() => queryBowelReturns(tracking.value.filter(inTaskScope), { actor: props.actor, reservations: reservations.value, filters: tubeApplied.value }))
const selectableTubes = computed(() => selectableReturnIds(tubeResults.value, props.actor))
const labResults = computed(() => queryBowelLabRecords(tracking.value.filter(inTaskScope), { actor: props.actor, filters: labApplied.value }))
const selectableLab = computed(() => selectableLabIds(labResults.value, props.actor))
const selectedLabRows = computed(() => labResults.value.filter(row => chosenLab.value.includes(String(row.id))))
const labInstitutionOptions = computed(() => [...new Set(queryBowelLabRecords(tracking.value, { actor: props.actor, filters: { currentStatus: '全部', township: labFilter.township } }).map(row => row.institutionName))])
const labTownshipOptions = computed(() => [...new Set(queryBowelLabRecords(tracking.value, { actor: props.actor, filters: { currentStatus: '全部' } }).map(row => row.township))])
const calendarDate = computed(() => new Date(new Date().getFullYear(), new Date().getMonth() + closureMonth.value, 1))
const calendarDays = computed(() => Array.from({ length: new Date(calendarDate.value.getFullYear(), calendarDate.value.getMonth() + 1, 0).getDate() }, (_, index) => `${calendarDate.value.getFullYear()}-${String(calendarDate.value.getMonth() + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`))
const calendarBlank = computed(() => (calendarDate.value.getDay() + 6) % 7)
function tell(value) { notice.value = value; setTimeout(() => { if (notice.value === value) notice.value = '' }, 4000) }
function slots(e) {
  if (!e) return []
  const start = Number(e.start.slice(0, 2)) * 60 + Number(e.start.slice(3))
  const end = Number(e.end.slice(0, 2)) * 60 + Number(e.end.slice(3))
  const interval = Number(e.interval || 30)
  const fmt = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  const result = []
  for (let n = start; n + interval <= end; n += interval) result.push(`${fmt(n)}－${fmt(n + interval)}`)
  return result
}
function loadMedical() {
  if (!selectedEvent.value) { slotDraft.value = {}; return }
  const saved = medical.value[settingKey.value]
  partnerList.value = saved?.partners ? [...saved.partners] : ['彰化基督教醫院']
  sendCar.value = saved?.sendCar || false
  carProvider.value = saved?.carProvider || '彰化縣衛生局'
  const configured = selectedEvent.value?.slotCapacityByScreening?.[screening.value] || selectedEvent.value?.slotCapacity || {}
  slotDraft.value = Object.fromEntries(slots(selectedEvent.value).map(label => [label, { total: saved?.slots?.[label]?.total ?? configured[label]?.total ?? Math.min(99, Math.max(1, Math.floor(selectedEvent.value.capacity / Math.max(1, slots(selectedEvent.value).length)))), public: saved?.slots?.[label]?.public ?? configured[label]?.public ?? Math.min(99, Math.max(1, Math.floor(selectedEvent.value.capacity / Math.max(1, slots(selectedEvent.value).length)))), closed: saved?.slots?.[label]?.closed ?? configured[label]?.closed ?? false }]))
}
watch(selectedEventId, () => { screening.value = medicalScreenings.value[0] || '整合式篩檢' }, { immediate: true })
watch([selectedEventId, screening], loadMedical, { immediate: true })
function addPartner() { if (partnerList.value.length >= 4) return tell('最多設定 4 家院所'); partnerList.value.push(partnerOptions.find(name => !partnerList.value.includes(name)) || partner.value) }
function saveMedical() {
  if (!has('event.write')) return tell('目前身分沒有活動設定權限')
  if (!selectedEvent.value) return tell('請選擇有權設定的活動')
  if (!selectedEvent.value) return
  if (screening.value !== '整合式篩檢' && partnerList.value.length < 2) return tell('子抹與乳攝請設定 2 至 4 家配合院所')
  if (new Set(partnerList.value).size !== partnerList.value.length) return tell('配合醫療院所不可重複')
  for (const row of Object.values(slotDraft.value)) if (!Number.isInteger(Number(row.total)) || !Number.isInteger(Number(row.public)) || row.total < 0 || row.total > 99 || row.public < 0 || row.public > row.total) return tell('每時段總名額須為 0–99，對外名額不可超過總名額')
  if (!window.confirm('確定公布此場次的篩檢設定？')) return
  medical.value[settingKey.value] = { partners: [...partnerList.value], sendCar: sendCar.value, carProvider: carProvider.value, slots: copy(slotDraft.value), published: true }
  selectedEvent.value.slotCapacityByScreening ||= {}
  selectedEvent.value.slotCapacityByScreening[screening.value] = copy(slotDraft.value)
  tell('院所與逐時段名額已公布於本機 DEMO')
}
function loadProvider() {
  if (!selectedProvider.value) return
  Object.assign(providerDraft, { area: selectedProvider.value.area, category: selectedProvider.value.category, name: selectedProvider.value.name, phone: selectedProvider.value.phone, address: selectedProvider.value.address, periods: copy(selectedProvider.value.periods), week: [...selectedProvider.value.week] })
  closureDraft.value = [...selectedProvider.value.closed]
}
watch(providerId, loadProvider, { immediate: true })
function newProvider() { providerId.value = null; Object.assign(providerDraft, { area: '田中鎮', category: '藥局', name: '', phone: '', address: '', periods: [{ start: '08:30', end: '17:00' }], week: [true, true, true, true, true, false, false] }); closureDraft.value = []; providerTab.value = 'edit' }
function saveProvider() {
  if (!has('bowel.write')) return tell('目前身分沒有院所設定權限')
  if (!providerDraft.name.trim() || !/^\d{7}$/.test(providerDraft.phone) || !providerDraft.address.trim()) return tell('請輸入院所、地址與 7 碼電話')
  if (providerDraft.periods.some(p => !p.start || !p.end || p.end <= p.start)) return tell('營業時間起迄不正確')
  const record = { ...copy(providerDraft), hours: `星期${providerDraft.week.map((active, i) => active ? weekNames[i] : '').filter(Boolean).join('、')} ${providerDraft.periods.map(p => `${p.start}－${p.end}`).join('、')}`, closed: [...closureDraft.value] }
  if (selectedProvider.value) Object.assign(selectedProvider.value, record)
  else { record.id = Date.now(); providers.value.push(record); providerId.value = record.id }
  providerTab.value = 'list'; tell('院所營業時間已儲存')
}
function toggleClosed(day) { const index = closureDraft.value.indexOf(day); if (index < 0) closureDraft.value.push(day); else closureDraft.value.splice(index, 1) }
function saveClosures() { if (!has('bowel.write')) return tell('目前身分沒有公休設定權限'); if (!selectedProvider.value) return tell('請先選擇院所'); selectedProvider.value.closed = [...closureDraft.value]; providerTab.value = 'list'; tell('公休日已儲存') }
function openSchedule() {
  if (!selectedProvider.value) return tell('請先從院所清單選擇院所')
  daySchedule.value = copy(selectedProvider.value.schedule || weekNames.map((_, index) => selectedProvider.value.week[index] ? selectedProvider.value.periods : []))
  scheduleOpen.value = true
}
function saveSchedule() {
  if (!has('bowel.write')) return tell('目前身分沒有院所時段設定權限')
  if (!selectedProvider.value) return
  for (const periods of daySchedule.value) for (const period of periods) if (!period.start || !period.end || period.end <= period.start || !/:(00|05|10|15|20|25|30|35|40|45|50|55)$/.test(period.start) || !/:(00|05|10|15|20|25|30|35|40|45|50|55)$/.test(period.end)) return tell('營業時段須使用 5 分鐘間隔，且結束時間晚於開始時間')
  selectedProvider.value.schedule = copy(daySchedule.value)
  selectedProvider.value.week = daySchedule.value.map(periods => periods.length > 0)
  selectedProvider.value.hours = daySchedule.value.map((periods, index) => periods.length ? `星期${weekNames[index]} ${periods.map(period => `${period.start}－${period.end}`).join('、')}` : '').filter(Boolean).join('；') || '暫無營業時間'
  scheduleOpen.value = false; tell('每週個別營業時段已儲存')
}
function manualLookup() { const known = reservations.value.find(r => r.identity === manual.identity.toUpperCase()); if (known) { manual.name = known.name; if (/^09\d{8}$/.test(known.phone)) manual.phone = known.phone; manual.birth = known.birth || ''; manual.address = known.address || ''; tell('已帶入本機示範名單資料') } else tell('無本機對應資料，請手動填寫') }
function reviewManual() {
  const e = manualPlace.value
  if (!/^[A-Z][A-Z0-9]{9}$/.test(manual.identity.toUpperCase()) || !manual.name.trim() || !e || !manual.screening || !manual.slot) return tell('請完成身分、姓名、場次、項目與時段')
  if (manual.type === '腸篩專案' && !/^09\d{8}$/.test(manual.phone)) return tell('腸篩專案手機號碼為必填 10 碼')
  if (manual.phone && !/^09\d{8}$/.test(manual.phone)) return tell('手機號碼須為 10 碼')
  if (manual.type !== '腸篩專案' && e.booked >= e.capacity) return tell('此場次已額滿')
  manualStep.value = 3
}
function saveManual() {
  if (manualStep.value !== 3 || manualSubmitting.value) return
  if (!has('booking.write')) return tell('目前身分沒有新增預約權限')
  manualSubmitting.value = true
  const e = manualPlace.value
  if (!e || !manual.screening || !manual.slot || (manual.type !== '腸篩專案' && e.booked >= e.capacity)) { manualSubmitting.value = false; manualStep.value = 2; return tell('場次或名額已變更，請重新確認') }
  const record = { id: `CH${String(Date.now()).slice(-8)}`, identity: manual.identity.toUpperCase(), name: manual.name.trim(), phone: manual.phone, birth: manual.birth, screening: manual.screening, eventId: manual.type === '腸篩專案' ? null : e.id, providerId: manual.type === '腸篩專案' ? e.id : null, slot: manual.slot, source: '輸入預約', status: '已預約', address: manual.address, createdAt: new Date().toISOString().slice(0, 10) }
  reservations.value.unshift(record)
  if (manual.type === '腸篩專案') tracking.value.unshift({ id: `13${String(e.id).padStart(4, '0')}02${String(Date.now()).slice(-4)}`, name: manual.name.trim(), identity: manual.identity.toUpperCase(), area: e.area, provider: e.name, category: e.category, date: new Date().toISOString().slice(0, 10), state: '已預約', printAt: '', tubeReturned: false, issuedAt: new Date().toISOString().slice(0, 10), returnedAt: '' })
  else e.booked++
  manualSuccess.value = { id: record.id, name: record.name, screening: record.screening }
  manualStep.value = 4
  manualSubmitting.value = false
  tell('預約建立成功')
}
function startNewManual() {
  Object.assign(manual, { type: '整合式篩檢', identity: '', name: '', phone: '', birth: '', address: '', area: '彰化市', eventId: '', screening: '', slot: '' })
  manualSuccess.value = null
  manualStep.value = 1
}
function findEdit() {
  editMatches.value = reservations.value.filter(r => r.identity === searchId.value.trim().toUpperCase() && r.status !== '已取消' && has('booking.read', { ...r, area: events.value.find(e => e.id === r.eventId)?.area || providers.value.find(p => p.id === r.providerId)?.area }))
  const record = editMatches.value[0]
  editing.value = null
  if (!record) return tell('查無符合的本機預約資料')
  selectEdit(record)
}
function selectEdit(record) {
  editing.value = record
  Object.assign(editDraft, { name: record.name, phone: record.phone, email: record.email || '', address: record.address || '', eventId: record.eventId || '', providerId: record.providerId || '', slot: record.slot || '', screening: record.screening || '' })
}
function saveEdit() {
  if (!editing.value) return
  if (!has('booking.write')) return tell('目前身分沒有修改預約權限')
  if (!editDraft.name.trim() || (editDraft.phone !== editing.value.phone && editDraft.phone && !/^09\d{8}$/.test(editDraft.phone)) || (editDraft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editDraft.email))) return tell('請確認姓名、手機號碼及電子郵件格式')
  if (editing.value.providerId) {
    const provider = providers.value.find(p => p.id === Number(editDraft.providerId))
    if (!provider) return tell('請選擇領管院所')
    Object.assign(editing.value, { name: editDraft.name, phone: editDraft.phone, email: editDraft.email, address: editDraft.address, providerId: provider.id, slot: provider.hours })
    return tell('腸篩預約資料已更新')
  }
  const oldEvent = events.value.find(e => e.id === editing.value.eventId), newEvent = events.value.find(e => e.id === Number(editDraft.eventId))
  if (!newEvent || !newEvent.screenings.includes(editDraft.screening) || !slots(newEvent).includes(editDraft.slot)) return tell('請選擇有效的場次、篩檢項目與時段')
  if (newEvent && oldEvent?.id !== newEvent.id && newEvent.booked >= newEvent.capacity) return tell('新場次已額滿')
  if (oldEvent?.id !== newEvent?.id) { if (oldEvent) oldEvent.booked = Math.max(0, oldEvent.booked - 1); if (newEvent) newEvent.booked++ }
  Object.assign(editing.value, { name: editDraft.name, phone: editDraft.phone, email: editDraft.email, address: editDraft.address, eventId: newEvent?.id || null, slot: editDraft.slot, screening: editDraft.screening })
  tell('預約資料已更新')
}
function cancelEdit() { if (!has('booking.write')) return tell('目前身分沒有取消預約權限'); if (!editing.value || !window.confirm('確定取消這筆預約？')) return; editing.value.status = '已取消'; const e = events.value.find(item => item.id === editing.value.eventId); if (e) e.booked = Math.max(0, e.booked - 1); tell('預約已取消'); editing.value = null }
function csv(filename, header, rows) { if (!has(props.section === 'roster' ? 'booking.export' : 'bowel.export')) return tell('目前身分沒有匯出權限'); const data = '\uFEFF' + [header, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\r\n'); const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); tell('已匯出目前結果') }
function exportProviders() { csv('腸篩院所_DEMO.csv', ['鄉鎮別', '類別', '醫療院所名稱', '電話', '營業時間'], providerResults.value.map(p => [p.area, p.category, p.name, p.phone, p.hours])) }
function exportRoster() { csv('預約清冊_DEMO.csv', reservationExportHeaders, reservationExportRows(rosterResults.value)) }
function openBowelAction(record, nextCode) {
  const result = canOperateBowelStep(record, nextCode, props.actor)
  if (!result.allowed) return tell(result.reason)
  pendingBowelAction.value = { id: record.id, nextCode }
  pickupIdentitySuffix.value = ''
  bowelActionError.value = ''
}
function closeBowelAction() { pendingBowelAction.value = null; pickupIdentitySuffix.value = ''; bowelActionError.value = '' }
function submitBowelAction() {
  const record = pendingBowelRecord.value
  if (!record) { bowelActionError.value = '名單已變更，請關閉後重新查詢'; return }
  try {
    const updated = confirmBowelStep(record, pendingBowelAction.value.nextCode, { actor: props.actor, identitySuffix: pickupIdentitySuffix.value })
    Object.assign(record, updated)
    const label = updated.state
    closeBowelAction()
    tell(`已確認：${label}`)
  } catch (error) { bowelActionError.value = error.message }
}
function undoStatus(record) {
  if (!record) return tell('名單已變更，請重新查詢')
  if (!canRollbackBowelStep(record, props.actor)) return tell('目前沒有權限或已超過可復原期限')
  if (!window.confirm(`確定復原 ${record.name} 的「${record.state}」狀態？`)) return
  try { Object.assign(record, rollbackBowelStep(record, props.actor)); tell('已返回上一狀態') }
  catch (error) { tell(error.message) }
}
function toggleSelection(list, id) { const index = list.indexOf(id); if (index < 0) list.push(id); else list.splice(index, 1) }
function openLabelPrintWindow(printData) {
  const popup = window.open('', '_blank', 'width=700,height=700')
  if (!popup) return false
  popup.document.title = '腸篩標籤 DEMO'
  const style = popup.document.createElement('style')
  style.textContent = bowelLabelStyles + 'body{font-family:Arial,"Microsoft JhengHei",sans-serif;padding:12px;color:#000;background:#fff}.bowel-print-label{margin:2mm}@page{size:A4;margin:10mm}@media print{body{padding:0}}'
  popup.document.head.append(style)
  for (const data of printData) {
    const card = popup.document.createElement('div'); card.className = 'bowel-print-label'
    const header = popup.document.createElement('div'); header.className = 'bowel-print-label-header'
    for (const value of [data.institutionName, data.name]) {
      const part = popup.document.createElement('span'); part.textContent = value; header.append(part)
    }
    const details = popup.document.createElement('p'); details.className = 'bowel-print-label-details'; details.textContent = `${data.institutionType} · ${data.identity} · ${data.reservationDate}`
    const barcode = popup.document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(barcode, data.barcode, { format: 'CODE128', width: 2, height: 32, margin: 0, marginLeft: 20, marginRight: 20, lineColor: '#000000', background: '#ffffff', displayValue: false })
    barcode.setAttribute('viewBox', `0 0 ${barcode.getAttribute('width')} ${barcode.getAttribute('height')}`)
    const serial = popup.document.createElement('p'); serial.className = 'bowel-print-label-serial'; serial.textContent = `條碼 ${data.barcode} · 預約編號 ${data.reservationId}`
    card.append(header, details, barcode, serial); popup.document.body.append(card)
  }
  popup.setTimeout(() => popup.print(), 250)
  return true
}
function printLabels(action) {
  if (!chosenLabels.value.length) return tell('請先勾選名單')
  const result = processLabelBatch(tracking.value, chosenLabels.value, action, { actor: props.actor })
  if (action === 'PRINT' && result.successCount && !openLabelPrintWindow(result.printData)) return tell('瀏覽器阻擋列印視窗，請允許彈出視窗後重試；本次狀態未更新')
  for (const update of result.updates) {
    const target = tracking.value.find(record => String(record.id) === update.id)
    if (target) Object.assign(target, update.record)
  }
  chosenLabels.value = []
  const firstError = result.failures[0]?.reason
  tell(`成功 ${result.successCount} 筆，失敗 ${result.failureCount} 筆${firstError ? `；${firstError}` : ''}`)
}
function selectAllLabels(checked) { chosenLabels.value = checked ? [...selectableLabels.value] : [] }
function exportLabels() { csv('標籤清冊_DEMO.csv', labelExportHeaders, labelExportRows(labelResults.value)) }
function exportLabelRoster() {
  if (!has('bowel.export')) return tell('目前身分沒有匯出權限')
  const url = URL.createObjectURL(new Blob([JSON.stringify(labelSnapshot(queryLabelRecords(tracking.value, { actor: props.actor, filters: { printStatus: '全部' } })), null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = '腸篩條碼比對名冊_DEMO.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  tell('已匯出模擬比對名冊，可在手機的條碼比對頁匯入')
}
function saveTubes() {
  if (!chosenTubes.value.length) return tell('請先勾選名單')
  const result = processBowelReturnBatch(tracking.value, chosenTubes.value, { actor: props.actor })
  for (const update of result.updates) {
    const target = tracking.value.find(record => String(record.id) === update.id)
    if (target) Object.assign(target, update.record)
  }
  chosenTubes.value = []
  tubeMessage.value = `成功 ${result.successCount} 筆，失敗 ${result.failureCount} 筆${result.failures[0] ? `；${result.failures[0].reason}` : ''}`
  tell(tubeMessage.value)
}
function exportTubes() {
  if (!canUseBowelReturns(props.actor)) return tell('目前身分沒有繳管匯出權限')
  csv('繳管清冊_DEMO.csv', returnExportHeaders, returnExportRows(tubeResults.value))
}
function searchTubes() {
  tubeApplied.value = { ...tubeFilter }
  tubeMessage.value = tubeFilter.identity && !tubeResults.value.length ? '權限範圍內找不到符合條件的領管紀錄' : ''
}
function selectAllTubes(checked) { chosenTubes.value = checked ? [...selectableTubes.value] : [] }
function simulateQrScan() {
  const result = lookupBowelReturn(tracking.value, qrPayload.value, { actor: props.actor, reservations: reservations.value })
  if (!result.record) { qrError.value = result.error; return }
  qrError.value = ''
  Object.assign(tubeFilter, { identity: result.record.identity, state: '全部', category: '全部', from: '', to: '' })
  tubeApplied.value = { ...tubeFilter, reservationId: result.record.bowelReservationId }
  chosenTubes.value = []
  tubeMessage.value = `已找到 ${result.record.name} 的領管紀錄；請核對預約編號 ${result.record.bowelReservationId}`
  qrOpen.value = false
}
function undoTubeReturn(record) {
  try {
    const updated = rollbackBowelReturn(record, props.actor)
    const target = tracking.value.find(item => item.id === record.id)
    if (target) Object.assign(target, updated)
    tubeMessage.value = '繳管已復原，狀態回到已領取'
    tell(tubeMessage.value)
  } catch (error) { tell(error.message) }
}
function searchLab() {
  labApplied.value = { ...labFilter }
  labMessage.value = labResults.value.length ? '' : '權限範圍內沒有符合條件的送驗紀錄'
}
function selectAllLab(checked) { chosenLab.value = checked ? [...selectableLab.value] : [] }
function confirmLabBatch() {
  labConfirmOpen.value = false
  const result = processBowelLabBatch(tracking.value, chosenLab.value, { actor: props.actor })
  for (const update of result.updates) {
    const target = tracking.value.find(record => String(record.id) === update.id)
    if (target) Object.assign(target, update.record)
  }
  chosenLab.value = []
  labMessage.value = `成功 ${result.successCount} 筆，失敗 ${result.failureCount} 筆${result.failures[0] ? `；${result.failures[0].reason}` : ''}`
  tell(labMessage.value)
}
function undoLab(record) {
  try {
    const updated = rollbackBowelLab(record, props.actor)
    const target = tracking.value.find(item => item.id === record.id)
    if (target) Object.assign(target, updated)
    labMessage.value = '送驗已復原，狀態回到已繳回'
    tell(labMessage.value)
  } catch (error) { tell(error.message) }
}
function exportLab() {
  if (!canUseBowelLab(props.actor)) return tell('目前身分沒有送驗匯出權限')
  csv('送驗清冊_DEMO.csv', labExportHeaders, labExportRows(labResults.value))
}
function advanceManual() {
  if (!/^[A-Z][A-Z0-9]{4,9}$/.test(manual.identity.toUpperCase()) || !manual.name.trim()) return tell('請輸入 5 至 10 碼身分證字號及姓名')
  if ((manual.phone && !/^09\d{8}$/.test(manual.phone)) || (manual.type === '腸篩專案' && !manual.phone)) return tell('請確認手機號碼，腸篩專案為必填')
  manualStep.value = 2
}
watch(labelApplied, () => { chosenLabels.value = []; labelPreviewId.value = '' })
watch(tubeApplied, () => { chosenTubes.value = [] })
watch(labApplied, () => { chosenLab.value = [] })
watch([() => rosterFilter.from, () => rosterFilter.to, () => rosterFilter.area], () => { rosterFilter.eventId = '全部' })
if (props.initialIdentity) findEdit()

const preset = (label, description, fill) => ({ label, description, fill })
const medicalEventSamples = computed(() => events.value.filter(e => e.type !== '腸篩專案' && has('event.read', e)).slice(0, 3).map(e => preset(e.location, e.date + ' · ' + e.type, () => { selectedEventId.value = e.id })))
const editPlaceSamples = computed(() => editing.value?.providerId
  ? providers.value.slice(0, 3).map(p => preset(p.name, p.area + ' · ' + p.hours, () => { editDraft.providerId = p.id }))
  : events.value.filter(e => e.type !== '腸篩專案' && (e.booked < e.capacity || e.id === editing.value?.eventId)).slice(0, 3).map(e => preset(e.location, e.date + ' · ' + e.screenings[0], () => Object.assign(editDraft, { eventId: e.id, screening: e.screenings[0], slot: slots(e)[0] || '' }))))
const querySamples = computed(() => [...new Map(reservations.value.filter(r => r.status !== '已取消').map(r => [r.identity, r])).values()].slice(0, 3).map(r => preset(r.name, r.identity + ' · ' + r.screening, () => { searchId.value = r.identity; editing.value = null; editMatches.value = [] })))
const contactSamples = computed(() => [1, 2, 3].map(n => preset('聯絡資料 ' + n, '091200000' + n + ' · demo' + n + '@example.test', () => Object.assign(editDraft, { name: '模擬民眾' + n, phone: '091200000' + n, email: 'demo' + n + '@example.test', address: '彰化縣彰化市模擬路 ' + n + ' 號' }))))
const scheduleSamples = computed(() => [
  preset('平日全天', '週一至五 08:30－16:30', () => { daySchedule.value = weekNames.map((_, i) => i < 5 ? [{ start: '08:30', end: '16:30' }] : []) }),
  preset('平日分段', '週一至五上午與下午；週六上午', () => { daySchedule.value = weekNames.map((_, i) => i < 5 ? [{ start: '08:30', end: '12:00' }, { start: '13:30', end: '17:00' }] : i === 5 ? [{ start: '09:00', end: '12:00' }] : []) }),
  preset('每日晚間', '每日 18:00－20:00', () => { daySchedule.value = weekNames.map(() => [{ start: '18:00', end: '20:00' }]) }),
])
const workSamples = computed(() => {
  if (props.section === 'manual') {
    if (manualStep.value === 1) return ['整合式篩檢', '衛生局所設站', '腸篩專案'].map((type, i) => preset(type, '模擬民眾' + (i + 1) + ' · A2000000' + ['12', '21', '30'][i], () => Object.assign(manual, { type, identity: 'A2000000' + ['12', '21', '30'][i], name: '模擬民眾' + (i + 1), phone: '091200000' + (i + 1), area: type === '腸篩專案' ? providers.value[0]?.area || '田中鎮' : events.value.find(e => e.type === type && e.booked < e.capacity)?.area || '彰化市', eventId: '', screening: '', slot: '' })))
    const places = manual.type === '腸篩專案' ? providers.value : events.value.filter(e => e.type === manual.type && e.booked < e.capacity)
    return places.slice(0, 3).map(e => preset(e.location || e.name, (e.date || e.category) + ' · ' + e.area, () => Object.assign(manual, { area: e.area, eventId: e.id, screening: manual.type === '腸篩專案' ? '大腸癌篩檢' : e.screenings[0], slot: manual.type === '腸篩專案' ? e.hours : slots(e).find(label => { const config = e.slotCapacityByScreening?.[e.screenings[0]]?.[label] || e.slotCapacity?.[label]; return !config?.closed && config?.public !== 0 }) || '' })))
  }
  if (props.section === 'medical') return medicalTab.value === 'partners' ? [
    preset('兩家配合院所', '彰基、秀傳 · 不派車', () => { partnerList.value = partnerOptions.slice(0, 2); sendCar.value = false }),
    preset('三家配合院所', '彰基、秀傳、彰化醫院 · 衛生局派車', () => { partnerList.value = partnerOptions.slice(0, 3); sendCar.value = screening.value === '子宮頸抹片'; carProvider.value = '彰化縣衛生局' }),
  ] : [
    preset('正常開放', '各時段總名額 5、對外 3', () => { Object.values(slotDraft.value).forEach(row => Object.assign(row, { total: 5, public: 3, closed: false })) }),
    preset('零剩餘名額', '各時段總名額 5、對外 0', () => { Object.values(slotDraft.value).forEach(row => Object.assign(row, { total: 5, public: 0, closed: false })) }),
    preset('首時段不辦理', '第一時段停用，其餘正常開放', () => { Object.values(slotDraft.value).forEach((row, i) => Object.assign(row, { total: 5, public: i === 0 ? 0 : 3, closed: i === 0 })) }),
  ]
  if (props.section === 'providers') {
    if (providerTab.value === 'list') return providers.value.slice(0, 3).map(p => preset(p.name, p.area + ' · ' + p.category, () => Object.assign(providerFilter, { area: p.area, category: p.category, name: p.name })))
    if (providerTab.value === 'edit') return ['衛生所', '藥局', '藥局'].map((category, i) => preset('模擬院所 ' + (i + 1), category + ' · 880000' + (i + 1), () => Object.assign(providerDraft, { area: ['田中鎮', '彰化市', '員林市'][i], category, name: '模擬測試' + category + (i + 1), phone: '880000' + (i + 1), address: '彰化縣' + ['田中鎮', '彰化市', '員林市'][i] + '模擬路 ' + (i + 1) + ' 號', week: [true, true, true, true, true, i === 2, false], periods: [{ start: '08:30', end: i === 1 ? '20:30' : '16:30' }] })))
    return [preset('單日公休', calendarDays.value[0], () => { closureDraft.value = [calendarDays.value[0]] }), preset('連續三日', calendarDays.value.slice(0, 3).join('、'), () => { closureDraft.value = calendarDays.value.slice(0, 3) }), preset('本月週末', '本月所有星期六、日', () => { closureDraft.value = calendarDays.value.filter(day => [0, 6].includes(new Date(day + 'T12:00:00').getDay())) })]
  }
  if (props.section === 'roster') return rosterResults.value.slice(0, 3).map(r => preset(r.name + '的預約條件', r.reservationDate + ' · ' + r.screeningType, async () => { Object.assign(rosterFilter, { from: r.reservationDate, to: r.reservationDate, area: r.township || '全部', eventId: '全部', screening: r.screeningType, source: r.reservationSource }); await nextTick(); rosterFilter.eventId = r.event?.id || '全部' }))
  if (props.section === 'tracking') return trackResults.value.slice(0, 3).map(r => preset(r.name, r.identity + ' · ' + r.state, () => Object.assign(trackFilter, { area: r.township, provider: r.institution, state: statusCode(r.state), identity: r.identity, month: String(r.date).slice(0, 7), updated: '全部' })))
  if (props.section === 'labels') return [...new Map(queryLabelRecords(tracking.value, { actor: props.actor, filters: { printStatus: '全部' } }).map(r => [r.institutionType + r.printStatus, r])).values()].slice(0, 3).map(r => preset(r.institutionType + ' · ' + labelPrintStatuses[r.printStatus], '篩選目前已有的模擬標籤', () => Object.assign(labelFilter, { category: r.institutionType, status: labelPrintStatuses[r.printStatus] })))
  if (props.section === 'tubes') return queryBowelReturns(tracking.value, { actor: props.actor, reservations: reservations.value }).slice(0, 3).map(r => preset(r.name, r.identity + ' · ' + r.returnStatus, () => Object.assign(tubeFilter, { identity: r.identity, state: r.returnStatus, category: r.institutionType, from: r.issueDate, to: r.issueDate })))
  if (props.section === 'lab') return queryBowelLabRecords(tracking.value, { actor: props.actor, filters: { currentStatus: '全部' } }).slice(0, 3).map(r => preset(r.name, r.bowelReservationId + ' · ' + r.state, () => Object.assign(labFilter, { township: r.township, institution: r.institutionName, returnFrom: r.returnedDate, returnTo: r.returnedDate, identity: r.identity, reservationId: r.bowelReservationId, currentStatus: r.currentStatus })))
  return []
})
async function fillSample(sample) { await sample.fill(); if (props.section === 'labels') labelApplied.value = { ...labelFilter }; tell('模擬資料已帶入，請核對欄位') }
</script>

<template>
  <div class="admin-work"><div class="admin-page-heading"><div><h1>{{ titles[section] }}</h1><p>{{ { medical: '選擇場次，設定配合院所與各時段的預約名額。', providers: '管理領管院所、營業時段與公休日。', manual: '先填寫民眾資料，再選擇預約場次。', edit: '先查詢預約，再核對資料、修改或取消。', roster: '查詢符合條件的預約，再匯出工作清冊。', tracking: '追蹤檢體管進度，確認後再更新狀態。', labels: '篩選名單，勾選需要列印的標籤。', tubes: '查詢發管紀錄，勾選已收到的檢體管並儲存。', lab: '查詢已繳回檢體，確認衛生所收回後標記送驗。' }[section] }}</p></div></div>
    <div v-if="scopedTask" class="admin-task-scope"><p>目前顯示：{{ scopedTask.label }} · {{ tracking.filter(inTaskScope).length }} 筆</p><button type="button" class="admin-text-action" @click="clearTaskScope">清除待辦篩選</button></div><template v-if="section === 'medical'">
      <div class="admin-filter"><div class="grid gap-4 sm:grid-cols-2"><div><label class="label">活動場次</label><select v-model.number="selectedEventId" class="field"><option v-for="e in events.filter(item => item.type !== '腸篩專案')" :key="e.id" :value="e.id">{{ e.date }} · {{ e.location }}</option></select></div><div><label class="label">篩檢項目</label><select v-model="screening" class="field"><option v-for="item in medicalScreenings" :key="item">{{ item }}</option></select></div></div><p class="mt-4 text-sm leading-6 text-[#59695a]">{{ selectedEvent?.start }}－{{ selectedEvent?.end }} · 每 {{ selectedEvent?.interval || 30 }} 分鐘一個時段</p><AdminSampleData :samples="medicalEventSamples" @select="fillSample" /></div>
      <div class="work-tabs" aria-label="名額設定步驟"><button :class="['work-tab', medicalTab === 'partners' ? 'is-active' : '']" :aria-pressed="medicalTab === 'partners'" @click="medicalTab = 'partners'">配合院所</button><button :class="['work-tab', medicalTab === 'slots' ? 'is-active' : '']" :aria-pressed="medicalTab === 'slots'" @click="medicalTab = 'slots'">時段與名額</button></div>
      <section v-if="medicalTab === 'partners'" class="card p-6"><h2 class="work-step-title">配合醫療院所</h2><p class="mb-5 text-sm leading-6 text-[#59695a]">{{ screening === '整合式篩檢' ? '確認配合院所後，即可設定整篩各時段名額。' : '子抹與乳攝需設定 2 至 4 家院所。完成後，再檢查各時段名額。' }}</p><div v-for="(name,index) in partnerList" :key="index" class="mb-3 flex gap-3"><select v-model="partnerList[index]" class="field" :aria-label="'第 ' + (index + 1) + ' 家配合院所'"><option>彰化基督教醫院</option><option>秀傳紀念醫院</option><option>彰化醫院</option><option>員林基督教醫院</option><option>衛生所</option></select><button class="btn-secondary shrink-0" @click="partnerList.splice(index,1)">移除</button></div><button class="btn-secondary" :disabled="partnerList.length >= 4" @click="addPartner">新增配合院所</button><div v-if="screening === '子宮頸抹片'" class="mt-6 space-y-3"><label class="flex items-center gap-3 text-sm"><input v-model="sendCar" type="checkbox">派送子抹車</label><select v-if="sendCar" v-model="carProvider" class="field max-w-xs" aria-label="派車單位"><option>彰化縣衛生局</option><option>彰化基督教醫院</option><option>秀傳紀念醫院</option></select></div><AdminSampleData :samples="workSamples" @select="fillSample" /><div class="work-actions"><button class="btn-primary" @click="medicalTab = 'slots'">下一步：時段與名額</button></div></section>
      <section v-else class="card p-6"><h2 class="work-step-title">時段與名額</h2><p class="mb-5 text-sm leading-6 text-[#59695a]">第一列輸入會同步帶入下方時段，之後可逐列調整。每時段 0–99 人，對外名額不得超過總名額；勾選「不辦理」會停止開放。</p><div class="overflow-x-auto"><table class="w-full min-w-[560px] text-sm"><thead><tr><th>時段</th><th>總名額</th><th>對外名額</th><th>不辦理</th></tr></thead><tbody><tr v-for="(row,label,index) in slotDraft" :key="label"><td>{{ label }}</td><td><input v-model.number="row.total" type="number" min="0" max="99" :disabled="row.closed" class="field max-w-24" :aria-label="label + ' 總名額'" @input="index === 0 && Object.keys(slotDraft).slice(1).forEach(key => { slotDraft[key].total = row.total })"></td><td><input v-model.number="row.public" type="number" min="0" max="99" :disabled="row.closed" class="field max-w-24" :aria-label="label + ' 對外名額'" @input="index === 0 && Object.keys(slotDraft).slice(1).forEach(key => { slotDraft[key].public = row.public })"></td><td><input v-model="row.closed" type="checkbox" :aria-label="label + ' 不辦理'"></td></tr></tbody></table></div><AdminSampleData :samples="workSamples" @select="fillSample" /><div class="work-actions"><button class="btn-secondary" @click="medicalTab = 'partners'">返回配合院所</button><button class="btn-primary" @click="saveMedical">儲存並確認公布</button></div></section>
    </template>
    <template v-else-if="section === 'providers'"><div class="work-tabs"><button v-for="item in [{ key: 'list', label: '院所清單' }, { key: 'edit', label: '院所資料' }, { key: 'closure', label: '公休設定' }]" :key="item.key" :class="['work-tab', providerTab === item.key ? 'is-active' : '']" @click="providerTab = item.key">{{ item.label }}</button></div><section v-if="providerTab === 'list'" class="card p-6"><div class="mb-5 grid gap-3 md:grid-cols-3"><div><label class="label">鄉鎮市區</label><select aria-label="院所鄉鎮" v-model="providerFilter.area" class="field"><option value="全部">全部鄉鎮</option><option v-for="item in areas" :key="item">{{ item }}</option></select></div><div><label class="label">院所類別</label><select aria-label="院所類別" v-model="providerFilter.category" class="field"><option>全部</option><option>衛生所</option><option>藥局</option></select></div><div><label class="label">醫療院所</label><select aria-label="院所名稱" v-model="providerFilter.name" class="field"><option>全部</option><option v-for="p in readableProviders" :key="p.id">{{ p.name }}</option></select></div></div><AdminSampleData class="mb-5" :samples="workSamples" automatic @select="fillSample" /><div class="mb-5 flex gap-2"><button class="btn-primary" @click="newProvider">＋ 新增院所</button><button class="btn-secondary" @click="exportProviders">匯出 CSV</button></div><div class="overflow-x-auto"><table class="w-full min-w-[620px] text-sm"><thead class="bg-[#eeeee3]"><tr><th v-for="item in ['鄉鎮', '類別', '醫療院所', '電話', '營業時間', '操作']" :key="item" class="p-3 text-left">{{ item }}</th></tr></thead><tbody><tr v-for="p in providerResults" :key="p.id" class="border-b border-stone-100"><td class="p-3">{{ p.area }}</td><td class="p-3">{{ p.category }}</td><td class="p-3 font-bold">{{ p.name }}</td><td class="p-3">{{ p.phone }}</td><td class="p-3">{{ p.hours }}</td><td class="p-3"><button class="font-bold text-brand" @click="providerId = p.id; providerTab = 'edit'">編輯院所</button><button class="mt-2 block text-brand" @click="providerId = p.id; openSchedule()">營業時段</button></td></tr><tr v-if="!providerResults.length"><td colspan="6" class="py-10 text-center">沒有符合條件的院所，請調整篩選條件。</td></tr></tbody></table></div></section><section v-else-if="providerTab === 'edit'" class="card space-y-5 p-6"><div class="grid gap-3 md:grid-cols-2"><div><label class="label">類別</label><select v-model="providerDraft.category" class="field"><option>衛生所</option><option>藥局</option></select></div><div><label class="label">鄉鎮市</label><select v-model="providerDraft.area" class="field"><option v-for="item in areas" :key="item">{{ item }}</option></select></div><div><label class="label">活動地點／院所名稱</label><input v-model="providerDraft.name" class="field"></div><div><label class="label">聯絡電話（7 碼）</label><input v-model="providerDraft.phone" class="field" maxlength="7"></div></div><div><label class="label">活動地址</label><input v-model="providerDraft.address" class="field"></div><div><h2 class="mb-3 font-black">每週營業日</h2><div class="flex flex-wrap gap-3"><label v-for="(day, index) in weekNames" :key="day" class="flex items-center gap-2 rounded-xl bg-[#e7ecdf] px-3 py-2 text-sm"><input v-model="providerDraft.week[index]" type="checkbox">星期{{ day }}</label></div></div><div><h2 class="mb-3 font-black">每日營業時段</h2><div v-for="(period, index) in providerDraft.periods" :key="index" class="mb-2 flex flex-wrap items-center gap-2"><input v-model="period.start" type="time" step="300" class="field max-w-44"><span>至</span><input v-model="period.end" type="time" step="300" class="field max-w-44"><button class="btn-secondary" @click="providerDraft.periods.splice(index, 1)">移除</button></div><button class="btn-secondary" @click="providerDraft.periods.push({ start: '13:00', end: '17:00' })">＋ 增加時段</button></div><AdminSampleData :samples="workSamples" @select="fillSample" /><div class="flex gap-3"><button class="btn-secondary" @click="providerTab = 'list'">離開</button><button class="btn-primary" @click="saveProvider">儲存</button></div></section><section v-else class="card p-6"><div class="mb-5 flex flex-wrap items-center justify-between gap-3"><select v-model.number="providerId" class="field max-w-xs"><option v-for="p in readableProviders" :key="p.id" :value="p.id">{{ p.name }}</option></select><div class="flex items-center gap-3"><button class="btn-secondary" :disabled="closureMonth <= 0" @click="closureMonth--">←</button><b>{{ calendarDate.getFullYear() }} 年 {{ calendarDate.getMonth() + 1 }} 月</b><button class="btn-secondary" @click="closureMonth++">→</button></div></div><div class="calendar-grid grid grid-cols-7 gap-2 text-center"><div v-for="day in weekNames" :key="day" class="py-2 text-xs font-bold text-stone-400">{{ day }}</div><div v-for="blank in calendarBlank" :key="`blank-${blank}`"></div><button v-for="day in calendarDays" :key="day" :class="['min-h-14 rounded-xl border text-sm', closureDraft.includes(day) ? 'border-brand bg-[#e7ecdf] font-bold text-brand' : 'border-[#d8ddce]']" @click="toggleClosed(day)">{{ Number(day.slice(-2)) }}<span v-if="closureDraft.includes(day)" class="block">× 公休</span></button></div><AdminSampleData :samples="workSamples" @select="fillSample" /><div class="mt-5 flex gap-3"><button class="btn-secondary" @click="providerTab = 'list'">離開</button><button class="btn-primary" @click="saveClosures">儲存公休</button></div></section></template>
    <template v-else-if="section === 'manual'">
      <ol class="mb-6 grid grid-cols-3 gap-3"><li class="border-t-2 border-[#526c4b] pt-3 text-sm">1 · 民眾資料</li><li :class="['border-t-2 pt-3 text-sm', manualStep >= 2 ? 'border-[#526c4b]' : 'border-[#d8ddce]']">2 · 場次與時段</li><li :class="['border-t-2 pt-3 text-sm', manualStep >= 3 ? 'border-[#526c4b]' : 'border-[#d8ddce]']">3 · 資料確認</li></ol>
      <section class="card max-w-4xl p-6">
        <div v-if="manualStep === 1" class="space-y-5"><h2 class="work-step-title">民眾資料</h2><div><label class="label">預約類型</label><select v-model="manual.type" class="field" @change="manual.eventId = ''; manual.slot = ''; manual.screening = ''"><option>整合式篩檢</option><option>衛生局所設站</option><option>腸篩專案</option></select></div><div><label class="label">身分證字號</label><div class="flex gap-3"><input v-model="manual.identity" class="field" maxlength="10" placeholder="例如 N123456789"><button class="btn-secondary shrink-0" @click="manualLookup">帶入資料</button></div></div><div class="grid gap-4 sm:grid-cols-2"><div><label class="label">姓名</label><input v-model="manual.name" class="field" maxlength="10"></div><div><label class="label">手機號碼 {{ manual.type === '腸篩專案' ? '（必填）' : '（選填）' }}</label><input v-model="manual.phone" class="field" maxlength="10" inputmode="tel"></div><div><label class="label">出生年月日（若有）</label><input v-model="manual.birth" type="date" class="field"></div><div><label class="label">現居地址（若有）</label><input v-model="manual.address" class="field"></div></div><p class="text-sm leading-6 text-[#59695a]">「帶入資料」僅比對本機預約資料，未連接真實名冊。</p><AdminSampleData :samples="workSamples" @select="fillSample" /><div class="work-actions"><button class="btn-primary" @click="advanceManual">下一步：選擇場次</button></div></div>
        <div v-else-if="manualStep === 2" class="space-y-5"><h2 class="work-step-title">場次與時段</h2><p class="rounded-xl bg-[#e7ecdf] p-4 text-sm leading-6">{{ manual.name }} · {{ manual.identity }} · {{ manual.type }}</p><div v-if="manual.type !== '整合式篩檢'"><label class="label">鄉鎮市區</label><select v-model="manual.area" class="field" @change="manual.eventId = ''; manual.screening = ''; manual.slot = ''"><option v-for="item in areas" :key="item">{{ item }}</option></select></div><div><label class="label">{{ manual.type === '腸篩專案' ? '領管院所' : '活動場次' }}</label><select v-model="manual.eventId" class="field" @change="manual.slot = ''; manual.screening = ''"><option value="">請選擇</option><option v-for="e in eventOptions" :key="e.id" :value="e.id">{{ e.date }} · {{ e.location }}</option></select><p v-if="!eventOptions.length" class="mt-2 text-sm text-[#59695a]">目前沒有可預約的場次，請選擇其他鄉鎮或預約類型。</p></div><div v-if="manual.eventId" class="grid gap-4 sm:grid-cols-2"><div><label class="label">篩檢項目</label><select v-model="manual.screening" class="field"><option value="">請選擇</option><option v-for="item in manual.type === '腸篩專案' ? ['大腸癌篩檢'] : manualPlace?.screenings" :key="item">{{ item }}</option></select></div><div><label class="label">{{ manual.type === '腸篩專案' ? '領管時間' : '預約時段' }}</label><select v-model="manual.slot" class="field"><option value="">請選擇</option><option v-for="item in manual.type === '腸篩專案' ? [manualPlace?.hours] : slots(manualPlace)" :key="item">{{ item }}</option></select></div></div><AdminSampleData :samples="workSamples" @select="fillSample" /><div class="work-actions"><button class="btn-secondary" @click="manualStep = 1">返回民眾資料</button><button class="btn-primary" @click="reviewManual">下一步：確認資料</button></div></div>
        <div v-else-if="manualStep === 3" class="space-y-6"><h2 class="work-step-title">預約資料確認</h2><section class="rounded-xl bg-[#e7ecdf] p-5"><h3 class="text-xl font-normal">民眾基本資料</h3><dl class="mt-3 grid gap-3 text-base sm:grid-cols-2"><div><dt>身分證</dt><dd>{{ manual.identity.toUpperCase() }}</dd></div><div><dt>姓名</dt><dd>{{ manual.name }}</dd></div><div><dt>手機</dt><dd>{{ manual.phone || '未提供' }}</dd></div><div><dt>出生年月日</dt><dd>{{ manual.birth || '未提供' }}</dd></div><div class="sm:col-span-2"><dt>現居地址</dt><dd>{{ manual.address || '未提供' }}</dd></div></dl></section><section class="rounded-xl bg-[#f1ebdf] p-5"><h3 class="text-xl font-normal">預約資訊</h3><dl class="mt-3 grid gap-3 text-base sm:grid-cols-2"><div><dt>預約類型</dt><dd>{{ manual.type }}</dd></div><div><dt>篩檢項目</dt><dd>{{ manual.type === '腸篩專案' ? '糞便潛血檢查' : manual.screening }}</dd></div><div><dt>{{ manual.type === '腸篩專案' ? '領管院所' : '場次' }}</dt><dd>{{ manualPlace?.location || manualPlace?.name }}</dd></div><div v-if="manual.type === '腸篩專案'"><dt>院所類型</dt><dd>{{ manualPlace?.category }}</dd></div><div v-else><dt>日期</dt><dd>{{ manualPlace?.date }}</dd></div><div><dt>{{ manual.type === '腸篩專案' ? '可領管時間' : '預約時段' }}</dt><dd>{{ manual.slot }}</dd></div><div class="sm:col-span-2"><dt>地址</dt><dd>{{ manualPlace?.address }}</dd></div></dl></section><p class="text-base">資料來源：後台人工輸入</p><div class="work-actions"><button class="btn-secondary" :disabled="manualSubmitting" @click="manualStep = 2">返回修改</button><button class="btn-primary" :disabled="manualSubmitting" @click="saveManual">{{ manualSubmitting ? '建立中…' : '確認建立預約' }}</button></div></div>
        <div v-else class="space-y-5"><h2 class="work-step-title">預約建立成功</h2><div class="rounded-xl bg-[#e7ecdf] p-5 text-base leading-7"><p>預約編號：{{ manualSuccess?.id }}</p><p>姓名：{{ manualSuccess?.name }}</p><p>預約項目：{{ manualSuccess?.screening }}</p></div><div class="work-actions"><button class="btn-secondary" @click="router.push('/admin?section=roster')">返回預約名單</button><button class="btn-primary" @click="startNewManual">繼續新增預約</button></div></div>
      </section>
    </template>
    <template v-else-if="section === 'edit'"><section class="card space-y-5 p-6">
      <div><label class="label">依身分證字號查詢</label><div class="flex gap-2"><input v-model="searchId" class="field" maxlength="10" placeholder="例如 N123456789" @keyup.enter="findEdit"><button class="btn-primary shrink-0" @click="findEdit">查詢</button></div></div>
      <AdminSampleData :samples="querySamples" @select="fillSample" /><div v-if="editMatches.length > 1" class="mt-5"><label class="label">此民眾有 {{ editMatches.length }} 筆預約，請選擇要處理的紀錄</label><select class="field" :value="editing?.id" @change="selectEdit(editMatches.find(r => r.id === $event.target.value))"><option v-for="r in editMatches" :key="r.id" :value="r.id">{{ r.id }} · {{ r.screening }} · {{ r.slot }}</option></select></div><div v-if="editing" class="space-y-5 border-t border-stone-100 pt-5">
        <div class="grid gap-3 md:grid-cols-2"><div><label class="label">身分證字號（不可修改）</label><input :value="editing.identity" class="field bg-stone-50" readonly></div><div><label class="label">出生年月日（不可修改）</label><input :value="editing.birth || '示範資料未提供'" class="field bg-stone-50" readonly></div><div><label class="label">姓名</label><input v-model="editDraft.name" class="field"></div><div><label class="label">手機號碼</label><input v-model="editDraft.phone" class="field"></div><div><label class="label">E-mail</label><input v-model="editDraft.email" class="field"></div><div><label class="label">現居地址</label><input v-model="editDraft.address" class="field"></div></div>
        <div class="rounded-xl bg-[#e7ecdf] p-4 text-sm">目前預約：{{ events.find(e => e.id === editing.eventId)?.location || providers.find(p => p.id === editing.providerId)?.name }} · {{ editing.slot }} · {{ editing.screening }}</div>
        <div v-if="editing.providerId" class="grid gap-3 md:grid-cols-2"><div><label class="label">修改領管院所</label><select v-model="editDraft.providerId" class="field"><option v-for="p in readableProviders" :key="p.id" :value="p.id">{{ p.area }} · {{ p.name }}</option></select></div><div><label class="label">領管時間</label><input :value="providers.find(p => p.id === Number(editDraft.providerId))?.hours" class="field bg-stone-50" readonly></div></div>
        <div v-else class="grid gap-3 md:grid-cols-2"><div><label class="label">修改場次</label><select v-model="editDraft.eventId" class="field"><option v-for="e in readableEvents" :key="e.id" :value="e.id">{{ e.date }} · {{ e.location }}</option></select></div><div><label class="label">時段</label><select v-model="editDraft.slot" class="field"><option v-for="item in slots(events.find(e => e.id === Number(editDraft.eventId)))" :key="item">{{ item }}</option></select></div><div><label class="label">篩檢項目</label><select v-model="editDraft.screening" class="field"><option v-for="item in events.find(e => e.id === Number(editDraft.eventId))?.screenings" :key="item">{{ item }}</option></select></div></div>
        <AdminSampleData :samples="editPlaceSamples" @select="fillSample" /><AdminSampleData :samples="contactSamples" @select="fillSample" /><div class="flex flex-wrap gap-3"><button class="btn-primary" @click="saveEdit">儲存修改</button><button class="btn-secondary text-red-700" @click="cancelEdit">取消預約</button></div>
      </div>
    </section></template>
    <template v-else-if="section === 'roster'">
      <form class="admin-filter" @submit.prevent="rosterApplied = { ...rosterFilter }">
        <p class="mb-5 rounded-xl bg-[#e7ecdf] p-4 text-sm leading-6">目前可查詢範圍：{{ rosterScopeLabel }}</p>
        <div class="grid gap-4 sm:grid-cols-3">
          <div><label class="label" for="roster-from">起始日期</label><input id="roster-from" v-model="rosterFilter.from" type="date" class="field"></div>
          <div><label class="label" for="roster-to">結束日期</label><input id="roster-to" v-model="rosterFilter.to" type="date" class="field"></div>
          <div><label class="label" for="roster-township">鄉鎮別</label><select id="roster-township" v-model="rosterFilter.area" class="field"><option>全部</option><option v-for="area in areas" :key="area">{{ area }}</option></select></div>
          <div><label class="label" for="roster-event">場次</label><select id="roster-event" v-model="rosterFilter.eventId" class="field"><option>全部</option><option v-for="e in rosterEventOptions" :key="e.id" :value="e.id">{{ e.date }} · {{ e.location }}</option></select></div>
          <div><label class="label" for="roster-screening">篩檢項目</label><select id="roster-screening" v-model="rosterFilter.screening" class="field"><option>全部</option><option v-for="item in ['子宮頸抹片','乳房攝影','糞便潛血檢查','整合式篩檢']" :key="item">{{ item }}</option></select></div>
          <div><label class="label" for="roster-source">預約方式</label><select id="roster-source" v-model="rosterFilter.source" class="field"><option value="全部">全部</option><option value="public">自行預約</option><option value="staff">輸入預約</option></select></div>
        </div>
        <AdminSampleData class="mt-5" :samples="workSamples" @select="fillSample" />
        <div class="mt-5"><button class="btn-primary">查詢</button></div>
      </form>
      <section class="admin-result">
        <div class="admin-result-heading"><h2>預約名單 <span class="ml-2 text-sm text-[#59695a]">{{ rosterResults.length }} 筆</span></h2><button v-if="has('booking.export')" class="btn-secondary" @click="exportRoster">Excel 匯出（CSV）</button></div>
        <div class="overflow-x-auto"><table class="w-full min-w-[1400px] text-sm"><thead><tr><th>ID／身分證</th><th>姓名</th><th>出生年月日</th><th>手機號碼</th><th>現居地址</th><th>鄉鎮別</th><th>預約日期</th><th>預約時段／領管資訊</th><th>篩檢項目</th><th>預約方式</th><th>操作</th></tr></thead><tbody>
          <tr v-for="r in rosterResults" :key="r.reservationId"><td><p class="break-all">{{ r.reservationId }}</p><p class="mt-1 text-[#59695a]">{{ r.identityId }}</p></td><td>{{ r.name }}</td><td>{{ r.birthDate || '未提供' }}</td><td>{{ r.phone || '未提供' }}</td><td>{{ r.currentAddress || '未提供' }}</td><td>{{ r.township }}</td><td>{{ r.reservationDate }}</td><td><template v-if="r.program === 'bowel'"><span>領管院所：{{ r.institutionName }}</span><span class="mt-1 block text-[#59695a]">可領管時間：{{ r.pickupSchedule }}</span></template><span v-else>{{ r.timeSlot || '未指定時段' }}<span class="mt-1 block text-[#59695a]">{{ r.location }}</span></span></td><td>{{ r.screeningType }}</td><td>{{ reservationSourceLabels[r.reservationSource] }}</td><td><button class="admin-text-action" @click="emit('open-edit', r.identityId)">查看預約</button></td></tr>
          <tr v-if="!rosterResults.length"><td colspan="11" class="py-10 text-center">沒有符合條件的預約，請調整篩選條件。</td></tr>
        </tbody></table></div>
        <p class="border-t border-[#d8ddce] px-6 py-4 text-sm text-[#59695a]">資料依目前機構範圍與查詢條件顯示；匯出使用相同結果。</p>
      </section>
    </template>
    <template v-else-if="section === 'tracking'">
      <section class="card p-6">
        <div class="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><label class="label" for="track-area">鄉鎮市區</label><select id="track-area" v-model="trackFilter.area" class="field"><option>全部</option><option v-for="item in areas" :key="item">{{ item }}</option></select></div>
          <div><label class="label" for="track-provider">領管院所</label><select id="track-provider" v-model="trackFilter.provider" class="field"><option>全部</option><option v-for="name in trackingInstitutionOptions" :key="name">{{ name }}</option></select></div>
          <div><label class="label" for="track-state">目前狀態</label><select id="track-state" v-model="trackFilter.state" class="field"><option>全部</option><option v-for="item in statuses" :key="item.code" :value="item.code">{{ item.label }}</option></select></div>
          <div><label class="label" for="track-followup">待追蹤／異常狀態</label><select id="track-followup" v-model="trackFilter.followUp" class="field"><option>全部</option><option v-for="item in followUpStatuses" :key="item.code" :value="item.code">{{ item.label }}</option></select></div>
          <div><label class="label" for="track-identity">身分證字號</label><input id="track-identity" v-model="trackFilter.identity" class="field" placeholder="單筆民眾查詢"></div>
          <div><label class="label" for="track-updated">更新狀態</label><select id="track-updated" v-model="trackFilter.updated" class="field"><option>全部</option><option>已更新</option><option>未更新</option></select></div>
          <div><label class="label" for="track-month">預約年月</label><input id="track-month" v-model="trackFilter.month" type="month" class="field"></div>
        </div>
        <AdminSampleData :samples="workSamples" @select="fillSample" />
        <div class="mb-5 mt-5 flex flex-wrap gap-3"><button class="btn-primary" @click="trackApplied = { ...trackFilter }">查詢</button><button v-if="has('bowel.export')" class="btn-secondary" @click="csv('腸篩名單動態_DEMO.csv', trackingExportHeaders, trackingExportRows(trackResults))">匯出 CSV</button></div>
        <div class="overflow-x-auto"><table class="w-full min-w-[900px] text-sm"><thead class="bg-[#eeeee3]"><tr><th v-for="item in ['鄉鎮別', '醫療院所', '預約編號', '姓名', '身分證', '預約日期', '目前狀態', '最新狀態時間', '待追蹤／異常', '業務作業']" :key="item" class="text-left">{{ item }}</th></tr></thead><tbody>
          <tr v-for="r in trackResults" :key="r.id"><td>{{ r.township }}</td><td>{{ r.institution }}</td><td><button class="admin-text-action tabular-nums" @click="specialRecord = r">{{ r.bowelReservationId }}</button></td><td>{{ r.name }}</td><td>{{ r.identity }}</td><td>{{ r.date }}</td><td>{{ r.state }}</td><td>{{ r.statusUpdatedAt ? trackingHistoryTime(r.statusUpdatedAt) : '—' }}</td><td>{{ r.specialStatus?.label || '—' }}<span v-if="r.specialStatus" class="block text-xs text-[#59695a]">已滿 {{ r.specialStatus.days }} 天</span></td><td><div class="flex flex-wrap gap-3"><button v-if="r.currentStatus === 'DISPATCHED' && canOperateBowelStep(r, 'RECEIVED', actor).allowed" class="admin-text-action" @click="openBowelAction(r, 'RECEIVED')">確認接收</button><button v-else-if="r.currentStatus === 'RECEIVED' && canOperateBowelStep(r, 'PICKED_UP', actor).allowed" class="admin-text-action" @click="openBowelAction(r, 'PICKED_UP')">確認領管</button><span v-else-if="r.currentStatus === 'PICKED_UP'" class="text-[#59695a]">待繳回</span><span v-else class="text-[#59695a]">—</span><button v-if="canRollbackBowelStep(r, actor, followUpNow)" class="admin-text-action" @click="undoStatus(tracking.find(item => item.id === r.id))">復原</button></div></td></tr>
          <tr v-if="!trackResults.length"><td colspan="10" class="py-10 text-center">沒有符合條件的名單，請調整查詢條件。</td></tr>
        </tbody></table></div>
        <p class="mt-4 text-xs leading-6 text-[#59695a]">接收與領管由院所實際業務動作確認。DEMO 一般操作可於 10 分鐘內復原；衛生局依既有規則不受期限限制。</p>
      </section>
    </template>    <template v-else-if="section === 'labels'">
      <section v-if="!canUseBowelLabels(actor)" class="card p-6"><p>目前身分沒有腸篩標籤列印權限。</p></section>
      <section v-else class="card p-6">
        <div class="grid gap-3 md:grid-cols-2">
          <div><label class="label" for="label-category">類別</label><select id="label-category" v-model="labelFilter.category" class="field"><option>全部</option><option>衛生所</option><option>藥局</option></select></div>
          <div><label class="label" for="label-status">列印狀態</label><select id="label-status" v-model="labelFilter.status" class="field"><option>尚未列印</option><option>完成列印</option></select></div>
        </div>
        <div class="mt-5"><button class="btn-secondary" @click="labelApplied = { ...labelFilter }">查詢</button></div>
        <AdminSampleData class="my-5" :samples="workSamples" automatic @select="fillSample" />
        <div class="mb-5 flex flex-wrap gap-2">
          <button v-if="labelApplied.status === '尚未列印'" class="btn-primary" :disabled="!chosenLabels.length" @click="printLabels('PRINT')">列印所選（{{ chosenLabels.length }}）</button>
          <template v-else><button class="btn-primary" :disabled="!chosenLabels.length" @click="printLabels('PRINT')">補印所選（{{ chosenLabels.length }}）</button><button class="btn-secondary" :disabled="!chosenLabels.length" @click="printLabels('CANCEL_PRINT')">取消列印</button></template>
          <button v-if="has('bowel.export')" class="btn-secondary" @click="exportLabels">Excel 匯出（CSV）</button>
          <button v-if="has('bowel.export')" class="btn-secondary" @click="exportLabelRoster">匯出 DEMO 比對名冊</button>
          <button class="btn-secondary" @click="router.push('/bowel-scan')">掃描／比對條碼</button>
        </div>
        <div v-if="labelPreview" class="mb-6 border-y border-[#d8ddce] py-5"><div class="flex flex-wrap items-center justify-between gap-3"><h2 class="text-xl font-normal">標籤預覽</h2><button class="btn-secondary" @click="labelPreviewId = ''">收起預覽</button></div><div class="mt-4"><BowelLabel :record="labelPreview" /></div><p class="mt-3 text-sm leading-7 text-[#59695a]">列印資料依院所分組，同院所依預約編號排序；補印沿用原預約編號與條碼。</p></div>
        <div class="overflow-x-auto"><table class="w-full min-w-[900px] text-sm"><thead class="bg-[#eeeee3]"><tr><th><input type="checkbox" aria-label="全選目前可操作資料" :checked="selectableLabels.length > 0 && selectableLabels.every(id => chosenLabels.includes(id))" :disabled="!selectableLabels.length" @change="selectAllLabels($event.target.checked)"></th><th v-for="item in ['預約編號', '姓名', '身分證', '預約日期', '院所／藥局', '列印狀態', '列印時間', '主要狀態', '預覽']" :key="item" class="text-left">{{ item }}</th></tr></thead><tbody><tr v-for="r in labelResults" :key="r.id"><td><input type="checkbox" :aria-label="'選取 ' + r.name + ' 的標籤'" :checked="chosenLabels.includes(r.id)" :disabled="!selectableLabels.includes(r.id)" @change="toggleSelection(chosenLabels, r.id)"></td><td class="tabular-nums">{{ r.bowelReservationId }}</td><td>{{ r.name }}</td><td>{{ r.identity }}</td><td>{{ r.date }}</td><td>{{ r.institution }}<span class="block text-xs text-[#59695a]">{{ r.institutionType }}</span></td><td>{{ labelPrintStatuses[r.printStatus] }}</td><td>{{ r.printedAt || '—' }}</td><td>{{ r.state }}</td><td><button class="admin-text-action" @click="labelPreviewId = r.id">預覽標籤</button></td></tr><tr v-if="!labelResults.length"><td colspan="10" class="py-10 text-center">目前沒有符合條件的標籤資料。</td></tr></tbody></table></div>
        <p class="mt-4 text-xs leading-6 text-[#59695a]">全選只包含目前篩選結果中可操作的紀錄。已接收及之後狀態不可補印或取消列印；實際印表機與後端尚未連接。</p>
      </section>
    </template>
    <template v-else-if="section === 'tubes'">
      <section class="card p-6">
        <div class="mb-5 grid gap-3 md:grid-cols-3">
          <div><label class="label" for="tube-identity">身分證字號</label><input id="tube-identity" v-model.trim="tubeFilter.identity" class="field" maxlength="10" placeholder="輸入完整身分證字號" @keyup.enter="searchTubes"></div>
          <div><label class="label" for="tube-state">繳管狀態</label><select id="tube-state" v-model="tubeFilter.state" class="field"><option>全部</option><option>未繳管</option><option>已繳管</option></select></div>
          <div><label class="label" for="tube-category">發管單位</label><select id="tube-category" v-model="tubeFilter.category" class="field"><option>全部</option><option>衛生所</option><option>藥局</option></select></div>
          <div><label class="label" for="tube-from">發管日期起</label><input id="tube-from" v-model="tubeFilter.from" type="date" class="field"></div>
          <div><label class="label" for="tube-to">發管日期迄</label><input id="tube-to" v-model="tubeFilter.to" type="date" class="field"></div>
        </div>
        <AdminSampleData :samples="workSamples" @select="fillSample" />
        <div class="mb-5 mt-5 flex flex-wrap gap-2">
          <button class="btn-primary" @click="searchTubes">查詢</button>
          <button class="btn-secondary" @click="qrOpen = true; qrPayload = ''; qrError = ''">掃描 QR Code</button>
          <button class="btn-primary" :disabled="!chosenTubes.length" @click="saveTubes">儲存（{{ chosenTubes.length }}）</button>
          <button v-if="canUseBowelReturns(actor) && has('bowel.export')" class="btn-secondary" @click="exportTubes">匯出 CSV</button>
        </div>
        <p v-if="tubeMessage" role="status" class="mb-4 rounded-xl bg-[#e7ecdf] p-3 text-sm leading-6">{{ tubeMessage }}</p>
        <div class="overflow-x-auto"><table class="w-full min-w-[900px] text-sm">
          <thead class="bg-[#eeeee3]"><tr><th class="p-3"><input type="checkbox" aria-label="全選目前可繳管資料" :checked="selectableTubes.length > 0 && selectableTubes.every(id => chosenTubes.includes(id))" :disabled="!selectableTubes.length" @change="selectAllTubes($event.target.checked)"></th><th v-for="item in ['姓名', '身分證', '預約編號', '發管日期', '發管單位', '鄉鎮', '繳管狀態', '繳管日期', '操作']" :key="item" class="p-3 text-left">{{ item }}</th></tr></thead>
          <tbody><tr v-for="r in tubeResults" :key="r.id" class="border-b border-stone-100"><td class="p-3"><input type="checkbox" :aria-label="'選取 ' + r.name + ' 的繳管紀錄'" :checked="chosenTubes.includes(String(r.id))" :disabled="!selectableTubes.includes(String(r.id))" @change="toggleSelection(chosenTubes, String(r.id))"></td><td class="p-3">{{ r.name }}</td><td class="p-3">{{ r.identity }}</td><td class="p-3 tabular-nums">{{ r.bowelReservationId }}</td><td class="p-3">{{ r.issueDate }}</td><td class="p-3">{{ r.institutionName }}<span class="block text-xs text-[#59695a]">{{ r.institutionType }}</span></td><td class="p-3">{{ r.township }}</td><td class="p-3">{{ r.returnStatus }}</td><td class="p-3">{{ r.returnedAt ? trackingHistoryTime(r.returnedAt) : '—' }}</td><td class="p-3"><button v-if="canRollbackBowelReturn(r, actor)" class="admin-text-action" @click="undoTubeReturn(r)">復原繳管</button><button class="admin-text-action" @click="specialRecord = r">歷程</button></td></tr><tr v-if="!tubeResults.length"><td colspan="10" class="py-10 text-center">權限範圍內沒有符合條件的發管名單。</td></tr></tbody>
        </table></div>
        <p class="mt-4 text-xs leading-6 text-[#59695a]">發管日期取自民眾實際領管時間。全選僅包含目前篩選結果中「已領取」的紀錄；QR 為 DEMO 模擬掃描，實際設備與後端尚未連接。</p>
      </section>
    </template>
    <template v-else-if="section === 'lab'">
      <section class="card p-6">
        <div class="mb-5 grid gap-3 md:grid-cols-3">
          <div><label class="label" for="lab-township">鄉鎮</label><select id="lab-township" v-model="labFilter.township" class="field" @change="labFilter.institution = '全部'"><option>全部</option><option v-for="township in labTownshipOptions" :key="township">{{ township }}</option></select></div>
          <div><label class="label" for="lab-institution">發管／繳管院所</label><select id="lab-institution" v-model="labFilter.institution" class="field"><option>全部</option><option v-for="institution in labInstitutionOptions" :key="institution">{{ institution }}</option></select></div>
          <div><label class="label" for="lab-status">目前狀態</label><select id="lab-status" v-model="labFilter.currentStatus" class="field"><option value="RETURNED">已繳回／待送驗</option><option value="SENT_TO_LAB">已送驗</option><option value="全部">全部</option></select></div>
          <div><label class="label" for="lab-return-from">繳管日期起</label><input id="lab-return-from" v-model="labFilter.returnFrom" type="date" class="field"></div>
          <div><label class="label" for="lab-return-to">繳管日期迄</label><input id="lab-return-to" v-model="labFilter.returnTo" type="date" class="field"></div>
          <div><label class="label" for="lab-identity">身分證字號</label><input id="lab-identity" v-model.trim="labFilter.identity" maxlength="10" class="field" placeholder="輸入完整身分證字號" @keyup.enter="searchLab"></div>
          <div><label class="label" for="lab-reservation-id">預約編號</label><input id="lab-reservation-id" v-model.trim="labFilter.reservationId" maxlength="12" class="field" inputmode="numeric" placeholder="12 碼預約編號" @keyup.enter="searchLab"></div>
        </div>
        <AdminSampleData :samples="workSamples" @select="fillSample" />
        <div class="mb-5 mt-5 flex flex-wrap gap-2"><button class="btn-primary" @click="searchLab">查詢</button><button class="btn-primary" :disabled="!chosenLab.length" @click="labConfirmOpen = true">確認送驗（{{ chosenLab.length }}）</button><button v-if="canUseBowelLab(actor) && has('bowel.export')" class="btn-secondary" @click="exportLab">匯出 CSV</button></div>
        <p v-if="labMessage" role="status" class="mb-4 rounded-xl bg-[#e7ecdf] p-3 text-sm leading-6">{{ labMessage }}</p>
        <div class="overflow-x-auto"><table class="w-full min-w-[1020px] text-sm"><thead class="bg-[#eeeee3]"><tr><th class="p-3"><input type="checkbox" aria-label="全選目前可送驗資料" :checked="selectableLab.length > 0 && selectableLab.every(id => chosenLab.includes(id))" :disabled="!selectableLab.length" @change="selectAllLab($event.target.checked)"></th><th v-for="item in ['預約編號', '姓名', '身分證', '鄉鎮', '領管／繳管院所', '發管日期', '繳管日期', '目前狀態', '送驗日期', '操作']" :key="item" class="p-3 text-left">{{ item }}</th></tr></thead><tbody><tr v-for="row in labResults" :key="row.id" class="border-b border-stone-100"><td class="p-3"><input type="checkbox" :aria-label="'選取 ' + row.name + ' 的送驗紀錄'" :checked="chosenLab.includes(String(row.id))" :disabled="!selectableLab.includes(String(row.id))" @change="toggleSelection(chosenLab, String(row.id))"></td><td class="p-3 tabular-nums">{{ row.bowelReservationId }}</td><td class="p-3">{{ row.name }}</td><td class="p-3">{{ row.identity }}</td><td class="p-3">{{ row.township }}</td><td class="p-3">{{ row.institutionName }}</td><td class="p-3">{{ row.issueDate || '—' }}</td><td class="p-3">{{ row.returnedDate || '—' }}</td><td class="p-3">{{ row.state }}</td><td class="p-3">{{ row.sentToLabAt ? trackingHistoryTime(row.sentToLabAt) : '—' }}</td><td class="p-3"><button v-if="canRollbackBowelLab(row, actor)" class="admin-text-action" @click="undoLab(row)">復原送驗</button><button class="admin-text-action" @click="specialRecord = row">歷程</button></td></tr><tr v-if="!labResults.length"><td colspan="11" class="py-10 text-center">權限範圍內沒有符合條件的送驗紀錄。</td></tr></tbody></table></div>
        <p class="mt-4 text-xs leading-6 text-[#59695a]">預設顯示已繳回、待送驗資料；全選只包含目前查詢結果中可合法送驗的紀錄。DEMO 操作尚未連接後端或檢驗單位。</p>
      </section>
    </template>
    <section v-if="labConfirmOpen" role="dialog" aria-modal="true" aria-labelledby="lab-confirm-title" tabindex="-1" @keydown.esc="labConfirmOpen = false" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2f493a]/45 p-3" @click.self="labConfirmOpen = false">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#fffdf8] p-6"><h2 id="lab-confirm-title" class="text-xl">確認將以下檢體標記為已送驗？</h2><p class="mt-3 text-sm">共選擇 {{ chosenLab.length }} 筆。請核對預約編號、姓名、繳管院所及日期。</p><ul class="mt-4 max-h-64 divide-y divide-[#d8ddce] overflow-y-auto rounded-xl bg-[#e7ecdf] px-4"><li v-for="row in selectedLabRows" :key="row.id" class="py-3 text-sm leading-6"><span class="block tabular-nums">{{ row.bowelReservationId }} · {{ row.name }}</span><span class="text-[#59695a]">{{ row.institutionName }} · 繳管 {{ row.returnedDate || '日期未提供' }}</span></li></ul><div class="work-actions"><button type="button" class="btn-secondary" @click="labConfirmOpen = false">返回</button><button type="button" class="btn-primary" :disabled="!chosenLab.length" @click="confirmLabBatch">確認送驗</button></div></div>
    </section>
    <section v-if="qrOpen" role="dialog" aria-modal="true" aria-labelledby="return-qr-title" tabindex="-1" @keydown.esc="qrOpen = false" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2f493a]/45 p-3" @click.self="qrOpen = false">
      <form class="w-full max-w-md rounded-2xl bg-[#fffdf8] p-6" @submit.prevent="simulateQrScan">
        <h2 id="return-qr-title" class="text-xl">DEMO 掃描 QR Code</h2>
        <p class="mt-3 text-sm leading-6">輸入模擬 QR 內容：12 碼預約編號、完整身分證字號，或含 reservationId 的 JSON。查到紀錄後仍需核對並按「儲存」。</p>
        <label class="label mt-5" for="return-qr-payload">QR 內容</label><input id="return-qr-payload" v-model.trim="qrPayload" class="field" autocomplete="off" required placeholder="例如 153707010008">
        <p v-if="qrError" role="alert" class="mt-3 text-sm text-red-700">{{ qrError }}</p>
        <div class="work-actions"><button type="button" class="btn-secondary" @click="qrOpen = false">返回</button><button type="submit" class="btn-primary">模擬掃描並查詢</button></div>
      </form>
    </section>
    <section v-if="selectedTrackingDetail" role="dialog" aria-modal="true" aria-labelledby="tracking-detail-title" tabindex="-1" @keydown.esc="specialRecord = null" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2f493a]/45 p-3" @click.self="specialRecord = null">
      <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[#fffdf8] p-6">
        <div class="flex items-start justify-between gap-4"><div><h2 id="tracking-detail-title" class="text-xl">腸篩名單詳情</h2><p class="mt-2 text-sm leading-6">{{ selectedTrackingDetail.name }} · {{ selectedTrackingDetail.bowelReservationId }}<br>{{ selectedTrackingDetail.institution }}</p></div><button class="btn-secondary" @click="specialRecord = null">關閉</button></div>
        <div class="mt-5 grid gap-2 rounded-xl bg-[#e7ecdf] p-4 text-sm"><p>目前狀態：{{ selectedTrackingDetail.state }}</p><p>待追蹤／異常：{{ followUpFor(selectedTrackingDetail)?.label || '無' }}</p><p v-if="selectedTrackingDetail.receivedAt">接收時間：{{ trackingHistoryTime(selectedTrackingDetail.receivedAt) }} · {{ selectedTrackingDetail.receivedBy || '操作者未提供' }}</p><p v-if="selectedTrackingDetail.pickedUpAt">領管時間：{{ trackingHistoryTime(selectedTrackingDetail.pickedUpAt) }} · {{ selectedTrackingDetail.pickedUpBy || '操作者未提供' }}</p><p v-if="selectedTrackingDetail.returnedAt">繳管時間：{{ trackingHistoryTime(selectedTrackingDetail.returnedAt) }} · {{ selectedTrackingDetail.returnedBy || '操作者未提供' }}</p><p v-if="selectedTrackingDetail.sentToLabAt">送驗時間：{{ trackingHistoryTime(selectedTrackingDetail.sentToLabAt) }} · {{ selectedTrackingDetail.sentToLabBy || '操作者未提供' }}</p></div>
        <h3 class="mt-6 text-lg">狀態歷程</h3><ol v-if="selectedTrackingDetail.statusHistory.length" class="mt-3 divide-y divide-[#d8ddce]"><li v-for="(item, index) in selectedTrackingDetail.statusHistory.slice().reverse()" :key="index" class="grid gap-1 py-3 text-sm"><span>{{ trackingHistoryTime(item.changedAt) }} · {{ trackingHistoryLabel(item) }}</span><span class="text-[#59695a]">{{ item.changedBy || '操作者未提供' }}</span></li></ol><p v-else class="mt-3 text-sm text-[#59695a]">此筆舊版 DEMO 資料尚無狀態歷程。</p>
      </div>
    </section>
    <section v-if="pendingBowelAction && pendingBowelRecord" role="dialog" aria-modal="true" aria-labelledby="bowel-action-title" tabindex="-1" @keydown.esc="closeBowelAction" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2f493a]/45 p-3" @click.self="closeBowelAction">
      <form class="w-full max-w-md rounded-2xl bg-[#fffdf8] p-6" @submit.prevent="submitBowelAction">
        <h2 id="bowel-action-title" class="text-xl">{{ pendingBowelAction.nextCode === 'RECEIVED' ? '確認院所接收' : '確認民眾領管' }}</h2>
        <p class="mt-4 text-sm leading-7">{{ pendingBowelAction.nextCode === 'RECEIVED' ? `確認此採檢管已送達 ${pendingBowelRecord.provider}？` : '請核對民眾身分後確認實際領管。' }}</p>
        <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-[#e7ecdf] p-4 text-sm"><dt>預約編號</dt><dd class="break-all">{{ pendingBowelRecord.bowelReservationId || pendingBowelRecord.id }}</dd><dt>姓名</dt><dd>{{ pendingBowelRecord.name }}</dd><dt>領管院所</dt><dd>{{ pendingBowelRecord.provider }}</dd><dt>目前狀態</dt><dd>{{ pendingBowelRecord.state }}</dd></dl>
        <div v-if="pendingBowelAction.nextCode === 'PICKED_UP'" class="mt-5"><label class="label" for="pickup-identity-suffix">輸入民眾身分證後四碼</label><input id="pickup-identity-suffix" v-model="pickupIdentitySuffix" class="field" maxlength="4" autocomplete="off" required placeholder="後四碼"></div>
        <p v-if="bowelActionError" role="alert" class="mt-4 text-sm text-red-700">{{ bowelActionError }}</p>
        <div class="work-actions"><button type="button" class="btn-secondary" @click="closeBowelAction">返回</button><button type="submit" class="btn-primary">{{ pendingBowelAction.nextCode === 'RECEIVED' ? '確認接收' : '確認領管' }}</button></div>
      </form>
    </section>    <div v-if="scheduleOpen" role="dialog" aria-modal="true" aria-labelledby="schedule-title" tabindex="-1" @keydown.esc="scheduleOpen = false" class="fixed inset-0 z-50 flex items-center justify-center bg-[#2f493a]/45 p-3" @click.self="scheduleOpen = false"><div class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div class="mb-5 flex justify-between"><div><p class="text-xs font-bold text-brand">腸篩院所營業時間</p><h2 id="schedule-title" class="mt-1 text-xl font-black">{{ selectedProvider?.name }} · 每週時段</h2></div><button class="text-2xl text-stone-400" @click="scheduleOpen = false">×</button></div><div v-for="(periods, index) in daySchedule" :key="index" class="border-t border-stone-100 py-4"><div class="mb-2 flex items-center justify-between"><b>星期{{ weekNames[index] }}</b><button class="text-sm font-bold text-brand" @click="periods.push({ start: '08:30', end: '17:00' })">＋ 新增時段</button></div><div v-if="!periods.length" class="text-sm text-stone-400">未開放</div><div v-for="(period, itemIndex) in periods" :key="itemIndex" class="mb-2 flex flex-wrap items-center gap-2"><input v-model="period.start" type="time" step="300" class="field max-w-40"><span>至</span><input v-model="period.end" type="time" step="300" class="field max-w-40"><button class="btn-secondary" @click="periods.splice(itemIndex, 1)">移除</button></div></div><AdminSampleData :samples="scheduleSamples" @select="fillSample" /><div class="mt-4 flex justify-end gap-3"><button class="btn-secondary" @click="scheduleOpen = false">離開</button><button class="btn-primary" @click="saveSchedule">儲存營業時段</button></div></div></div>
    <div v-if="notice" role="status" class="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl bg-[#2f493a] px-5 py-3 text-sm font-semibold text-white shadow-xl">{{ notice }}</div>
  </div>
</template>



