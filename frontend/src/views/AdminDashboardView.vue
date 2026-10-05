<script setup>
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDemoStore } from '@/stores/demo'
import { changhuaAreas } from '@/stores/areas'
import PublicBrand from '@/components/PublicBrand.vue'
import AdminSampleData from '@/components/AdminSampleData.vue'
import AdminWorkView from '@/views/AdminWorkView.vue'
import PublicIcon from '@/components/PublicIcon.vue'
import { summarizeAdminTasks } from '@/utils/adminTasks'
import { canAccess, sectionPermissions } from '@/utils/accessPolicy'
import { canUseBowelLabels } from '@/services/bowelLabelService'
import { canUseBowelReturns } from '@/services/bowelReturnService'
import { canUseBowelLab } from '@/services/bowelLabService'
import '@/styles/admin.css'

const route = useRoute()
const router = useRouter()
const { events, reservations, tracking, session } = storeToRefs(useDemoStore())
const groups = [
  { key: 'overview', label: '工作首頁', sections: [{ key: 'overview', label: '工作首頁' }] },
  { key: 'bookings', label: '預約管理', sections: [{ key: 'edit', label: '查詢與修改' }, { key: 'manual', label: '新增預約' }, { key: 'roster', label: '名單清冊' }] },
  { key: 'activities', label: '活動設定', sections: [{ key: 'events', label: '活動場次' }, { key: 'medical', label: '院所與時段名額' }] },
  { key: 'bowel', label: '腸篩管理', sections: [{ key: 'tubes', label: '繳管作業', icon: 'tube' }, { key: 'lab', label: '送驗作業', icon: 'tube' }, { key: 'tracking', label: '名單動態', icon: 'list' }, { key: 'labels', label: '標籤列印', icon: 'label' }, { key: 'providers', label: '院所與公休', icon: 'provider' }] },
]
const validSections = [...groups.flatMap(group => group.sections.map(item => item.key)), 'eventForm']
const allowed = permission => permission === 'bowel.label' ? canUseBowelLabels(session.value) : permission === 'bowel.return' ? canUseBowelReturns(session.value) : permission === 'bowel.sendToLab' ? canUseBowelLab(session.value) : canAccess(session.value, permission)
const availableGroups = computed(() => groups.map(item => ({ ...item, sections: item.sections.filter(page => allowed(sectionPermissions[page.key])) })).filter(item => item.sections.length))
const section = computed(() => {
  const requested = route.query.section === 'bowelOverview' ? 'tubes' : route.query.section === 'reservations' ? 'roster' : validSections.includes(route.query.section) ? route.query.section : 'overview'
  return allowed(sectionPermissions[requested]) ? requested : availableGroups.value[0]?.sections[0]?.key || 'overview'
})
const group = computed(() => availableGroups.value.find(item => item.sections.some(page => page.key === section.value)) || (section.value === 'eventForm' ? groups[2] : availableGroups.value[0] || groups[0]))
const sectionTitle = computed(() => section.value === 'eventForm' ? '建立活動場次' : group.value.sections.find(item => item.key === section.value)?.label)
const queryIdentity = ref('')
const notice = ref('')
const editingId = ref(null)
const formStep = ref(1)
const formLabels = ['場次與地點', '時間與篩檢', '提醒與確認']
const form = reactive({ type: '整合式篩檢', date: '', area: '彰化市', village: '', location: '', address: '', start: '06:10', end: '09:00', interval: 10, screenings: ['子宮頸抹片'], capacity: 30, organizer: '衛生局承辦人', coorganizer: '', smsDays: [1], phone: '', notes: '請攜帶健保卡與身分證件。' })
const filters = reactive({ year: String(new Date().getFullYear()), month: String(new Date().getMonth() + 1), area: '全部', type: '全部', keyword: '' })
const applied = ref({ ...filters })
const advancedFilters = ref(false)
const areas = changhuaAreas
const screenings = ['子宮頸抹片', '乳房攝影', '大腸癌篩檢', '口腔癌篩檢', 'BC 型肝炎', '成人健檢']
const years = computed(() => [...new Set([String(new Date().getFullYear()), ...events.value.map(e => e.date.slice(0, 4))])].sort())
const results = computed(() => events.value.filter(e => {
  const f = applied.value
  return canAccess(session.value, 'event.read', e) && e.type !== '腸篩專案' && (f.year === '全部' || e.date.slice(0, 4) === f.year) && (f.month === '全部' || Number(e.date.slice(5, 7)) === Number(f.month)) && (f.area === '全部' || e.area === f.area) && (f.type === '全部' || e.type === f.type) && (!f.keyword.trim() || `${e.location} ${e.address}`.includes(f.keyword.trim()))
}))
const activeReservations = computed(() => reservations.value.filter(r => r.status !== '已取消' && canAccess(session.value, 'booking.read', { ...r, area: events.value.find(e => e.id === r.eventId)?.area })))
const taskSummary = computed(() => summarizeAdminTasks(tracking.value.filter(r => canAccess(session.value, 'bowel.read', r))))
const todoAppearance = {
  labels: { icon: 'label', color: '#8a7358', tint: '#f2ece2' },
  receive: { icon: 'list', color: '#74875d', tint: '#edf0e4' },
  pickup: { icon: 'provider', color: '#5e826e', tint: '#e8f0e9' },
  return: { icon: 'tube', color: '#446d63', tint: '#e7efeb' },
  send: { icon: 'chart', color: '#587885', tint: '#e9eff1' },
}
function openTask(task) { go(task.section, { task: task.key }) }
function localDate() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function tell(text) { notice.value = text; setTimeout(() => { if (notice.value === text) notice.value = '' }, 4000) }
function go(value, extras = {}) { if (!allowed(sectionPermissions[value])) return tell('目前身分沒有此功能權限'); router.push({ path: '/admin', query: { section: value, ...extras } }) }
watch(section, async () => { await nextTick(); document.querySelector('#admin-content')?.focus({ preventScroll: true }) })
function lookup() { if (!queryIdentity.value.trim()) return tell('請輸入預約人的身分證字號'); go('edit', { identity: queryIdentity.value.trim().toUpperCase() }) }
function searchEvents() { applied.value = { ...filters } }
function clearFilters() { Object.assign(filters, { year: '全部', month: '全部', area: '全部', type: '全部', keyword: '' }); searchEvents() }
function newEvent() { editingId.value = null; formStep.value = 1; Object.assign(form, { type: '整合式篩檢', date: localDate(), area: '彰化市', village: '', location: '', address: '', start: '06:10', end: '09:00', interval: 10, screenings: ['子宮頸抹片'], capacity: 30, organizer: '衛生局承辦人', coorganizer: '', smsDays: [1], phone: '', notes: '請攜帶健保卡與身分證件。' }); go('eventForm') }
function editEvent(value) {
  if (value.type === '腸篩專案') return go('providers')
  editingId.value = value.id; formStep.value = 1
  Object.assign(form, { type: value.type === '腸篩專案' ? '衛生局所設站' : value.type, date: value.date, area: value.area, location: value.location, address: value.address, start: value.start, end: value.end, interval: value.interval || 30, capacity: value.capacity, phone: value.phone || '', notes: value.notes || '', screenings: [...value.screenings], smsDays: [...(value.smsDays || [1])], organizer: value.organizer || '衛生局承辦人', coorganizer: value.coorganizer || '', village: value.village || '' })
  go('eventForm')
}
function changeType() { Object.assign(form, form.type === '整合式篩檢' ? { start: '06:10', end: '09:00', interval: 10 } : { start: '08:00', end: '12:00', interval: 30 }) }
function validateStep(value) {
  if (value === 1 && (!form.date || !form.location.trim() || !form.address.trim())) { tell('請完成活動日期、地點及地址'); return false }
  if (value === 2 && (!form.start || !form.end || form.end <= form.start || !form.screenings.length || !Number.isInteger(Number(form.interval)) || form.interval < 5 || form.interval > 60 || form.interval % 5)) { tell('請確認時間、5 至 60 分鐘的間隔及篩檢項目'); return false }
  const booked = events.value.find(e => e.id === editingId.value)?.booked || 0
  if (value === 3 && (!form.organizer.trim() || !Number.isInteger(Number(form.capacity)) || form.capacity < Math.max(1, booked) || form.capacity > 99)) { tell(`請填寫主辦人，總名額須為 ${Math.max(1, booked)} 至 99`); return false }
  return true
}
function advanceForm() { if (validateStep(formStep.value)) formStep.value++ }
function saveEvent() {
  if (![1, 2, 3].every(validateStep)) return
  const original = events.value.find(e => e.id === editingId.value)
  const record = { ...form, screenings: [...form.screenings], smsDays: [...form.smsDays] }
  if (original) Object.assign(original, record)
  else events.value.unshift({ ...record, id: Date.now(), booked: 0 })
  clearFilters(); go('events'); tell('場次資料已儲存，可前往「院所與時段名額」設定對外名額')
}
function exportEvents() {
  if (!allowed('event.read')) return tell('目前身分沒有活動清冊權限')
  const rows = [['日期', '時間', '地點', '地址', '類型', '主辦人', '總名額', '已預約'], ...results.value.map(e => [e.date, `${e.start}－${e.end}`, e.location, e.address, e.type, e.organizer || '', e.capacity, e.booked])]
  const data = '\uFEFF' + rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = '活動場次_DEMO.csv'; link.click(); URL.revokeObjectURL(url)
}

