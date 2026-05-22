# Accordion Repo-Set Columns + Issues/PRs Toolbar Refactor

**Date:** 2026-05-21  
**Issues:** #14 (accordion), + concurrent addition of Archived set  
**Status:** approved

---

## Summary

Three coordinated changes, all sharing the same "three repo sets" foundation:

1. **Archived set** — introduce a third repo set (initially `eutils`) in `config.ts`, distinct from Admin.
2. **Contributor Table accordion** — replace the external Core/Admin toggle with an in-header two-row `<thead>`. Clicking a set header expands its individual repo columns (radio) or collapses to one aggregate cell.
3. **Issues/PRs toolbar refactor** — extract a shared `FlowToolbar` component from `FlowChart`. The toolbar owns a 3-state repo-set switch (row 1, with active-set repo list inline), and granularity/timespan selectors (row 2). `FlowChart` becomes a pure chart with no toolbar UI.

---

## Config Changes (`config.ts`)

- Add `ARCHIVED_REPOS: Set<string>` containing `'eutils'`.
- Remove `'eutils'` from `ADMIN_REPOS`.
- Add `META_REPO_ARCHIVED = '__archived__'` constant.
- Add a `REPO_SETS` ordered array describing all sets:

```ts
export const REPO_SETS: RepoSetDef[] = [
  { key: 'core',     label: 'Core',     metaKey: META_REPO_CORE,     isAdmin: (r) => false },
  { key: 'admin',    label: 'Admin',    metaKey: META_REPO_ADMIN,    isAdmin: (r) => ADMIN_REPOS.has(r) },
  { key: 'archived', label: 'Archived', metaKey: META_REPO_ARCHIVED, isAdmin: (r) => ARCHIVED_REPOS.has(r) },
]
```

(In practice this is implemented as classification logic, not a predicate field — see composable section.)

---

## Composable Changes (`useContributorsTab.ts`)

### Remove
- `repoSet` ref and all logic branching on it.
- Route query `?set=` sync (state becomes local to the component).

### Add / Change

`tabData` gains a `repoSets` array replacing the flat `repos` list:

```ts
export interface RepoSetInfo {
  key: string          // 'core' | 'admin' | 'archived'
  label: string        // display name
  metaKey: string      // e.g. META_REPO_CORE
  repos: string[]      // individual repos in this set (sorted by display name)
}

export interface ContributorTabData {
  rows: ContributorRow[]
  repoSets: RepoSetInfo[]
  colMaxes: Record<string, ContributorCounts>  // keyed by repo name AND metaKey
}
```

Classification: repo → set is determined by membership in `ARCHIVED_REPOS`, then `ADMIN_REPOS`, then core (everything else).

All three meta keys (`META_REPO_CORE`, `META_REPO_ADMIN`, `META_REPO_ARCHIVED`) are injected into every contributor's `byRepo` map and into `colMaxes`. This means a contributor row always has aggregate counts ready for any collapsed group without re-computation.

`repoSet` is removed from the return value.

---

## Component Changes (`ContributorTable.vue`)

### State
```ts
const expandedSet = ref<string>('core')   // radio: exactly one set expanded at a time
```

Clicking a collapsed group header sets `expandedSet = key`.  
Clicking the already-expanded group collapses it (`expandedSet = ''`), leaving all groups as aggregate cells — a valid edge case.

### Derived columns
```ts
const displayRepos = computed(() =>
  tabData.value.repoSets.flatMap(s =>
    expandedSet.value === s.key ? s.repos : [s.metaKey]
  )
)
```

The body rows and colMaxes lookups iterate over `displayRepos` exactly as before.

### Two-row `<thead>`

**Row 1** (group headers):
- `Contributor` (`rowspan="2"`, sticky)
- `Total` (`rowspan="2"`)
- For each set: one `<th>` with `colspan` = expanded ? `set.repos.length` : `1`. Clickable. Shows label + chevron (▸ collapsed, ▾ expanded).

**Row 2** (repo headers):
- One `<th>` per entry in `displayRepos`.
- `v-if` on the `<tr>`: skip row 2 if all groups are collapsed (all single-cell) — avoids an empty row. In practice this only happens when `expandedSet === ''`.

