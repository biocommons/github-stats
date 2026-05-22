import { useContributorStats, type ContributorCounts } from './useContributorStats'
import { type FlowTimespan } from './useFlowStats'
import {
  repoDisplayName, CONTRIBUTOR_EXCLUDE,
  ADMIN_REPOS,
  META_REPO_ADMIN, META_REPO_CORE, META_REPO_ARCHIVED,
} from '~/config'

export type ContribTimespan = FlowTimespan

export interface ContributorRow {
  login: string
  avatar_url: string
  first_contribution_at: string
  last_activity_at: string
  isNew: boolean
  isTop: boolean
  isAnonymous: boolean
  expertRepos: Set<string>
  total: ContributorCounts
  byRepo: Record<string, ContributorCounts>
  totalCount: number
}

export interface RepoSetInfo {
  key: string
  label: string
  metaKey: string
  repos: string[]
}

export interface ContributorTabData {
  rows: ContributorRow[]
  repoSets: RepoSetInfo[]
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


function aggregateCounts(
  byRepo: Record<string, ContributorCounts>,
  repos: string[],
): ContributorCounts {
  const total = emptyCounts()
  const keys: (keyof ContributorCounts)[] = ['commits', 'issues_opened', 'prs_opened', 'reviews_submitted']
  for (const repo of repos) {
    const rc = byRepo[repo]
    if (!rc) continue
    for (const k of keys) total[k] += rc[k]
  }
  return total
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
  const timespan = ref<ContribTimespan>('12mo')

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

  const { data: repoMeta } = useAsyncData<Set<string>>(
    () => `repos:${dataBase.value}`,
    async () => {
      const repos = await $fetch<{ name: string; archived: boolean }[]>(`${dataBase.value}/repos.json`, { responseType: 'json' })
      return new Set(repos.filter(r => r.archived).map(r => r.name))
    },
  )

  function isExcluded(login: string | null): boolean {
    return login !== null && CONTRIBUTOR_EXCLUDE.some(re => re.test(login))
  }

  const tabData = computed<ContributorTabData | null>(() => {
    if (!rawData.value) return null
    const { contributors: rawContributors, issues: rawIssues, prs: rawPRs, commits: rawCommits, reviews: rawReviews } = rawData.value
    const contributors = rawContributors.filter(c => !isExcluded(c.login))
    const issues = rawIssues.filter(r => !isExcluded(r.author_login))
    const prs = rawPRs.filter(r => !isExcluded(r.author_login))
    const commits = rawCommits.filter(r => !isExcluded(r.author_login))
    const reviews = rawReviews.filter(r => !isExcluded(r.reviewer_login))

    // All repos present in any event
    const allEventRepos = [...new Set([
      ...issues.map(r => r.repo),
      ...prs.map(r => r.repo),
      ...commits.map(r => r.repo),
      ...reviews.map(r => r.repo),
    ])].sort((a, b) => repoDisplayName(a).localeCompare(repoDisplayName(b)))

    const archived = repoMeta.value ?? new Set<string>()
    const coreRepos     = allEventRepos.filter(r => !ADMIN_REPOS.has(r) && !archived.has(r))
    const adminRepos    = allEventRepos.filter(r => ADMIN_REPOS.has(r) && !archived.has(r))
    const archivedRepos = allEventRepos.filter(r => archived.has(r))

    const repoSetInfos: RepoSetInfo[] = [
      { key: 'core',     label: 'Core',     metaKey: META_REPO_CORE,     repos: coreRepos },
      { key: 'admin',    label: 'Admin',    metaKey: META_REPO_ADMIN,    repos: adminRepos },
      { key: 'archived', label: 'Archived', metaKey: META_REPO_ARCHIVED, repos: archivedRepos },
    ]

    // All-time stats (all repos, all time) — for Total column + badge eligibility
    const allTimeStats = useContributorStats(contributors, issues, prs, commits, reviews)
    const allTimeCountMap = new Map(allTimeStats.map(s => [s.login, countTotal(s.all_time)]))

    // Timespan-filtered stats — for per-repo column display and sort
    const cutoff = (() => {
      if (timespan.value === 'all') return null
      const months = timespan.value === '12mo' ? 12 : timespan.value === '6mo' ? 6 : timespan.value === '3mo' ? 3 : 1
      const d = new Date()
      d.setMonth(d.getMonth() - months)
      return d
    })()

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

    const setDefs = repoSetInfos

    // Inject meta columns into each contributor's byRepo (both filtered and all-time)
    for (const s of filteredStats) {
      for (const { metaKey, repos } of setDefs) {
        s.by_repo[metaKey] = aggregateCounts(s.by_repo, repos)
      }
    }
    // Only inject into allTimeStats if it's a separate object from filteredStats
    if (timespan.value !== 'all') {
      for (const s of allTimeStats) {
        for (const { metaKey, repos } of setDefs) {
          s.by_repo[metaKey] = aggregateCounts(s.by_repo, repos)
        }
      }
    }

    const allIndividualRepos = [...coreRepos, ...adminRepos, ...archivedRepos]
    const allMetaKeys = [META_REPO_CORE, META_REPO_ADMIN, META_REPO_ARCHIVED]
    const displayRepos = [...allIndividualRepos, ...allMetaKeys]

    // Sort by all-time totalCount desc
    const withCounts = filteredStats.map(s => ({ ...s, totalCount: countTotal(s.all_time) }))
    withCounts.sort((a, b) => b.totalCount - a.totalCount)
    const topLogins = new Set(withCounts.filter(s => s.totalCount > 0).slice(0, 3).map(s => s.login))

    // Anonymous counts: null-login events, aggregated by repo + meta
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
    for (const { metaKey, repos } of setDefs) {
      anonByRepo[metaKey] = aggregateCounts(anonByRepo, repos)
    }

    const colMaxes = computeColMaxes(filteredStats, displayRepos)
    const countKeys: (keyof ContributorCounts)[] = ['commits', 'issues_opened', 'prs_opened', 'reviews_submitted']
    for (const k of countKeys) colMaxes['total']![k] = Math.max(colMaxes['total']![k], anonTotal[k])
    for (const repo of displayRepos) {
      const ac = anonByRepo[repo] ?? emptyCounts()
      for (const k of countKeys) colMaxes[repo]![k] = Math.max(colMaxes[repo]![k], ac[k])
    }

    // Last activity date per login
    const lastActivityMap: Record<string, string> = {}
    function trackLast(login: string | null, date: string) {
      if (!login) return
      if (!lastActivityMap[login] || date > lastActivityMap[login]!) lastActivityMap[login] = date
    }
    for (const r of issues) trackLast(r.author_login, r.created_at)
    for (const r of prs) trackLast(r.author_login, r.created_at)
    for (const r of commits) trackLast(r.author_login, r.author_date)
    for (const r of reviews) trackLast(r.reviewer_login, r.submitted_at)

    // Pareto 80% expertise — covers all repos and meta keys
    const expertMap = new Map<string, Set<string>>()
    for (const repo of displayRepos) {
      const ranked = allTimeStats
        .map(s => ({ login: s.login, count: countTotal(s.by_repo[repo] ?? emptyCounts()) }))
        .filter(c => c.count > 0)
        .sort((a, b) => b.count - a.count)
      const repoTotal = ranked.reduce((sum, c) => sum + c.count, 0)
      if (repoTotal === 0) continue
      let cumulative = 0
      for (const c of ranked) {
        if (!expertMap.has(c.login)) expertMap.set(c.login, new Set())
        expertMap.get(c.login)!.add(repo)
        cumulative += c.count
        if (cumulative / repoTotal >= 0.8) break
      }
    }

    const now = Date.now()

    // Determine eligible logins using all-time data (not timespan-filtered)
    const activeSetLogins = new Set(
      allTimeStats
        .filter(s => countTotal(s.all_time) > 0)
        .map(s => s.login)
    )

    const rows: ContributorRow[] = withCounts
      .filter(s => activeSetLogins.has(s.login) && (
        cutoff === null || new Date(lastActivityMap[s.login] ?? s.first_contribution_at) >= cutoff
      ))
      .map(s => {
        const daysOld = (now - new Date(s.first_contribution_at).getTime()) / 86_400_000
        const allTimeCount = allTimeCountMap.get(s.login) ?? 0
        return {
          login: s.login,
          avatar_url: s.avatar_url,
          first_contribution_at: s.first_contribution_at,
          last_activity_at: lastActivityMap[s.login] ?? s.first_contribution_at,
          isNew: daysOld < 90 && allTimeCount >= 3,
          isTop: topLogins.has(s.login),
          isAnonymous: false,
          expertRepos: expertMap.get(s.login) ?? new Set<string>(),
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
        last_activity_at: '',
        isNew: false,
        isTop: false,
        isAnonymous: true,
        expertRepos: new Set<string>(),
        total: anonTotal,
        byRepo: anonByRepo,
        totalCount: anonCount,
      })
    }

    return { rows, repoSets: repoSetInfos, colMaxes }
  })

  return { tabData, timespan, isLoading: pending }
}
