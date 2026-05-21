<script setup lang="ts">
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

</script>

<template>
  <div>
    <!-- Toolbar: repo set + timespan left, cell-mode toggle right -->
    <div class="mb-6 flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-3">
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
          <tbody>
            <tr
              v-for="row in tabData.rows"
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
                        active: {{ formatActiveSpan(row.first_contribution_at, row.last_activity_at) }}; last: {{ formatRelative(row.last_activity_at) }}
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
            </tr>
          </tbody>
        </table>
      </div>

    </template>
  </div>
</template>
