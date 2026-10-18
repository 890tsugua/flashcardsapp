export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/** Study days roll over at 4 am local time (like Anki), so a late-night session counts as the same day. */
const ROLLOVER_HOUR = 4

export function startOfStudyDay(now: Date): Date {
  const d = new Date(now)
  if (d.getHours() < ROLLOVER_HOUR) d.setDate(d.getDate() - 1)
  d.setHours(ROLLOVER_HOUR, 0, 0, 0)
  return d
}

export function endOfStudyDay(now: Date): Date {
  const d = startOfStudyDay(now)
  d.setDate(d.getDate() + 1)
  return d
}

/** "2026-10-18" for the study day containing `now`. */
export function dayKey(now: Date): string {
  const d = startOfStudyDay(now)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole study days from `now`'s day to `time`'s day (0 = today, 1 = tomorrow). */
export function studyDaysUntil(time: number, now: Date): number {
  const today = startOfStudyDay(now).getTime()
  const that = startOfStudyDay(new Date(time)).getTime()
  return Math.round((that - today) / DAY_MS)
}

function trim(n: number): string {
  return n >= 10 ? String(Math.round(n)) : String(Math.round(n * 10) / 10)
}

/** Compact interval for the answer buttons: "1m", "10m", "3h", "4d", "2.5mo", "1.2y". */
export function formatInterval(ms: number): string {
  if (ms < HOUR_MS) return `${Math.max(1, Math.round(ms / MINUTE_MS))}m`
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)}h`
  const days = ms / DAY_MS
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${trim(days / 30)}mo`
  return `${trim(days / 365)}y`
}

/** When a card is next due, in words: "now", "in 10 min", "today", "tomorrow", "in 5 days". */
export function formatDue(due: number, now: Date): string {
  const ms = due - now.getTime()
  if (ms <= 0) return 'now'
  if (ms < HOUR_MS) return `in ${Math.max(1, Math.round(ms / MINUTE_MS))} min`
  const days = studyDaysUntil(due, now)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 60) return `in ${days} days`
  if (days < 730) return `in ${Math.round(days / 30)} months`
  return `in ${Math.round(days / 365)} years`
}

/** When something happened, in words: "today", "yesterday", "3 days ago". */
export function formatAgo(time: number, now: Date): string {
  const days = -studyDaysUntil(time, now)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 60) return `${days} days ago`
  return `${Math.round(days / 30)} months ago`
}
