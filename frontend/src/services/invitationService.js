import { demoInvitations } from '../utils/demoInvitations.js'

// DEMO adapter: the view only consumes this contract. Replace the lookup body with an API call later.
export const invitationSamples = demoInvitations

export async function verifyInvitationCode(rawCode) {
  const code = String(rawCode ?? '').replace(/\s/g, '')
  if (!/^\d{10}$/.test(code)) return { ok: false, error: '邀約碼須為 10 碼數字，請核對簡訊或明信片上的代碼。' }
  const invitation = demoInvitations.find(item => item.code === code)
  if (!invitation) return { ok: false, error: '查無此邀約碼的模擬資料。請核對代碼，或使用下方測試資料。' }
  return { ok: true, invitation: { ...invitation }, error: '' }
}

export function eventWeekday(date) {
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? '' : `星期${'日一二三四五六'[parsed.getUTCDay()]}`
}
