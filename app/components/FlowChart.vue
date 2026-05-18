<script setup lang="ts">
import type { FlowStats } from '~/composables/useFlowStats'
import type { TimeBucket } from '~/composables/useTimeBuckets'

const props = defineProps<{
  stats: FlowStats
  allRepos: string[]
  granularity: TimeBucket
  selectedRepos: Set<string>
  itemLabel: string  // e.g. "issues" or "PRs"
}>()

const emit = defineEmits<{
  'update:granularity': [value: TimeBucket]
  'toggle-repo': [repo: string]
}>()

// Colors indexed against allRepos so they never shift during filtering
const REPO_COLORS = [
  '#34d399', // emerald-400
  '#60a5fa', // blue-400
  '#f472b6', // pink-400
  '#fb923c', // orange-400
  '#a78bfa', // violet-400
  '#facc15', // yellow-400
  '#22d3ee', // cyan-400
]

function repoColor(repo: string): string {
  return REPO_COLORS[props.allRepos.indexOf(repo) % REPO_COLORS.length] ?? '#94a3b8'
}

const W = 800
const H = 320
const PAD_L = 58
const PAD_R = 62
const PAD_T = 18
const PAD_B = 38
const CHART_W = W - PAD_L - PAD_R
const CHART_H = H - PAD_T - PAD_B

const tooltip = ref<{ x: number; y: number; lines: string[] } | null>(null)

// Use stockSeries as the authoritative time axis — it includes every bucket,
// even periods with no opens/closes (stock value unchanged but slot present).
const buckets = computed(() => props.stats.stockSeries.map(s => s.bucket))

const barWidth = computed(() => {
  const n = buckets.value.length
  return n > 0 ? Math.max(2, Math.floor((CHART_W / n) * 0.65)) : 8
})

function bucketX(i: number): number {
  const n = buckets.value.length
  return PAD_L + (i + 0.5) * (CHART_W / Math.max(n, 1))
}

const maxFlow = computed(() => {
  const totals: Record<string, { opened: number; closed: number }> = {}
  for (const p of props.stats.flowPoints) {
    if (!totals[p.bucket]) totals[p.bucket] = { opened: 0, closed: 0 }
    totals[p.bucket]!.opened += p.opened
    totals[p.bucket]!.closed += p.closed
  }
  const vals = Object.values(totals).map(b => Math.max(b.opened, b.closed)).sort((a, b) => a - b)
  if (vals.length === 0) return 1
  const q1 = vals[Math.floor(vals.length * 0.25)] ?? 0
  const q3 = vals[Math.floor(vals.length * 0.75)] ?? 0
  return Math.max(1, q3 + 1.5 * (q3 - q1))
})

const baseline = computed(() => PAD_T + CHART_H / 2)

function flowToPixels(count: number): number {
  return (count / maxFlow.value) * (CHART_H / 2)
}

interface BarRect {
  x: number; y: number; w: number; h: number
  fill: string; repo: string; opened: number; closed: number
}
interface ClipMarker { cx: number; cy: number; w: number; dir: 'up' | 'down' }

function stackedBars(bucket: string, bx: number, bw: number): { rects: BarRect[]; markers: ClipMarker[] } {
  const rects: BarRect[] = []
  const markers: ClipMarker[] = []
  let topOffset = 0
  let botOffset = 0
  const bl = baseline.value
  const bwHalf = bw / 2
  const halfH = CHART_H / 2

  for (const repo of props.allRepos) {
    const pt = props.stats.flowPoints.find(p => p.bucket === bucket && p.repo === repo)
    if (!pt) continue
    const color = repoColor(repo)
    if (pt.opened > 0) {
      const h = flowToPixels(pt.opened)
      rects.push({ x: bx - bwHalf, y: bl - topOffset - h, w: bw, h, fill: color, repo, opened: pt.opened, closed: 0 })
      topOffset += h
    }
    if (pt.closed > 0) {
      const h = flowToPixels(pt.closed)
      rects.push({ x: bx - bwHalf, y: bl + botOffset, w: bw, h, fill: color, repo, opened: 0, closed: pt.closed })
      botOffset += h
    }
  }

  if (topOffset > halfH) markers.push({ cx: bx, cy: PAD_T, w: bw, dir: 'up' })
  if (botOffset > halfH) markers.push({ cx: bx, cy: PAD_T + CHART_H, w: bw, dir: 'down' })

  return { rects, markers }
}

