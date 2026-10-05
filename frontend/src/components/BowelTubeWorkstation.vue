<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useDemoStore } from '@/stores/demo'
import { assignLabelCodes } from '@/utils/bowelLabels'
import { findTubeRecord, receiveTube, todayReturns, undoReturnError, undoTubeReturn, undoReturnWindow, taipeiDay } from '@/utils/tubeOperations'
import { canAccess } from '@/utils/accessPolicy'

const props = defineProps({ actor: { type: Object, required: true } })

const { tracking } = storeToRefs(useDemoStore())
const input = ref(''), inputField = ref(null), error = ref(''), message = ref(''), now = ref(Date.now())
const recent = computed(() => todayReturns(tracking.value, now.value).filter(({ record }) => canAccess(props.actor, 'bowel.read', record)))
const formatTime = timestamp => new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(timestamp))
let timer
onMounted(() => { timer = setInterval(() => { now.value = Date.now() }, 1000) })
onBeforeUnmount(() => clearInterval(timer))
async function focusInput() { await nextTick(); inputField.value?.focus({ preventScroll: true }) }
async function saveReturn() {
  if (!canAccess(props.actor, 'bowel.write')) { error.value = '目前身分沒有繳管操作權限'; return }
  error.value = ''; message.value = ''
  const match = findTubeRecord(tracking.value, input.value)
  if (match.error) { error.value = match.error; return focusInput() }
  if (!canAccess(props.actor, 'bowel.write', match.record)) { error.value = '目前身分無法操作這個院所的管件'; return focusInput() }
  const result = receiveTube(match.record)
  if (result.error) { error.value = result.error; return focusInput() }
  now.value = Date.now()
  message.value = `${match.record.name}（${match.record.barcode}）繳管狀態已儲存。`
  input.value = ''; await focusInput()
}
function remaining(record, receipt) {
  if (receipt.undoneAt) return '已返回上一狀態'
  if (undoReturnError(record, receipt, now.value)) return '無法復原'
  const seconds = Math.ceil((receipt.at + undoReturnWindow - now.value) / 1000)
  return `剩餘 ${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒`
}
function undo(record, receipt) {
  if (!canAccess(props.actor, 'bowel.write', record)) { error.value = '目前身分沒有復原權限'; return }
  const problem = undoTubeReturn(record, receipt)
  error.value = problem; message.value = problem ? '' : `${record.name} 已返回上一狀態。`
  now.value = Date.now()
}
const samples = [
  { key: 'ready', label: '未繳管', description: '已領取，可測試儲存繳管' },
  { key: 'returned', label: '已繳管', description: '測試重複登記及復原' },
  { key: 'expired', label: '超過 10 分鐘', description: '測試無法復原的狀態' },
  { key: 'pending', label: '已接收', description: '尚未領取，不可登記繳管' },
  { key: 'missing', label: '查無資料', description: '測試不存在的掃描結果' },
]
async function fillSample(sample) {
  error.value = ''; message.value = '模擬資料已帶入，請核對欄位。'
  if (sample.key === 'missing') { input.value = '000000000000'; return focusInput() }
  const id = `TUBE-DEMO-${sample.key}`
  let record = tracking.value.find(item => item.id === id)
  if (!record) {
    const index = samples.indexOf(sample)
    record = { id, name: `繳管測試${['甲', '乙', '丙', '丁'][index]}`, identity: `N${index + 6}23456789`, area: '田中鎮', provider: '田中鎮衛生所', category: '衛生所', date: taipeiDay(Date.now()), issuedAt: taipeiDay(Date.now()), returnedAt: '', printAt: taipeiDay(Date.now()), state: sample.key === 'pending' ? '已接收' : '已領取', tubeReturned: false }
    assignLabelCodes([...tracking.value, record])
    if (['returned', 'expired'].includes(sample.key)) receiveTube(record, Date.now() - (sample.key === 'expired' ? 11 : 3) * 60000)
    tracking.value.push(record)
  }
  input.value = record.barcode; now.value = Date.now(); await focusInput()
}
function exportReturns() {
  if (!canAccess(props.actor, 'bowel.export')) { error.value = '目前身分沒有匯出權限'; return }
  const rows = [['條碼', '預約編號', '姓名', '身分證', '發管單位', '繳管時間', '繳管狀態'], ...recent.value.map(({ record, receipt }) => [record.barcode, record.id, record.name, record.identity, record.provider, formatTime(receipt.at), receipt.undoneAt ? '已返回上一狀態' : record.state])]
  const escape = value => { const text = String(value); return `"${(/^[=+@\-]/.test(text) ? "'" : '') + text.replaceAll('"', '""')}"` }
  const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = '繳管清冊_DEMO.csv'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
}
</script>
<template>
  <section class="bowel-workstation card p-5 sm:p-7" aria-labelledby="tube-work-title">
    <h1 id="tube-work-title">腸篩繳管作業</h1>
    <p class="mt-3 max-w-3xl text-base leading-7 text-[#59695a]">掃描條碼或輸入身分證字號，確認資料後登記繳管。掃描器可用 Enter 送出，完成後可繼續掃描下一筆。</p>
    <form class="tube-scan-form mt-6" @submit.prevent="saveReturn"><label class="label" for="tube-scan-input">身分證字號／掃描結果</label><div class="mt-3 flex flex-col gap-3 sm:flex-row"><input id="tube-scan-input" ref="inputField" v-model="input" class="field sm:flex-1" placeholder="請輸入或貼上掃描結果" autocomplete="off" :aria-invalid="!!error" aria-describedby="tube-scan-hint"><button class="btn-primary shrink-0" type="submit" :disabled="!canAccess(actor, 'bowel.write')">儲存繳管</button></div><p id="tube-scan-hint" class="mt-3 text-sm leading-6 text-[#59695a]">可使用標籤下方的 12 碼條碼、預約編號或身分證字號；不會登記尚未領取或已繳管的資料。</p></form>
    <p v-if="error" class="mt-4 text-base leading-7 text-[#9b342b]" role="alert">{{ error }}</p><p v-if="message" class="mt-4 text-base leading-7 text-[#40573c]" role="status">{{ message }}</p>
    <details class="mt-5 border-b border-[#d8ddce] pb-5"><summary class="min-h-11 cursor-pointer text-base text-[#40573c]">模擬測試資料</summary><p class="mt-3 text-sm leading-6 text-[#59695a]">帶入不會執行繳管。已操作的模擬資料會保留目前狀態。</p><div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><button v-for="sample in samples" :key="sample.key" type="button" class="admin-sample-button text-left" @click="fillSample(sample)"><span class="block text-base">{{ sample.label }}</span><span class="mt-1 block text-sm text-[#59695a]">{{ sample.description }}</span></button></div></details>
    <div class="mt-6 flex flex-wrap items-center justify-between gap-3"><h2 class="text-xl">繳管狀態 <span class="ml-2 text-base text-[#59695a]">本日 {{ recent.length }} 筆</span></h2><button class="btn-secondary" :disabled="!recent.length" @click="exportReturns">匯出 CSV</button></div>
    <p class="mt-2 text-sm leading-6 text-[#59695a]">DEMO 更新後 10 分鐘內可返回上一狀態；正式權限限制與系統時間規則需後端實作。</p>
    <div class="mt-4 hidden overflow-x-auto md:block"><table class="w-full min-w-[900px] text-sm"><thead><tr><th v-for="title in ['預約編號', '姓名', '身分證', '發管單位', '繳管日期', '繳管狀態', '操作']" :key="title">{{ title }}</th></tr></thead><tbody><tr v-for="{ record, receipt } in recent" :key="receipt.id"><td><span class="block break-all">{{ record.id }}</span><span class="mt-1 block whitespace-nowrap text-xs tabular-nums text-[#59695a]">條碼：{{ record.barcode }}</span></td><td>{{ record.name }}</td><td>{{ record.identity }}</td><td>{{ record.provider }}</td><td class="whitespace-nowrap tabular-nums">{{ formatTime(receipt.at) }}</td><td class="whitespace-nowrap">{{ remaining(record, receipt) }}</td><td><button class="btn-secondary" :disabled="!!undoReturnError(record, receipt, now)" @click="undo(record, receipt)">復原</button></td></tr><tr v-if="!recent.length"><td colspan="7" class="py-10 text-center text-[#59695a]">目前沒有符合條件的發管名單。</td></tr></tbody></table></div>
    <ul class="mt-4 divide-y divide-[#d8ddce] md:hidden"><li v-for="{ record, receipt } in recent" :key="receipt.id" class="space-y-3 py-5"><div class="flex items-start justify-between gap-3"><div><p class="text-lg">{{ record.name }}</p><p class="mt-1 tabular-nums text-[#59695a]">{{ record.barcode }}</p></div><button class="btn-secondary shrink-0" :disabled="!!undoReturnError(record, receipt, now)" @click="undo(record, receipt)">復原</button></div><p class="break-all text-sm leading-7 text-[#59695a]">{{ record.identity }} · {{ record.provider }}<br>{{ formatTime(receipt.at) }}<br>{{ remaining(record, receipt) }}</p></li><li v-if="!recent.length" class="py-8 text-center text-base text-[#59695a]">目前沒有符合條件的發管名單。</li></ul>
  </section>
</template>
<style scoped>
.tube-scan-form { border: 1px dashed #8eaa80; border-radius: 12px; padding: 20px; background: #f1f4eb; }
.tube-scan-form .field { min-height: 56px; font-size: 18px; }
.tube-scan-form .btn-primary { min-height: 56px; font-size: 18px; }
button:disabled { opacity: .55; cursor: not-allowed; }
@media(max-width:639px) { .tube-scan-form { padding: 16px; } }
</style>

