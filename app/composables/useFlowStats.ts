import { toBucket, type TimeBucket } from './useTimeBuckets'
import { repoDisplayName, ADMIN_REPOS, ARCHIVED_REPOS } from '~/config'
import type { RepoSet } from '~/config'

export type FlowKind = 'issues' | 'prs'
export type FlowTimespan = 'all' | '12mo' | '6mo' | '3mo' | '1mo'

// Normalized shape shared by issues and PRs
interface FlowRecord {
  repo: string
  created_at: string
  closed_at: string | null
}

export const RESOLUTION_BUCKETS = ['0–1d', '2–7d', '8–30d', '31–90d', '91–365d', '>365d'] as const
export type ResolutionBucket = (typeof RESOLUTION_BUCKETS)[number]

function classifyDays(days: number): ResolutionBucket {
  if (days <= 1) return '0–1d'
  if (days <= 7) return '2–7d'
  if (days <= 30) return '8–30d'
  if (days <= 90) return '31–90d'
  if (days <= 365) return '91–365d'
  return '>365d'
}

function classifyResolution(createdAt: string, closedAt: string): ResolutionBucket {
  return classifyDays((new Date(closedAt).getTime() - new Date(createdAt).getTime()) / 86_400_000)
}

export interface FlowPoint {
  bucket: string
  repo: string
  opened: number
  closed: number
}

export interface StockPoint {
  bucket: string
  openCount: number
}

export interface ResolutionRow {
  bucket: ResolutionBucket
  byRepo: Record<string, number>
  total: number
}

export interface RepoResolution {
  medianDays: number | null
  p90Days: number | null
  totalClosed: number
}

export const RESOLUTION_WINDOWS = ['all', '12mo', '6mo', '3mo', '1mo'] as const
export type ResolutionWindow = (typeof RESOLUTION_WINDOWS)[number]

export interface WindowResolution {
  medianDays: number | null
  p90Days: number | null
  totalClosed: number
  totalOpen: number
  openByRepo: Record<string, number>
  resolutionRows: ResolutionRow[]
  resolutionRowsWithOpen: ResolutionRow[]
  perRepo: Record<string, { medianDays: number | null; p90Days: number | null; totalClosed: number }>
}

export interface FlowStats {
  repos: string[]
  flowPoints: FlowPoint[]
  stockSeries: StockPoint[]
  repoStockSeries: Record<string, StockPoint[]>
  resolutionRows: ResolutionRow[]
  medianDays: number | null
  p90Days: number | null
  totalClosed: number
  perRepo: Record<string, RepoResolution>
}

