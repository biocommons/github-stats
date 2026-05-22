# Accordion Repo-Sets + FlowToolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Archived repo set, replace the Issues/PRs repo-set toggle with a shared FlowToolbar component (two-row layout), and replace the Contributor Table's external set toggle with an in-header accordion.

**Architecture:** Config defines three sets (Core, Admin, Archived). `useFlowStats` gains an 'archived' branch. A new `FlowToolbar` component owns all view-control UI for Issues/PRs; `FlowChart` becomes a pure chart. `useContributorsTab` returns both sets always; `ContributorTable` drives expand/collapse locally via `expandedSet`.

**Tech Stack:** Nuxt 3, Vue 3 Composition API (`<script setup>`), TypeScript strict, Tailwind CSS. No test framework — verify with `pnpm dev` on port 3050.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `app/config.ts` | Modify | Add `ARCHIVED_REPOS`, `META_REPO_ARCHIVED`, `RepoSetDef`, `REPO_SETS`; update `RepoSet` type |
| `app/composables/useFlowStats.ts` | Modify | Add `'archived'` to `RepoSet`; update `allRepos` computed |
| `app/components/FlowToolbar.vue` | Create | Two-row toolbar: repo-set pills + repo list (row 1), timespan + granularity (row 2) |
| `app/components/FlowChart.vue` | Modify | Remove timespan/granularity selector UI and their emits |
| `app/pages/issues.vue` | Modify | Add `<FlowToolbar>`, remove inline repo-set toggle, handle `'archived'` in query |
| `app/pages/prs.vue` | Modify | Same as issues.vue |
| `app/composables/useContributorsTab.ts` | Modify | Remove `repoSet`; return `repoSets: RepoSetInfo[]`; inject all 3 meta keys always |
| `app/components/ContributorTable.vue` | Modify | Two-row `<thead>` accordion; `expandedSet` ref; remove pill toggle |

---

## Task 1: Add Archived set to config

**Files:**
- Modify: `app/config.ts`

- [ ] **Step 1: Add the new constants and types**

Replace the top of `app/config.ts` (everything before `REPO_DISPLAY_NAMES`) with:

```ts
export const CONTRIBUTOR_EXCLUDE: RegExp[] = [
  /\[bot\]$/,
  /^pyup-bot$/,
]

export const ADMIN_REPOS = new Set([
  'infra',
  'biocommons.github.io',
  'github-stats',
  '.github',
])

export const ARCHIVED_REPOS = new Set([
  'eutils',
])

export const META_REPO_ADMIN = '__admin__'
export const META_REPO_CORE = '__core__'
export const META_REPO_ARCHIVED = '__archived__'

export type RepoSet = 'core' | 'admin' | 'archived'

export interface RepoSetDef {
  key: RepoSet
  label: string
  metaKey: string
}

export const REPO_SETS: RepoSetDef[] = [
  { key: 'core',     label: 'Core',     metaKey: META_REPO_CORE },
  { key: 'admin',    label: 'Admin',    metaKey: META_REPO_ADMIN },
  { key: 'archived', label: 'Archived', metaKey: META_REPO_ARCHIVED },
]
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/reece/projects/biocommons/github-stats && pnpm nuxt prepare 2>&1 | tail -5
```

Expected: no errors (warnings about unused imports are OK at this stage).

- [ ] **Step 3: Commit**

```bash
git add app/config.ts
git commit -m "feat(config): add Archived repo set (eutils), REPO_SETS descriptor array"
```

---

## Task 2: Update useFlowStats for 'archived'

**Files:**
- Modify: `app/composables/useFlowStats.ts`

- [ ] **Step 1: Update the RepoSet import and allRepos computed**

`RepoSet` is now defined in `config.ts`. First check the current import at the top of the file:

```bash
head -10 /home/reece/projects/biocommons/github-stats/app/composables/useFlowStats.ts
```

- [ ] **Step 2: Remove the local RepoSet type and import from config**

Find the line `export type RepoSet = 'core' | 'admin'` and replace it with an import from config. Also add `ARCHIVED_REPOS` to the config import. The import line (currently referencing `ADMIN_REPOS`) should become:

```ts
import { ADMIN_REPOS, ARCHIVED_REPOS, repoDisplayName } from '~/config'
import type { RepoSet } from '~/config'
```

Remove the local `export type RepoSet = 'core' | 'admin'` line entirely.

- [ ] **Step 3: Update the allRepos computed**

