import { toYearMonth } from './useTimeBuckets'

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
  const { public: { dataBase } } = useRuntimeConfig()

  const { data: repos } = useFetch<RepoCardData[]>(`${dataBase}/repos.json`)
  const { data: commits } = useFetch<Array<{ author_date: string; repo: string }>>(`${dataBase}/commits.json`)
  const { data: prs } = useFetch<Array<{ merged_at: string | null; repo: string }>>(`${dataBase}/prs.json`)
  const { data: contributors } = useFetch<Array<{ login: string }>>(`${dataBase}/contributors.json`)

  const months = last12Months()
  const monthSet = new Set(months)

  const orgSummary = computed<OrgSummary | null>(() => {
    if (!repos.value || !contributors.value) return null
    return {
      totalStars: repos.value.reduce((s, r) => s + r.stargazers_count, 0),
      uniqueContributors: contributors.value.length,
      openIssues: repos.value.reduce((s, r) => s + r.open_issues_count, 0),
      openPRs: repos.value.reduce((s, r) => s + r.open_pr_count, 0),
    }
  })

  const repoCards = computed<RepoCardData[]>(() => {
    if (!repos.value || !commits.value || !prs.value) return []

    const activity: Record<string, Record<string, number>> = {}

    for (const c of commits.value) {
      const m = toYearMonth(c.author_date)
      if (!monthSet.has(m)) continue
      if (!activity[c.repo]) activity[c.repo] = {}
      const rm = activity[c.repo]!
      rm[m] = (rm[m] ?? 0) + 1
    }

    for (const p of prs.value) {
      if (!p.merged_at) continue
      const m = toYearMonth(p.merged_at)
      if (!monthSet.has(m)) continue
      if (!activity[p.repo]) activity[p.repo] = {}
      const rm = activity[p.repo]!
      rm[m] = (rm[m] ?? 0) + 1
    }

    return [...repos.value]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .map(r => ({
        ...r,
        sparkline: months.map(m => activity[r.name]?.[m] ?? 0),
      }))
  })

  const isLoading = computed(
    () => !repos.value || !commits.value || !prs.value || !contributors.value,
  )

  return { orgSummary, repoCards, isLoading }
}
