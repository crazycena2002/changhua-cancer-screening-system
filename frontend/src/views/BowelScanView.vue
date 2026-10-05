<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDemoStore } from '@/stores/demo'
import PublicBrand from '@/components/PublicBrand.vue'
import BowelBarcode from '@/components/BowelBarcode.vue'
import { matchLabel, mergeLabelRecords, parseLabelSnapshot } from '@/utils/bowelLabels'

const router = useRouter()
const { tracking } = storeToRefs(useDemoStore())
const input = ref(''), recordId = ref(''), error = ref(''), message = ref('')
const busy = ref(false), scanning = ref(false), video = ref(null)
const record = computed(() => tracking.value.find(item => item.id === recordId.value && item.barcode === input.value.trim()))
let controls, cameraRequest = 0
watch(input, () => { recordId.value = ''; error.value = ''; message.value = '' }, { flush: 'sync' })
function lookup(value = input.value) {
  input.value = String(value).trim()
  const result = matchLabel(tracking.value, input.value)
  recordId.value = result.record?.id || ''; error.value = result.error; message.value = ''
}
function stopCamera() {
  cameraRequest++
  controls?.stop(); controls = null
  video.value?.srcObject?.getTracks().forEach(track => track.stop())
  scanning.value = false; busy.value = false
}
async function reader() {
  const [browser, library] = await Promise.all([import('@zxing/browser'), import('@zxing/library')])
  return new browser.BrowserMultiFormatReader(new Map([[library.DecodeHintType.POSSIBLE_FORMATS, [library.BarcodeFormat.CODE_128]]]))
}
async function startCamera() {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    error.value = '目前網址無法啟用相機，請改用「拍照／選擇條碼照片」或輸入條碼；相機需 HTTPS 或本機 localhost。'
    return
  }
  const request = ++cameraRequest
  busy.value = true; scanning.value = true; error.value = ''; message.value = ''; recordId.value = ''
  await nextTick()
  try {
    const decoder = await reader()
    if (request !== cameraRequest) return
    const started = await decoder.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.value, (result, _error, activeControls) => {
      if (result && request === cameraRequest) { lookup(result.getText()); activeControls.stop(); stopCamera() }
    })
    if (request !== cameraRequest) started.stop()
    else { controls = started; busy.value = false }
  } catch (failure) {
    if (request !== cameraRequest) return
    stopCamera()
    error.value = failure.name === 'NotAllowedError' ? '尚未允許相機，請開啟相機權限，或改用照片辨識。' : '無法開啟相機，請確認裝置有相機，或改用照片辨識。'
  }
}
async function scanPhoto(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  stopCamera(); error.value = ''; message.value = ''; recordId.value = ''
  if (!file.type.startsWith('image/') || file.size > 10_000_000) { error.value = '請選擇 10 MB 以下、清楚且完整的條碼照片'; return }
  busy.value = true
  const url = URL.createObjectURL(file)
  try { const decoder = await reader(); const result = await decoder.decodeFromImageUrl(url); lookup(result.getText()) }
  catch { error.value = '未辨識到 Code 128 條碼。請正面拍攝、保留左右留白，或輸入標籤下方的數字。' }
  finally { URL.revokeObjectURL(url); busy.value = false }
}
async function importRoster(event) {
  const file = event.target.files?.[0]; event.target.value = ''
  if (!file) return
  stopCamera(); recordId.value = ''; error.value = ''; message.value = ''
  try {
    if (file.size > 2_000_000) throw new Error('名冊檔案過大，請使用系統匯出的 DEMO 名冊')
    const incoming = parseLabelSnapshot(await file.text())
    tracking.value = mergeLabelRecords(tracking.value, incoming)
    message.value = `已匯入 ${incoming.length} 筆模擬資料，現在可以掃描電腦列印的條碼。`
  } catch (failure) { error.value = failure.message || '無法匯入名冊，請重新選擇 DEMO 檔案' }
}
onBeforeUnmount(stopCamera)
</script>