Find the `allRepos` computed block (around line 269) and replace:

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

with:

```ts
  const allRepos = computed<string[]>(() => {
    if (!rawData.value) return []
    const all = [...new Set(rawData.value.map(r => r.repo))].sort(
      (a, b) => repoDisplayName(a).localeCompare(repoDisplayName(b))
    )
    if (repoSet.value === 'admin') return all.filter(r => ADMIN_REPOS.has(r) && !ARCHIVED_REPOS.has(r))
    if (repoSet.value === 'archived') return all.filter(r => ARCHIVED_REPOS.has(r))
    return all.filter(r => !ADMIN_REPOS.has(r) && !ARCHIVED_REPOS.has(r))
  })
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/reece/projects/biocommons/github-stats && pnpm nuxt prepare 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/composables/useFlowStats.ts
git commit -m "feat(useFlowStats): add 'archived' to RepoSet, filter eutils from admin"
```

---

## Task 3: Create FlowToolbar component

**Files:**
- Create: `app/components/FlowToolbar.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import { REPO_SETS } from '~/config'
import type { RepoSet } from '~/config'
import type { FlowTimespan } from '~/composables/useFlowStats'
import type { TimeBucket } from '~/composables/useTimeBuckets'
import { repoDisplayName } from '~/config'

const props = defineProps<{
  repoSet: RepoSet
  reposInSet: string[]
  granularity: TimeBucket
  timespan: FlowTimespan
}>()

const emit = defineEmits<{
  'update:repoSet': [value: RepoSet]
  'update:granularity': [value: TimeBucket]
  'update:timespan': [value: FlowTimespan]
}>()

const TIMESPANS: { label: string; value: FlowTimespan }[] = [
  { label: 'All time', value: 'all' },
  { label: '12 mo',   value: '12mo' },
  { label: '6 mo',    value: '6mo' },
  { label: '3 mo',    value: '3mo' },
  { label: '1 mo',    value: '1mo' },
]
</script>

<template>
  <div class="mb-4 flex flex-col gap-2">
    <!-- Row 1: repo-set switch + active repo list -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="s in REPO_SETS"
          :key="s.key"
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === s.key
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="emit('update:repoSet', s.key)"
        >{{ s.label }}</button>
      </div>
      <span class="truncate text-xs text-slate-400 dark:text-slate-500">
        {{ reposInSet.map(repoDisplayName).join(', ') }}
      </span>
    </div>

    <!-- Row 2: timespan + granularity -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="ts in TIMESPANS"
          :key="ts.value"
          class="rounded-full px-3 py-1 transition-colors"
          :class="timespan === ts.value
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="emit('update:timespan', ts.value)"
        >{{ ts.label }}</button>
      </div>
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="g in (['week', 'month', 'quarter'] as const)"
          :key="g"
          class="rounded-full px-3 py-1 capitalize transition-colors"
          :class="granularity === g
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="emit('update:granularity', g)"
        >{{ g }}</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /home/reece/projects/biocommons/github-stats && pnpm nuxt prepare 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/FlowToolbar.vue
git commit -m "feat(FlowToolbar): new two-row toolbar with repo-set switch and view controls"
```

---

## Task 4: Strip toolbar UI from FlowChart

**Files:**
- Modify: `app/components/FlowChart.vue`

- [ ] **Step 1: Remove TIMESPANS constant**

Delete the `TIMESPANS` constant block (lines ~6-12) from `<script setup>`:

```ts
// DELETE these lines:
const TIMESPANS: { label: string; value: FlowTimespan }[] = [
  { label: 'All time', value: 'all' },
  { label: '12 mo', value: '12mo' },
  { label: '6 mo', value: '6mo' },
  { label: '3 mo', value: '3mo' },
  { label: '1 mo', value: '1mo' },
]
```

- [ ] **Step 2: Remove update:granularity and update:timespan from defineEmits**

Find the `defineEmits` block and change it from:

```ts
const emit = defineEmits<{
  'update:granularity': [value: TimeBucket]
  'update:timespan': [value: FlowTimespan]
  'toggle-repo': [repo: string]
}>()
```

to:

```ts
const emit = defineEmits<{
  'toggle-repo': [repo: string]
}>()
```

- [ ] **Step 3: Remove timespan and granularity selector divs from template**

In the `<template>`, find the `<!-- Selectors group flush right -->` div (the `<div class="ml-auto flex items-center gap-2">` block) and remove the two inner divs for timespan and granularity selectors, keeping only the Fit/Pan control. The result should be:

```html
<!-- Selectors group flush right -->
<div class="ml-auto flex items-center gap-2">
  <!-- Fit/Pan segmented control -->
  <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-sm dark:border-slate-700 dark:bg-slate-900">
    <button
      v-for="[mode, label] in [['fit', 'Fit'], ['pan', 'Pan']] as const"
      :key="mode"
      class="rounded-full px-3 py-1 transition-colors"
      :class="(mode === 'pan') === scrollMode ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
      @click="scrollMode = mode === 'pan'"
    >{{ label }}</button>
  </div>
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /home/reece/projects/biocommons/github-stats && pnpm nuxt prepare 2>&1 | tail -5
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/FlowChart.vue
git commit -m "refactor(FlowChart): remove timespan/granularity toolbar — moved to FlowToolbar"
```

---

## Task 5: Wire FlowToolbar into issues.vue and prs.vue

**Files:**
- Modify: `app/pages/issues.vue`
- Modify: `app/pages/prs.vue`

- [ ] **Step 1: Rewrite issues.vue**

Replace the entire file content:

```vue
<script setup lang="ts">
import { useFlowStats, type FlowTimespan } from '~/composables/useFlowStats'
import type { RepoSet } from '~/config'

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
  const s = route.query.set
  if (s === 'admin' || s === 'archived') return s
  return 'core'
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

<template>
  <div v-if="!stats" class="flex items-center justify-center py-24 text-slate-500">
    Loading…
  </div>
  <template v-else>
    <FlowToolbar
      :repo-set="repoSet"
      :repos-in-set="allRepos"
      :granularity="granularity"
      :timespan="timespan"
      @update:repo-set="repoSet = $event"
      @update:granularity="granularity = $event"
      @update:timespan="timespan = $event"
    />
    <FlowChart
      :stats="stats"
      :all-repos="allRepos"
      :granularity="granularity"
      :timespan="timespan"
      :selected-repos="selectedRepos"
      item-label="issues"
      @toggle-repo="toggleRepo"
    />
    <div class="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
      <ResolutionByRepo :stats="stats" :all-repos="allRepos" item-label="issues" />
    </div>
  </template>
</template>
```

- [ ] **Step 2: Rewrite prs.vue**

Replace the entire file content (identical to issues.vue except `'issues'` → `'prs'` and `item-label`):

```vue
<script setup lang="ts">
import { useFlowStats, type FlowTimespan } from '~/composables/useFlowStats'
import type { RepoSet } from '~/config'

const route = useRoute()
const router = useRouter()
const { stats, allRepos, granularity, timespan, repoSet, selectedRepos, toggleRepo } = useFlowStats('prs')

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
  const s = route.query.set
  if (s === 'admin' || s === 'archived') return s
  return 'core'
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

<template>
  <div v-if="!stats" class="flex items-center justify-center py-24 text-slate-500">
    Loading…
  </div>
  <template v-else>
    <FlowToolbar
      :repo-set="repoSet"
      :repos-in-set="allRepos"
      :granularity="granularity"
      :timespan="timespan"
      @update:repo-set="repoSet = $event"
      @update:granularity="granularity = $event"
      @update:timespan="timespan = $event"
    />
    <FlowChart
      :stats="stats"
      :all-repos="allRepos"
      :granularity="granularity"
      :timespan="timespan"
      :selected-repos="selectedRepos"
      item-label="PRs"
      @toggle-repo="toggleRepo"
    />
    <div class="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
      <ResolutionByRepo :stats="stats" :all-repos="allRepos" item-label="PRs" />
    </div>
  </template>
</template>
```

- [ ] **Step 3: Run dev server and verify Issues + PRs tabs**

```bash
pnpm dev --port 3050
```

Open http://localhost:3050. Check:
- Issues tab: two-row toolbar visible (Core/Admin/Archived pills on row 1 with repo names; timespan + granularity on row 2)
- Switch to Admin → chart updates, repo list updates
- Switch to Archived → shows only `eutils` in repo list, chart shows eutils data
- Timespan and granularity selectors work
- PRs tab: identical behavior
- `?set=archived` in URL round-trips correctly on reload
- Fit/Pan control still present in chart area

- [ ] **Step 4: Commit**

```bash
git add app/pages/issues.vue app/pages/prs.vue
git commit -m "feat(issues,prs): add FlowToolbar with 3-state repo-set, two-row layout; Closes #15 partial"
```

