import { toYearMonth, relativeTime } from './useTimeBuckets'

export interface OrgSummary {
  totalStars: number
  uniqueContributors: number
  openIssues: number
  openPRs: number
}

export interface RepoCardData {
  name: string
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  forks_count: number
  open_issues_count: number
  open_pr_count: number
  contributors: number
  latest_release: { tag_name: string; published_at: string } | null
  sparkline: number[]
}

interface RawCommit { author_date: string; repo: string }
interface RawPR { merged_at: string | null; repo: string }
interface RawContributor { login: string }
interface RawMeta { collected_at: string }

interface RawData {
  repos: RepoCardData[]
  commits: RawCommit[]
  prs: RawPR[]
  contributors: RawContributor[]
  meta: RawMeta
}

function last12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    months.push(toYearMonth(d.toISOString()))
  }
  return months
}

export function useOverviewData() {
  const { dataBase } = useDataSource()

  const { data, pending } = useAsyncData<RawData>(
    () => `overview:${dataBase.value}`,
    async () => {
      const base = dataBase.value
      const opts = { responseType: 'json' as const }
      const [repos, commits, prs, contributors, meta] = await Promise.all([
        $fetch<RepoCardData[]>(`${base}/repos.json`, opts),
        $fetch<RawCommit[]>(`${base}/commits.json`, opts),
        $fetch<RawPR[]>(`${base}/prs.json`, opts),
        $fetch<RawContributor[]>(`${base}/contributors.json`, opts),
        $fetch<RawMeta>(`${base}/meta.json`, opts),
      ])
      return { repos, commits, prs, contributors, meta }
    },
  )

  const months = last12Months()
  const monthSet = new Set(months)

  const orgSummary = computed<OrgSummary | null>(() => {
    if (!data.value) return null
    const { repos, contributors } = data.value
    return {
      totalStars: repos.reduce((s, r) => s + r.stargazers_count, 0),
      uniqueContributors: contributors.length,
      openIssues: repos.reduce((s, r) => s + r.open_issues_count, 0),
      openPRs: repos.reduce((s, r) => s + r.open_pr_count, 0),
    }
  })

  const repoCards = computed<RepoCardData[]>(() => {
    if (!data.value) return []
    const { repos, commits, prs } = data.value
    const activity: Record<string, Record<string, number>> = {}

    for (const c of commits) {
      const m = toYearMonth(c.author_date)
      if (!monthSet.has(m)) continue
      if (!activity[c.repo]) activity[c.repo] = {}
      const rm = activity[c.repo]!
      rm[m] = (rm[m] ?? 0) + 1
    }

    for (const p of prs) {
      if (!p.merged_at) continue
      const m = toYearMonth(p.merged_at)
      if (!monthSet.has(m)) continue
      if (!activity[p.repo]) activity[p.repo] = {}
      const rm = activity[p.repo]!
      rm[m] = (rm[m] ?? 0) + 1
    }

    return [...repos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .map(r => ({
        ...r,
        sparkline: months.map(m => activity[r.name]?.[m] ?? 0),
      }))
  })

  const collectedAt = computed(() => data.value?.meta.collected_at ?? null)

  return { orgSummary, repoCards, isLoading: pending, collectedAt, relativeTime }
}
