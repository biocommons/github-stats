<script setup lang="ts">
import type { FlowStats } from '~/composables/useFlowStats'
import type { TimeBucket } from '~/composables/useTimeBuckets'
import { repoDisplayName } from '~/config'

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

// Fixed pixels-per-bucket in scroll mode; gives comfortable bar widths regardless of dataset size
const SCROLL_PITCH = 18

const tooltip = ref<{ x: number; y: number; lines: string[] } | null>(null)
const scrollMode = ref(true)
const panOffset = ref(0)
const svgEl = ref<SVGSVGElement | null>(null)
const dragState = ref<{ startClientX: number; startPan: number } | null>(null)

// Use stockSeries as the authoritative time axis — it includes every bucket,
// even periods with no opens/closes (stock value unchanged but slot present).
const buckets = computed(() => props.stats.stockSeries.map(s => s.bucket))

const totalDataW = computed(() => buckets.value.length * SCROLL_PITCH)
const maxPan = computed(() => Math.max(0, totalDataW.value - CHART_W))

function clampPan(v: number): number {
  return Math.max(0, Math.min(maxPan.value, v))
}

// On entering scroll mode, snap to right (most recent data); on exit, reset
watch(scrollMode, (on) => {
  panOffset.value = on ? maxPan.value : 0
})

// Keep pan in bounds when data changes (e.g. granularity switch)
watch(maxPan, () => {
  if (scrollMode.value) panOffset.value = clampPan(panOffset.value)
})

const barWidth = computed(() => {
  if (scrollMode.value) return Math.floor(SCROLL_PITCH * 0.65)
  const n = buckets.value.length
  return n > 0 ? Math.max(2, Math.floor((CHART_W / n) * 0.65)) : 8
})

function bucketX(i: number): number {
  if (scrollMode.value) return PAD_L + (i + 0.5) * SCROLL_PITCH
  const n = buckets.value.length
  return PAD_L + (i + 0.5) * (CHART_W / Math.max(n, 1))
}

// Convert screen-pixel drag delta to SVG units (SVG is scaled to container width)
function svgScale(): number {
  const el = svgEl.value
  if (!el) return 1
  const w = el.getBoundingClientRect().width
  return w > 0 ? W / w : 1
}

function onPointerDown(e: PointerEvent) {
  if (!scrollMode.value) return
  ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
  dragState.value = { startClientX: e.clientX, startPan: panOffset.value }
}

function onPointerMove(e: PointerEvent) {
  if (!dragState.value) return
  tooltip.value = null
  const delta = (dragState.value.startClientX - e.clientX) * svgScale()
  panOffset.value = clampPan(dragState.value.startPan + delta)
}

