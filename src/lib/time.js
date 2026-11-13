export const MIN = 60 * 1000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR

export const minutesAgo = (m) => Date.now() - m * MIN

export function fmtRelative(ts) {
  if (!ts) return ''
  const d = Date.now() - ts
  if (d < 60 * 1000) return '刚刚'
  if (d < HOUR) return `${Math.floor(d / MIN)} 分钟前`
  if (d < DAY) return `${Math.floor(d / HOUR)} 小时前`
  if (d < 2 * DAY) return '昨天'
  if (d < 7 * DAY) return `${Math.floor(d / DAY)} 天前`
  const t = new Date(ts)
  return `${t.getMonth() + 1} 月 ${t.getDate()} 日`
}

export function fmtClock(ts) {
  const t = new Date(ts)
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
}

export function fmtDate(ts) {
  const t = new Date(ts)
  return `${t.getFullYear()}/${t.getMonth() + 1}/${t.getDate()}`
}

// 聊天里的日期分隔：「今天 / 昨天 / 2026/11/4」
export function fmtDay(ts) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return '今天'
  const y = new Date(now)
  y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return '昨天'
  return fmtDate(ts)
}

export function todayKey() {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}
