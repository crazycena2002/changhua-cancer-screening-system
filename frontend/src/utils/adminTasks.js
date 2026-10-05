// Stages are mutually exclusive so the total counts people once.
export const adminTaskDefinitions = [
  { key: 'labels', label: '待列印標籤', description: '已預約，尚未列印發管標籤', section: 'labels', state: '已預約' },
  { key: 'receive', label: '待確認接收', description: '已派送，等待確認接收', section: 'tracking', state: '已派送' },
  { key: 'pickup', label: '待確認領管', description: '已接收，等待民眾領管', section: 'tracking', state: '已接收' },
  { key: 'return', label: '待登記繳管', description: '已領取，尚未登記繳回', section: 'tubes', state: '已領取' },
  { key: 'send', label: '待登記送驗', description: '已繳回，等待登記送驗', section: 'tracking', state: '已繳回' },
]

export function matchesAdminTask(record, key) {
  const task = adminTaskDefinitions.find(item => item.key === key)
  return !!task && record.state === task.state && (key !== 'labels' || !record.printAt) && (key !== 'return' || !record.tubeReturned)
}

export function summarizeAdminTasks(records) {
  return adminTaskDefinitions.map(task => ({ ...task, count: records.filter(record => matchesAdminTask(record, task.key)).length }))
}
