# Core / Admin Repo Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add admin/infrastructure repos to the dashboard as a secondary set, visible on all pages without crowding the core bioinformatics library view.

**Architecture:** `ADMIN_REPOS` in `config.ts` drives the split. All pages add a `?set=core|admin` URL param. The collector adds `private`/`archived` flags to `repos.json`. The Contributors tab uses synthetic `__admin__`/`__core__` column keys to pool the "other" set into one meta-column.

**Tech Stack:** Vue 3 Composition API, Nuxt 3, TypeScript, Tailwind CSS, Python (collect.py)

---

## File Map

| File | Change |
|------|--------|
| `scripts/collect.py` | Add admin repos to REPOS_TO_COLLECT; write `private`/`archived` to repos.json |
| `app/config.ts` | Add `ADMIN_REPOS`, `META_REPO_ADMIN`, `META_REPO_CORE` |
| `app/composables/useOverviewData.ts` | Add `private`/`archived` to `RepoCardData`; split `coreRepoCards`/`adminRepoCards`; filter orgSummary to core |
| `app/components/RepoCard.vue` | Render `fa-lock` for private repos; render "archived" badge |
| `app/pages/overview.vue` | Add "Infrastructure & Meta" section below core grid |
| `app/composables/useFlowStats.ts` | Add `repoSet` ref; filter `allRepos` by set; reset `selectedRepos` on set change |
| `app/pages/issues.vue` | Add `?set=` URL sync + Core\|Admin pill toggle |
| `app/pages/prs.vue` | Same as issues.vue |
| `app/composables/useContributorsTab.ts` | Add `repoSet` ref; compute meta column; filter rows to active set |
| `app/components/ContributorTable.vue` | Add Core\|Admin pill toggle; URL sync `?set=`; render meta column with distinct style |

---

## Task 1: collect.py — admin repos + private/archived fields

**Files:**
- Modify: `scripts/collect.py`

- [ ] **Step 1: Expand REPOS_TO_COLLECT**

Replace the existing list (lines ~23–27) with:

```python
REPOS_TO_COLLECT = [
    "anyvar",
    "biocommons.seqrepo",
    "bioutils",
    "hgvs",
    "uta",
    # administrative / infrastructure
    "infra",
    "biocommons.github.org",
    "github-stats",
    ".github",
    "eutils",
]
```

- [ ] **Step 2: Write private + archived into repos.json**

In `fetch_repo` (around line 317), inside `self.repos.append({...})`, add two fields after `"default_branch"`:

```python
                "private": repo_data["private"],
                "archived": repo_data.get("archived", False),
```

The full dict should end with:
```python
                "default_branch": repo_data["default_branch"],
                "private": repo_data["private"],
                "archived": repo_data.get("archived", False),
```

- [ ] **Step 3: Verify the change runs without error**

```bash
cd /home/reece/projects/biocommons/github-stats
python scripts/collect.py --help
```

Expected: help text prints, no import errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/collect.py
git commit -m "feat(collect): add admin repos and private/archived fields to repos.json"
```

---

## Task 2: config.ts — ADMIN_REPOS + meta column keys

**Files:**
- Modify: `app/config.ts`

- [ ] **Step 1: Add ADMIN_REPOS set and meta column constants**

Add after the existing `CONTRIBUTOR_EXCLUDE` block:

```ts
export const ADMIN_REPOS = new Set([
  'infra',
  'biocommons.github.org',
  'github-stats',
  '.github',
  'eutils',
])

