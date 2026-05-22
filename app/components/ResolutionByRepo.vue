<script setup lang="ts">
import type { ResolutionBucket, ResolutionWindow, WindowResolution } from '~/composables/useFlowStats'
import { RESOLUTION_BUCKETS, RESOLUTION_WINDOWS } from '~/composables/useFlowStats'
import { repoDisplayName, repoColor, contrastColor, GITHUB_ORG } from '~/config'

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

const showOpen = ref(true)

// Repos that have at least one closed item in the all-time window
const repos = computed(() =>
  props.allRepos.filter(r => (props.resolutionWindows.all?.perRepo[r]?.totalClosed ?? 0) > 0)
)

const allWindow = computed(() => props.resolutionWindows.all)


function repoTotal(repo: string): number {
  const closed = allWindow.value?.perRepo[repo]?.totalClosed ?? 0
  return showOpen.value ? closed + (allWindow.value?.openByRepo[repo] ?? 0) : closed
}

const maxRepoTotal = computed(() => Math.max(0, ...repos.value.map(r => repoTotal(r))))

function repoMedianValues(repo: string): (number | null)[] {
  return RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.perRepo[repo]?.medianDays ?? null)
}

function repoP90Values(repo: string): (number | null)[] {
  return RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.perRepo[repo]?.p90Days ?? null)
}

function repoMedianWithOpenValues(repo: string): (number | null)[] {
  return RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.perRepo[repo]?.medianDaysWithOpen ?? null)
}

function repoP90WithOpenValues(repo: string): (number | null)[] {
  return RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.perRepo[repo]?.p90DaysWithOpen ?? null)
}

const overallMedianValues = computed(() =>
  RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.medianDays ?? null)
)

const overallP90Values = computed(() =>
  RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.p90Days ?? null)
)

const overallMedianWithOpenValues = computed(() =>
  RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.medianDaysWithOpen ?? null)
)

const overallP90WithOpenValues = computed(() =>
  RESOLUTION_WINDOWS.map(w => props.resolutionWindows[w]?.p90DaysWithOpen ?? null)
)

const HATCH_STYLE = {
  backgroundImage: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0, rgba(255,255,255,0.35) 2px, transparent 0, transparent 50%)',
  backgroundSize: '5px 5px',
}

function closedBucketCount(repo: string, bucket: ResolutionBucket): number {
  return allWindow.value?.resolutionRows.find(r => r.bucket === bucket)?.byRepo[repo] ?? 0
}

function openBucketCount(repo: string, bucket: ResolutionBucket): number {
  if (!showOpen.value) return 0
  const withOpen = allWindow.value?.resolutionRowsWithOpen.find(r => r.bucket === bucket)?.byRepo[repo] ?? 0
  return withOpen - closedBucketCount(repo, bucket)
}


function closedFracPct(repo: string, bucket: ResolutionBucket): number {
  const total = repoTotal(repo)
  return total > 0 ? (closedBucketCount(repo, bucket) / total) * 100 : 0
}

function openFracPct(repo: string, bucket: ResolutionBucket): number {
  const total = repoTotal(repo)
  return total > 0 ? (openBucketCount(repo, bucket) / total) * 100 : 0
}

function closedAbsPct(repo: string, bucket: ResolutionBucket): number {
  return maxRepoTotal.value > 0 ? (closedBucketCount(repo, bucket) / maxRepoTotal.value) * 100 : 0
}

function openAbsPct(repo: string, bucket: ResolutionBucket): number {
  return maxRepoTotal.value > 0 ? (openBucketCount(repo, bucket) / maxRepoTotal.value) * 100 : 0
}

function closedOverallFracPct(bucket: ResolutionBucket): number {
  const totalClosed = allWindow.value?.totalClosed ?? 0
  const totalOpen = showOpen.value ? (allWindow.value?.totalOpen ?? 0) : 0
  const total = totalClosed + totalOpen
  const count = allWindow.value?.resolutionRows.find(r => r.bucket === bucket)?.total ?? 0
  return total > 0 ? (count / total) * 100 : 0
}

