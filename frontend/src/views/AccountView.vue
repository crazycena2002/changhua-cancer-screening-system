<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useDemoStore } from '@/stores/demo'
import PublicBrand from '@/components/PublicBrand.vue'

const router = useRouter()
const { accounts, session } = storeToRefs(useDemoStore())
const step = ref('login')
const showPassword = ref(false)
const loginMethod = ref('一般登入')
const captcha = ref(String(Math.floor(1000 + Math.random() * 9000)))
const login = reactive({ account: '', password: '', captcha: '' })
const application = reactive({ phone: '', email: '', account: '', password: '', confirm: '', id: '', name: '', organizationCode: '', organizationName: '', role: '一般使用者' })
const forgot = reactive({ account: '', id: '', code: '', password: '', confirm: '' })
const sent = reactive({ phone: false, email: false, reset: false })
const codes = reactive({ phone: '', email: '', reset: '' })
const sentTo = reactive({ phone: '', email: '' })
const deadlines = reactive({ phone: 0, email: 0, reset: 0 })
const attempts = ref(0)
const locked = ref(false)
const resetCodeConfirmed = ref(false)
const success = ref(false)
const notice = ref('')
const order = ['phone', 'email', 'credentials', 'profile']
const titles = { login: '服務登入', phone: '手機驗證', email: 'E-mail 驗證', credentials: '帳號與密碼設定', profile: '基本資料填寫', forgot: '忘記密碼', reset: '重新設定密碼' }
const currentNumber = computed(() => order.indexOf(step.value) + 1)
const passwordValid = value => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value)
const freshCode = () => String(Math.floor(100000 + Math.random() * 900000))
function tell(value) { notice.value = value; setTimeout(() => { if (notice.value === value) notice.value = '' }, 4500) }
function alertRule(value) { window.alert(value); tell(value) }
function refreshCaptcha() { captcha.value = String(Math.floor(1000 + Math.random() * 9000)); login.captcha = '' }
function sendCode(kind) {
  if (kind === 'phone' && !/^09\d{8}$/.test(application.phone)) return tell('請輸入 10 碼手機號碼')
  if (kind === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(application.email)) return tell('請輸入有效的 E-mail')
  codes[kind] = freshCode()
  sentTo[kind] = application[kind]
  deadlines[kind] = Date.now() + (kind === 'phone' ? 5 : 15) * 60 * 1000
  sent[kind] = true
  tell('已產生本機 DEMO 驗證碼')
}
function confirmCode(kind) {
  const entered = kind === 'reset' ? forgot.code : application[`${kind}Code`]
  if (!sent[kind]) return tell('請先產生驗證碼')
  if (kind !== 'reset' && application[kind] !== sentTo[kind]) return tell('聯絡資料已變更，請重新產生驗證碼')
  if (Date.now() > deadlines[kind]) return tell('驗證碼已過期，請重新產生')
  if (entered !== codes[kind]) return tell('驗證碼不正確')
  if (kind === 'phone') step.value = 'email'
  if (kind === 'email') step.value = 'credentials'
  if (kind === 'reset') { resetCodeConfirmed.value = true; tell('驗證成功，請設定新密碼') }
}
function saveCredentials() {
  if (!application.account.trim()) return tell('請輸入帳號')
  if (accounts.value.some(a => a.account === application.account.trim())) return tell('此帳號已存在')
  if (!passwordValid(application.password)) return alertRule('密碼須至少 8 碼，包含英文大小寫、數字及特殊符號')
  if (application.password !== application.confirm) return tell('兩次輸入的密碼不一致')
  step.value = 'profile'
}
function lookupId() { if (application.id.toUpperCase() === 'N123456789') application.name = '王小美' }
function lookupOrganization() { application.organizationName = application.organizationCode === '5937010015' ? '彰化市南區衛生所（DEMO）' : '' }
function saveProfile() {
  if (!application.id.trim() || !application.name.trim() || !application.organizationCode.trim()) return tell('請填寫身分證字號、姓名與醫事機構代碼')
  if (application.role === '單位管理者' && accounts.value.some(a => a.organizationCode === application.organizationCode && a.role === '單位管理者')) return tell('此機構已有單位管理者，請選擇一般使用者')
  accounts.value.push({ account: application.account.trim(), password: application.password, previous: [], id: application.id.toUpperCase(), name: application.name.trim(), phone: application.phone, email: application.email, organizationCode: application.organizationCode, organizationName: application.organizationName.trim(), area: application.organizationCode === '5937010015' ? '彰化市' : '', role: application.role, expires: Date.now() + 90 * 86400000 })
  success.value = true
  application.password = ''; application.confirm = ''
  tell('DEMO 帳號申請完成')
}
function submitLogin() {
  if (loginMethod.value === '憑證登入') return tell('本機 DEMO 沒有憑證設備，請切換一般登入')
  if (login.captcha !== captcha.value) { refreshCaptcha(); return tell('驗證碼不正確') }
  const account = accounts.value.find(a => a.account === login.account.trim())
  if (!account) { refreshCaptcha(); return alertRule('無此帳號') }
  if (locked.value) return alertRule('帳號已被鎖定，請點選忘記密碼重新設定')
  if (account.password !== login.password) {
    attempts.value++
    refreshCaptcha()
    if (attempts.value >= 3) { locked.value = true; return alertRule('密碼錯誤3次！帳號已被鎖定，請點選忘記密碼重新設定') }
    return alertRule('密碼錯誤！錯誤3次，帳號將被鎖定！')
  }
  attempts.value = 0
  if (account.expires <= Date.now()) { forgot.account = account.account; forgot.id = account.id; step.value = 'reset'; sendResetCode(account); return alertRule('密碼已到期，請重新設定密碼') }
  if (account.expires - Date.now() <= 10 * 86400000) window.alert('您的密碼將在10天後過期，請盡速更換密碼')
  session.value = { organizationCode: account.organizationCode, organizationName: account.organizationName || '', role: account.role, name: account.name, area: account.area || '', provider: ['藥局人員', '醫療院所人員'].includes(account.role) ? account.organizationName || '' : '' }
  router.push('/admin')
}
function sendResetCode(account) {
  codes.reset = freshCode(); deadlines.reset = Date.now() + 15 * 60 * 1000; sent.reset = true; resetCodeConfirmed.value = false
  tell(`驗證碼已寄送至指定的 E-mail 地址（本機 DEMO 模擬）`)
}
function submitForgot() {
  const account = accounts.value.find(a => a.account === forgot.account.trim() && a.id === forgot.id.toUpperCase().trim())
  if (!account) return tell('帳號或身分證字號不符')
  sendResetCode(account)
  window.alert('驗證信件已寄送至指定的 E-mail 地址。驗證碼為 6 碼，限 15 分鐘內輸入。此為本機 DEMO 模擬。')
  step.value = 'reset'
}
function saveReset() {
  if (!resetCodeConfirmed.value) return tell('請先確認信箱驗證碼')
  if (!passwordValid(forgot.password)) return alertRule('密碼須至少 8 碼，包含英文大小寫、數字及特殊符號')
  if (forgot.password !== forgot.confirm) return tell('兩次輸入的密碼不一致')
  const account = accounts.value.find(a => a.account === forgot.account)
  if (!account) return tell('找不到帳號')
  if ([account.password, ...account.previous].slice(0, 3).includes(forgot.password)) return tell('新密碼不可與前 3 次密碼相同')
  account.previous.unshift(account.password); account.previous = account.previous.slice(0, 2)
  account.password = forgot.password; account.expires = Date.now() + 90 * 86400000
  locked.value = false; attempts.value = 0; forgot.password = ''; forgot.confirm = ''; login.password = ''; refreshCaptcha(); step.value = 'login'
  alertRule('密碼已重新設定，請登入 DEMO 帳號')
}
function exit() { step.value = 'login'; success.value = false; resetCodeConfirmed.value = false }
</script>