<template>
  <div class="natural-surface min-h-screen bg-[#f8f6f0] text-[#2f493a]">
    <header class="border-b border-[#d8ddce] bg-[#fffdf8]"><div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-4"><PublicBrand @click="router.push('/')" /><button class="btn-secondary shrink-0" @click="router.push('/admin?section=labels')">返回標籤</button></div></header>
    <main class="mx-auto max-w-3xl space-y-7 px-5 py-8 sm:py-12">
      <div><h1 class="text-3xl font-normal tracking-[-0.025em]">腸篩條碼比對</h1><p class="mt-3 text-base leading-7 text-[#59695a]">掃描標籤上的長方形條碼，快速查看對應名單與領管狀態。</p></div>
      <section class="rounded-2xl border border-[#d8ddce] bg-[#fffdf8] p-5 sm:p-7" aria-labelledby="scan-heading">
        <h2 id="scan-heading" class="text-xl font-normal">掃描或輸入條碼</h2>
        <div class="mt-5 flex flex-col gap-3 sm:flex-row"><button type="button" class="btn-primary" :disabled="busy || scanning" @click="startCamera">開啟相機掃描</button><label class="btn-secondary flex cursor-pointer items-center justify-center" :class="busy ? 'pointer-events-none opacity-60' : ''">拍照／選擇條碼照片<input id="barcode-photo" class="sr-only" type="file" accept="image/*" capture="environment" :disabled="busy" @change="scanPhoto"></label></div>
        <div v-if="scanning" class="mt-5 space-y-3"><video ref="video" autoplay muted playsinline class="aspect-video w-full rounded-xl bg-black object-cover" aria-label="條碼掃描相機畫面"/><p class="text-base leading-7 text-[#59695a]">將整段條碼對準相機，保留左右留白並避免反光。</p><button class="btn-secondary" @click="stopCamera">停止掃描</button></div>
        <p v-if="busy" role="status" class="mt-4 text-base text-[#59695a]">{{ scanning ? '正在開啟相機…' : '正在辨識照片…' }}</p>
        <form class="mt-6 space-y-3 border-t border-[#d8ddce] pt-5" @submit.prevent="lookup()"><label class="label" for="barcode-input">條碼編號（12 碼數字）</label><input id="barcode-input" v-model.trim="input" class="field" type="text" inputmode="numeric" maxlength="12" autocomplete="off" placeholder="輸入標籤下方的數字" :aria-invalid="!!error" :aria-describedby="error ? 'barcode-error' : undefined"><button class="btn-primary" :disabled="busy || scanning" type="submit">比對資料</button></form>
        <p v-if="error" id="barcode-error" role="alert" class="mt-4 text-base leading-7 text-[#9b342b]">{{ error }}</p><p v-if="message" role="status" class="mt-4 text-base leading-7 text-[#40573c]">{{ message }}</p>
      </section>
      <section v-if="record" class="rounded-2xl border border-[#b6c3a8] bg-[#edf1e6] p-5 sm:p-7" aria-labelledby="match-heading" aria-live="polite">
        <div class="flex flex-wrap items-center justify-between gap-3"><h2 id="match-heading" class="text-2xl font-normal">找到對應資料</h2><span class="rounded-lg bg-[#fffdf8] px-3 py-2 text-base">{{ record.state }}</span></div>
        <p v-if="record.state === '已取消'" class="mt-4 text-base text-[#9b342b]">此預約已取消，請勿繼續發管或收管。</p>
        <dl class="mt-5 grid gap-x-6 gap-y-4 text-base sm:grid-cols-2"><div v-for="[label, value] in [['姓名', record.name], ['身分證字號', record.identity], ['預約編號', record.id], ['領管院所', record.provider], ['鄉鎮', record.area], ['預約日期', record.date], ['發管日期', record.issuedAt || '尚未登記'], ['繳管狀態', record.tubeReturned ? '已繳管' : '未繳管']]" :key="label"><dt class="text-[#59695a]">{{ label }}</dt><dd class="mt-1 break-words">{{ value }}</dd></div></dl>
        <div class="mt-6 max-w-xs"><BowelBarcode :value="record.barcode" /></div>
        <p class="mt-4 text-sm leading-6 text-[#59695a]">此頁僅比對本機模擬名冊，不會自動更新領管或繳管狀態。</p>
      </section>
      <section class="space-y-4 border-t border-[#d8ddce] pt-6"><h2 class="text-xl font-normal">在手機測試電腦的標籤</h2><p class="text-base leading-7 text-[#59695a]">先在電腦的「標籤列印」匯出 DEMO 比對名冊，再於手機匯入同一檔案。兩台裝置的模擬資料不會自動同步。</p><label class="btn-secondary inline-flex cursor-pointer items-center">匯入 DEMO 比對名冊<input id="barcode-roster" class="sr-only" type="file" accept=".json,application/json" @change="importRoster"></label><p class="text-sm leading-7 text-[#59695a]">手機需連上與電腦相同的區域網路，並開啟電腦的專案網址。以 HTTP 區網網址開啟時，可使用照片辨識；相機即時掃描需瀏覽器允許的安全網址。照片與名冊僅在此裝置處理，不會上傳。</p></section>
      <section class="space-y-4 border-t border-[#d8ddce] pt-6"><h2 class="text-xl font-normal">模擬測試資料</h2><p class="text-base leading-7 text-[#59695a]">可帶入下方資料測試比對；目前名冊共 {{ tracking.length }} 筆。</p><div class="divide-y divide-[#d8ddce]"><div v-for="sample in tracking.slice(0, 3)" :key="sample.id" class="flex flex-wrap items-center justify-between gap-3 py-4"><div><p class="text-lg">{{ sample.name }} · {{ sample.state }}</p><p class="mt-1 text-base tabular-nums text-[#59695a]">{{ sample.barcode }}</p></div><button class="btn-secondary" @click="lookup(sample.barcode)">帶入並比對</button></div></div><button class="btn-secondary" @click="lookup('000000000000')">測試查無條碼</button></section>
    </main>
  </div>
</template>

<style scoped>
.natural-surface :is(.btn-primary, .btn-secondary) { min-height: 54px; font-size: 16px; font-weight: 400; line-height: 1.6; }
.natural-surface .btn-primary { background: #526c4b; }
.natural-surface .btn-primary:hover { background: #40573c; }
.natural-surface .btn-secondary { border-color: #d8ddce; color: #526c4b; }
.natural-surface .btn-secondary:hover { background: #e7ecdf; }
.natural-surface button:disabled { opacity: .6; cursor: not-allowed; }
.natural-surface .field { border-color: #d8ddce; min-height: 54px; font-size: 18px; color: #2f493a; }
.natural-surface .field:focus { border-color: #526c4b; outline: 3px solid #e7ecdf; }
.natural-surface .label { font-size: 16px; font-weight: 400; color: #59695a; }
.natural-surface label.btn-secondary:focus-within { outline: 2px solid #526c4b; outline-offset: 3px; }
</style>