const identitySamples = computed(() => activeReservations.value.slice(0, 3).map(r => ({ label: r.name, description: r.identity, fill: () => { queryIdentity.value = r.identity } })))
const eventFilterSamples = computed(() => events.value.filter(e => e.type !== '腸篩專案').slice(0, 3).map(e => ({ label: e.location, description: e.date + ' · ' + e.type, fill: () => { Object.assign(filters, { year: e.date.slice(0, 4), month: String(Number(e.date.slice(5, 7))), area: e.area, type: e.type, keyword: '' }); advancedFilters.value = true } })))
const eventFormSamples = computed(() => [
  { label: '整合式篩檢', description: '彰化市 · 60 名 · 多項篩檢', type: '整合式篩檢', area: '彰化市', location: '模擬南區整合篩檢場', address: '彰化縣彰化市模擬路 1 號', start: '06:10', end: '09:00', interval: 10, screenings: ['子宮頸抹片', '乳房攝影', '大腸癌篩檢'], capacity: 60 },
  { label: '子抹設站', description: '員林市 · 40 名 · 上午場', type: '衛生局所設站', area: '員林市', location: '模擬員林子抹場', address: '彰化縣員林市模擬路 2 號', start: '08:00', end: '12:00', interval: 30, screenings: ['子宮頸抹片'], capacity: 40 },
  { label: '乳攝設站', description: '和美鎮 · 50 名 · 下午場', type: '衛生局所設站', area: '和美鎮', location: '模擬和美乳攝場', address: '彰化縣和美鎮模擬路 3 號', start: '13:00', end: '17:00', interval: 30, screenings: ['乳房攝影'], capacity: 50 },
].map((sample, i) => ({ label: sample.label, description: formStep.value === 1 ? sample.description : formStep.value === 2 ? sample.start + '－' + sample.end + ' · 每 ' + sample.interval + ' 分鐘' : sample.capacity + ' 名 · 模擬承辦人' + (i + 1), fill: () => {
  // Each step fills only its own fields, preserving the information already reviewed.
  if (formStep.value === 1) Object.assign(form, { type: sample.type, date: localDate(), area: sample.area, village: '模擬里', location: sample.location, address: sample.address });
  else if (formStep.value === 2) Object.assign(form, { start: sample.start, end: sample.end, interval: sample.interval, screenings: [...sample.screenings] });
  else Object.assign(form, { capacity: Math.max(sample.capacity, events.value.find(e => e.id === editingId.value)?.booked || 0), organizer: '模擬承辦人' + (i + 1), coorganizer: '模擬衛生所', phone: '04-700000' + (i + 1), smsDays: [1, 3], notes: '本機模擬場次，請攜帶健保卡與身分證件。' });
} })))
function fillSample(sample) { sample.fill(); tell('模擬資料已帶入，請核對欄位') }
</script>

