<script setup lang="ts">
import { useContributorsTab, type ContribTimespan } from '~/composables/useContributorsTab'
import type { ContributorCounts } from '~/composables/useContributorStats'
import { repoDisplayName } from '~/config'

const { tabData, timespan, isLoading } = useContributorsTab()

const TIMESPANS: { label: string; value: ContribTimespan }[] = [
  { label: 'All time', value: 'all' },
  { label: 'Last 90d', value: '90d' },
  { label: 'Last 30d', value: '30d' },
]

const EMPTY_COUNTS: ContributorCounts = { commits: 0, issues_opened: 0, prs_opened: 0, reviews_submitted: 0 }

function repoCounts(byRepo: Record<string, ContributorCounts>, repo: string): ContributorCounts {
  return byRepo[repo] ?? EMPTY_COUNTS
}

</script>

<template>
  <div>
    <!-- Timespan selector -->
    <div class="mb-6 flex items-center gap-2">
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

              <!-- Total quad cell -->
              <td class="px-4 py-2">
                <div class="flex justify-center">
                  <QuadCell :counts="row.total" :maxes="tabData.colMaxes['total']!" />
                </div>
              </td>

              <!-- Per-repo quad cells -->
              <td
                v-for="repo in tabData.repos"
                :key="repo"
                class="px-4 py-2"
              >
                <div class="flex justify-center">
                  <QuadCell
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
        <!-- Quadrant key -->
        <div>
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
