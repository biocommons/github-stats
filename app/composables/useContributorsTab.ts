import { toYearMonth } from './useTimeBuckets'
import { useContributorStats, type ContributorCounts } from './useContributorStats'
import { repoDisplayName } from '~/config'

export type ContribTimespan = 'all' | '90d' | '30d'

export interface ContributorRow {
  login: string
  avatar_url: string
  first_contribution_at: string
  sparkline: number[]
  isNew: boolean
  isTop: boolean
  isAnonymous: boolean
  total: ContributorCounts
  byRepo: Record<string, ContributorCounts>
  totalCount: number
}

export interface ContributorTabData {
  rows: ContributorRow[]
  repos: string[]
  colMaxes: Record<string, ContributorCounts>
}

interface RawContributor { login: string; avatar_url: string; first_contribution_at: string }
interface RawIssue { author_login: string | null; repo: string; created_at: string }
interface RawPR { author_login: string | null; repo: string; created_at: string }
interface RawCommit { author_login: string | null; repo: string; author_date: string }
interface RawReview { reviewer_login: string | null; repo: string; submitted_at: string }

interface RawData {
  contributors: RawContributor[]
  issues: RawIssue[]
  prs: RawPR[]
  commits: RawCommit[]
  reviews: RawReview[]
}

function emptyCounts(): ContributorCounts {
  return { commits: 0, issues_opened: 0, prs_opened: 0, reviews_submitted: 0 }
}

