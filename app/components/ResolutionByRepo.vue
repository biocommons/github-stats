<script setup lang="ts">
import type { ResolutionBucket, ResolutionWindow, WindowResolution } from '~/composables/useFlowStats'
import { RESOLUTION_BUCKETS, RESOLUTION_WINDOWS } from '~/composables/useFlowStats'
import { repoDisplayName, repoColor, contrastColor } from '~/config'

const props = defineProps<{
  resolutionWindows: Record<ResolutionWindow, WindowResolution | null>
  allRepos: string[]
  itemLabel: string
}>()

const BUCKET_COLORS: Record<ResolutionBucket, string> = {
  '0–1d':    '#6ea059',
  '2–7d':    '#5586d3',
  '8–30d':   '#d28e46',
  '31–90d':  '#d3b440',
  '91–365d': '#7e6ab3',
  '>365d':   '#c7594a',
}

const closedLabel = computed(() => props.itemLabel === 'PRs' ? 'merged PRs' : `closed ${props.itemLabel}`)

// Repos that have at least one close in the all-time window
const repos = computed(() =>
  props.allRepos.filter(r => (props.resolutionWindows.all?.perRepo[r]?.totalClosed ?? 0) > 0)
)

const allWindow = computed(() => props.resolutionWindows.all)

const maxRepoClosed = computed(() =>
  Math.max(0, ...repos.value.map(r => allWindow.value?.perRepo[r]?.totalClosed ?? 0))
)

function repoMedianValues(repo: string): (number | null)[] {
  return RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.perRepo[repo]?.medianDays ?? null)
}

function repoP90Values(repo: string): (number | null)[] {
  return RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.perRepo[repo]?.p90Days ?? null)
}

const overallMedianValues = computed(() =>
  RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.medianDays ?? null)
)

const overallP90Values = computed(() =>
  RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.p90Days ?? null)
)

function bucketCount(repo: string, bucket: ResolutionBucket): number {
  return allWindow.value?.resolutionRows.find(r => r.bucket === bucket)?.byRepo[repo] ?? 0
}

function fracPct(repo: string, bucket: ResolutionBucket): number {
  const total = allWindow.value?.perRepo[repo]?.totalClosed ?? 0
  return total > 0 ? (bucketCount(repo, bucket) / total) * 100 : 0
}

function absPct(repo: string, bucket: ResolutionBucket): number {
  return maxRepoClosed.value > 0 ? (bucketCount(repo, bucket) / maxRepoClosed.value) * 100 : 0
}

// Aggregate bucket fraction for totals row
function overallFracPct(bucket: ResolutionBucket): number {
  const total = allWindow.value?.totalClosed ?? 0
  const count = allWindow.value?.resolutionRows.find(r => r.bucket === bucket)?.total ?? 0
  return total > 0 ? (count / total) * 100 : 0
}

const hoveredRepo = ref<string | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

function tooltipRows(repo: string) {
  const total = allWindow.value?.perRepo[repo]?.totalClosed ?? 0
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

function onBarMove(event: MouseEvent) { updatePos(event) }
function onBarLeave() { hoveredRepo.value = null }

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
    <div>
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">Resolution time by repo</h3>
      <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">How long {{ closedLabel }} stayed open before being resolved. Trend lines show all-time → 12mo → 6mo → 3mo → 1mo; green = improving, red = degrading.</p>
    </div>

    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
            <th class="px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Repo</th>
            <th
              class="w-px px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400"
              title="Median resolution time. Trend from all-time → 12mo → 6mo → 3mo → 1mo. Label shows most recent value."
            >Median</th>
            <th
              class="w-px px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400"
              title="90th-percentile resolution time — 10% of items took longer than this. Same time windows as Median."
            >P90 <span class="font-normal text-slate-400 dark:text-slate-500">ⓘ</span></th>
            <th class="min-w-36 px-4 py-3 font-medium text-slate-500 dark:text-slate-400">% by bucket</th>
            <th class="min-w-36 px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Count by bucket</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="repo in repos"
            :key="repo"
            class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
          >
            <td class="px-4 py-2">
              <span
                class="inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium"
                :style="{ borderColor: repoColor(repo, allRepos), background: repoColor(repo, allRepos) + 'bf', color: contrastColor(repoColor(repo, allRepos), 0.75) }"
              >{{ repoDisplayName(repo) }}</span>
            </td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline :values="repoMedianValues(repo)" />
            </td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline :values="repoP90Values(repo)" />
            </td>
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
        <tfoot>
          <tr class="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
            <td class="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">All repos</td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline :values="overallMedianValues" />
            </td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline :values="overallP90Values" />
            </td>
            <td class="px-4 py-2">
              <div class="flex h-5 overflow-hidden rounded bg-slate-200 dark:bg-slate-800">
                <div
                  v-for="bucket in RESOLUTION_BUCKETS"
                  :key="bucket"
                  :style="{ width: `${overallFracPct(bucket)}%`, background: BUCKET_COLORS[bucket] }"
                />
              </div>
            </td>
            <td class="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">
              {{ (allWindow?.totalClosed ?? 0).toLocaleString() }} total
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Legend -->
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">Resolution time buckets:</span>
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
              <span class="inline-block h-2 w-3 rounded-sm" :style="{ background: row.color }" />
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
