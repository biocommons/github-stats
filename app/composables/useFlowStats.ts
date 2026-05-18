import { toBucket, type TimeBucket } from './useTimeBuckets'

export type FlowKind = 'issues' | 'prs'

// Normalized shape shared by issues and PRs
interface FlowRecord {
  repo: string
  created_at: string
  closed_at: string | null
}

export const RESOLUTION_BUCKETS = ['0–1d', '2–7d', '8–30d', '31–90d', '91–365d', '>365d'] as const
export type ResolutionBucket = (typeof RESOLUTION_BUCKETS)[number]

function classifyResolution(createdAt: string, closedAt: string): ResolutionBucket {
  const days = (new Date(closedAt).getTime() - new Date(createdAt).getTime()) / 86_400_000
  if (days <= 1) return '0–1d'
  if (days <= 7) return '2–7d'
  if (days <= 30) return '8–30d'
  if (days <= 90) return '31–90d'
  if (days <= 365) return '91–365d'
  return '>365d'
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

export interface FlowStats {
  repos: string[]
  flowPoints: FlowPoint[]
  stockSeries: StockPoint[]
  resolutionRows: ResolutionRow[]
  medianDays: number | null
  p90Days: number | null
  totalClosed: number
}

function fillContiguousBuckets(first: string, last: string, granularity: TimeBucket): string[] {
  const result: string[] = []
  if (granularity === 'month') {
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

export function computeFlowStats(records: FlowRecord[], granularity: TimeBucket): FlowStats {
  const repos = [...new Set(records.map(r => r.repo))].sort()

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

  let runningOpen = 0
  const stockSeries: StockPoint[] = buckets.map(bucket => {
    const totalOpened = repos.reduce((s, r) => s + (openedMap[bucket]![r] ?? 0), 0)
    const totalClosed = repos.reduce((s, r) => s + (closedMap[bucket]![r] ?? 0), 0)
    runningOpen += totalOpened - totalClosed
    return { bucket, openCount: Math.max(0, runningOpen) }
  })

  const resolutionMap: Record<ResolutionBucket, Record<string, number>> = {
    '0–1d': {}, '2–7d': {}, '8–30d': {}, '31–90d': {}, '91–365d': {}, '>365d': {},
  }
  const closedDays: number[] = []

  for (const r of records) {
    if (!r.closed_at) continue
    const days = (new Date(r.closed_at).getTime() - new Date(r.created_at).getTime()) / 86_400_000
    closedDays.push(days)
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

  return { repos, flowPoints, stockSeries, resolutionRows, medianDays, p90Days, totalClosed }
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

export function useFlowStats(kind: FlowKind) {
  const { dataBase } = useDataSource()
  const granularity = ref<TimeBucket>('month')

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
    return [...new Set(rawData.value.map(r => r.repo))].sort()
  })

  const selectedRepos = ref<Set<string>>(new Set())
  const initialized = ref(false)

  watch(allRepos, repos => {
    if (repos.length > 0 && !initialized.value) {
      selectedRepos.value = new Set(repos)
      initialized.value = true
    }
  }, { immediate: true })

  const stats = computed<FlowStats | null>(() => {
    if (!rawData.value || rawData.value.length === 0) return null
    const filtered = rawData.value.filter(r => selectedRepos.value.has(r.repo))
    return computeFlowStats(filtered, granularity.value)
  })

  function toggleRepo(repo: string) {
    const next = new Set(selectedRepos.value)
    if (next.has(repo)) next.delete(repo)
    else next.add(repo)
    selectedRepos.value = next
  }

  return { stats, allRepos, granularity, selectedRepos, toggleRepo, isLoading: pending }
}