function openOverallFracPct(bucket: ResolutionBucket): number {
  if (!showOpen.value) return 0
  const totalClosed = allWindow.value?.totalClosed ?? 0
  const totalOpen = allWindow.value?.totalOpen ?? 0
  const total = totalClosed + totalOpen
  const withOpen = allWindow.value?.resolutionRowsWithOpen.find(r => r.bucket === bucket)?.total ?? 0
  const closed = allWindow.value?.resolutionRows.find(r => r.bucket === bucket)?.total ?? 0
  return total > 0 ? ((withOpen - closed) / total) * 100 : 0
}


const ALL_REPOS_KEY = '__all__'

const hoveredRepo = ref<string | null>(null)
const tooltipX = ref(0)
const tooltipY = ref(0)

function tooltipRows(repo: string) {
  const totalClosed = repo === ALL_REPOS_KEY
    ? (allWindow.value?.totalClosed ?? 0)
    : (allWindow.value?.resolutionRows.reduce((s, r) => s + (r.byRepo[repo] ?? 0), 0) ?? 0)
  const totalOpen = showOpen.value
    ? (repo === ALL_REPOS_KEY
        ? (allWindow.value?.totalOpen ?? 0)
        : (allWindow.value?.openByRepo[repo] ?? 0))
    : 0
  const total = totalClosed + totalOpen

  return RESOLUTION_BUCKETS.map(bucket => {
    const closed = repo === ALL_REPOS_KEY
      ? (allWindow.value?.resolutionRows.find(r => r.bucket === bucket)?.total ?? 0)
      : closedBucketCount(repo, bucket)
    const open = showOpen.value
      ? (repo === ALL_REPOS_KEY
          ? ((allWindow.value?.resolutionRowsWithOpen.find(r => r.bucket === bucket)?.total ?? 0) - closed)
          : openBucketCount(repo, bucket))
      : 0
    return {
      bucket,
      color: BUCKET_COLORS[bucket],
      closedCount: closed,
      closedPct: total > 0 ? (closed / total) * 100 : 0,
      openCount: open,
      openPct: total > 0 ? (open / total) * 100 : 0,
    }
  })
}