function onPointerUp() {
  dragState.value = null
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
  return Math.max(5, q3 + 1.5 * (q3 - q1))
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

const maxStock = computed(() => {
  const vals = Object.values(props.stats.repoStockSeries)
    .flatMap(s => s.map(p => p.openCount))
    .sort((a, b) => a - b)
  if (vals.length === 0) return 1
  const q1 = vals[Math.floor(vals.length * 0.25)] ?? 0
  const q3 = vals[Math.floor(vals.length * 0.75)] ?? 0
  return Math.max(1, q3 + 1.5 * (q3 - q1))
})

function stockY(count: number): number {
  return baseline.value - (count / maxStock.value) * (CHART_H / 2)
}

function repoStockPath(repo: string): string {
  const series = props.stats.repoStockSeries[repo]
  if (!series || series.length < 2) return ''
  return series
    .map((pt, i) => {
      const x = bucketX(i)
      const y = stockY(pt.openCount)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function niceStep(maxVal: number, targetTicks = 4): number {
  if (maxVal <= 0) return 1
  const raw = maxVal / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return nice * mag
}

// Left Y-axis: symmetric nice ticks above and below baseline, always including 0
const flowYLabels = computed(() => {
  const step = niceStep(maxFlow.value)
  const bl = baseline.value
  const labels: { y: number; label: string }[] = [{ y: bl, label: '0' }]
  for (let v = step; v <= maxFlow.value; v += step) {
    labels.push(
      { y: bl - flowToPixels(v), label: `+${v}` },
      { y: bl + flowToPixels(v), label: `-${v}` },
    )
  }
  return labels
})

const stockYLabels = computed(() => {
  const step = niceStep(maxStock.value)
  const labels: { y: number; label: string }[] = []
  for (let v = 0; v <= maxStock.value; v += step) {
    labels.push({ y: stockY(v), label: v.toString() })
  }
  return labels
})

const MONTH_ABB = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const

function bucketYear(b: string): number { return parseInt(b) }

function bucketSub(b: string): number {
  // '2024W05' → 5, '2024-06' → 6, '2024Q2' → 2
  return parseInt(b.slice(5))
}

function formatBucketLabel(b: string, gran: TimeBucket): string {
  const year = bucketYear(b)
  const yy = String(year).slice(2)
  const sub = bucketSub(b)
  if (gran === 'month') return `${MONTH_ABB[sub - 1]} '${yy}`
  return sub === 1 ? `'${yy}` : `Q${sub} '${yy}`
}

// Nice calendar-boundary x labels. In scroll mode, density is based on the visible
// window width rather than the full dataset span so labels don't crowd.
const xLabels = computed(() => {
  const buks = buckets.value
  if (buks.length === 0) return []

  const gran = props.granularity
  const visibleBuckets = scrollMode.value ? Math.floor(CHART_W / SCROLL_PITCH) : buks.length
  const visibleYearSpan = Math.max(1, Math.ceil(visibleBuckets / (gran === 'month' ? 12 : 4)))

  const indices = new Set<number>()

  const targets = gran === 'month'
    ? (visibleYearSpan <= 1 ? [1, 4, 7, 10] : visibleYearSpan <= 3 ? [1, 7] : [1])
    : (visibleYearSpan <= 2 ? [1, 2, 3, 4] : visibleYearSpan <= 5 ? [1, 3] : [1])
  const years = [...new Set(buks.map(bucketYear))]
  for (const year of years) {
    for (const sub of targets) {
      const idx = buks.findIndex(b => bucketYear(b) === year && bucketSub(b) === sub)
      if (idx >= 0) indices.add(idx)
    }
  }

  // Fallback: evenly spaced if too few calendar anchors found
  if (indices.size < 2) {
    const step = Math.max(1, Math.ceil(buks.length / 8))
    return buks
      .map((b, i) => ({ i, label: formatBucketLabel(b, gran), x: bucketX(i) }))
      .filter(({ i }) => i % step === 0)
  }

  return [...indices]
    .sort((a, b) => a - b)
    .map(i => ({ i, label: formatBucketLabel(buks[i]!, gran), x: bucketX(i) }))
})

function onRectMouseEnter(_event: MouseEvent, rect: BarRect) {
  if (dragState.value) return
  const dir = rect.opened > 0 ? 'opened' : 'closed'
  const count = rect.opened > 0 ? rect.opened : rect.closed
  // rect.x is pre-translate; subtract panOffset to get the bar's display position
  const displayX = rect.x + rect.w / 2 - (scrollMode.value ? panOffset.value : 0)
  tooltip.value = {
    x: displayX,
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
          v-for="g in (['month', 'quarter'] as const)"
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
            : { borderColor: '#64748b', color: '#94a3b8' }"
          @click="emit('toggle-repo', repo)"
        >{{ repoDisplayName(repo) }}</button>
      </div>

      <!-- Scroll/Fit pill toggle -->
      <button
        class="ml-auto flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        :title="scrollMode ? 'Switch to fit view' : 'Switch to scroll view'"
        @click="scrollMode = !scrollMode"
      >
        <span>{{ scrollMode ? 'scroll' : 'fit' }}</span>
        <div
          class="relative h-5 w-9 rounded-full transition-colors duration-200"
          :class="scrollMode ? 'bg-sky-500' : 'bg-slate-700'"
        >
          <div
            class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            :class="scrollMode ? 'translate-x-[18px]' : 'translate-x-0.5'"
          />
        </div>
      </button>
    </div>

    <!-- Chart -->
    <div class="relative">
      <svg
        ref="svgEl"
        :viewBox="`0 0 ${W} ${H}`"
        class="block w-full h-auto select-none"
        :style="scrollMode ? (dragState ? { cursor: 'grabbing' } : { cursor: 'grab' }) : {}"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <defs>
          <!-- clip-path is evaluated in the group's local space (after transform),
               so add panOffset to the x so the rect lands at PAD_L in screen space -->
          <clipPath id="chart-area">
            <rect
              :x="PAD_L + (scrollMode ? panOffset : 0)"
              :y="PAD_T" :width="CHART_W" :height="CHART_H"
            />
          </clipPath>
          <clipPath id="chart-cols">
            <rect
              :x="PAD_L + (scrollMode ? panOffset : 0)"
              :y="0" :width="CHART_W" :height="H"
            />
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
          fill="#94a3b8" font-size="11" text-anchor="middle"
          :transform="`rotate(90, ${W - 14}, ${PAD_T + CHART_H / 2})`"
        >open {{ itemLabel }} per repo</text>

        <!-- Right Y-axis ticks -->
        <g v-for="t in stockYLabels" :key="'r' + t.label">
          <line :x1="W - PAD_R" :y1="t.y" :x2="W - PAD_R + 4" :y2="t.y" stroke="#334155" stroke-width="1" />
          <text :x="W - PAD_R + 7" :y="t.y + 4.5" fill="#94a3b8" font-size="13">{{ t.label }}</text>
        </g>

        <!-- Scrollable data layer (bars + stock lines), clipped to chart rectangle -->
        <g :transform="`translate(${scrollMode ? -panOffset : 0}, 0)`" clip-path="url(#chart-area)">
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

          <path
            v-for="repo in allRepos"
            :key="'stock-' + repo"
            :d="repoStockPath(repo)"
            fill="none"
            :stroke="repoColor(repo)"
            stroke-width="1.5"
            stroke-linejoin="round"
            stroke-linecap="round"
            opacity="0.8"
          />
        </g>

        <!-- Scrollable annotation layer (clip markers + x-axis), column-clipped only -->
        <g :transform="`translate(${scrollMode ? -panOffset : 0}, 0)`" clip-path="url(#chart-cols)">
          <!-- Clip markers: hatch lines at the cut edge of overflowing bars -->
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

          <!-- X-axis ticks and labels -->
          <g v-for="tick in xLabels" :key="tick.i">
            <line
              :x1="tick.x" :y1="PAD_T + CHART_H"
              :x2="tick.x" :y2="PAD_T + CHART_H + 5"
              stroke="#475569" stroke-width="1"
            />
            <text
              :x="tick.x"
              :y="PAD_T + CHART_H + 20"
              fill="#94a3b8"
              font-size="13"
              text-anchor="middle"
            >{{ tick.label }}</text>
          </g>
        </g>

        <!-- Tooltip (root SVG coords; x adjusted for pan offset) -->
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
