/**
 * Aggregates contributor activity counts from raw event files.
 * contributors.json only carries identity (login, avatar_url, first_contribution_at);
 * all counts are derived here so the collector stays free of UI-coupled aggregations.
 */

export interface ContributorCounts {
  commits: number
  issues_opened: number
  prs_opened: number
  reviews_submitted: number
}

export interface ContributorStats {
  login: string
  avatar_url: string
  first_contribution_at: string
  all_time: ContributorCounts
  by_repo: Record<string, ContributorCounts>
}

function emptyCounts(): ContributorCounts {
  return { commits: 0, issues_opened: 0, prs_opened: 0, reviews_submitted: 0 }
}

function getOrInit(map: Record<string, ContributorCounts>, key: string): ContributorCounts {
  if (!map[key]) map[key] = emptyCounts()
  return map[key]
}

export function useContributorStats(
  contributors: Array<{ login: string; avatar_url: string; first_contribution_at: string }>,
  issues: Array<{ author_login: string | null; repo: string }>,
  prs: Array<{ author_login: string | null; repo: string }>,
  commits: Array<{ author_login: string | null; repo: string }>,
  reviews: Array<{ reviewer_login: string | null; repo: string }>,
): ContributorStats[] {
  const statsMap: Record<string, { all_time: ContributorCounts; by_repo: Record<string, ContributorCounts> }> = {}

  function tally(login: string | null, repo: string, type: keyof ContributorCounts) {
    if (!login) return
    if (!statsMap[login]) statsMap[login] = { all_time: emptyCounts(), by_repo: {} }
    statsMap[login].all_time[type]++
    getOrInit(statsMap[login].by_repo, repo)[type]++
  }

  for (const i of issues) tally(i.author_login, i.repo, 'issues_opened')
  for (const p of prs) tally(p.author_login, p.repo, 'prs_opened')
  for (const c of commits) tally(c.author_login, c.repo, 'commits')
  for (const r of reviews) tally(r.reviewer_login, r.repo, 'reviews_submitted')

  return contributors.map(c => ({
    ...c,
    all_time: statsMap[c.login]?.all_time ?? emptyCounts(),
    by_repo: statsMap[c.login]?.by_repo ?? {},
  }))
}