function fillContiguousBuckets(first: string, last: string, granularity: TimeBucket): string[] {
  const result: string[] = []
  if (granularity === 'week') {
    // Advance by 7-day steps from the Monday of the first ISO week to the last
    const isoWeekToDate = (key: string): Date => {
      const year = parseInt(key)
      const week = parseInt(key.slice(5))
      // Jan 4 is always in week 1; find Monday of that week then advance
      const jan4 = new Date(Date.UTC(year, 0, 4))
      const jan4Day = jan4.getUTCDay() || 7
      return new Date(jan4.getTime() + (week - 1) * 7 * 86_400_000 - (jan4Day - 1) * 86_400_000)
    }
    let cur = isoWeekToDate(first)
    const end = isoWeekToDate(last)
    while (cur <= end) {
      const day = cur.getUTCDay() || 7
      const thu = new Date(cur.getTime() + (4 - day) * 86_400_000)
      const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1))
      const week = Math.ceil(((thu.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
      result.push(`${thu.getUTCFullYear()}W${String(week).padStart(2, '0')}`)
      cur = new Date(cur.getTime() + 7 * 86_400_000)
    }
  } else if (granularity === 'month') {
    let year = parseInt(first)
    let month = parseInt(first.slice(5))
    const endYear = parseInt(last)
    const endMonth = parseInt(last.slice(5))
    while (year < endYear || (year === endYear && month <= endMonth)) {
      result.push(`${year}-${String(month).padStart(2, '0')}`)
      if (++month > 12) { month = 1; year++ }
    }
  } else {
    let year = parseInt(first)
    let q = parseInt(first.slice(5))
    const endYear = parseInt(last)
    const endQ = parseInt(last.slice(5))
    while (year < endYear || (year === endYear && q <= endQ)) {
      result.push(`${year}Q${q}`)
      if (++q > 4) { q = 1; year++ }
    }
  }
  return result
}

function computeWindowResolution(records: FlowRecord[]): WindowResolution {
  const now = Date.now()
  const closedDays: number[] = []
  const closedDaysByRepo: Record<string, number[]> = {}
  const openByRepo: Record<string, number> = {}
  const resolutionMap: Record<ResolutionBucket, Record<string, number>> = {
    '0–1d': {}, '2–7d': {}, '8–30d': {}, '31–90d': {}, '91–365d': {}, '>365d': {},
  }
  const resolutionMapWithOpen: Record<ResolutionBucket, Record<string, number>> = {
    '0–1d': {}, '2–7d': {}, '8–30d': {}, '31–90d': {}, '91–365d': {}, '>365d': {},
  }

  for (const r of records) {
    if (r.closed_at) {
      const days = (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000
      closedDays.push(days)
      ;(closedDaysByRepo[r.repo] ??= []).push(days)
      const rb = classifyResolution(r.created_at, r.closed_at)
      resolutionMap[rb]![r.repo] = (resolutionMap[rb]![r.repo] ?? 0) + 1
      resolutionMapWithOpen[rb]![r.repo] = (resolutionMapWithOpen[rb]![r.repo] ?? 0) + 1
    } else {
      openByRepo[r.repo] = (openByRepo[r.repo] ?? 0) + 1
      const ageDays = (now - new Date(r.created_at).getTime()) / 86_400_000
      const rb = classifyDays(ageDays)
      resolutionMapWithOpen[rb]![r.repo] = (resolutionMapWithOpen[rb]![r.repo] ?? 0) + 1
    }
  }

  closedDays.sort((a, b) => a - b)
  const n = closedDays.length

  const resolutionRows: ResolutionRow[] = RESOLUTION_BUCKETS.map(bucket => {
    const byRepo = resolutionMap[bucket]!
    return { bucket, byRepo, total: Object.values(byRepo).reduce((s, v) => s + v, 0) }
  })

  const resolutionRowsWithOpen: ResolutionRow[] = RESOLUTION_BUCKETS.map(bucket => {
    const byRepo = resolutionMapWithOpen[bucket]!
    return { bucket, byRepo, total: Object.values(byRepo).reduce((s, v) => s + v, 0) }
  })

  const perRepo: Record<string, { medianDays: number | null; p90Days: number | null; totalClosed: number }> = {}
  for (const [repo, days] of Object.entries(closedDaysByRepo)) {
    days.sort((a, b) => a - b)
    const m = days.length
    perRepo[repo] = {
      totalClosed: m,
      medianDays: m > 0 ? (days[Math.floor(m / 2)] ?? null) : null,
      p90Days: m > 0 ? (days[Math.floor(m * 0.9)] ?? null) : null,
    }
  }

  return {
    medianDays: n > 0 ? (closedDays[Math.floor(n / 2)] ?? null) : null,
    p90Days: n > 0 ? (closedDays[Math.floor(n * 0.9)] ?? null) : null,
    totalClosed: n,
    totalOpen: Object.values(openByRepo).reduce((s, v) => s + v, 0),
    openByRepo,
    resolutionRows,
    resolutionRowsWithOpen,
    perRepo,
  }
}

export function computeFlowStats(records: FlowRecord[], granularity: TimeBucket, allRecords?: FlowRecord[]): FlowStats {
  const repos = [...new Set(records.map(r => r.repo))].sort((a, b) => repoDisplayName(a).localeCompare(repoDisplayName(b)))

  const sparseBuckets = new Set<string>()
  for (const r of records) {
    sparseBuckets.add(toBucket(r.created_at, granularity))
    if (r.closed_at) sparseBuckets.add(toBucket(r.closed_at, granularity))
  }
  // Always extend the axis through the current period so the chart reads as "up to today"
  sparseBuckets.add(toBucket(new Date().toISOString(), granularity))
  const sorted = [...sparseBuckets].sort()
  // Fill every period between first and last so the x-axis is evenly spaced with no gaps
  const buckets = sorted.length >= 2 ? fillContiguousBuckets(sorted[0]!, sorted[sorted.length - 1]!, granularity) : sorted

  const openedMap: Record<string, Record<string, number>> = {}
  const closedMap: Record<string, Record<string, number>> = {}
  for (const b of buckets) {
    openedMap[b] = {}
    closedMap[b] = {}
  }

  for (const r of records) {
    const ob = toBucket(r.created_at, granularity)
    openedMap[ob]![r.repo] = (openedMap[ob]![r.repo] ?? 0) + 1
    if (r.closed_at) {
      const cb = toBucket(r.closed_at, granularity)
      closedMap[cb]![r.repo] = (closedMap[cb]![r.repo] ?? 0) + 1
    }
  }

  const flowPoints: FlowPoint[] = []
  for (const bucket of buckets) {
    for (const repo of repos) {
      const opened = openedMap[bucket]![repo] ?? 0
      const closed = closedMap[bucket]![repo] ?? 0
      if (opened > 0 || closed > 0) {
        flowPoints.push({ bucket, repo, opened, closed })
      }
    }
  }

  // Build separate opened/closed maps from allRecords for stock computation.
  // This captures closes of pre-period-opened items that are absent from openedMap/closedMap
  // (which only cover records filtered by created_at for the flow bars).
  const allOpenedMap: Record<string, Record<string, number>> = {}
  const allClosedMap: Record<string, Record<string, number>> = {}
  for (const b of buckets) {
    allOpenedMap[b] = {}
    allClosedMap[b] = {}
  }
  for (const r of (allRecords ?? records)) {
    const ob = toBucket(r.created_at, granularity)
    if (allOpenedMap[ob]) allOpenedMap[ob]![r.repo] = (allOpenedMap[ob]![r.repo] ?? 0) + 1
    if (r.closed_at) {
      const cb = toBucket(r.closed_at, granularity)
      if (allClosedMap[cb]) allClosedMap[cb]![r.repo] = (allClosedMap[cb]![r.repo] ?? 0) + 1
    }
  }

  // Pre-period stock: items opened before the first visible bucket and not yet closed
  const repoPreStock: Record<string, number> = {}
  const firstBucket = buckets[0] ?? ''
  for (const r of (allRecords ?? records)) {
    const ob = toBucket(r.created_at, granularity)
    if (ob >= firstBucket) continue
    repoPreStock[r.repo] = (repoPreStock[r.repo] ?? 0) + 1
    if (r.closed_at && toBucket(r.closed_at, granularity) < firstBucket) {
      repoPreStock[r.repo]!--
    }
  }

  let runningOpen = Object.values(repoPreStock).reduce((s, v) => s + v, 0)
  const stockSeries: StockPoint[] = buckets.map(bucket => {
    const totalOpened = repos.reduce((s, r) => s + (allOpenedMap[bucket]![r] ?? 0), 0)
    const totalClosed = repos.reduce((s, r) => s + (allClosedMap[bucket]![r] ?? 0), 0)
    runningOpen += totalOpened - totalClosed
    return { bucket, openCount: Math.max(0, runningOpen) }
  })

  const repoStockSeries: Record<string, StockPoint[]> = {}
  for (const repo of repos) {
    let repoOpen = repoPreStock[repo] ?? 0
    repoStockSeries[repo] = buckets.map(bucket => {
      repoOpen += (allOpenedMap[bucket]![repo] ?? 0) - (allClosedMap[bucket]![repo] ?? 0)
      return { bucket, openCount: Math.max(0, repoOpen) }
    })
  }

  const resolutionMap: Record<ResolutionBucket, Record<string, number>> = {
    '0–1d': {}, '2–7d': {}, '8–30d': {}, '31–90d': {}, '91–365d': {}, '>365d': {},
  }
  const closedDays: number[] = []
  const closedDaysByRepo: Record<string, number[]> = {}

  for (const r of records) {
    if (!r.closed_at) continue
    const days = (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000
    closedDays.push(days)
    ;(closedDaysByRepo[r.repo] ??= []).push(days)
    const rb = classifyResolution(r.created_at, r.closed_at)
    resolutionMap[rb]![r.repo] = (resolutionMap[rb]![r.repo] ?? 0) + 1
  }

  const resolutionRows: ResolutionRow[] = RESOLUTION_BUCKETS.map(bucket => {
    const byRepo = resolutionMap[bucket]!
    return { bucket, byRepo, total: Object.values(byRepo).reduce((s, v) => s + v, 0) }
  })

  closedDays.sort((a, b) => a - b)
  const totalClosed = closedDays.length
  const medianDays = totalClosed > 0 ? (closedDays[Math.floor(totalClosed / 2)] ?? null) : null
  const p90Days = totalClosed > 0 ? (closedDays[Math.floor(totalClosed * 0.9)] ?? null) : null

  const perRepo: Record<string, RepoResolution> = {}
  for (const repo of repos) {
    const days = (closedDaysByRepo[repo] ?? []).sort((a, b) => a - b)
    const n = days.length
    perRepo[repo] = {
      totalClosed: n,
      medianDays: n > 0 ? (days[Math.floor(n / 2)] ?? null) : null,
      p90Days: n > 0 ? (days[Math.floor(n * 0.9)] ?? null) : null,
    }
  }

  return { repos, flowPoints, stockSeries, repoStockSeries, resolutionRows, medianDays, p90Days, totalClosed, perRepo }
}

// Raw API shapes — only the fields we need
interface RawIssue { repo: string; created_at: string; closed_at: string | null }
interface RawPR { repo: string; created_at: string; merged_at: string | null }

function toFlowRecords(kind: FlowKind, data: unknown[]): FlowRecord[] {
  if (kind === 'prs') {
    return (data as RawPR[]).map(r => ({ repo: r.repo, created_at: r.created_at, closed_at: r.merged_at }))
  }
  return (data as RawIssue[]).map(r => ({ repo: r.repo, created_at: r.created_at, closed_at: r.closed_at }))
}

function timespanCutoff(timespan: FlowTimespan): Date | null {
  if (timespan === 'all') return null
  const months = timespan === '12mo' ? 12 : timespan === '6mo' ? 6 : timespan === '3mo' ? 3 : 1
  const d = new Date()
  d.setMonth(d.getMonth() - months)
  return d
}

export function useFlowStats(kind: FlowKind) {
  const { dataBase } = useDataSource()
  const granularity = ref<TimeBucket>('week')
  const timespan = ref<FlowTimespan>('12mo')
  const repoSet = ref<RepoSet>('core')

  const { data: rawData, pending } = useAsyncData<FlowRecord[]>(
    () => `flow:${kind}:${dataBase.value}`,
    async () => {
      const raw = await $fetch<unknown[]>(`${dataBase.value}/${kind}.json`, { responseType: 'json' })
      return toFlowRecords(kind, raw)
    },
  )

  // Full repo list from unfiltered data — used for chip display and stable color mapping
  const allRepos = computed<string[]>(() => {
    if (!rawData.value) return []
    const all = [...new Set(rawData.value.map(r => r.repo))].sort(
      (a, b) => repoDisplayName(a).localeCompare(repoDisplayName(b)))
    if (repoSet.value === 'admin') return all.filter(r => ADMIN_REPOS.has(r) && !ARCHIVED_REPOS.has(r))
    if (repoSet.value === 'archived') return all.filter(r => ARCHIVED_REPOS.has(r))
    return all.filter(r => !ADMIN_REPOS.has(r) && !ARCHIVED_REPOS.has(r))
  })

  const selectedRepos = ref<Set<string>>(new Set())
  const initialized = ref(false)

  watch(allRepos, repos => {
    if (repos.length > 0 && !initialized.value) {
      selectedRepos.value = new Set(repos)
      initialized.value = true
    }
  }, { immediate: true })

  watch(repoSet, () => {
    if (allRepos.value.length > 0) {
      selectedRepos.value = new Set(allRepos.value)
    }
    initialized.value = false  // allow re-init if data is re-fetched after a set change
  })

  const timespanFiltered = computed<FlowRecord[]>(() => {
    if (!rawData.value) return []
    const cutoff = timespanCutoff(timespan.value)
    if (!cutoff) return rawData.value
    return rawData.value.filter(r => new Date(r.created_at) >= cutoff)
  })

  const stats = computed<FlowStats | null>(() => {
    if (timespanFiltered.value.length === 0) return null
    const filtered = timespanFiltered.value.filter(r => selectedRepos.value.has(r.repo))
    const allSelected = (rawData.value ?? []).filter(r => selectedRepos.value.has(r.repo))
    return computeFlowStats(filtered, granularity.value, allSelected)
  })

  const allStats = computed<FlowStats | null>(() => {
    if (timespanFiltered.value.length === 0) return null
    return computeFlowStats(timespanFiltered.value, granularity.value)
  })

  const resolutionWindows = computed<Record<ResolutionWindow, WindowResolution | null>>(() => {
    if (!rawData.value) return Object.fromEntries(RESOLUTION_WINDOWS.map(w => [w, null])) as Record<ResolutionWindow, WindowResolution | null>
    const result = {} as Record<ResolutionWindow, WindowResolution | null>
    for (const w of RESOLUTION_WINDOWS) {
      const cutoff = w === 'all' ? null : timespanCutoff(w as FlowTimespan)
      const filtered = (cutoff
        ? rawData.value.filter(r => new Date(r.created_at) >= cutoff)
        : rawData.value
      ).filter(r => selectedRepos.value.has(r.repo))
      result[w] = filtered.length > 0 ? computeWindowResolution(filtered) : null
    }
    return result
  })

  function toggleRepo(repo: string) {
    const next = new Set(selectedRepos.value)
    if (next.has(repo)) next.delete(repo)
    else next.add(repo)
    selectedRepos.value = next
  }

  return { stats, allStats, allRepos, granularity, timespan, repoSet, selectedRepos, toggleRepo, isLoading: pending, resolutionWindows }
}
