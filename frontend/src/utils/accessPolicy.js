// 本機 DEMO 的介面權限模型；正式授權與資料範圍須由後端重新驗證。
export const rolePermissions = Object.freeze({
  系統管理員: ['*'],
  衛生局承辦: ['booking.read', 'booking.write', 'booking.export', 'event.read', 'event.write', 'bowel.read', 'bowel.write', 'bowel.label', 'bowel.receive', 'bowel.pickup', 'bowel.return', 'bowel.sendToLab', 'bowel.export'],
  衛生所承辦: ['booking.read', 'booking.write', 'booking.export', 'event.read', 'event.write', 'bowel.read', 'bowel.write', 'bowel.label', 'bowel.receive', 'bowel.pickup', 'bowel.return', 'bowel.sendToLab', 'bowel.export'],
  醫療院所人員: ['booking.read', 'bowel.read', 'bowel.receive', 'bowel.pickup'],
  藥局人員: ['bowel.read', 'bowel.receive', 'bowel.pickup'],
  單位管理者: ['booking.read', 'booking.write', 'booking.export', 'event.read', 'event.write', 'bowel.read', 'bowel.write', 'bowel.receive', 'bowel.pickup', 'bowel.export'],
  一般使用者: ['booking.read'],
})

export function canAccess(actor, permission, record = null) {
  if (!actor?.organizationCode || !rolePermissions[actor.role]) return false
  const allowed = actor.permissions || rolePermissions[actor.role]
  if (!allowed.includes('*') && !allowed.includes(permission)) return false
  if (record && !allowed.includes('*')) {
    if (actor.role === '衛生局承辦') return true
    if (record.organizationCode && record.organizationCode !== actor.organizationCode) return false
    if (!actor.area && !actor.provider && (record.area || record.provider) && !record.organizationCode) return false
    if (actor.area && record.area && record.area !== actor.area) return false
    if (actor.provider && record.provider && record.provider !== actor.provider) return false
  }
  return true
}

export const sectionPermissions = Object.freeze({
  overview: 'booking.read', edit: 'booking.read', manual: 'booking.write', roster: 'booking.read',
  events: 'event.read', eventForm: 'event.write', medical: 'event.write',
  tubes: 'bowel.return', lab: 'bowel.sendToLab', tracking: 'bowel.read', labels: 'bowel.label', providers: 'bowel.read',
})