const allElements = computed(() => {
  const rects: BarRect[] = []
  const clipMarkers: ClipMarker[] = []
  for (const [i, bucket] of buckets.value.entries()) {
    const el = stackedBars(bucket, bucketX(i), barWidth.value)
    rects.push(...el.rects)
    clipMarkers.push(...el.markers)
  }
  return { rects, clipMarkers }
})

const maxStock = computed(() => Math.max(1, ...props.stats.stockSeries.map(s => s.openCount)))

function stockY(count: number): number {
  return baseline.value - (count / maxStock.value) * (CHART_H / 2)
}

const stockPath = computed(() => {
  const series = props.stats.stockSeries
  if (series.length < 2) return ''
  return series
    .map((pt, i) => {
      const x = bucketX(i)
      const y = stockY(pt.openCount)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})

// Left Y-axis: 4 symmetric ticks above and below baseline
const flowYLabels = computed(() => {
  const ticks = [0.25, 0.5, 0.75, 1]
  const bl = baseline.value
  return ticks.flatMap(t => {
    const v = Math.round(maxFlow.value * t)
    return [
      { y: bl - flowToPixels(v), label: `+${v}` },
      { y: bl + flowToPixels(v), label: `-${v}` },
    ]
  })
})

const stockYLabels = computed(() => {
  const ticks = [0, 0.25, 0.5, 0.75, 1]
  return ticks.map(t => ({
    y: stockY(maxStock.value * t),
    label: Math.round(maxStock.value * t).toString(),
  }))
})

// Target ~13 visible x labels regardless of bucket count
const xLabels = computed(() => {
  const n = buckets.value.length
  const step = Math.max(1, Math.ceil(n / 13))
  return buckets.value
    .map((b, i) => ({ i, label: b, x: bucketX(i) }))
    .filter(({ i }) => i % step === 0)
})

function onRectMouseEnter(_event: MouseEvent, rect: BarRect) {
  const dir = rect.opened > 0 ? 'opened' : 'closed'
  const count = rect.opened > 0 ? rect.opened : rect.closed
  tooltip.value = {
    x: rect.x + rect.w / 2,
    y: rect.y,
    lines: [rect.repo, `${dir}: ${count}`],
  }
}

function onRectMouseLeave() {
  tooltip.value = null
}
</script>

<template>
  <div class="space-y-4">
    <!-- Controls row -->
    <div class="flex flex-wrap items-center gap-3">
      <!-- Granularity selector -->
      <div class="flex items-center rounded-full border border-slate-700 bg-slate-900 p-0.5 text-sm">
        <button
          v-for="g in (['week', 'month', 'quarter'] as const)"
          :key="g"
          class="rounded-full px-3 py-1 transition-colors capitalize"
          :class="granularity === g ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'"
          @click="emit('update:granularity', g)"
        >{{ g }}</button>
      </div>

      <!-- Repo chips — always rendered from allRepos, never disappear -->
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="repo in allRepos"
          :key="repo"
          class="rounded-full border px-2.5 py-0.5 text-sm font-medium transition-colors"
          :style="selectedRepos.has(repo)
            ? { borderColor: repoColor(repo), color: repoColor(repo), background: repoColor(repo) + '22' }
            : { borderColor: '#334155', color: '#475569' }"
          @click="emit('toggle-repo', repo)"
        >{{ repo }}</button>
      </div>
    </div>

    <!-- Chart -->
    <div class="relative">
      <svg :viewBox="`0 0 ${W} ${H}`" class="block w-full h-auto">
        <defs>
          <clipPath id="chart-area">
            <rect :x="PAD_L" :y="PAD_T" :width="CHART_W" :height="CHART_H" />
          </clipPath>
        </defs>

        <!-- Zero baseline -->
        <line
          :x1="PAD_L" :y1="baseline" :x2="W - PAD_R" :y2="baseline"
          stroke="#475569" stroke-width="1"
        />

        <!-- Chart area boundary lines -->
        <line :x1="PAD_L" :y1="PAD_T" :x2="W - PAD_R" :y2="PAD_T" stroke="#1e293b" stroke-width="1" />
        <line :x1="PAD_L" :y1="PAD_T + CHART_H" :x2="W - PAD_R" :y2="PAD_T + CHART_H" stroke="#1e293b" stroke-width="1" />

        <!-- Left Y-axis title (rotated) -->
        <text
          :x="13" :y="baseline"
          fill="#64748b" font-size="11" text-anchor="middle"
          :transform="`rotate(-90, 13, ${baseline})`"
        >newly closed (−) / opened (+)</text>

        <!-- Left Y-axis ticks -->
        <g v-for="t in flowYLabels" :key="t.label">
          <line :x1="PAD_L - 4" :y1="t.y" :x2="PAD_L" :y2="t.y" stroke="#334155" stroke-width="1" />
          <text :x="PAD_L - 7" :y="t.y + 4.5" fill="#cbd5e1" font-size="13" text-anchor="end">{{ t.label }}</text>
        </g>

        <!-- Right Y-axis title (rotated) -->
        <text
          :x="W - 14" :y="PAD_T + CHART_H / 2"
          fill="#38bdf8" font-size="11" text-anchor="middle"
          :transform="`rotate(90, ${W - 14}, ${PAD_T + CHART_H / 2})`"
        >open {{ itemLabel }} (stock)</text>

        <!-- Right Y-axis ticks -->
        <g v-for="t in stockYLabels" :key="'r' + t.label">
          <line :x1="W - PAD_R" :y1="t.y" :x2="W - PAD_R + 4" :y2="t.y" stroke="#334155" stroke-width="1" />
          <text :x="W - PAD_R + 7" :y="t.y + 4.5" fill="#7dd3fc" font-size="13">{{ t.label }}</text>
        </g>

        <!-- Stacked bars (clipped so outlier spikes don't overflow chart bounds) -->
        <g clip-path="url(#chart-area)">
          <rect
            v-for="(rect, ri) in allElements.rects"
            :key="ri"
            :x="rect.x" :y="rect.y" :width="rect.w" :height="rect.h"
            :fill="rect.fill"
            fill-opacity="0.75"
            class="cursor-pointer"
            style="transition: fill-opacity 0.1s"
            @mouseenter="onRectMouseEnter($event, rect)"
            @mouseleave="onRectMouseLeave"
          />
        </g>

        <!-- Clip markers: two parallel hatch lines at the cut edge of clipped bars -->
        <g v-for="(m, mi) in allElements.clipMarkers" :key="'cm' + mi">
          <line
            v-for="offset in [3, 7]"
            :key="offset"
            :x1="m.cx - m.w / 2 + 1"
            :y1="m.dir === 'up' ? m.cy + offset : m.cy - offset"
            :x2="m.cx + m.w / 2 - 1"
            :y2="m.dir === 'up' ? m.cy + offset - (m.w - 2) * 0.577 : m.cy - offset + (m.w - 2) * 0.577"
            stroke="white"
            stroke-width="1.5"
            stroke-opacity="0.7"
          />
        </g>

        <!-- Stock line overlay -->
        <path
          v-if="stockPath"
          :d="stockPath"
          fill="none"
          stroke="#38bdf8"
          stroke-width="1.5"
          stroke-linejoin="round"
          stroke-linecap="round"
          opacity="0.8"
        />

        <!-- X-axis labels -->
        <text
          v-for="tick in xLabels"
          :key="tick.label"
          :x="tick.x"
          :y="PAD_T + CHART_H + 20"
          fill="#94a3b8"
          font-size="13"
          text-anchor="middle"
        >{{ tick.label }}</text>

        <!-- Tooltip -->
        <g v-if="tooltip">
          <rect
            :x="Math.min(tooltip.x + 8, W - 120)"
            :y="tooltip.y - 40"
            width="112" :height="tooltip.lines.length * 17 + 10"
            rx="4"
            fill="#0f172a"
            stroke="#334155"
            stroke-width="1"
          />
          <text
            v-for="(line, li) in tooltip.lines"
            :key="li"
            :x="Math.min(tooltip.x + 14, W - 114)"
            :y="tooltip.y - 40 + 16 + li * 17"
            fill="#e2e8f0"
            font-size="13"
          >{{ line }}</text>
        </g>
      </svg>
    </div>
  </div>
</template>