function openIssuesUrl(repo: string): string {
  const kind = props.itemLabel === 'PRs' ? 'is:pr' : 'is:issue'
  return `https://github.com/${GITHUB_ORG}/${repo}/issues?q=is:open+${kind}`
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
      <p class="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        How long {{ closedLabel }} stayed open before being resolved.
        Trend sparklines compare five cohorts of items grouped by when they were <em>opened</em>:
        all-time, opened within the last 12 months, 6 months, 3 months, and 1 month —
        each a nested subset of the previous.
        A falling line (green) means recently-opened items are closing faster than the historical average; rising (red) means slower.
        Note that the 1-month cohort is naturally bounded — items can't have been open longer than ~30 days — so its values will always look short.
        When "Include open issues" is checked, open items are treated as if closed today (bucketed by current age),
        and a dotted sparkline shows what median and P90 would be under that scenario.
      </p>
    </div>

    <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      <input type="checkbox" v-model="showOpen" class="accent-bc-teal-500" />
      Include open issues
    </label>

    <div class="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60">
            <th class="w-px pl-4 pr-1 py-3 text-left font-medium text-slate-500 dark:text-slate-400">Repo</th>
            <th
              class="w-px pl-1 pr-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400"
              title="Currently open items — not yet closed or merged."
            >Open</th>
            <th
              class="w-px px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400"
              title="Median resolution time. Trend from all-time → 12mo → 6mo → 3mo → 1mo. Label shows most recent value."
            >Median</th>
            <th
              class="w-px px-4 py-3 text-left font-medium text-slate-500 dark:text-slate-400"
              title="90th-percentile resolution time — 10% of items took longer than this. Same time windows as Median."
            >P90 <span class="font-normal text-slate-400 dark:text-slate-500">ⓘ</span></th>
            <th class="min-w-36 px-4 py-3 font-medium text-slate-500 dark:text-slate-400">% by resolution time bucket</th>
            <th class="min-w-36 px-4 py-3 font-medium text-slate-500 dark:text-slate-400">Count by resolution time bucket</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="repo in repos"
            :key="repo"
            class="border-b border-slate-100 last:border-0 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-800/30"
          >
            <td class="w-px pl-4 pr-1 py-2">
              <span
                class="inline-block rounded-full border px-2.5 py-0.5 text-sm font-medium"
                :style="{ borderColor: repoColor(repo, allRepos), background: repoColor(repo, allRepos) + 'bf', color: contrastColor(repoColor(repo, allRepos), 0.75) }"
              >{{ repoDisplayName(repo) }}</span>
            </td>
            <td class="w-px pl-1 pr-4 py-2 text-right tabular-nums">
              <a
                :href="openIssuesUrl(repo)"
                target="_blank"
                rel="noopener"
                class="text-bc-teal-600 hover:underline dark:text-bc-teal-400"
              >{{ (allWindow?.openByRepo[repo] ?? 0).toLocaleString() }}</a>
            </td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline
                :values="repoMedianValues(repo)"
                :secondary-values="showOpen ? repoMedianWithOpenValues(repo) : undefined"
              />
            </td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline
                :values="repoP90Values(repo)"
                :secondary-values="showOpen ? repoP90WithOpenValues(repo) : undefined"
              />
            </td>
            <td class="px-4 py-2">
              <div
                class="flex h-5 cursor-default overflow-hidden rounded bg-slate-200 dark:bg-slate-800"
                @mouseenter="onBarEnter(repo, $event)"
                @mousemove="onBarMove"
                @mouseleave="onBarLeave"
              >
                <template v-for="bucket in RESOLUTION_BUCKETS" :key="bucket">
                  <div :style="{ width: `${closedFracPct(repo, bucket)}%`, background: BUCKET_COLORS[bucket] }" />
                  <div v-if="showOpen && openFracPct(repo, bucket) > 0"
                       :style="{ width: `${openFracPct(repo, bucket)}%`, background: BUCKET_COLORS[bucket], ...HATCH_STYLE }" />
                </template>
              </div>
            </td>
            <td class="px-4 py-2">
              <div
                class="flex h-5 cursor-default overflow-hidden rounded bg-slate-200 dark:bg-slate-800"
                @mouseenter="onBarEnter(repo, $event)"
                @mousemove="onBarMove"
                @mouseleave="onBarLeave"
              >
                <template v-for="bucket in RESOLUTION_BUCKETS" :key="bucket">
                  <div :style="{ width: `${closedAbsPct(repo, bucket)}%`, background: BUCKET_COLORS[bucket] }" />
                  <div v-if="showOpen && openAbsPct(repo, bucket) > 0"
                       :style="{ width: `${openAbsPct(repo, bucket)}%`, background: BUCKET_COLORS[bucket], ...HATCH_STYLE }" />
                </template>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/40">
            <td class="w-px pl-4 pr-1 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">All repos</td>
            <td class="w-px pl-1 pr-4 py-2 text-right tabular-nums font-semibold text-slate-600 dark:text-slate-300">
              {{ (allWindow?.totalOpen ?? 0).toLocaleString() }}
            </td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline
                :values="overallMedianValues"
                :secondary-values="showOpen ? overallMedianWithOpenValues : undefined"
              />
            </td>
            <td class="w-px px-4 py-1">
              <ResolutionSparkline
                :values="overallP90Values"
                :secondary-values="showOpen ? overallP90WithOpenValues : undefined"
              />
            </td>
            <td class="px-4 py-2">
              <div
                class="flex h-5 cursor-default overflow-hidden rounded bg-slate-200 dark:bg-slate-800"
                @mouseenter="onBarEnter(ALL_REPOS_KEY, $event)"
                @mousemove="onBarMove"
                @mouseleave="onBarLeave"
              >
                <template v-for="bucket in RESOLUTION_BUCKETS" :key="bucket">
                  <div :style="{ width: `${closedOverallFracPct(bucket)}%`, background: BUCKET_COLORS[bucket] }" />
                  <div v-if="showOpen && openOverallFracPct(bucket) > 0"
                       :style="{ width: `${openOverallFracPct(bucket)}%`, background: BUCKET_COLORS[bucket], ...HATCH_STYLE }" />
                </template>
              </div>
            </td>
            <td class="px-4 py-2 text-xs text-slate-400 dark:text-slate-500">
              {{ (allWindow?.totalClosed ?? 0).toLocaleString() }} closed
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Legend -->
    <div class="flex justify-end">
      <table class="text-xs text-slate-500 dark:text-slate-400">
        <thead>
          <tr>
            <th class="pr-3 text-right font-semibold">Resolution time buckets</th>
            <th
              v-for="bucket in RESOLUTION_BUCKETS"
              :key="bucket"
              class="px-2 pb-1 text-center font-normal"
            >{{ bucket }}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="pr-3 text-right font-medium">Closed Issues</td>
            <td v-for="bucket in RESOLUTION_BUCKETS" :key="bucket" class="px-2 text-center">
              <span class="inline-block h-2 w-4 rounded-sm" :style="{ background: BUCKET_COLORS[bucket] }" />
            </td>
          </tr>
          <tr v-if="showOpen">
            <td class="pr-3 text-right font-medium">Open Issues</td>
            <td v-for="bucket in RESOLUTION_BUCKETS" :key="bucket" class="px-2 text-center">
              <span class="inline-block h-2 w-4 rounded-sm" :style="{ background: BUCKET_COLORS[bucket], ...HATCH_STYLE }" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Tooltip -->
  <Teleport to="body">
    <div
      v-if="hoveredRepo"
      class="pointer-events-none fixed z-50 min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      <p class="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">{{ hoveredRepo === ALL_REPOS_KEY ? 'All repos' : repoDisplayName(hoveredRepo!) }}</p>
      <table class="text-xs">
        <thead>
          <tr>
            <th class="pb-1 text-left font-normal text-slate-400 dark:text-slate-500">Bucket</th>
            <th colspan="3" class="pb-1 text-center font-medium text-slate-600 dark:text-slate-300">Closed</th>
            <th v-if="showOpen" colspan="3" class="pb-1 pl-3 text-center font-medium text-slate-600 dark:text-slate-300">Open</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in tooltipRows(hoveredRepo)" :key="row.bucket">
            <td class="py-0.5 pr-3 text-slate-500 dark:text-slate-400">{{ row.bucket }}</td>
            <td class="py-0.5 pr-1">
              <span class="inline-block h-2 w-3 rounded-sm" :style="{ background: row.color }" />
            </td>
            <td class="py-0.5 pr-1 text-right tabular-nums text-slate-800 dark:text-slate-200">{{ row.closedCount.toLocaleString() }}</td>
            <td class="py-0.5 pr-3 text-right tabular-nums text-slate-400 dark:text-slate-500">{{ row.closedPct.toFixed(0) }}%</td>
            <template v-if="showOpen">
              <td class="py-0.5 pl-3 pr-1">
                <span class="inline-block h-2 w-3 rounded-sm" :style="{ background: row.color, ...HATCH_STYLE }" />
              </td>
              <td class="py-0.5 pr-1 text-right tabular-nums text-slate-800 dark:text-slate-200">{{ row.openCount.toLocaleString() }}</td>
              <td class="py-0.5 text-right tabular-nums text-slate-400 dark:text-slate-500">{{ row.openPct.toFixed(0) }}%</td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </Teleport>
</template>
