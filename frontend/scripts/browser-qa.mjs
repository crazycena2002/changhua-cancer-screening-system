// Run against a locally started Vite server and Chrome DevTools port.
// Example: CHANGHUA_CDP=http://127.0.0.1:9225 node scripts/browser-qa.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const cdp = process.env.CHANGHUA_CDP || 'http://127.0.0.1:9225'
const base = process.env.CHANGHUA_BASE || 'http://127.0.0.1:5173'
const tabs = await (await fetch(`${cdp}/json/list`)).json()
const tab = tabs.find(item => item.type === 'page' && item.url.startsWith(base))
assert.ok(tab, '找不到開啟本機網站的 Chrome 分頁')
const socket = new WebSocket(tab.webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
let nextId = 0
const pending = new Map()
socket.onmessage = event => {
  const message = JSON.parse(event.data)
  if (!message.id || !pending.has(message.id)) return
  const { resolve, reject } = pending.get(message.id)
  pending.delete(message.id)
  message.error ? reject(new Error(message.error.message)) : resolve(message.result)
}
const command = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})
const evaluate = async expression => {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
const body = () => evaluate('document.body.innerText')
const click = async text => {
  const done = await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(item => item.textContent.trim().includes(${JSON.stringify(text)}) && !item.disabled); if (!button) return false; button.click(); return true })()`)
  assert.ok(done, `找不到可點擊按鈕：${text}`)
  await pause(100)
}
const fill = async (selector, value) => {
  const done = await evaluate(`(() => { const input = document.querySelector(${JSON.stringify(selector)}); if (!input) return false; input.value = ${JSON.stringify(value)}; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  assert.ok(done, `找不到欄位：${selector}`)
  await pause(80)
}
const navigate = async path => {
  await command('Page.navigate', { url: `${base}${path}` })
  for (let count = 0; count < 40; count++) { await pause(100); if (await evaluate('document.readyState === "complete" && !!document.querySelector("#app")')) return }
  throw new Error(`頁面未載入：${path}`)
}
const firstEnabled = async selector => {
  const done = await evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => !item.disabled); if (!button) return false; button.click(); return true })()`)
  assert.ok(done, `沒有可選項目：${selector}`)
  await pause(100)
}

try {
  // A: qualification selection, disabled state, and reason.
  await navigate('/booking/general')
  await fill('#general-identity', 'A200000003')
  await fill('#general-birth', '1970-03-01')
  await click('查詢資格')
  assert.equal(await evaluate('document.querySelectorAll(".screening-option input:disabled").length'), 2)
  assert.match(await body(), /不可預約原因：您近期已完成/)
  assert.equal(await evaluate('document.querySelectorAll(".screening-option input:not(:disabled)").length'), 1)
  await evaluate('document.querySelector(".screening-option:has(input:disabled)").click()')
  assert.equal(await evaluate('document.querySelectorAll(".screening-option input:checked").length'), 0)
  console.log('A 通過：資格原因與 disabled 狀態')

  // B/C: two screenings share identity and contact; e-mail can be omitted.
  await navigate('/booking/general')
  await fill('#general-identity', 'A200000012')
  await fill('#general-birth', '1965-01-01')
  await click('查詢資格')
  assert.equal(await evaluate('document.querySelectorAll(".screening-option input:not(:disabled)").length'), 3)
  await evaluate('document.querySelectorAll(".screening-option input:not(:disabled)")[0].click(); document.querySelectorAll(".screening-option input:not(:disabled)")[1].click()')
  await pause(100)
  await click('開始預約所選 2 項')
  await firstEnabled('.result-option')
  await firstEnabled('button.rounded-xl.border.p-3.text-left.text-sm')
  await click('確認並繼續')
  assert.match(await body(), /聯絡方式與驗證[\s\S]*電子郵件（選填）/)
  await fill('#booking-phone', '0912345678')
  await click('產生手機驗證碼')
  const phoneCode = await evaluate('document.querySelector("#demo-phone-code span")?.textContent.trim()')
  await fill('#booking-phone-code', phoneCode)
  await click('確認手機驗證碼')
  assert.match(await body(), /手機：已完成驗證/)
  await fill('#booking-email', 'demo@example.test')
  await click('下一步：基本資料')
  assert.match(await body(), /E-mail：尚未驗證/)
  await fill('#booking-email', '')
  await click('下一步：基本資料')
  assert.match(await body(), /基本資料/)
  await evaluate('document.querySelector("#same-address").click()')
  await pause(80)
  await click('確認資料並檢查其他篩檢')
  assert.equal(await evaluate('document.querySelectorAll("input[type=checkbox]:checked").length'), 1)
  await click('繼續預約加選的 1 項')
  await fill('select[id^="extra-event-"]', String(await evaluate(`document.querySelector('select[id^="extra-event-"]')?.options[1]?.value`)))
  await firstEnabled('[role="group"][aria-label$="預約時段"] button')
  await click('確認並繼續')
  assert.match(await body(), /已為您建立 2 筆 DEMO 預約/)
  console.log('B/C 通過：雙項預約共用資料，手機與選填 E-mail 同頁')

  // A station booking can add the independent bowel pickup route in one session.
  await navigate('/booking/general')
  await fill('#general-identity', 'A200000012')
  await fill('#general-birth', '1965-01-01')
  await click('查詢資格')
  await evaluate('[...document.querySelectorAll(".screening-option input:not(:disabled)")].forEach(item => item.click())')
  await pause(100)
  await click('開始預約所選 3 項')
  await firstEnabled('.result-option')
  await firstEnabled('button.rounded-xl.border.p-3.text-left.text-sm')
  await click('確認並繼續')
  await fill('#booking-phone', '0912345678')
  await click('產生手機驗證碼')
  await fill('#booking-phone-code', await evaluate('document.querySelector("#demo-phone-code span")?.textContent.trim()'))
  await click('下一步：基本資料')
  await evaluate('document.querySelector("#same-address").click()')
  await pause(80)
  await click('確認資料並檢查其他篩檢')
  await click('繼續預約加選的 2 項')
  await fill('select[id^="extra-event-"]', String(await evaluate(`document.querySelector('select[id^="extra-event-"]')?.options[1]?.value`)))
  await firstEnabled('[role="group"][aria-label$="預約時段"] button')
  await fill('select[id^="extra-township-"]', '田中鎮')
  await fill('select[id^="extra-provider-"]', 'BO-101')
  await click('確認並繼續')
  assert.match(await body(), /已為您建立 3 筆 DEMO 預約/)
  assert.match(await body(), /領管院所：田中鎮衛生所/)
  console.log('B 延伸通過：三項預約含獨立腸篩領管院所')

  // D: invitation fields keep identity and birth read-only while address can be edited.
  await navigate('/booking/invitation')
  await fill('#booking-invite', '3701000012')
  await click('確認邀約碼')
  await firstEnabled('.result-option')
  await firstEnabled('button.rounded-xl.border.p-3.text-left.text-sm')
  await click('確認並繼續')
  await fill('#booking-phone', '0912345678')
  await click('產生手機驗證碼')
  await fill('#booking-phone-code', await evaluate('document.querySelector("#demo-phone-code span")?.textContent.trim()'))
  await click('下一步：基本資料')
  assert.equal(await evaluate('document.querySelector("#profile-identity").readOnly && document.querySelector("#profile-birth").readOnly'), true)
  await click('修改基本資料')
  await evaluate('document.querySelector("#same-address").click()')
  await fill('#profile-current-detail', '修正路 8 號')
  await click('取消修改')
  assert.equal(await evaluate('document.querySelector("#same-address").checked'), true)
  await click('修改基本資料')
  await evaluate('document.querySelector("#same-address").click()')
  await fill('#profile-current-detail', '修正路 8 號')
  await click('儲存基本資料修改')
  assert.equal(await evaluate('document.querySelector("#profile-current-detail").value'), '修正路 8 號')
  await click('確認資料並檢查其他篩檢')
  await click('不加選，完成原預約')
  assert.match(await body(), /已為您建立 1 筆 DEMO 預約/)
  assert.match(await evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('demo').reservations[0].bookingDraft.basicProfile.currentAddress`), /修正路 8 號/)
  console.log('D 通過：整篩修改、取消還原及固定身分欄位')

  // E: manual booking must wait for review and show a result after a single commit.
  await navigate('/admin?section=manual')
  const reservationCount = () => evaluate(`document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('demo').reservations.length`)
  const before = await reservationCount()
  await click('模擬民眾1')
  await click('下一步：選擇場次')
  await click('1 · 員林市衛生所')
  await click('下一步：確認資料')
  assert.equal(await reservationCount(), before)
  assert.match(await body(), /預約資料確認[\s\S]*民眾基本資料[\s\S]*後台人工輸入/)
  await click('返回修改')
  assert.equal(await evaluate('document.querySelector("select")?.value != null'), true)
  await click('下一步：確認資料')
  await click('確認建立預約')
  assert.equal(await reservationCount(), before + 1)
  assert.match(await body(), /預約建立成功[\s\S]*預約編號/)
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(item => item.textContent.includes("確認建立預約"))'), false)
  console.log('E 通過：人工預約確認、返回保留與單次建立結果')

  await navigate('/booking')
  await click('查詢／取消預約')
  assert.match(await body(), /輸入預約時使用的身分證字號與手機號碼/)
  console.log('既有路由通過：預約入口與查詢／取消入口可用')

  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await navigate('/booking/general')
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), true)
  await navigate('/admin?section=manual')
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'), true)
  console.log('手機寬度通過：前台入口與後台人工預約沒有整頁橫向溢出')
  if (process.env.CHANGHUA_QA_SCREENSHOTS) {
    await mkdir(process.env.CHANGHUA_QA_SCREENSHOTS, { recursive: true })
    const shot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(join(process.env.CHANGHUA_QA_SCREENSHOTS, 'admin-manual-mobile.png'), Buffer.from(shot.data, 'base64'))
    await navigate('/booking/general')
    await fill('#general-identity', 'A200000003')
    await fill('#general-birth', '1970-03-01')
    await click('查詢資格')
    const qualificationShot = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    await writeFile(join(process.env.CHANGHUA_QA_SCREENSHOTS, 'qualification-mobile.png'), Buffer.from(qualificationShot.data, 'base64'))
  }
} finally {
  socket.close()
}