function countTotal(c: ContributorCounts): number {
  return c.commits + c.issues_opened + c.prs_opened + c.reviews_submitted
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

function computeColMaxes(
  rows: ReturnType<typeof useContributorStats>,
  repos: string[],
): Record<string, ContributorCounts> {
  const maxes: Record<string, ContributorCounts> = {}
  const keys: (keyof ContributorCounts)[] = ['commits', 'issues_opened', 'prs_opened', 'reviews_submitted']

  maxes['total'] = emptyCounts()
  for (const s of rows) {
    for (const k of keys) maxes['total']![k] = Math.max(maxes['total']![k], s.all_time[k])
  }

  for (const repo of repos) {
    maxes[repo] = emptyCounts()
    for (const s of rows) {
      const rc = s.by_repo[repo] ?? emptyCounts()
      for (const k of keys) maxes[repo]![k] = Math.max(maxes[repo]![k], rc[k])
    }
  }

  return maxes
}

export function useContributorsTab() {
  const { dataBase } = useDataSource()
  const timespan = ref<ContribTimespan>('all')

  const { data: rawData, pending } = useAsyncData<RawData>(
    () => `contributors-tab:${dataBase.value}`,
    async () => {
      const base = dataBase.value
      const opts = { responseType: 'json' as const }
      const [contributors, issues, prs, commits, reviews] = await Promise.all([
        $fetch<RawContributor[]>(`${base}/contributors.json`, opts),
        $fetch<RawIssue[]>(`${base}/issues.json`, opts),
        $fetch<RawPR[]>(`${base}/prs.json`, opts),
        $fetch<RawCommit[]>(`${base}/commits.json`, opts),
        $fetch<RawReview[]>(`${base}/reviews.json`, opts),
      ])
      return { contributors, issues, prs, commits, reviews }
    },
  )

  const tabData = computed<ContributorTabData | null>(() => {
    if (!rawData.value) return null
    const { contributors, issues, prs, commits, reviews } = rawData.value

    const months = last12Months()
    const monthSet = new Set(months)

    // Stable repo list from all events
    const repos = [...new Set([
      ...issues.map(r => r.repo),
      ...prs.map(r => r.repo),
      ...commits.map(r => r.repo),
      ...reviews.map(r => r.repo),
    ])].sort((a, b) => repoDisplayName(a).localeCompare(repoDisplayName(b)))

    // All-time stats for badge eligibility (3+ contributions ever)
    const allTimeStats = useContributorStats(contributors, issues, prs, commits, reviews)
    const allTimeCountMap = new Map(allTimeStats.map(s => [s.login, countTotal(s.all_time)]))

    // Timespan-filtered stats for table display and sort
    const cutoff = timespan.value === 'all'
      ? null
      : new Date(Date.now() - (timespan.value === '90d' ? 90 : 30) * 86_400_000)

    function afterCutoff(date: string): boolean {
      return cutoff === null || new Date(date) >= cutoff
    }

    const filteredStats = timespan.value === 'all'
      ? allTimeStats
      : useContributorStats(
          contributors,
          issues.filter(r => afterCutoff(r.created_at)),
          prs.filter(r => afterCutoff(r.created_at)),
          commits.filter(r => afterCutoff(r.author_date)),
          reviews.filter(r => afterCutoff(r.submitted_at)),
        )

    // Sort by filtered totalCount desc to find top contributors
    const withCounts = filteredStats.map(s => ({ ...s, totalCount: countTotal(s.all_time) }))
    withCounts.sort((a, b) => b.totalCount - a.totalCount)
    const topLogins = new Set(withCounts.filter(s => s.totalCount > 0).slice(0, 3).map(s => s.login))

    // Anonymous counts: null-login events in filtered data, aggregated by repo
    const anonTotal = emptyCounts()
    const anonByRepo: Record<string, ContributorCounts> = {}
    function tallyAnon(login: string | null, repo: string, key: keyof ContributorCounts) {
      if (login !== null) return
      anonTotal[key]++
      if (!anonByRepo[repo]) anonByRepo[repo] = emptyCounts()
      anonByRepo[repo]![key]++
    }
    for (const r of commits.filter(r => afterCutoff(r.author_date))) tallyAnon(r.author_login, r.repo, 'commits')
    for (const r of issues.filter(r => afterCutoff(r.created_at))) tallyAnon(r.author_login, r.repo, 'issues_opened')
    for (const r of prs.filter(r => afterCutoff(r.created_at))) tallyAnon(r.author_login, r.repo, 'prs_opened')
    for (const r of reviews.filter(r => afterCutoff(r.submitted_at))) tallyAnon(r.reviewer_login, r.repo, 'reviews_submitted')

    const colMaxes = computeColMaxes(filteredStats, repos)

    // Include anonymous counts in normalization so shading is comparable across all rows
    const countKeys: (keyof ContributorCounts)[] = ['commits', 'issues_opened', 'prs_opened', 'reviews_submitted']
    for (const k of countKeys) colMaxes['total']![k] = Math.max(colMaxes['total']![k], anonTotal[k])
    for (const repo of repos) {
      const ac = anonByRepo[repo] ?? emptyCounts()
      for (const k of countKeys) colMaxes[repo]![k] = Math.max(colMaxes[repo]![k], ac[k])
    }

    // Sparklines always show last 12 months regardless of timespan filter
    const sparkMap: Record<string, Record<string, number>> = {}
    const anonSparkMap: Record<string, number> = {}
    function addSpark(login: string | null, month: string) {
      if (!monthSet.has(month)) return
      if (login === null) {
        anonSparkMap[month] = (anonSparkMap[month] ?? 0) + 1
        return
      }
      if (!sparkMap[login]) sparkMap[login] = {}
      sparkMap[login]![month] = (sparkMap[login]![month] ?? 0) + 1
    }
    for (const r of issues) addSpark(r.author_login, toYearMonth(r.created_at))
    for (const r of prs) addSpark(r.author_login, toYearMonth(r.created_at))
    for (const r of commits) addSpark(r.author_login, toYearMonth(r.author_date))
    for (const r of reviews) addSpark(r.reviewer_login, toYearMonth(r.submitted_at))

    const now = Date.now()

    const rows: ContributorRow[] = withCounts
      .filter(s => s.totalCount > 0 || timespan.value === 'all')
      .map(s => {
        const daysOld = (now - new Date(s.first_contribution_at).getTime()) / 86_400_000
        const allTimeCount = allTimeCountMap.get(s.login) ?? 0
        return {
          login: s.login,
          avatar_url: s.avatar_url,
          first_contribution_at: s.first_contribution_at,
          sparkline: months.map(m => sparkMap[s.login]?.[m] ?? 0),
          isNew: daysOld < 90 && allTimeCount >= 3,
          isTop: topLogins.has(s.login),
          isAnonymous: false,
          total: s.all_time,
          byRepo: s.by_repo,
          totalCount: s.totalCount,
        }
      })

    const anonCount = countTotal(anonTotal)
    if (anonCount > 0) {
      rows.push({
        login: '(anonymous)',
        avatar_url: '',
        first_contribution_at: '',
        sparkline: months.map(m => anonSparkMap[m] ?? 0),
        isNew: false,
        isTop: false,
        isAnonymous: true,
        total: anonTotal,
        byRepo: anonByRepo,
        totalCount: anonCount,
      })
    }

    return { rows, repos, colMaxes }
  })

  return { tabData, timespan, isLoading: pending }
}
