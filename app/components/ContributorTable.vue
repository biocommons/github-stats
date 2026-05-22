<script setup lang="ts">
import { useContributorsTab } from '~/composables/useContributorsTab'
import type { ContribTimespan } from '~/composables/useContributorsTab'
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

function metaRepoLabel(metaKey: string): string {
  const n = tabData.value?.repoSets.find(s => s.metaKey === metaKey)?.repos.length ?? 0
  return `(${n} ${n === 1 ? 'repo' : 'repos'})`
}

function columnColor(repo: string): string {
  if (isMetaColumn(repo)) return '#64748b'
  return repoColor(repo, displayRepos.value)
}

function formatActiveSpan(first: string, last: string): string {
  if (!first || !last) return ''
  const a = new Date(first)
  const b = new Date(last)
  const totalMonths = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  if (totalMonths < 1) return '< 1 mo'
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months} mo`
  if (months === 0) return `${years} y`
  return `${years} y ${months} mo`
}

function formatRelative(iso: string): string {
  if (!iso) return ''
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days < 45) return `${days} d`
  const months = Math.round(days / 30.44)
  if (months < 18) return `${months} mo`
  return `${Math.round(months / 12)} y`
}

const TIMESPANS: { label: string; value: ContribTimespan }[] = [
  { label: 'All time', value: 'all' },
  { label: '12 mo',   value: '12mo' },
  { label: '6 mo',    value: '6mo' },
  { label: '3 mo',    value: '3mo' },
  { label: '1 mo',    value: '1mo' },
]

const EMPTY_COUNTS: ContributorCounts = { commits: 0, issues_opened: 0, prs_opened: 0, reviews_submitted: 0 }

type CellMode = 'quad' | 'radar'
const cellMode = ref<CellMode>('radar')
const CellComponent = computed(() => cellMode.value === 'quad' ? QuadCell : RadarCell)

function repoCounts(byRepo: Record<string, ContributorCounts>, repo: string): ContributorCounts {
  return byRepo[repo] ?? EMPTY_COUNTS
}

function repoCountTotal(c: ContributorCounts): number {
  return c.commits + c.issues_opened + c.prs_opened + c.reviews_submitted
}

const sortKey = ref<string>('total')
const sortDir = ref<'asc' | 'desc'>('desc')

function setSort(key: string) {
  sortKey.value = key
  sortDir.value = 'desc'
}

function sortIndicator(key: string): string {
  if (sortKey.value !== key) return ''
  return sortDir.value === 'asc' ? ' ▴' : ' ▾'
}

const sortedRows = computed(() => {
  if (!tabData.value) return []
  const regular = tabData.value.rows.filter(r => !r.isAnonymous)
  const anon = tabData.value.rows.filter(r => r.isAnonymous)
  const dir = sortDir.value === 'asc' ? 1 : -1
  regular.sort((a, b) => {
    switch (sortKey.value) {
      case 'name':
        return dir * a.login.localeCompare(b.login)
      case 'tenure': {
        const tA = a.first_contribution_at ? Date.now() - new Date(a.first_contribution_at).getTime() : 0
        const tB = b.first_contribution_at ? Date.now() - new Date(b.first_contribution_at).getTime() : 0
        return dir * (tA - tB)
      }
      case 'last_seen':
        return dir * (a.last_activity_at || '').localeCompare(b.last_activity_at || '')
      case 'total':
        return dir * (a.totalCount - b.totalCount)
      default: {
        const cA = repoCountTotal(a.byRepo[sortKey.value] ?? EMPTY_COUNTS)
        const cB = repoCountTotal(b.byRepo[sortKey.value] ?? EMPTY_COUNTS)
        return dir * (cA - cB)
      }
    }
  })
  return [...regular, ...anon]
})

</script>

<template>
  <div>
    <!-- Toolbar: repo set + timespan left, cell-mode toggle right -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-3">
        <!-- Timespan toggle -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Timespan</span>
          <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
            <button
              v-for="ts in TIMESPANS"
              :key="ts.value"
              class="rounded-full px-3 py-1 transition-colors"
              :class="timespan === ts.value
                ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
              @click="timespan = ts.value"
            >
              {{ ts.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Cell mode toggle -->
      <div class="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900">
        <!-- Quad icon -->
        <button
          class="rounded p-1.5 transition-colors"
          :class="cellMode === 'quad' ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'"
          title="Quadrant view"
          @click="cellMode = 'quad'"
        >
          <svg viewBox="0 0 16 16" width="16" height="16">
            <rect x="1" y="1" width="6" height="6" rx="1" fill="rgba(64,81,181,0.8)" />
            <rect x="9" y="1" width="6" height="6" rx="1" fill="rgba(230,159,0,0.8)" />
            <rect x="1" y="9" width="6" height="6" rx="1" fill="rgba(86,180,233,0.8)" />
            <rect x="9" y="9" width="6" height="6" rx="1" fill="rgba(0,158,115,0.8)" />
          </svg>
        </button>
        <!-- Radar icon -->
        <button
          class="rounded p-1.5 transition-colors"
          :class="cellMode === 'radar' ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'"
          title="Radar view"
          @click="cellMode = 'radar'"
        >
          <svg viewBox="0 0 16 16" width="16" height="16">
            <line x1="8" y1="1" x2="8" y2="15" stroke="var(--chart-axis-guide)" stroke-width="0.5" />
            <line x1="1" y1="8" x2="15" y2="8" stroke="var(--chart-axis-guide)" stroke-width="0.5" />
            <polygon points="8,2 13,8 8,14 3,8" fill="rgba(0,189,164,0.25)" stroke="rgba(0,189,164,0.9)" stroke-width="1" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="flex items-center justify-center py-24 text-slate-500">
      Loading…
    </div>

    <!-- Empty state -->
    <div
      v-else-if="!tabData || tabData.rows.length === 0"
      class="flex items-center justify-center py-24 text-slate-500"
    >
      No contributor activity in this period.
    </div>

    <template v-else>
      <!-- Scrollable table -->
      <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table class="w-full text-sm">
          <thead>
            <!-- Row 1: set group headers -->
            <tr class="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:border-slate-800">
              <th class="sticky left-0 z-10 bg-white px-4 py-3 min-w-[200px] dark:bg-slate-950" :rowspan="expandedSet !== '' ? 2 : 1">
                <button class="cursor-pointer hover:text-slate-700 dark:hover:text-slate-200" @click="setSort('name')">Contributor{{ sortIndicator('name') }}</button>
                <div class="mt-0.5 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                  <button class="hover:text-slate-600 dark:hover:text-slate-300" @click.stop="setSort('tenure')">tenure{{ sortIndicator('tenure') }}</button>
                  <span class="mx-1">•</span>
                  <button class="hover:text-slate-600 dark:hover:text-slate-300" @click.stop="setSort('last_seen')">last seen{{ sortIndicator('last_seen') }}</button>
                </div>
              </th>
              <th class="cursor-pointer select-none border-x-2 border-slate-300 bg-slate-100 px-4 py-3 text-center transition-colors hover:text-slate-700 dark:border-slate-600 dark:bg-slate-800/60 dark:hover:text-slate-200" :rowspan="expandedSet !== '' ? 2 : 1" @click="setSort('total')">Total{{ sortIndicator('total') }}</th>
              <th
                v-for="s in tabData?.repoSets ?? []"
                :key="s.key"
                :colspan="expandedSet === s.key ? Math.max(1, s.repos.length) : 1"
                class="select-none border-l-2 border-slate-300 px-4 py-2 text-center dark:border-slate-600"
                :class="expandedSet === s.key ? 'bg-bc-teal-500/10 text-bc-teal-600 dark:text-bc-teal-300' : ''"
              >
                <button
                  class="cursor-pointer transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                  :title="expandedSet === s.key ? `Collapse ${s.label}` : `Expand ${s.label}`"
                  @click="expandedSet = expandedSet === s.key ? '' : s.key"
                >{{ s.label }} {{ expandedSet === s.key ? '▾' : '▸' }}</button>
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
                class="cursor-pointer select-none px-4 py-2 text-center min-w-[72px] transition-colors hover:text-slate-700 dark:hover:text-slate-200"
                :class="isMetaColumn(repo) ? 'border-l-2 border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/40' : ''"
                :title="isMetaColumn(repo) ? `Pooled ${columnLabel(repo).toLowerCase()} repos` : repo"
                @click="setSort(repo)"
              >
                {{ isMetaColumn(repo) ? metaRepoLabel(repo) : columnLabel(repo) }}{{ sortIndicator(repo) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in sortedRows"
              :key="row.login"
              class="border-b border-slate-100 transition-colors hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30"
            >
              <!-- Contributor identity -->
              <td class="sticky left-0 z-10 bg-white px-4 py-2 dark:bg-slate-950">
                <div class="flex items-center gap-2">
                  <template v-if="row.isAnonymous">
                    <span
                      class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      title="Commits with no linked GitHub account"
                    >?</span>
                    <span
                      class="font-mono text-xs italic text-slate-500"
                      title="Commits whose git author email is not linked to a GitHub account"
                    >{{ row.login }}</span>
                  </template>
                  <template v-else>
                    <img
                      :src="row.avatar_url"
                      :alt="row.login"
                      class="h-7 w-7 rounded-full"
                      loading="lazy"
                    />
                    <div>
                      <div class="flex items-center gap-1.5">
                        <a
                          :href="`https://github.com/${row.login}`"
                          target="_blank"
                          rel="noopener"
                          class="font-mono text-slate-700 transition-colors hover:text-bc-teal-600 dark:text-slate-300 dark:hover:text-bc-teal-300"
                        >{{ row.login }}</a>
                        <span v-if="row.isTop" title="Top contributor — top 3 by activity" class="text-base leading-none">🚀</span>
                        <span v-if="row.isNew" title="New contributor — first contribution &lt;90 days ago" class="text-base leading-none">🌱</span>
                      </div>
                      <div v-if="row.first_contribution_at" class="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                        active {{ formatActiveSpan(row.first_contribution_at, row.last_activity_at) }} • last {{ formatRelative(row.last_activity_at) }}
                      </div>
                    </div>
                  </template>
                </div>
              </td>

              <!-- Total cell -->
              <td class="border-x-2 border-slate-300 bg-slate-100 px-4 py-2 dark:border-slate-600 dark:bg-slate-800/60">
                <div class="flex justify-center">
                  <component :is="CellComponent" :counts="row.total" :maxes="tabData.colMaxes['total']!" />
                </div>
              </td>

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
                    :ring-color="row.expertRepos.has(repo) && repoCountTotal(repoCounts(row.byRepo, repo)) > 0 ? columnColor(repo) : undefined"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    <div class="mt-2 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
      <div class="h-4 w-4 rounded flex-shrink-0" style="outline: 2px solid #94a3b8; outline-offset: 2px;" />
      <span>Top contributors for each repo who collectively account for ≥80% of all-time activity</span>
    </div>

    </template>
  </div>
</template>
