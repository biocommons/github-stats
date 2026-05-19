<script setup lang="ts">
import { useContributorsTab, type ContribTimespan } from '~/composables/useContributorsTab'
import type { ContributorCounts } from '~/composables/useContributorStats'
import { repoDisplayName } from '~/config'
import QuadCell from '~/components/QuadCell.vue'
import RadarCell from '~/components/RadarCell.vue'

const { tabData, timespan, isLoading } = useContributorsTab()

const TIMESPANS: { label: string; value: ContribTimespan }[] = [
  { label: 'All time', value: 'all' },
  { label: 'Last 90d', value: '90d' },
  { label: 'Last 30d', value: '30d' },
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
    <!-- Toolbar: timespan left, cell-mode toggle right -->
    <div class="mb-6 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Timespan</span>
        <div class="flex items-center rounded-full border border-slate-700 bg-slate-900 p-0.5 text-xs font-medium">
          <button
            v-for="ts in TIMESPANS"
            :key="ts.value"
            class="rounded-full px-3 py-1 transition-colors"
            :class="timespan === ts.value
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'text-slate-400 hover:text-slate-200'"
            @click="timespan = ts.value"
          >
            {{ ts.label }}
          </button>
        </div>
      </div>

      <!-- Cell mode toggle -->
      <div class="flex items-center rounded-md border border-slate-700 bg-slate-900 p-0.5">
        <!-- Quad icon -->
        <button
          class="rounded p-1.5 transition-colors"
          :class="cellMode === 'quad' ? 'bg-slate-700' : 'hover:bg-slate-800'"
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
          :class="cellMode === 'radar' ? 'bg-slate-700' : 'hover:bg-slate-800'"
          title="Radar view"
          @click="cellMode = 'radar'"
        >
          <svg viewBox="0 0 16 16" width="16" height="16">
            <line x1="8" y1="1" x2="8" y2="15" stroke="rgb(100,116,139)" stroke-width="0.5" opacity="0.5" />
            <line x1="1" y1="8" x2="15" y2="8" stroke="rgb(100,116,139)" stroke-width="0.5" opacity="0.5" />
            <polygon points="8,2 13,8 8,14 3,8" fill="rgba(52,211,153,0.25)" stroke="rgba(52,211,153,0.9)" stroke-width="1" stroke-linejoin="round" />
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
      <div class="overflow-x-auto rounded-lg border border-slate-800">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-800 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
              <th class="sticky left-0 z-10 bg-slate-950 px-4 py-3 min-w-[200px]">Contributor</th>
              <th class="px-4 py-3 min-w-[136px]">Trend</th>
              <th class="px-4 py-3 text-center">Total</th>
              <th
                v-for="repo in tabData.repos"
                :key="repo"
                class="px-4 py-3 text-center min-w-[72px]"
                :title="repo"
              >
                {{ repoDisplayName(repo) }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in tabData.rows"
              :key="row.login"
              class="border-b border-slate-800/60 transition-colors hover:bg-slate-800/30"
            >
              <!-- Contributor identity -->
              <td class="sticky left-0 z-10 bg-slate-950 px-4 py-2">
                <div class="flex items-center gap-2">
                  <template v-if="row.isAnonymous">
                    <span
                      class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-xs text-slate-400"
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
                    <a
                      :href="`https://github.com/${row.login}`"
                      target="_blank"
                      rel="noopener"
                      class="font-mono text-slate-300 hover:text-emerald-300 transition-colors"
                    >{{ row.login }}</a>
                    <span v-if="row.isTop" title="Top contributor — top 3 by activity" class="text-base leading-none">🚀</span>
                    <span v-if="row.isNew" title="New contributor — first contribution &lt;90 days ago" class="text-base leading-none">🌱</span>
                  </template>
                </div>
              </td>

              <!-- 12-month sparkline -->
              <td class="px-4 py-2 text-emerald-400">
                <SparkLine :values="row.sparkline" />
              </td>

              <!-- Total cell -->
              <td class="px-4 py-2">
                <div class="flex justify-center">
                  <component :is="CellComponent" :counts="row.total" :maxes="tabData.colMaxes['total']!" />
                </div>
              </td>

              <!-- Per-repo cells -->
              <td
                v-for="repo in tabData.repos"
                :key="repo"
                class="px-4 py-2"
              >
                <div class="flex justify-center">
                  <component
                    :is="CellComponent"
                    :counts="repoCounts(row.byRepo, repo)"
                    :maxes="tabData.colMaxes[repo]!"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Legend -->
      <div class="mt-8 flex flex-col gap-6 sm:flex-row sm:gap-12">
        <!-- Quad key -->
        <div v-if="cellMode === 'quad'">
          <p class="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Quadrant key</p>
          <div class="flex items-start gap-6">
            <div class="grid grid-cols-2 gap-1 text-[10px] text-slate-400">
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm" style="background: rgba(64,81,181,0.75)" />
                commits
              </div>
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm" style="background: rgba(230,159,0,0.75)" />
                issues
              </div>
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm" style="background: rgba(86,180,233,0.75)" />
                PRs
              </div>
              <div class="flex items-center gap-1.5">
                <span class="inline-block h-3 w-3 rounded-sm" style="background: rgba(0,158,115,0.75)" />
                reviews
              </div>
            </div>
            <div class="text-[10px] text-slate-500">
              <p>Shade = relative activity</p>
              <p>within each column</p>
            </div>
          </div>
        </div>

        <!-- Radar key -->
        <div v-else>
          <p class="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Radar axes</p>
          <div class="flex items-start gap-6">
            <div class="shrink-0">
              <svg viewBox="0 0 40 40" width="40" height="40">
                <line x1="20" y1="4" x2="20" y2="36" stroke="rgb(100,116,139)" stroke-width="0.5" opacity="0.4" />
                <line x1="4" y1="20" x2="36" y2="20" stroke="rgb(100,116,139)" stroke-width="0.5" opacity="0.4" />
                <polygon points="20,6 32,20 20,34 8,20" fill="rgba(52,211,153,0.25)" stroke="rgba(52,211,153,0.85)" stroke-width="1.2" stroke-linejoin="round" />
              </svg>
            </div>
            <div class="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-slate-400">
              <div>↑ commits</div>
              <div>→ PRs</div>
              <div>↓ reviews</div>
              <div>← issues</div>
            </div>
            <div class="text-[10px] text-slate-500">
              <p>Reach = relative activity</p>
              <p>within each column</p>
            </div>
          </div>
        </div>

        <!-- Badge key -->
        <div>
          <p class="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Badges</p>
          <div class="flex flex-col gap-1.5 text-[10px] text-slate-400">
            <div
              class="flex items-center gap-2"
              title="First contribution less than 90 days ago, with 3 or more all-time contributions"
            >
              <span class="text-sm">🌱</span>
              New contributor — first contribution &lt;90 days ago
            </div>
            <div class="flex items-center gap-2" title="Top 3 contributors by total activity in the selected timespan">
              <span class="text-sm">🚀</span>
              Top contributor — top 3 by activity
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