---

## Task 6: Update useContributorsTab for three-set repoSets

**Files:**
- Modify: `app/composables/useContributorsTab.ts`

- [ ] **Step 1: Update imports**

Replace the existing config import line:

```ts
import { repoDisplayName, CONTRIBUTOR_EXCLUDE, ADMIN_REPOS, META_REPO_ADMIN, META_REPO_CORE } from '~/config'
```

with:

```ts
import {
  repoDisplayName, CONTRIBUTOR_EXCLUDE,
  ADMIN_REPOS, ARCHIVED_REPOS,
  META_REPO_ADMIN, META_REPO_CORE, META_REPO_ARCHIVED,
  REPO_SETS,
} from '~/config'
import type { RepoSetDef } from '~/config'
```

- [ ] **Step 2: Update the ContributorTabData interface**

Replace:

```ts
export interface ContributorTabData {
  rows: ContributorRow[]
  repos: string[]
  colMaxes: Record<string, ContributorCounts>
}
```

with:

```ts
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
```

- [ ] **Step 3: Remove repoSet ref from useContributorsTab**

Remove the line:

```ts
const repoSet = ref<RepoSet>('core')
```

And remove `repoSet` from the return value at the bottom of `useContributorsTab`.

- [ ] **Step 4: Replace the set-classification logic in the tabData computed**

Find the block (around lines 129–135) that reads:

```ts
const coreRepos = allEventRepos.filter(r => !ADMIN_REPOS.has(r))
const adminRepos = allEventRepos.filter(r => ADMIN_REPOS.has(r))

const activeRepos = repoSet.value === 'core' ? coreRepos : adminRepos
const metaRepos   = repoSet.value === 'core' ? adminRepos : coreRepos
const metaKey     = repoSet.value === 'core' ? META_REPO_ADMIN : META_REPO_CORE
```

Replace it with:

```ts
const coreRepos     = allEventRepos.filter(r => !ADMIN_REPOS.has(r) && !ARCHIVED_REPOS.has(r))
const adminRepos    = allEventRepos.filter(r => ADMIN_REPOS.has(r) && !ARCHIVED_REPOS.has(r))
const archivedRepos = allEventRepos.filter(r => ARCHIVED_REPOS.has(r))

const repoSetInfos: RepoSetInfo[] = [
  { key: 'core',     label: 'Core',     metaKey: META_REPO_CORE,     repos: coreRepos },
  { key: 'admin',    label: 'Admin',    metaKey: META_REPO_ADMIN,    repos: adminRepos },
  { key: 'archived', label: 'Archived', metaKey: META_REPO_ARCHIVED, repos: archivedRepos },
]
```

- [ ] **Step 5: Update meta-key injection to cover all three sets**

Find the block that injects the meta column (around lines 164–172):

```ts
for (const s of filteredStats) {
  s.by_repo[metaKey] = aggregateCounts(s.by_repo, metaRepos)
}
if (timespan.value !== 'all') {
  for (const s of allTimeStats) {
    s.by_repo[metaKey] = aggregateCounts(s.by_repo, metaRepos)
  }
}
```

Replace with injection for all three sets:

```ts
const setDefs = [
  { metaKey: META_REPO_CORE,     repos: coreRepos },
  { metaKey: META_REPO_ADMIN,    repos: adminRepos },
  { metaKey: META_REPO_ARCHIVED, repos: archivedRepos },
]
for (const s of filteredStats) {
  for (const { metaKey, repos } of setDefs) {
    s.by_repo[metaKey] = aggregateCounts(s.by_repo, repos)
  }
}
if (timespan.value !== 'all') {
  for (const s of allTimeStats) {
    for (const { metaKey, repos } of setDefs) {
      s.by_repo[metaKey] = aggregateCounts(s.by_repo, repos)
    }
  }
}
```

- [ ] **Step 6: Update displayRepos and anonymous meta injection**

Find:

```ts
const displayRepos = [...activeRepos, metaKey]
```

Replace with all individual repos (for colMaxes computation — the component builds its own display list):

```ts
const allIndividualRepos = [...coreRepos, ...adminRepos, ...archivedRepos]
const allMetaKeys = [META_REPO_CORE, META_REPO_ADMIN, META_REPO_ARCHIVED]
const displayRepos = [...allIndividualRepos, ...allMetaKeys]
```

Also find the anonymous meta injection line:

```ts
anonByRepo[metaKey] = aggregateCounts(anonByRepo, metaRepos)
```

Replace with:

```ts
for (const { metaKey, repos } of setDefs) {
  anonByRepo[metaKey] = aggregateCounts(anonByRepo, repos)
}
```

- [ ] **Step 7: Update the return value**

Find the final return inside `tabData computed`:

```ts
return { rows, repos: displayRepos, colMaxes }
```

Replace with:

```ts
return { rows, repoSets: repoSetInfos, colMaxes }
```

And update the `useContributorsTab` function return (at the very bottom):

```ts
return { tabData, timespan, isLoading: pending }
```

(Remove `repoSet` from the return.)

- [ ] **Step 8: Verify TypeScript compiles**

```bash
cd /home/reece/projects/biocommons/github-stats && pnpm nuxt prepare 2>&1 | tail -10
```

Expected: type errors in `ContributorTable.vue` only (it still references old `tabData.repos`) — that's fine, Task 7 fixes it.

- [ ] **Step 9: Commit**

```bash
git add app/composables/useContributorsTab.ts
git commit -m "feat(useContributorsTab): return repoSets[] for all three sets; inject all meta keys"
```

---

## Task 7: Contributor Table accordion

**Files:**
- Modify: `app/components/ContributorTable.vue`

- [ ] **Step 1: Update script setup — remove repoSet, add accordion state**

Replace the top of `<script setup>`:

```ts
import { useContributorsTab } from '~/composables/useContributorsTab'
import type { FlowTimespan as ContribTimespan } from '~/composables/useFlowStats'
import { repoColor, repoDisplayName, META_REPO_ADMIN, META_REPO_CORE } from '~/config'
import type { ContributorCounts } from '~/composables/useContributorStats'
import QuadCell from '~/components/QuadCell.vue'
import RadarCell from '~/components/RadarCell.vue'


const { tabData, timespan, repoSet, isLoading } = useContributorsTab()

const route = useRoute()
const router = useRouter()

watch(() => route.query.set, (val) => {
  repoSet.value = val === 'admin' ? 'admin' : 'core'
}, { immediate: true })

watch(repoSet, (s) => {
  router.replace({ query: { ...route.query, set: s === 'core' ? undefined : s } })
})

function isMetaColumn(repo: string): boolean {
  return repo === META_REPO_ADMIN || repo === META_REPO_CORE
}

function columnLabel(repo: string): string {
  if (repo === META_REPO_ADMIN) return 'Admin'
  if (repo === META_REPO_CORE) return 'Core'
  return repoDisplayName(repo)
}

function columnColor(repo: string, repos: string[]): string {
  if (isMetaColumn(repo)) return '#64748b'
  return repoColor(repo, repos)
}
```

with:

```ts
import { useContributorsTab } from '~/composables/useContributorsTab'
import type { FlowTimespan as ContribTimespan } from '~/composables/useFlowStats'
import { repoColor, repoDisplayName } from '~/config'
import type { ContributorCounts } from '~/composables/useContributorStats'
import QuadCell from '~/components/QuadCell.vue'
import RadarCell from '~/components/RadarCell.vue'

const { tabData, timespan, isLoading } = useContributorsTab()

const expandedSet = ref<string>('core')

const displayRepos = computed(() => {
  if (!tabData.value) return []
  return tabData.value.repoSets.flatMap(s =>
    expandedSet.value === s.key ? s.repos : [s.metaKey]
  )
})

const allMetaKeys = computed(() =>
  tabData.value?.repoSets.map(s => s.metaKey) ?? []
)

function isMetaColumn(repo: string): boolean {
  return allMetaKeys.value.includes(repo)
}

function columnLabel(repo: string): string {
  const set = tabData.value?.repoSets.find(s => s.metaKey === repo)
  if (set) return set.label
  return repoDisplayName(repo)
}

function columnColor(repo: string): string {
  if (isMetaColumn(repo)) return '#64748b'
  return repoColor(repo, displayRepos.value)
}
```

- [ ] **Step 2: Remove the repo-set pill toggle from the template toolbar**

In the `<template>`, find and delete the "Repo set toggle" block:

```html
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
```

- [ ] **Step 3: Replace the single-row thead with the two-row accordion thead**

Find the entire `<thead>` block:

```html
<thead>
  <tr class="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800">
    <th class="sticky left-0 z-10 bg-white px-4 py-3 min-w-[200px] dark:bg-slate-950">Contributor</th>
    <th class="border-x-2 border-slate-300 bg-slate-100 px-4 py-3 text-center dark:border-slate-600 dark:bg-slate-800/60">Total</th>
    <th
      v-for="repo in tabData.repos"
      :key="repo"
      class="px-4 py-3 text-center min-w-[72px]"
      :class="isMetaColumn(repo) ? 'border-l-2 border-slate-300 dark:border-slate-600' : ''"
      :title="isMetaColumn(repo)
        ? (repo === META_REPO_ADMIN ? 'Pooled admin repos' : 'Pooled core repos')
        : repo"
    >
      {{ columnLabel(repo) }}
    </th>
  </tr>
</thead>
```

Replace it with:

```html
<thead>
  <!-- Row 1: set group headers -->
  <tr class="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800">
    <th class="sticky left-0 z-10 bg-white px-4 py-3 min-w-[200px] dark:bg-slate-950" rowspan="2">Contributor</th>
    <th class="border-x-2 border-slate-300 bg-slate-100 px-4 py-3 text-center dark:border-slate-600 dark:bg-slate-800/60" rowspan="2">Total</th>
    <th
      v-for="s in tabData.repoSets"
      :key="s.key"
      :colspan="expandedSet === s.key ? s.repos.length : 1"
      class="cursor-pointer select-none border-l-2 border-slate-300 px-4 py-2 text-center transition-colors dark:border-slate-600"
      :class="expandedSet === s.key
        ? 'bg-bc-teal-500/10 text-bc-teal-600 dark:text-bc-teal-300'
        : 'hover:text-slate-700 dark:hover:text-slate-200'"
      :title="expandedSet === s.key ? `Click to collapse ${s.label}` : `Click to expand ${s.label}`"
      @click="expandedSet = expandedSet === s.key ? '' : s.key"
    >
      {{ s.label }}
      <span class="ml-1 opacity-60">{{ expandedSet === s.key ? '▾' : '▸' }}</span>
    </th>
  </tr>
  <!-- Row 2: individual repo headers (hidden when all sets collapsed) -->
  <tr
    v-if="expandedSet !== ''"
    class="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-400 dark:border-slate-800"
  >
    <th
      v-for="repo in displayRepos"
      :key="repo"
      class="px-4 py-2 text-center min-w-[72px]"
      :class="isMetaColumn(repo) ? 'border-l-2 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/40' : ''"
      :title="isMetaColumn(repo) ? `Pooled ${columnLabel(repo).toLowerCase()} repos` : repo"
    >
      {{ columnLabel(repo) }}
    </th>
  </tr>
</thead>
```

- [ ] **Step 4: Update the body to iterate displayRepos**

In `<tbody>`, find the Total cell and per-repo cells section.

The Total cell stays unchanged.

For the per-repo cells, replace:

```html
<!-- Per-repo cells -->
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

with:

```html
<!-- Per-repo cells -->
<td
  v-for="repo in displayRepos"
  :key="repo"
  class="px-4 py-2"
  :class="isMetaColumn(repo) ? 'border-l-2 border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/20' : ''"
>
  <div class="flex justify-center">
    <component
      :is="CellComponent"
      :counts="repoCounts(row.byRepo, repo)"
      :maxes="tabData.colMaxes[repo]!"
      :ring-color="row.expertRepos.has(repo) ? columnColor(repo) : undefined"
    />
  </div>
</td>
```

- [ ] **Step 5: Run dev server and verify Contributors tab**

```bash
pnpm dev --port 3050
```

Open http://localhost:3050/contributors. Check:
- Two-row thead visible: row 1 has Core ▾ / Admin ▸ / Archived ▸; row 2 has individual Core repo headers
- Click Admin → Admin expands (individual admin repos visible), Core collapses to single "Core" aggregate cell
- Click Archived → Archived expands showing `eutils`, Admin collapses
- Click expanded set header → all sets show single aggregate cells (row 2 disappears)
- Aggregate cell counts in collapsed sets visually match the sums seen when expanded
- No repo-set pill toggle visible in the toolbar above the table
- Timespan selector still works
- Cell mode toggle (Quad/Radar) still works
- Dark mode: check separator borders and teal tint contrast

- [ ] **Step 6: Commit**

```bash
git add app/components/ContributorTable.vue
git commit -m "feat(ContributorTable): accordion two-row thead for Core/Admin/Archived sets; Closes #14"
```