<template>
  <div class="account-page natural-surface min-h-screen bg-[#f8f6f0] text-[#2f493a]">
    <header class="border-b border-[#d8ddce] bg-white"><div class="mx-auto flex max-w-7xl items-center justify-between gap-3 px-5 py-4 lg:px-8"><PublicBrand @click="router.push('/')" /><button class="shrink-0 rounded-lg border border-[#d8ddce] px-3 py-2 text-sm font-normal text-[#526c4b] hover:bg-[#e7ecdf]" @click="router.push('/')">返回首頁</button></div></header>
    <main class="mx-auto grid max-w-6xl gap-8 px-5 py-8 lg:grid-cols-[.9fr_1.1fr] lg:gap-16 lg:px-8 lg:py-16">
      <div class="lg:pt-8"><h1 class="text-3xl font-normal leading-tight tracking-[-0.025em] sm:text-4xl">後台帳號服務</h1><p class="mt-4 max-w-md text-base leading-7 text-[#59695a]">供衛生局及醫療院所人員登入、申請帳號與管理篩檢服務。</p><p class="mt-5 max-w-md border-t border-[#d8ddce] pt-5 text-sm leading-7 text-[#59695a]">本機 DEMO：驗證碼顯示在畫面上，身分與機構資料使用模擬名冊。請使用測試資料，勿輸入真實個資。</p></div>
      <section class="card overflow-hidden"><div class="border-b border-[#d8ddce] px-6 py-5 md:px-8"><h2 class="text-2xl font-normal">{{ success ? '帳號申請完成' : titles[step] }}</h2><div v-if="currentNumber > 0 && !success" class="mt-5 flex gap-2"><div v-for="n in 4" :key="n" :class="['h-1.5 flex-1 rounded-full', n <= currentNumber ? 'bg-[#526c4b]' : 'bg-[#d8ddce]']"></div></div></div>
        <div class="p-6 md:p-8">
          <div v-if="success" class="space-y-5"><div class="flex h-16 w-16 items-center justify-center rounded-full bg-[#e7ecdf] text-3xl text-[#65725f]">✓</div><p class="text-sm leading-7 text-[#59695a]">帳號 <b>{{ application.account }}</b> 已加入本機 DEMO 清單。可返回登入畫面試用。</p><button class="btn-primary w-full" @click="exit">前往登入</button></div>
          <form v-else-if="step === 'login'" class="space-y-5" @submit.prevent="submitLogin"><div><label class="label">登入方式</label><div class="grid grid-cols-2 gap-2"><button v-for="method in ['一般登入', '憑證登入']" :key="method" type="button" :class="['rounded-xl border px-3 py-3 text-sm font-normal', loginMethod === method ? 'border-[#526c4b] bg-[#e7ecdf] text-[#526c4b]' : 'border-[#d8ddce] text-[#59695a]']" @click="loginMethod = method">{{ method }}</button></div></div><template v-if="loginMethod === '一般登入'"><div><label class="label" for="login-account">帳號</label><input id="login-account" v-model="login.account" class="field" autocomplete="username" placeholder="請輸入帳號" required></div><div><label class="label" for="login-password">密碼</label><div class="flex gap-2"><input id="login-password" v-model="login.password" :type="showPassword ? 'text' : 'password'" class="field" autocomplete="current-password" placeholder="請輸入密碼" required><button type="button" class="btn-secondary shrink-0" @click="showPassword = !showPassword">{{ showPassword ? '隱藏' : '顯示' }}</button></div></div><div><label class="label" for="login-captcha">驗證碼</label><div class="flex gap-2"><input id="login-captcha" v-model="login.captcha" class="field" inputmode="numeric" maxlength="4" placeholder="輸入右側數字" required><button type="button" class="shrink-0 rounded-xl bg-[#e7ecdf] px-4 text-xl font-normal tracking-widest text-[#526c4b]" title="點擊更新驗證碼" @click="refreshCaptcha">{{ captcha }} ↻</button></div></div></template><p v-else class="rounded-xl bg-[#e7ecdf] p-4 text-sm leading-6 text-[#59695a]">憑證登入需要實體憑證與驗證服務；本機 DEMO 僅展示入口。</p><button class="btn-primary w-full" type="submit">登入後台</button><div class="flex justify-between border-t border-[#d8ddce] pt-5 text-sm"><button type="button" class="font-normal text-[#526c4b] hover:underline" @click="step = 'forgot'">忘記密碼？</button><button type="button" class="font-normal text-[#526c4b] hover:underline" @click="step = 'phone'">申請帳號 →</button></div><p class="text-xs text-[#59695a]">測試帳號：demo　密碼：Demo@1234　驗證碼請輸入畫面數字。</p></form>
          <form v-else-if="step === 'phone'" class="space-y-5" @submit.prevent="confirmCode('phone')"><p class="text-sm leading-6 text-[#59695a]">第一步，確認手機號碼。驗證碼為 6 碼，5 分鐘內有效。</p><div><label class="label">手機號碼</label><input v-model="application.phone" class="field" inputmode="tel" maxlength="10" placeholder="0912345678" required></div><button type="button" class="btn-secondary w-full" @click="sendCode('phone')">{{ sent.phone ? '重新產生驗證碼' : '發送簡訊驗證碼' }}</button><div v-if="sent.phone" class="space-y-4"><p class="rounded-xl bg-[#e7ecdf] px-4 py-3 text-sm text-[#526c4b]">本機 DEMO 驗證碼：<b class="tracking-widest">{{ codes.phone }}</b></p><div><label class="label">驗證碼</label><input v-model="application.phoneCode" class="field" inputmode="numeric" maxlength="6" placeholder="輸入 6 碼驗證碼" required></div></div><div class="flex gap-3"><button type="button" class="btn-secondary flex-1" @click="step = 'login'">上一頁</button><button type="submit" class="btn-primary flex-1">確定</button></div></form>
          <form v-else-if="step === 'email'" class="space-y-5" @submit.prevent="confirmCode('email')"><p class="text-sm leading-6 text-[#59695a]">第二步，確認電子郵件。驗證碼為 6 碼，15 分鐘內有效。</p><div><label class="label">E-mail</label><input v-model="application.email" type="email" class="field" placeholder="name@example.com" required></div><button type="button" class="btn-secondary w-full" @click="sendCode('email')">{{ sent.email ? '重新產生驗證碼' : '發送 E-mail 驗證碼' }}</button><div v-if="sent.email" class="space-y-4"><p class="rounded-xl bg-[#e7ecdf] px-4 py-3 text-sm text-[#526c4b]">本機 DEMO 驗證碼：<b class="tracking-widest">{{ codes.email }}</b></p><div><label class="label">驗證碼</label><input v-model="application.emailCode" class="field" inputmode="numeric" maxlength="6" placeholder="輸入 6 碼驗證碼" required></div></div><div class="flex gap-3"><button type="button" class="btn-secondary flex-1" @click="step = 'phone'">上一頁</button><button type="submit" class="btn-primary flex-1">確定</button></div></form>
          <form v-else-if="step === 'credentials'" class="space-y-5" @submit.prevent="saveCredentials"><p class="text-sm leading-6 text-[#59695a]">第三步，設定帳號與密碼。</p><div><label class="label">帳號</label><input v-model="application.account" class="field" autocomplete="username" required></div><div><label class="label">密碼</label><input v-model="application.password" :type="showPassword ? 'text' : 'password'" class="field" autocomplete="new-password" required></div><label class="flex items-center gap-2 text-sm text-[#59695a]"><input v-model="showPassword" type="checkbox">顯示密碼</label><div><label class="label">再次輸入密碼</label><input v-model="application.confirm" :type="showPassword ? 'text' : 'password'" class="field" autocomplete="new-password" required></div><p class="rounded-xl bg-[#e7ecdf] p-3 text-xs leading-5 text-[#59695a]">密碼至少 8 碼，須包含大寫字母、小寫字母、數字及特殊符號。</p><div class="flex gap-3"><button type="button" class="btn-secondary flex-1" @click="step = 'email'">上一頁</button><button type="submit" class="btn-primary flex-1">確定</button></div></form>
          <form v-else-if="step === 'profile'" class="space-y-5" @submit.prevent="saveProfile"><p class="text-sm leading-6 text-[#59695a]">第四步，填寫基本資料。手機與 E-mail 已帶入前面驗證的內容。</p><div class="grid gap-4 sm:grid-cols-2"><div><label class="label">身分證字號</label><input v-model="application.id" class="field" maxlength="10" @blur="lookupId" required></div><div><label class="label">姓名</label><input v-model="application.name" class="field" required></div><div><label class="label">手機號碼</label><input :value="application.phone" class="field bg-[#e7ecdf]" readonly></div><div><label class="label">E-mail</label><input :value="application.email" class="field bg-[#e7ecdf]" readonly></div><div><label class="label">醫事機構代碼</label><input v-model="application.organizationCode" class="field" @blur="lookupOrganization" required></div><div><label class="label">醫事機構名稱</label><input v-model="application.organizationName" class="field" placeholder="無查核資料時可手動填寫"></div></div><div><label class="label">角色別</label><select v-model="application.role" class="field"><option>一般使用者</option><option>單位管理者</option></select></div><p class="text-xs leading-5 text-[#59695a]">本機示範對照：N123456789 帶入王小美；機構代碼 5937010015 帶入示範機構。其餘資料可自行輸入測試。</p><div class="flex gap-3"><button type="button" class="btn-secondary flex-1" @click="step = 'credentials'">上一頁</button><button type="submit" class="btn-primary flex-1">完成申請</button></div></form>
          <form v-else-if="step === 'forgot'" class="space-y-5" @submit.prevent="submitForgot"><p class="text-sm leading-6 text-[#59695a]">請輸入帳號與身分證字號，確認後進入信箱驗證流程。</p><div><label class="label">使用者帳號</label><input v-model="forgot.account" class="field" required></div><div><label class="label">身分證字號</label><input v-model="forgot.id" class="field" required></div><div class="flex gap-3"><button type="button" class="btn-secondary flex-1" @click="exit">離開</button><button type="submit" class="btn-primary flex-1">確定</button></div><p class="text-xs text-[#59695a]">測試資料：demo / N123456789</p></form>
          <form v-else class="space-y-5" @submit.prevent="saveReset"><p class="text-sm leading-6 text-[#59695a]">請先確認信箱驗證碼。驗證成功後，才能設定新密碼。</p><p v-if="sent.reset" class="rounded-xl bg-[#e7ecdf] px-4 py-3 text-sm text-[#526c4b]">本機 DEMO 驗證碼：<b class="tracking-widest">{{ codes.reset }}</b>　<span class="text-xs">15 分鐘內有效</span></p><div><label class="label">信箱驗證碼</label><div class="flex gap-2"><input v-model="forgot.code" class="field" maxlength="6" inputmode="numeric" required><button type="button" class="btn-secondary shrink-0" @click="confirmCode('reset')">驗證</button></div></div><template v-if="resetCodeConfirmed"><div><label class="label">新密碼</label><input v-model="forgot.password" type="password" class="field" autocomplete="new-password" required></div><div><label class="label">再次輸入密碼</label><input v-model="forgot.confirm" type="password" class="field" autocomplete="new-password" required></div><p class="text-xs text-[#59695a]">至少 8 碼，含英文大小寫、數字與特殊符號；不可與前 3 次密碼相同。</p></template><div class="flex gap-3"><button type="button" class="btn-secondary flex-1" @click="exit">離開</button><button type="submit" class="btn-primary flex-1">確定</button></div></form>
        </div>
      </section>
    </main>
    <div v-if="notice" role="status" class="fixed bottom-6 right-6 z-50 max-w-sm rounded-xl bg-[#2f493a] px-5 py-3 text-sm font-normal text-white shadow-xl">{{ notice }}</div>
  </div>
</template>

<style scoped>
.account-page { font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif; }
.account-page .card { border-color: #d8ddce; border-radius: 16px; box-shadow: 0 6px 20px rgba(47, 73, 58, .055); }
.account-page .field { min-width: 0; min-height: 48px; border-color: #d8ddce; color: #2f493a; font-size: 16px; }
.account-page .field::placeholder { color: #59695a; }
.account-page .field:focus { border-color: #526c4b; outline: 3px solid #e7ecdf; }
.account-page .label { font-weight: 400; color: #59695a; font-size: 14px; }
.account-page .btn-primary { min-height: 48px; background: #526c4b; font-weight: 400; }
.account-page .btn-primary:hover { background: #40573c; transform: none; }
.account-page .btn-secondary { min-height: 44px; border-color: #d8ddce; color: #526c4b; font-weight: 400; }
.account-page .btn-secondary:hover { background: #e7ecdf; }
.account-page button:focus-visible { outline: 3px solid #40573c; outline-offset: 3px; }
.account-page ::selection { background: #e3ead8; color: #2f493a; }
.account-page input { caret-color: #526c4b; }
</style>
