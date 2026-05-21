/**
 * ISO 8601 time bucketing for raw event records.
 * All functions accept any ISO 8601 date string (with or without Z / offset).
 * Returns string keys suitable for grouping and display.
 */


export function toYearMonth(isoDate: string): string {
  const d = new Date(isoDate)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function toYearQuarter(isoDate: string): string {
  const d = new Date(isoDate)
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1
  return `${d.getUTCFullYear()}Q${quarter}`
}

export type TimeBucket = 'week' | 'month' | 'quarter'

export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function formatRelative(iso: string): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 45) return `${days} d`
  const months = Math.round(days / 30.44)
  if (months < 18) return `${months} mo`
  return `${Math.round(months / 12)} y`
}

export function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function toYearWeek(isoDate: string): string {
  const d = new Date(isoDate)
  // ISO 8601 week: Monday-anchored, week 1 contains the first Thursday of the year
  const day = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${d.getUTCFullYear()}W${String(week).padStart(2, '0')}`
}

export function toBucket(isoDate: string, bucket: TimeBucket): string {
  if (bucket === 'quarter') return toYearQuarter(isoDate)
  if (bucket === 'week') return toYearWeek(isoDate)
  return toYearMonth(isoDate)
}
