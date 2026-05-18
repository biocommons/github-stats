<script setup lang="ts">
import type { FlowStats } from '~/composables/useFlowStats'
import { RESOLUTION_BUCKETS } from '~/composables/useFlowStats'

const props = defineProps<{
  stats: FlowStats
  allRepos: string[]
  itemLabel: string  // e.g. "issues" or "PRs"
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

const totalClosed = computed(() => props.stats.totalClosed)

function stackSegments(bucket: (typeof RESOLUTION_BUCKETS)[number]) {
  const row = props.stats.resolutionRows.find(r => r.bucket === bucket)
  if (!row) return []
  return props.allRepos
    .filter(repo => (row.byRepo[repo] ?? 0) > 0)
    .map(repo => ({
      repo,
      count: row.byRepo[repo] ?? 0,
      pct: totalClosed.value > 0 ? ((row.byRepo[repo] ?? 0) / totalClosed.value) * 100 : 0,
    }))
}

const maxBucketTotal = computed(() =>
  Math.max(1, ...props.stats.resolutionRows.map(r => r.total)),
)

function formatDays(days: number | null): string {
  if (days === null) return '—'
  if (days < 1) return '<1d'
  if (days === 1) return '1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${(days / 30).toFixed(1)}mo`
  return `${(days / 365).toFixed(1)}yr`
}

// e.g. "issues" → "closed issues", "PRs" → "merged PRs"
const closedLabel = computed(() => props.itemLabel === 'PRs' ? 'merged PRs' : `closed ${props.itemLabel}`)
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold text-slate-300">Resolution time distribution</h3>

    <div class="grid gap-8 sm:grid-cols-2">
      <!-- % panel -->
      <div>
        <p class="mb-3 text-sm text-slate-400">% of all {{ closedLabel }}</p>
        <div class="space-y-2.5">
          <div v-for="bucket in RESOLUTION_BUCKETS" :key="bucket">
            <div class="flex items-center gap-2 text-sm">
              <span class="w-16 shrink-0 text-slate-300">{{ bucket }}</span>
              <div class="flex h-5 flex-1 overflow-hidden rounded bg-slate-800">
                <div
                  v-for="seg in stackSegments(bucket)"
                  :key="seg.repo"
                  :style="{ width: `${seg.pct}%`, background: repoColor(seg.repo) }"
                  :title="`${seg.repo}: ${seg.count} (${seg.pct.toFixed(1)}%)`"
                />
              </div>
              <span class="w-10 shrink-0 text-right text-slate-400">
                {{ stats.resolutionRows.find(r => r.bucket === bucket)?.total ?? 0 }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Count panel -->
      <div>
        <p class="mb-3 text-sm text-slate-400">raw count per bucket</p>
        <div class="space-y-2.5">
          <div v-for="bucket in RESOLUTION_BUCKETS" :key="bucket">
            <div class="flex items-center gap-2 text-sm">
              <span class="w-16 shrink-0 text-slate-300">{{ bucket }}</span>
              <div class="flex h-5 flex-1 overflow-hidden rounded bg-slate-800">
                <div
                  v-for="seg in stackSegments(bucket)"
                  :key="seg.repo"
                  :style="{ width: `${(seg.count / maxBucketTotal) * 100}%`, background: repoColor(seg.repo) }"
                  :title="`${seg.repo}: ${seg.count}`"
                />
              </div>
              <span class="w-10 shrink-0 text-right text-slate-400">
                {{ stats.resolutionRows.find(r => r.bucket === bucket)?.total ?? 0 }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="mt-2 flex flex-wrap gap-8 rounded-lg border border-slate-800 bg-slate-900/60 px-6 py-4">
      <div>
        <p class="mb-0.5 text-xs uppercase tracking-wide text-slate-500">Total {{ closedLabel }}</p>
        <p class="text-2xl font-semibold text-slate-200">{{ stats.totalClosed.toLocaleString() }}</p>
      </div>
      <div>
        <p class="mb-0.5 text-xs uppercase tracking-wide text-slate-500">Median</p>
        <p class="text-2xl font-semibold text-slate-200">{{ formatDays(stats.medianDays) }}</p>
      </div>
      <div :title="`90% of ${closedLabel} resolved within this many days — the remaining 10% took longer`">
        <p class="mb-0.5 text-xs uppercase tracking-wide text-slate-500">p90 <span class="normal-case text-slate-600">ⓘ</span></p>
        <p class="text-2xl font-semibold text-slate-200">{{ formatDays(stats.p90Days) }}</p>
      </div>
    </div>
  </div>
</template>
