<script setup lang="ts">
import type { FlowStats } from '~/composables/useFlowStats'
import { repoDisplayName } from '~/config'

const props = defineProps<{
  issueStats: FlowStats
  prStats: FlowStats
  allRepos: string[]
}>()

const REPO_COLORS = [
  '#34d399',
  '#60a5fa',
  '#f472b6',
  '#fb923c',
  '#a78bfa',
  '#facc15',
  '#22d3ee',
]

function repoColor(repo: string): string {
  return REPO_COLORS[props.allRepos.indexOf(repo) % REPO_COLORS.length] ?? '#94a3b8'
}

function formatDays(days: number | null): string {
  if (days === null) return '—'
  if (days < 1) return '<1d'
  if (days === 1) return '1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${(days / 30).toFixed(1)}mo`
  return `${(days / 365).toFixed(1)}yr`
}

const maxIssueMedian = computed(() =>
  Math.max(0, ...props.allRepos.map(r => props.issueStats.perRepo[r]?.medianDays ?? 0))
)

const maxPrMedian = computed(() =>
  Math.max(0, ...props.allRepos.map(r => props.prStats.perRepo[r]?.medianDays ?? 0))
)

function barPct(days: number | null, max: number): number {
  if (days === null || max === 0) return 0
  return (days / max) * 100
}
</script>

<template>
  <div class="space-y-8">
    <!-- Two bar charts side by side -->
    <div class="grid gap-8 sm:grid-cols-2">
      <div>
        <h3 class="mb-4 text-sm font-semibold text-slate-300">Issue median resolution time</h3>
        <div class="space-y-3">
          <div v-for="repo in allRepos" :key="repo" class="flex items-center gap-3">
            <span class="w-20 shrink-0 truncate text-right text-xs text-slate-400">{{ repoDisplayName(repo) }}</span>
            <div class="flex flex-1 items-center gap-2">
              <div class="h-5 flex-1 overflow-hidden rounded bg-slate-800">
                <div
                  class="h-full rounded transition-all"
                  :style="{
                    width: `${barPct(issueStats.perRepo[repo]?.medianDays ?? null, maxIssueMedian)}%`,
                    background: repoColor(repo),
                  }"
                  :title="`${repoDisplayName(repo)}: ${formatDays(issueStats.perRepo[repo]?.medianDays ?? null)}`"
                />
              </div>
              <span class="w-10 shrink-0 text-right text-xs text-slate-400">
                {{ formatDays(issueStats.perRepo[repo]?.medianDays ?? null) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 class="mb-4 text-sm font-semibold text-slate-300">PR median resolution time</h3>
        <div class="space-y-3">
          <div v-for="repo in allRepos" :key="repo" class="flex items-center gap-3">
            <span class="w-20 shrink-0 truncate text-right text-xs text-slate-400">{{ repoDisplayName(repo) }}</span>
            <div class="flex flex-1 items-center gap-2">
              <div class="h-5 flex-1 overflow-hidden rounded bg-slate-800">
                <div
                  class="h-full rounded transition-all"
                  :style="{
                    width: `${barPct(prStats.perRepo[repo]?.medianDays ?? null, maxPrMedian)}%`,
                    background: repoColor(repo),
                  }"
                  :title="`${repoDisplayName(repo)}: ${formatDays(prStats.perRepo[repo]?.medianDays ?? null)}`"
                />
              </div>
              <span class="w-10 shrink-0 text-right text-xs text-slate-400">
                {{ formatDays(prStats.perRepo[repo]?.medianDays ?? null) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary table -->
    <div class="overflow-hidden rounded-lg border border-slate-800">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-800 bg-slate-900/60">
            <th class="px-4 py-3 text-left font-medium text-slate-400">Repo</th>
            <th class="px-4 py-3 text-right font-medium text-slate-400">Issue median</th>
            <th
              class="px-4 py-3 text-right font-medium text-slate-400"
              title="90% of issues closed within this many days — the remaining 10% took longer"
            >
              Issue p90 <span class="font-normal text-slate-500">ⓘ</span>
            </th>
            <th class="px-4 py-3 text-right font-medium text-slate-400">PR median</th>
            <th
              class="px-4 py-3 text-right font-medium text-slate-400"
              title="90% of PRs merged within this many days — the remaining 10% took longer"
            >
              PR p90 <span class="font-normal text-slate-500">ⓘ</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="repo in allRepos"
            :key="repo"
            class="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30"
          >
            <td class="flex items-center gap-2 px-4 py-3">
              <span
                class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                :style="{ background: repoColor(repo) }"
              />
              <span class="text-slate-200">{{ repoDisplayName(repo) }}</span>
            </td>
            <td class="px-4 py-3 text-right text-slate-300">
              {{ formatDays(issueStats.perRepo[repo]?.medianDays ?? null) }}
            </td>
            <td class="px-4 py-3 text-right text-slate-300">
              {{ formatDays(issueStats.perRepo[repo]?.p90Days ?? null) }}
            </td>
            <td class="px-4 py-3 text-right text-slate-300">
              {{ formatDays(prStats.perRepo[repo]?.medianDays ?? null) }}
            </td>
            <td class="px-4 py-3 text-right text-slate-300">
              {{ formatDays(prStats.perRepo[repo]?.p90Days ?? null) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
