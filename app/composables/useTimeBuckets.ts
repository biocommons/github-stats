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

export type TimeBucket = 'month' | 'quarter'

export function formatLocalTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function toBucket(isoDate: string, bucket: TimeBucket): string {
  if (bucket === 'quarter') return toYearQuarter(isoDate)
  return toYearMonth(isoDate)
}
