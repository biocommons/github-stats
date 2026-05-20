<script setup lang="ts">
import type { FlowStats, ResolutionBucket } from '~/composables/useFlowStats'
import { RESOLUTION_BUCKETS } from '~/composables/useFlowStats'
import { repoDisplayName } from '~/config'

const props = defineProps<{
  stats: FlowStats
  itemLabel: string
}>()

const BUCKET_COLORS: Record<ResolutionBucket, string> = {
  '0–1d':    '#00bda4',
  '2–7d':    '#60a5fa',
  '8–30d':   '#f472b6',
  '31–90d':  '#fb923c',
  '91–365d': '#a78bfa',
  '>365d':   '#facc15',
}

const maxClosed = computed(() =>
  Math.max(0, ...props.stats.repos.map(r => props.stats.perRepo[r]?.totalClosed ?? 0))
)

function bucketCount(repo: string, bucket: ResolutionBucket): number {
  return props.stats.resolutionRows.find(r => r.bucket === bucket)?.byRepo[repo] ?? 0
}

function fracPct(repo: string, bucket: ResolutionBucket): number {
  const total = props.stats.perRepo[repo]?.totalClosed ?? 0
  return total > 0 ? (bucketCount(repo, bucket) / total) * 100 : 0
}

function absPct(repo: string, bucket: ResolutionBucket): number {
  return maxClosed.value > 0 ? (bucketCount(repo, bucket) / maxClosed.value) * 100 : 0
}

function formatDays(days: number | null): string {
  if (days === null) return '—'
  if (days < 1) return '<1d'
  if (days === 1) return '1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${(days / 30).toFixed(1)}mo`
  return `${(days / 365).toFixed(1)}yr`
}

const closedLabel = computed(() => props.itemLabel === 'PRs' ? 'merged PRs' : `closed ${props.itemLabel}`)

const hoveredRepo = ref<string | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

function tooltipRows(repo: string) {
  const total = props.stats.perRepo[repo]?.totalClosed ?? 0
  return RESOLUTION_BUCKETS.map(bucket => {
    const count = bucketCount(repo, bucket)
    const pct = total > 0 ? (count / total) * 100 : 0
    return { bucket, count, pct, color: BUCKET_COLORS[bucket] }
  })
}

function onBarEnter(repo: string, event: MouseEvent) {
  hoveredRepo.value = repo
  updatePos(event)
}

function onBarMove(event: MouseEvent) {
  updatePos(event)
}

function onBarLeave() {
  hoveredRepo.value = null
}

function updatePos(event: MouseEvent) {
  const offset = 14
  const tipW = 200
  const tipH = 170
  const x = event.clientX + offset
  const y = event.clientY + offset
  tooltipX.value = x + tipW > window.innerWidth  ? event.clientX - tipW - offset : x
  tooltipY.value = y + tipH > window.innerHeight ? event.clientY - tipH - offset : y
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-bc-indigo-600 dark:text-bc-indigo-400">Resolution time by repo</h3>
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span
          v-for="bucket in RESOLUTION_BUCKETS"
          :key="bucket"
          class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
        >
          <span class="inline-block h-2 w-3 rounded-sm" :style="{ background: BUCKET_COLORS[bucket] }" />
          {{ bucket }}
        </span>
      </div>
    </div>

    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
            <th class="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Repo</th>
            <th class="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
              {{ closedLabel.split(' ')[0] === 'merged' ? 'Merged' : 'Closed' }}
            </th>
            <th class="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">Median</th>
            <th
              class="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400"
              title="90th percentile — 10% of items took longer than this"
            >
              p90 <span class="font-normal text-slate-400 dark:text-slate-500">ⓘ</span>
            </th>
            <th class="min-w-40 px-4 py-3 font-medium text-slate-500 dark:text-slate-400">% by bucket</th>
            <th class="min-w-40 px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Count by bucket</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="repo in stats.repos"
            :key="repo"
            class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
          >
            <td class="px-4 py-3 text-slate-700 dark:text-slate-200">{{ repoDisplayName(repo) }}</td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
              {{ (stats.perRepo[repo]?.totalClosed ?? 0).toLocaleString() }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
              {{ formatDays(stats.perRepo[repo]?.medianDays ?? null) }}
            </td>
            <td class="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">
              {{ formatDays(stats.perRepo[repo]?.p90Days ?? null) }}
            </td>

            <!-- Fractional bar -->
            <td class="px-4 py-2">
              <div
                class="flex h-5 cursor-default overflow-hidden rounded bg-slate-200 dark:bg-slate-800"
                @mouseenter="onBarEnter(repo, $event)"
                @mousemove="onBarMove"
                @mouseleave="onBarLeave"
              >
                <div
                  v-for="bucket in RESOLUTION_BUCKETS"
                  :key="bucket"
                  :style="{ width: `${fracPct(repo, bucket)}%`, background: BUCKET_COLORS[bucket] }"
                />
              </div>
            </td>

            <!-- Absolute bar -->
            <td class="px-4 py-2">
              <div
                class="flex h-5 cursor-default overflow-hidden rounded bg-slate-200 dark:bg-slate-800"
                @mouseenter="onBarEnter(repo, $event)"
                @mousemove="onBarMove"
                @mouseleave="onBarLeave"
              >
                <div
                  v-for="bucket in RESOLUTION_BUCKETS"
                  :key="bucket"
                  :style="{ width: `${absPct(repo, bucket)}%`, background: BUCKET_COLORS[bucket] }"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Aggregate summary -->
    <div class="flex flex-wrap gap-8 rounded-lg border border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/60">
      <div>
        <p class="mb-0.5 text-xs uppercase tracking-wide text-slate-500">Total {{ closedLabel }}</p>
        <p class="text-2xl font-semibold text-slate-700 dark:text-slate-200">{{ stats.totalClosed.toLocaleString() }}</p>
      </div>
      <div>
        <p class="mb-0.5 text-xs uppercase tracking-wide text-slate-500">Median</p>
        <p class="text-2xl font-semibold text-slate-700 dark:text-slate-200">{{ formatDays(stats.medianDays) }}</p>
      </div>
      <div :title="`90% of ${closedLabel} resolved within this many days`">
        <p class="mb-0.5 text-xs uppercase tracking-wide text-slate-500">p90 <span class="normal-case text-slate-400 dark:text-slate-500">ⓘ</span></p>
        <p class="text-2xl font-semibold text-slate-700 dark:text-slate-200">{{ formatDays(stats.p90Days) }}</p>
      </div>
    </div>
  </div>

  <!-- Tooltip -->
  <Teleport to="body">
    <div
      v-if="hoveredRepo"
      class="pointer-events-none fixed z-50 min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      <p class="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{{ repoDisplayName(hoveredRepo) }}</p>
      <table class="w-full text-xs">
        <tbody>
          <tr v-for="row in tooltipRows(hoveredRepo)" :key="row.bucket">
            <td class="py-0.5 pr-2">
              <span
                class="inline-block h-2 w-3 rounded-sm"
                :style="{ background: row.color }"
              />
            </td>
            <td class="py-0.5 pr-3 text-slate-500 dark:text-slate-400">{{ row.bucket }}</td>
            <td class="py-0.5 pr-3 text-right tabular-nums text-slate-800 dark:text-slate-200">{{ row.count.toLocaleString() }}</td>
            <td class="py-0.5 text-right tabular-nums text-slate-400 dark:text-slate-500">{{ row.pct.toFixed(0) }}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  </Teleport>
</template>