### Remove
- The "Repos" pill toggle (Core / Admin buttons).
- The `watch(() => route.query.set, ...)` and `watch(repoSet, ...)` blocks.
- The `repoSet` ref and import.

The meta-column border separator logic (`isMetaColumn`) can be simplified: any entry in `displayRepos` that equals a `metaKey` gets the separator class.

---

## Visual Treatment

| State | Group header appearance |
|---|---|
| Expanded | label + ▾, subtle teal tint (matches existing active-set style) |
| Collapsed | label + ▸, muted slate, cursor-pointer |

Collapsed group's aggregate cell reuses the same background/border style as the current Total column (slate-100 / dark:slate-800). This visually groups the collapsed set as a single summary unit.

---

---

## Issues/PRs Toolbar Refactor

### New component: `FlowToolbar.vue`

Accepts all controls as props/emits; used by both issues.vue and prs.vue (eliminating their current duplication):

```ts
defineProps<{
  repoSet: RepoSet         // 'core' | 'admin' | 'archived'
  reposInSet: string[]     // repos in the active set, for display
  granularity: TimeBucket
  timespan: FlowTimespan
}>()

defineEmits<{
  'update:repoSet': [value: RepoSet]
  'update:granularity': [value: TimeBucket]
  'update:timespan': [value: FlowTimespan]
}>()
```

**Row 1 — Repo set:**
- 3-state pill switch: Core · Admin · Archived (same rounded-full style as existing toggles)
- To the right on the same row: comma-separated list of `reposInSet` in muted text (e.g., `seqrepo, hgvs, anyvar, bioutils`), truncated with `…` if overflow

**Row 2 — View controls:**
- Granularity selector (Week / Month / Quarter)
- Timespan selector (All time / 12 mo / 6 mo / 3 mo / 1 mo)

Both rows use `flex-wrap` so they reflow naturally on narrow screens, fixing the current mobile overflow.

### `useFlowStats` changes

- `RepoSet` type gains `'archived'` as a valid value.
- Expose `reposInSet: ComputedRef<string[]>` — the repos in the active set derived from event data (same source as current `allRepos`, filtered to the active set). This drives the inline repo list in the toolbar.
- Route query `?set=` updated to accept `'archived'`; falls back to `'core'` for unknown values.

### `FlowChart.vue` changes

- Remove the granularity and timespan toggle UI blocks entirely.
- Remove corresponding props that were only used by the internal toggles (granularity/timespan selectors stay as props for the chart rendering, but the buttons move out).
- The individual repo legend toggles (colored chips) stay inside `FlowChart` — they are chart-specific.

### `issues.vue` and `prs.vue` changes

Replace the current inline repo-set toggle + `<FlowChart>` with:

```html
<FlowToolbar
  v-model:repoSet="repoSet"
  :repos-in-set="reposInSet"
  v-model:granularity="granularity"
  v-model:timespan="timespan"
/>
<FlowChart ... />
```

Both pages become nearly identical; the only difference is `item-label` on `FlowChart`.

---

## What Is Not Changing

- Cell mode toggle (Quad / Radar) in ContributorTable: unchanged.
- `expertRepos`, Pareto rings, badges: logic unchanged; rings still fire for individual repo columns when expanded.
- Contributor Table accordion state: local to component, no URL sync.
- `colMaxes` computation: still per-column, now covers all three sets always.
- Individual repo legend toggles inside `FlowChart`: unchanged.

---

## Testing Notes

**Contributor Table:**
- Expand Core → individual core repo columns visible; Admin and Archived show aggregate cells.
- Click Admin → Admin expands, Core collapses to aggregate.
- Click expanded set → all groups show aggregate cells (edge case).
- `eutils` appears under Archived, not Admin.
- Collapsed aggregate cell counts match sum of individual repo columns when expanded.
- Dark mode: separator borders and header tint contrast.

**Issues/PRs toolbar:**
- Switching repo set updates chart data and inline repo list.
- Archived set shows only `eutils` in the repo list.
- On narrow viewport, row 1 and row 2 each wrap independently without overflowing.
- Granularity and timespan selectors function identically to current behavior.
- Route query `?set=archived` round-trips correctly.
