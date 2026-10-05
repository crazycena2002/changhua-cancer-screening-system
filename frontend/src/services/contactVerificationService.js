// Reuses the current in-page DEMO codes; this service only validates the draft state.
export function verifyContactPhone({ phone, code, input, deadline, now = Date.now() }) {
  if (!/^09\d{8}$/.test(phone)) return { ok: false, error: '請輸入必填的 10 碼手機號碼' }
  if (!code || now > deadline || input !== code) return { ok: false, error: '手機驗證碼錯誤或已過期，請重新產生' }
  return { ok: true, error: '' }
}

export function verifyContactEmail({ email, issuedTo, code, input, deadline, now = Date.now() }) {
  if (!email) return { ok: true, error: '' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email !== issuedTo || !code || now > deadline || input !== code) {
    return { ok: false, error: '已填寫 E-mail，請完成信箱驗證後繼續' }
  }
  return { ok: true, error: '' }
}