<template>
  <div class="admin-page natural-surface min-h-screen">
    <a href="#admin-content" class="sr-only focus:not-sr-only">跳至工作內容</a>
    <header class="border-b border-[#d8ddce]">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8"><PublicBrand @click="router.push('/')" /><div class="flex items-center gap-3"><span class="hidden text-sm text-[#59695a] md:block">後台管理 · 本機 DEMO</span><button class="btn-secondary whitespace-nowrap text-sm" @click="router.push('/')">返回前台</button></div></div>
      <nav aria-label="後台工作區" class="mx-auto grid max-w-7xl grid-cols-4 px-2 lg:px-8"><button v-for="item in availableGroups" :key="item.key" :aria-current="group.key === item.key ? 'page' : undefined" :class="['admin-group-tab', group.key === item.key ? 'is-active' : '']" @click="go(item.sections[0].key)">{{ item.label }}</button></nav>
    </header>
    <div v-if="group.key !== 'overview' && group.key !== 'bowel'" class="border-b border-[#d8ddce] bg-[#eeeee3]"><nav class="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-5 py-3 lg:px-8" :aria-label="`${group.label}工具`"><button v-for="item in group.sections" :key="item.key" :aria-current="section === item.key || section === 'eventForm' && item.key === 'events' ? 'page' : undefined" :class="['admin-tool-tab', section === item.key || section === 'eventForm' && item.key === 'events' ? 'is-active' : '']" @click="go(item.key)">{{ item.label }}</button></nav></div>
    <main id="admin-content" tabindex="-1" class="mx-auto max-w-7xl px-5 py-8 outline-none lg:px-8 lg:py-10">
      <nav class="mb-6 text-sm text-[#59695a]" aria-label="目前位置"><button @click="go('overview')">後台管理</button><span class="mx-2" aria-hidden="true">／</span><span aria-current="page">{{ sectionTitle }}</span></nav>
<div v-if="group.key === 'bowel'" class="bowel-management-header">
        <div class="mb-6 flex flex-wrap items-end justify-between gap-3"><h2 class="text-2xl font-normal">腸篩管理</h2><p class="text-sm text-[#59695a]">數量隨本機資料同步更新。</p></div>
        <ul class="bowel-summary-grid"><li v-for="task in taskSummary" :key="task.key"><button type="button" class="bowel-summary" :style="{ '--todo-color': todoAppearance[task.key].color, '--todo-tint': todoAppearance[task.key].tint }" @click="openTask(task)" :aria-label="task.label + '，' + task.count + ' 筆，查看名單'"><span class="bowel-summary-heading"><span class="text-base">{{ task.label }}</span><span class="bowel-summary-icon"><PublicIcon :name="todoAppearance[task.key].icon" /></span></span><span class="bowel-summary-value mt-3 block"><span class="text-3xl tabular-nums">{{ task.count }}</span><span class="ml-2 text-sm text-[#59695a]">筆</span></span><span class="bowel-summary-description mt-3 block text-sm leading-6 text-[#59695a]">{{ task.description }}</span></button></li></ul>
        <nav class="bowel-section-tabs" aria-label="腸篩管理工具"><button v-for="item in group.sections" :key="item.key" type="button" :aria-current="section === item.key ? 'page' : undefined" :class="['bowel-section-tab', section === item.key ? 'is-active' : '']" @click="go(item.key)"><PublicIcon :name="item.icon" class="h-5 w-5 shrink-0" />{{ item.label }}</button></nav>
      </div>
      <template v-if="section === 'overview'">
        <div class="mb-8"><h1>從今天的預約開始</h1><p class="mt-3 leading-7 text-[#59695a]">查詢民眾預約、整理名單，或前往腸篩管理處理待辦。</p></div>
        <section class="admin-lookup mb-8" aria-labelledby="quick-lookup-title"><div><h2 id="quick-lookup-title" class="text-xl">查詢預約</h2><p class="mt-2 text-sm leading-6 text-[#59695a]">輸入身分證字號，查看、修改或取消預約。</p></div><form class="flex min-w-0 flex-col gap-3 sm:flex-row" @submit.prevent="lookup"><label for="admin-quick-identity" class="sr-only">身分證字號</label><input id="admin-quick-identity" v-model.trim="queryIdentity" maxlength="10" class="field sm:min-w-[230px]" placeholder="例如 N123456789" autocomplete="off"><button class="btn-primary shrink-0">查詢預約</button></form><AdminSampleData class="sm:col-span-2" :samples="identitySamples" @select="fillSample" /></section>
        <section><h2 class="mb-4 text-xl">預約與名單</h2><div class="admin-task-list"><button class="admin-task" @click="go('manual')"><span><span class="block text-lg">新增民眾預約</span><span class="mt-1 block text-sm text-[#59695a]">代填整篩、設站或腸篩預約</span></span><span aria-hidden="true">→</span></button><button class="admin-task" @click="go('roster')"><span><span class="block text-lg">查詢與匯出清冊</span><span class="mt-1 block text-sm text-[#59695a]">依日期、場次及項目整理 {{ activeReservations.length }} 筆有效預約</span></span><span aria-hidden="true">→</span></button><button class="admin-task" @click="go('edit')"><span><span class="block text-lg">修改或取消預約</span><span class="mt-1 block text-sm text-[#59695a]">核對民眾資料並調整預約內容</span></span><span aria-hidden="true">→</span></button></div></section>
      </template>
      <template v-else-if="section === 'events'">
        <div class="admin-page-heading"><div><h1>活動場次</h1><p>先查詢場次，再設定地點、時間與預約名額。</p></div><button class="btn-primary" @click="newEvent">新增活動場次</button></div>
        <form class="admin-filter" @submit.prevent="searchEvents"><div class="grid gap-4 sm:grid-cols-3"><div><label class="label" for="event-year">年份</label><select id="event-year" v-model="filters.year" class="field"><option>全部</option><option v-for="year in years" :key="year" :value="year">民國 {{ Number(year) - 1911 }} 年</option></select></div><div><label class="label" for="event-month">月份</label><select id="event-month" v-model="filters.month" class="field"><option>全部</option><option v-for="n in 12" :key="n" :value="String(n)">{{ n }} 月</option></select></div><div><label class="label" for="event-area">鄉鎮市區</label><select id="event-area" v-model="filters.area" class="field"><option>全部</option><option v-for="area in areas" :key="area">{{ area }}</option></select></div></div><button type="button" class="admin-text-action mt-4" :aria-expanded="advancedFilters" @click="advancedFilters = !advancedFilters">{{ advancedFilters ? '收起其他條件' : '更多篩選條件' }}</button><div v-if="advancedFilters" class="mt-4 grid gap-4 sm:grid-cols-2"><div><label class="label">活動類型</label><select v-model="filters.type" class="field"><option>全部</option><option>整合式篩檢</option><option>衛生局所設站</option></select></div><div><label class="label">地點或地址</label><input v-model="filters.keyword" class="field" placeholder="搜尋關鍵字"></div></div><div class="mt-5 flex flex-wrap gap-3"><button class="btn-primary">查詢場次</button><button type="button" class="btn-secondary" @click="clearFilters">清除條件</button></div><AdminSampleData :samples="eventFilterSamples" @select="fillSample" /></form>
        <section class="admin-result"><div class="admin-result-heading"><h2>查詢結果 <span class="ml-2 text-sm text-[#59695a]">{{ results.length }} 場</span></h2><button class="btn-secondary text-sm" @click="exportEvents">匯出 CSV</button></div><div class="overflow-x-auto"><table class="w-full min-w-[780px] text-left text-sm"><thead><tr><th>日期／時間</th><th>場次與地點</th><th>預約名額</th><th>主辦人</th><th>操作</th></tr></thead><tbody><tr v-for="item in results" :key="item.id"><td><button class="admin-text-action" @click="editEvent(item)">{{ item.date }}</button><p class="mt-1 text-[#59695a]">{{ item.start }}－{{ item.end }}</p></td><td><p>{{ item.location }}</p><p class="mt-1 text-[#59695a]">{{ item.address }}</p><p class="mt-1 text-xs text-[#59695a]">{{ item.type }}</p></td><td><p>{{ item.booked }} ／ {{ item.capacity }} 名</p><p class="mt-1" :class="item.booked >= item.capacity ? 'text-[#687571]' : 'text-[#b3322c]'">{{ item.booked >= item.capacity ? '已額滿' : `剩餘 ${item.capacity - item.booked} 名` }}</p></td><td><button class="admin-text-action" @click="go('medical', { eventId: item.id })">{{ item.organizer || '衛生局承辦人' }}</button></td><td><div class="flex flex-col items-start gap-2"><button class="admin-text-action" @click="editEvent(item)">編輯場次</button><button class="admin-text-action" @click="go('medical', { eventId: item.id })">設定時段名額</button></div></td></tr><tr v-if="!results.length"><td colspan="5" class="py-10 text-center">沒有符合條件的場次，請調整查詢條件。</td></tr></tbody></table></div></section>
      </template>
      <template v-else-if="section === 'eventForm'">
        <div class="admin-page-heading"><div><h1>{{ editingId ? '編輯活動場次' : '建立活動場次' }}</h1><p>依序填寫場次資訊，儲存後再設定各時段的對外名額。</p></div><button class="btn-secondary" @click="go('events')">返回場次清單</button></div>
        <ol class="mb-6 grid grid-cols-3 gap-3" aria-label="建立場次進度"><li v-for="(label, index) in formLabels" :key="label" :aria-current="formStep === index + 1 ? 'step' : undefined" :class="['border-t-2 pt-3 text-sm', formStep >= index + 1 ? 'border-[#526c4b] text-[#2f493a]' : 'border-[#d8ddce] text-[#59695a]']">{{ index + 1 }} · {{ label }}</li></ol>
        <form class="admin-editor max-w-4xl" @submit.prevent="formStep < 3 ? advanceForm() : saveEvent()">
          <fieldset v-if="formStep === 1" class="space-y-5"><legend class="mb-5 text-xl">場次與地點</legend><div class="grid gap-4 sm:grid-cols-2"><div><label class="label">活動類型</label><select v-model="form.type" class="field" @change="changeType"><option>整合式篩檢</option><option>衛生局所設站</option></select></div><div><label class="label">活動日期</label><input v-model="form.date" type="date" class="field" required></div><div><label class="label">鄉鎮市區</label><select v-model="form.area" class="field"><option v-for="area in areas" :key="area">{{ area }}</option></select></div><div><label class="label">村里（選填）</label><input v-model="form.village" class="field" placeholder="村里名稱"></div></div><div><label class="label">活動地點</label><input v-model="form.location" class="field" placeholder="例如彰化市南區衛生所" required></div><div><label class="label">活動地址</label><input v-model="form.address" class="field" placeholder="請填寫完整活動地址" required></div></fieldset>
          <fieldset v-else-if="formStep === 2" class="space-y-5"><legend class="mb-5 text-xl">時間與篩檢項目</legend><div class="grid gap-4 sm:grid-cols-3"><div><label class="label">開始時間</label><input v-model="form.start" type="time" class="field" required></div><div><label class="label">結束時間</label><input v-model="form.end" type="time" class="field" required></div><div><label class="label">間隔時段</label><select v-model.number="form.interval" class="field"><option v-for="n in 12" :key="n" :value="n * 5">{{ n * 5 }} 分鐘</option></select></div></div><div><p class="label">篩檢項目（可複選）</p><div class="grid gap-3 sm:grid-cols-2"><label v-for="item in screenings" :key="item" class="flex items-center gap-3 rounded-xl border border-[#d8ddce] p-3 text-sm"><input v-model="form.screenings" type="checkbox" :value="item">{{ item }}</label></div></div></fieldset>
          <fieldset v-else class="space-y-5"><legend class="mb-5 text-xl">提醒與確認</legend><div class="rounded-xl bg-[#e7ecdf] p-4 text-sm leading-7">{{ form.date }} · {{ form.location }}<br>{{ form.start }}－{{ form.end }} · 每 {{ form.interval }} 分鐘<br>{{ form.screenings.join('、') }}</div><div class="grid gap-4 sm:grid-cols-2"><div><label class="label">總名額</label><input v-model.number="form.capacity" type="number" min="1" max="99" class="field" required></div><div><label class="label">主辦人</label><input v-model="form.organizer" class="field" required></div><div><label class="label">協辦人（選填）</label><input v-model="form.coorganizer" class="field"></div><div><label class="label">聯絡電話（選填）</label><input v-model="form.phone" class="field" inputmode="tel"></div></div><div><p class="label">活動前提醒（可複選）</p><div class="flex flex-wrap gap-4"><label v-for="day in 7" :key="day" class="flex items-center gap-2 text-sm"><input v-model="form.smsDays" type="checkbox" :value="day">前 {{ day }} 日</label></div></div><div><label class="label">報到提醒</label><textarea v-model="form.notes" class="field" rows="3"></textarea></div><p class="text-sm leading-6 text-[#59695a]">提醒設定僅存入本機資料，不會發送簡訊。</p></fieldset>
          <AdminSampleData :samples="eventFormSamples" @select="fillSample" />
          <div class="mt-8 flex flex-wrap justify-between gap-3 border-t border-[#d8ddce] pt-5"><button type="button" class="btn-secondary" @click="formStep > 1 ? formStep-- : go('events')">{{ formStep > 1 ? '上一步' : '取消建立' }}</button><button class="btn-primary">{{ formStep < 3 ? '下一步' : '儲存場次' }}</button></div>
        </form>
      </template>
<template v-else-if="section === 'tubes'">
        <AdminWorkView :key="String(route.query.task || '')" section="tubes" :actor="session" :initial-task="String(route.query.task || '')" />
      </template>
      <AdminWorkView v-else :key="`${section}:${route.query.identity || ''}:${route.query.eventId || ''}:${route.query.task || ''}`" :section="section" :actor="session" :initial-identity="String(route.query.identity || '')" :initial-event-id="Number(route.query.eventId) || null" :initial-task="String(route.query.task || '')" @open-edit="go('edit', { identity: $event })" />
      <p class="mt-10 border-t border-[#d8ddce] pt-5 text-xs leading-6 text-[#59695a]">本機 DEMO · 請使用測試資料。角色權限、真實名冊、通知服務與外部設備尚未連接。</p>
    </main>
    <div v-if="notice" role="status" class="fixed inset-x-5 bottom-5 z-50 mx-auto max-w-md rounded-xl bg-[#2f493a] px-5 py-3 text-sm text-white shadow-lg">{{ notice }}</div>
  </div>
</template>