export const META_REPO_ADMIN = '__admin__'
export const META_REPO_CORE = '__core__'
```

- [ ] **Step 2: Commit**

```bash
git add app/config.ts
git commit -m "feat(config): add ADMIN_REPOS set and meta column keys"
```

---

## Task 3: useOverviewData.ts — interface + split computed

**Files:**
- Modify: `app/composables/useOverviewData.ts`

- [ ] **Step 1: Add private/archived to RepoCardData**

In the `RepoCardData` interface, add two fields after `latest_release`:

```ts
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
  private: boolean
  archived: boolean
}
```

- [ ] **Step 2: Filter orgSummary to core repos**

Import `ADMIN_REPOS` at the top of the file:

```ts
import { ADMIN_REPOS } from '~/config'
```

Update the `orgSummary` computed to filter to core repos:

```ts
const orgSummary = computed<OrgSummary | null>(() => {
  if (!data.value) return null
  const { repos, contributors } = data.value
  const coreRepos = repos.filter(r => !ADMIN_REPOS.has(r.name))
  return {
    totalStars: coreRepos.reduce((s, r) => s + r.stargazers_count, 0),
    uniqueContributors: contributors.length,
    openIssues: coreRepos.reduce((s, r) => s + r.open_issues_count, 0),
    openPRs: coreRepos.reduce((s, r) => s + r.open_pr_count, 0),
  }
})
```

- [ ] **Step 3: Split repoCards into coreRepoCards + adminRepoCards**

Replace the existing `repoCards` computed with two computeds. The sparkline-building logic is identical — extract it to avoid duplication:

```ts
function buildSparklines(
  repos: RepoCardData[],
  commits: RawCommit[],
  prs: RawPR[],
  months: string[],
  monthSet: Set<string>,
): RepoCardData[] {
  const activity: Record<string, Record<string, number>> = {}
  for (const c of commits) {
    const m = toYearMonth(c.author_date)
    if (!monthSet.has(m)) continue
    if (!activity[c.repo]) activity[c.repo] = {}
    activity[c.repo]![m] = (activity[c.repo]![m] ?? 0) + 1
  }
  for (const p of prs) {
    if (!p.merged_at) continue
    const m = toYearMonth(p.merged_at)
    if (!monthSet.has(m)) continue
    if (!activity[p.repo]) activity[p.repo] = {}
    activity[p.repo]![m] = (activity[p.repo]![m] ?? 0) + 1
  }
  return [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .map(r => ({ ...r, sparkline: months.map(m => activity[r.name]?.[m] ?? 0) }))
}
```

Then replace the `repoCards` computed with:

```ts
const coreRepoCards = computed<RepoCardData[]>(() => {
  if (!data.value) return []
  const { repos, commits, prs } = data.value
  const core = repos.filter(r => !ADMIN_REPOS.has(r.name))
  return buildSparklines(core, commits, prs, months, monthSet)
})

const adminRepoCards = computed<RepoCardData[]>(() => {
  if (!data.value) return []
  const { repos, commits, prs } = data.value
  const admin = repos.filter(r => ADMIN_REPOS.has(r.name))
  return buildSparklines(admin, commits, prs, months, monthSet)
})
```

- [ ] **Step 4: Update the return statement**

Replace `repoCards` with `coreRepoCards` in the return:

```ts
return { orgSummary, coreRepoCards, adminRepoCards, isLoading: pending, collectedAt, relativeTime, formatLocalTime }
```

- [ ] **Step 5: Commit**

```bash
git add app/composables/useOverviewData.ts
git commit -m "feat(overview-data): split core/admin repo cards, filter org summary to core"
```

---

## Task 4: RepoCard.vue + overview.vue — badges + admin section

**Files:**
- Modify: `app/components/RepoCard.vue`
- Modify: `app/pages/overview.vue`

- [ ] **Step 1: Add private lock icon to RepoCard**

In `RepoCard.vue`, the repo name link currently reads:
```html
<a ... class="text-base font-semibold text-bc-indigo-500 ...">{{ repoDisplayName(repo.name) }}</a>
```

Add a lock icon after the link text, conditionally:
```html
<a
  :href="repo.html_url"
  target="_blank"
  rel="noopener"
  class="text-base font-semibold text-bc-indigo-500 hover:underline dark:text-bc-indigo-300 flex items-center gap-1.5"
>
  {{ repoDisplayName(repo.name) }}
  <i v-if="repo.private" class="fa-solid fa-lock text-xs text-slate-400 dark:text-slate-500" title="Private repository" aria-label="Private" />
</a>
```

- [ ] **Step 2: Add archived badge to RepoCard**

The release tag is in the top-right `<a v-if="repo.latest_release" ...>`. Add an archived badge using `v-else-if`:

```html
<a
  v-if="repo.latest_release && !repo.archived"
  :href="`https://github.com/${repo.full_name}/releases/tag/${repo.latest_release.tag_name}`"
  target="_blank"
  rel="noopener"
  class="shrink-0 rounded-full border border-bc-teal-400 px-2 py-0.5 text-xs text-bc-teal-600 transition-colors hover:bg-bc-teal-400 hover:text-white dark:border-bc-teal-400 dark:text-bc-teal-300 dark:hover:bg-bc-teal-500 dark:hover:text-white"
>
  {{ repo.latest_release.tag_name }} · {{ formatRelease(repo.latest_release.published_at) }}
</a>
<span
  v-else-if="repo.archived"
  class="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-400 dark:border-slate-600 dark:text-slate-500"
>
  archived
</span>
```

- [ ] **Step 3: Update overview.vue to use both card lists**

Replace the entire contents of `app/pages/overview.vue` with:

```vue
<script setup lang="ts">
const { orgSummary, coreRepoCards, adminRepoCards, isLoading } = useOverviewData()
</script>

<template>
  <div v-if="isLoading" class="flex items-center justify-center py-24 text-slate-500">
    Loading…
  </div>
  <template v-else>
    <div v-if="orgSummary" class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <OrgSummaryCard label="Total stars" :value="orgSummary.totalStars" />
      <OrgSummaryCard label="Contributors" :value="orgSummary.uniqueContributors" />
      <OrgSummaryCard label="Open issues" :value="orgSummary.openIssues" />
      <OrgSummaryCard label="Open PRs" :value="orgSummary.openPRs" />
    </div>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <RepoCard v-for="repo in coreRepoCards" :key="repo.name" :repo="repo" />
    </div>

    <div v-if="adminRepoCards.length > 0" class="mt-10">
      <h2 class="mb-4 text-sm font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
        Infrastructure &amp; Meta
      </h2>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <RepoCard v-for="repo in adminRepoCards" :key="repo.name" :repo="repo" />
      </div>
    </div>
  </template>
</template>
```

- [ ] **Step 4: Run dev server and verify visually**

```bash
pnpm dev
```

Open `http://localhost:3000/overview` and confirm:
- Core repos appear in the top grid as before
- "Infrastructure & Meta" section appears below (will be empty until data is re-collected, but the section header should render if any admin repos are in repos.json)
- No console errors

- [ ] **Step 5: Commit**

```bash
git add app/components/RepoCard.vue app/pages/overview.vue
git commit -m "feat(overview): add admin repo section with private/archived badges"
```

---

## Task 5: useFlowStats.ts — repoSet filtering

**Files:**
- Modify: `app/composables/useFlowStats.ts`

The composable needs a `repoSet` ref that restricts which repos appear in the chip selector and receive flow data.

- [ ] **Step 1: Import ADMIN_REPOS**

Add to the existing import line from config:

```ts
import { repoDisplayName, ADMIN_REPOS } from '~/config'
```

- [ ] **Step 2: Add repoSet ref**

Inside `useFlowStats`, after the existing `const timespan = ref<FlowTimespan>('12mo')` line, add:

```ts
export type RepoSet = 'core' | 'admin'
```

at the top of the file (with the other exported types), and inside `useFlowStats`:

```ts
const repoSet = ref<RepoSet>('core')
```

- [ ] **Step 3: Filter allRepos by repoSet**

Replace the existing `allRepos` computed:

```ts
const allRepos = computed<string[]>(() => {
  if (!rawData.value) return []
  const all = [...new Set(rawData.value.map(r => r.repo))].sort(
    (a, b) => repoDisplayName(a).localeCompare(repoDisplayName(b))
  )
  return repoSet.value === 'core'
    ? all.filter(r => !ADMIN_REPOS.has(r))
    : all.filter(r => ADMIN_REPOS.has(r))
})
```

- [ ] **Step 4: Reset selectedRepos when repoSet changes**

The existing watcher only initializes once. Add a separate watcher for set changes:

```ts
watch(repoSet, () => {
  selectedRepos.value = new Set(allRepos.value)
  initialized.value = false  // allow re-init if allRepos updates after a fetch
})
```

- [ ] **Step 5: Export repoSet from return**

Add `repoSet` to the return object:

```ts
return { stats, allStats, allRepos, granularity, timespan, repoSet, selectedRepos, toggleRepo, isLoading: pending }
```

- [ ] **Step 6: Commit**

```bash
git add app/composables/useFlowStats.ts
git commit -m "feat(flow-stats): add repoSet ref to filter chips between core and admin"
```

---

## Task 6: issues.vue + prs.vue — ?set= URL sync + pill toggle

**Files:**
- Modify: `app/pages/issues.vue`
- Modify: `app/pages/prs.vue`

The two files are symmetrical. Apply identical changes to both (substituting `'issues'` / `'PRs'` item labels).

- [ ] **Step 1: Update issues.vue script — add repoSet destructure and URL sync**

Replace the full `<script setup lang="ts">` block in `issues.vue` with:

```vue
<script setup lang="ts">
import { useFlowStats, type FlowTimespan, type RepoSet } from '~/composables/useFlowStats'

const route = useRoute()
const router = useRouter()
const { stats, allRepos, granularity, timespan, repoSet, selectedRepos, toggleRepo } = useFlowStats('issues')

function granularityFromQuery(): 'week' | 'month' | 'quarter' {
  const g = typeof route.query.granularity === 'string' ? route.query.granularity : ''
  if (g === 'quarter') return 'quarter'
  if (g === 'week') return 'week'
  return 'month'
}

function timespanFromQuery(): FlowTimespan {
  const t = typeof route.query.timespan === 'string' ? route.query.timespan : ''
  return (['all', '12mo', '6mo', '3mo', '1mo'] as FlowTimespan[]).includes(t as FlowTimespan) ? t as FlowTimespan : '12mo'
}

function repoSetFromQuery(): RepoSet {
  return route.query.set === 'admin' ? 'admin' : 'core'
}

granularity.value = granularityFromQuery()
timespan.value = timespanFromQuery()
repoSet.value = repoSetFromQuery()
if (!route.query.granularity) {
  granularity.value = timespan.value === 'all' ? 'month' : 'week'
}

watch([granularity, timespan, repoSet], ([g, t, s]) => {
  router.replace({ query: { ...route.query, granularity: g, timespan: t, set: s === 'core' ? undefined : s } })
})

watch(() => route.query.granularity, () => {
  const g = granularityFromQuery()
  if (g !== granularity.value) granularity.value = g
})

watch(() => route.query.timespan, () => {
  const t = timespanFromQuery()
  if (t !== timespan.value) timespan.value = t
})

watch(() => route.query.set, () => {
  const s = repoSetFromQuery()
  if (s !== repoSet.value) repoSet.value = s
})
</script>
```

- [ ] **Step 2: Update issues.vue template — add Core|Admin pill**

Replace the `<template>` block in `issues.vue` with:

```vue
<template>
  <div v-if="!stats" class="flex items-center justify-center py-24 text-slate-500">
    Loading…
  </div>
  <template v-else>
    <div class="mb-4 flex items-center gap-2">
      <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Repos</span>
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === 'core'
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="repoSet = 'core'"
        >Core</button>
        <button
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === 'admin'
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="repoSet = 'admin'"
        >Admin</button>
      </div>
    </div>
    <FlowChart
      :stats="stats"
      :all-repos="allRepos"
      :granularity="granularity"
      :timespan="timespan"
      :selected-repos="selectedRepos"
      item-label="issues"
      @update:granularity="granularity = $event"
      @update:timespan="timespan = $event"
      @toggle-repo="toggleRepo"
    />
    <div class="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
      <ResolutionByRepo :stats="stats" :all-repos="allRepos" item-label="issues" />
    </div>
  </template>
</template>
```

- [ ] **Step 3: Apply identical changes to prs.vue**

Make the same script and template changes in `prs.vue`, substituting:
- `useFlowStats('issues')` → `useFlowStats('prs')`
- `item-label="issues"` → `item-label="PRs"` (two occurrences)

- [ ] **Step 4: Run dev server and verify**

```bash
pnpm dev
```

Open `http://localhost:3000/issues`. Confirm:
- "Repos" pill with Core/Admin appears above the chart
- Toggling to Admin shows only admin repo chips (which may be empty if data not re-collected)
- `?set=admin` appears in the URL when Admin is selected
- Reloading with `?set=admin` restores the Admin selection

- [ ] **Step 5: Commit**

```bash
git add app/pages/issues.vue app/pages/prs.vue
git commit -m "feat(issues,prs): add Core|Admin repo set toggle with URL sync"
```

---

## Task 7: useContributorsTab.ts — repoSet + meta column

**Files:**
- Modify: `app/composables/useContributorsTab.ts`

This is the most complex change. The composable needs to:
- Split repos into core and admin
- Add a synthetic meta-column key to the repo list
- Aggregate the "other" set's activity into that meta-column for each contributor
- Filter rows to contributors with activity in the active set
- Run Pareto on the meta-column as a unit

- [ ] **Step 1: Import ADMIN_REPOS and meta keys**

Replace the existing config import:

```ts
import { repoDisplayName, CONTRIBUTOR_EXCLUDE, ADMIN_REPOS, META_REPO_ADMIN, META_REPO_CORE } from '~/config'
```

- [ ] **Step 2: Add RepoSet type and repoSet ref**

Add the import at the top of the file:

```ts
import type { RepoSet } from './useFlowStats'
```

Inside `useContributorsTab()`, after the existing `const timespan = ref<ContribTimespan>('all')` line:

```ts
const repoSet = ref<RepoSet>('core')
```

- [ ] **Step 3: Add a meta-column aggregation helper**

Add this helper function outside `useContributorsTab` (near the other helpers):

```ts
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
```

- [ ] **Step 4: Rewrite the tabData computed**

Replace the `tabData` computed with the new version. The key structural changes are:
1. Split `repos` into `coreRepos` / `adminRepos`
2. Determine `activeRepos`, `metaKey`, `metaRepos` from `repoSet`
3. Filter rows to contributors with activity in `activeRepos`
4. Add `metaKey` column to each contributor's `byRepo`
5. Run Pareto on `activeRepos + [metaKey]`

```ts
const tabData = computed<ContributorTabData | null>(() => {
  if (!rawData.value) return null
  const { contributors: rawContributors, issues: rawIssues, prs: rawPRs, commits: rawCommits, reviews: rawReviews } = rawData.value
  const contributors = rawContributors.filter(c => !isExcluded(c.login))
  const issues = rawIssues.filter(r => !isExcluded(r.author_login))
  const prs = rawPRs.filter(r => !isExcluded(r.author_login))
  const commits = rawCommits.filter(r => !isExcluded(r.author_login))
  const reviews = rawReviews.filter(r => !isExcluded(r.reviewer_login))

  // All repos from events
  const allEventRepos = [...new Set([
    ...issues.map(r => r.repo),
    ...prs.map(r => r.repo),
    ...commits.map(r => r.repo),
    ...reviews.map(r => r.repo),
  ])].sort((a, b) => repoDisplayName(a).localeCompare(repoDisplayName(b)))

  const coreRepos = allEventRepos.filter(r => !ADMIN_REPOS.has(r))
  const adminRepos = allEventRepos.filter(r => ADMIN_REPOS.has(r))

  const activeRepos = repoSet.value === 'core' ? coreRepos : adminRepos
  const metaRepos   = repoSet.value === 'core' ? adminRepos : coreRepos
  const metaKey     = repoSet.value === 'core' ? META_REPO_ADMIN : META_REPO_CORE

  // All-time stats (all repos, all time) — used for Total column + badge eligibility
  const allTimeStats = useContributorStats(contributors, issues, prs, commits, reviews)
  const allTimeCountMap = new Map(allTimeStats.map(s => [s.login, countTotal(s.all_time)]))

  // Timespan-filtered stats — used for per-repo column display and sort
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

  // Inject the meta-column into each contributor's byRepo
  for (const s of filteredStats) {
    s.by_repo[metaKey] = aggregateCounts(s.by_repo, metaRepos)
  }
  for (const s of allTimeStats) {
    s.by_repo[metaKey] = aggregateCounts(s.by_repo, metaRepos)
  }

  // Display repos: active set + meta column at the end
  const displayRepos = [...activeRepos, metaKey]

  // Sort by all-time totalCount desc to find top contributors
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
  anonByRepo[metaKey] = aggregateCounts(anonByRepo, metaRepos)

  const colMaxes = computeColMaxes(filteredStats, displayRepos)
  const countKeys: (keyof ContributorCounts)[] = ['commits', 'issues_opened', 'prs_opened', 'reviews_submitted']
  for (const k of countKeys) colMaxes['total']![k] = Math.max(colMaxes['total']![k], anonTotal[k])
  for (const repo of displayRepos) {
    const ac = anonByRepo[repo] ?? emptyCounts()
    if (!colMaxes[repo]) colMaxes[repo] = emptyCounts()
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

  // Pareto 80% expertise — covers activeRepos and the meta-column as a unit
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

  // Filter rows: only contributors with activity in the active set (all-time)
  const hasActiveSetActivity = (s: typeof withCounts[0]) =>
    activeRepos.some(repo => countTotal(s.by_repo[repo] ?? emptyCounts()) > 0) ||
    countTotal(s.by_repo[metaKey] ?? emptyCounts()) > 0

  const rows: ContributorRow[] = withCounts
    .filter(s => hasActiveSetActivity(s))
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

  return { rows, repos: displayRepos, colMaxes }
})
```

- [ ] **Step 5: Return repoSet from the composable**

```ts
return { tabData, timespan, repoSet, isLoading: pending }
```

- [ ] **Step 6: Commit**

```bash
git add app/composables/useContributorsTab.ts
git commit -m "feat(contributors-tab): add repoSet toggle with meta column aggregation"
```

---

## Task 8: ContributorTable.vue — set toggle + URL sync + meta column rendering

**Files:**
- Modify: `app/components/ContributorTable.vue`

- [ ] **Step 1: Import META_REPO_ADMIN/CORE and add meta column helper**

Add to the existing imports at the top of the `<script setup>`:

```ts
import { repoColor, repoDisplayName, META_REPO_ADMIN, META_REPO_CORE } from '~/config'
```

Add a helper that returns a display label and whether a column is the meta column:

```ts
function isMetaColumn(repo: string): boolean {
  return repo === META_REPO_ADMIN || repo === META_REPO_CORE
}

function columnLabel(repo: string): string {
  if (repo === META_REPO_ADMIN) return 'Admin'
  if (repo === META_REPO_CORE) return 'Core'
  return repoDisplayName(repo)
}

function columnColor(repo: string, repos: string[]): string {
  if (isMetaColumn(repo)) return '#64748b'  // slate-500 for meta
  return repoColor(repo, repos)
}
```

- [ ] **Step 2: Add repoSet + URL sync**

Destructure `repoSet` from `useContributorsTab()`:

```ts
const { tabData, timespan, repoSet, isLoading } = useContributorsTab()
```

Add route/router and URL sync below the existing composable call:

```ts
const route = useRoute()
const router = useRouter()

repoSet.value = route.query.set === 'admin' ? 'admin' : 'core'

watch(repoSet, (s) => {
  router.replace({ query: { ...route.query, set: s === 'core' ? undefined : s } })
})

watch(() => route.query.set, () => {
  const s = route.query.set === 'admin' ? 'admin' : 'core'
  if (s !== repoSet.value) repoSet.value = s
})
```

- [ ] **Step 3: Add Core|Admin pill to the toolbar**

In the toolbar `<div class="mb-6 flex items-center justify-between gap-2">`, add the set toggle between the timespan pill and the cell-mode toggle. The toolbar currently has two children (timespan on left, cell-mode on right). Make it three items — the set toggle in the middle — or nest the two left controls:

Replace the toolbar's opening structure so it reads:

```html
<div class="mb-6 flex items-center justify-between gap-2 flex-wrap">
  <div class="flex items-center gap-3">
    <!-- Repo set toggle -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Repos</span>
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === 'core'
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="repoSet = 'core'"
        >Core</button>
        <button
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === 'admin'
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="repoSet = 'admin'"
        >Admin</button>
      </div>
    </div>
    <!-- Timespan toggle (existing) -->
    <div class="flex items-center gap-2">
      <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Timespan</span>
      ...existing timespan pills...
    </div>
  </div>
  <!-- Cell-mode toggle (existing, unchanged) -->
  ...
</div>
```

- [ ] **Step 4: Update column header to use columnLabel**

In the `<th>` for repo columns, replace `{{ repoDisplayName(repo) }}` with `{{ columnLabel(repo) }}`:

```html
<th
  v-for="repo in tabData.repos"
  :key="repo"
  class="px-4 py-3 text-center min-w-[72px]"
  :class="isMetaColumn(repo) ? 'border-l-2 border-slate-300 dark:border-slate-600' : ''"
  :title="isMetaColumn(repo) ? (repo === '__admin__' ? 'Pooled admin repos' : 'Pooled core repos') : repo"
>
  {{ columnLabel(repo) }}
</th>
```

- [ ] **Step 5: Update per-repo cell to use columnColor**

In the `<td v-for="repo in tabData.repos">` cell, update the `:ring-color` binding and add a left border for meta column:

```html
<td
  v-for="repo in tabData.repos"
  :key="repo"
  class="px-4 py-2"
  :class="isMetaColumn(repo) ? 'border-l-2 border-slate-300 dark:border-slate-600' : ''"
>
  <div class="flex justify-center">
    <component
      :is="CellComponent"
      :counts="repoCounts(row.byRepo, repo)"
      :maxes="tabData.colMaxes[repo]!"
      :ring-color="row.expertRepos.has(repo) ? columnColor(repo, tabData.repos) : undefined"
    />
  </div>
</td>
```

- [ ] **Step 6: Run dev server and verify**

```bash
pnpm dev
```

Open `http://localhost:3000/contributors`. Confirm:
- "Repos" + "Timespan" toggles appear in the toolbar
- Core view shows core repo columns plus an "Admin" meta-column at the end with a left border
- Switching to Admin shows admin repo columns plus a "Core" meta-column
- `?set=admin` appears in the URL when Admin is selected; restores on reload
- Expert rings render correctly on meta column when applicable

- [ ] **Step 7: Commit**

```bash
git add app/components/ContributorTable.vue
git commit -m "feat(contributor-table): add Core|Admin set toggle with meta column rendering"
```

---

## Self-Review Checklist

- [x] **collect.py** — admin repos added, `private`/`archived` fields written (Task 1)
- [x] **config.ts** — `ADMIN_REPOS`, `META_REPO_ADMIN`, `META_REPO_CORE` exported (Task 2)
- [x] **RepoCardData interface** — `private`/`archived` fields added (Task 3)
- [x] **orgSummary** — filters to core repos only (Task 3)
- [x] **RepoCard** — lock icon for private, archived badge (Task 4)
- [x] **overview.vue** — two sections, no toggle (Task 4)
- [x] **useFlowStats** — `repoSet` ref + filtered `allRepos` + `selectedRepos` reset (Task 5)
- [x] **issues.vue / prs.vue** — `?set=` URL sync + pill toggle (Task 6)
- [x] **useContributorsTab** — `repoSet`, meta column, row filtering by active set (Task 7)
- [x] **ContributorTable** — set toggle, URL sync, meta column visual treatment (Task 8)
- [x] **Type consistency** — `RepoSet` type imported from `useFlowStats` in `useContributorsTab`; `META_REPO_ADMIN`/`META_REPO_CORE` used consistently throughout
- [x] **URL param** — `?set=` used in Issues, PRs, Contributors; omitted when `core` (default) so URLs stay clean
- [x] **Total column** — uses `s.all_time` which is never filtered by repoSet (all-repos, all-time)
