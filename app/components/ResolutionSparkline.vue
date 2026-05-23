<script setup lang="ts">
const props = defineProps<{
  values: (number | null)[]
  secondaryValues?: (number | null)[]
}>()

const W = 90
const H = 28
const CHART_W = 74
const PAD_Y = 4

const WINDOW_LABELS = ['All', '12mo', '6mo', '3mo', '1mo']

function formatDays(days: number | null): string {
  if (days === null) return '—'
  if (days < 1) return '<1d'
  if (days === 1) return '1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}

const nonNull = computed(() => props.values.filter((v): v is number => v !== null))
const secondaryNonNull = computed(() => (props.secondaryValues ?? []).filter((v): v is number => v !== null))

// Shared y-scale across both series so relative positions are comparable
const yMin = computed(() => Math.min(...nonNull.value, ...secondaryNonNull.value))
const yMax = computed(() => Math.max(...nonNull.value, ...secondaryNonNull.value))

function xOf(i: number): number {
  const n = props.values.length
  return n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W
}

function yOf(v: number): number {
  const allNonNull = [...nonNull.value, ...secondaryNonNull.value]
  const range = yMax.value - yMin.value
  if (allNonNull.length <= 1 || range === 0) return H / 2
  return PAD_Y + (1 - (v - yMin.value) / range) * (H - 2 * PAD_Y)
}

function buildSegments(vals: (number | null)[]) {
  const segs: { x: number; y: number }[][] = []
  let cur: { x: number; y: number }[] = []
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i]
    if (v === null) {
      if (cur.length) { segs.push(cur); cur = [] }
    } else {
      cur.push({ x: xOf(i), y: yOf(v) })
    }
  }
  if (cur.length) segs.push(cur)
  return segs
}

const segments = computed(() => buildSegments(props.values))
const secondarySegments = computed(() => props.secondaryValues ? buildSegments(props.secondaryValues) : [])

const dots = computed(() =>
  props.values
    .map((v, i) => v !== null ? { x: xOf(i), y: yOf(v) } : null)
    .filter((d): d is { x: number; y: number } => d !== null)
)

const color = computed(() => {
  if (nonNull.value.length < 2) return '#94a3b8'
  const first = nonNull.value[0]!
  const last = nonNull.value[nonNull.value.length - 1]!
  if (last < first) return '#22c55e'
  if (last > first) return '#ef4444'
  return '#94a3b8'
})

const lastValue = computed(() => {
  for (let i = props.values.length - 1; i >= 0; i--) {
    if (props.values[i] !== null) return props.values[i]
  }
  return null
})

const lastSecondaryValue = computed(() => {
  if (!props.secondaryValues) return null
  for (let i = props.secondaryValues.length - 1; i >= 0; i--) {
    if (props.secondaryValues[i] !== null) return props.secondaryValues[i]
  }
  return null
})

const tooltipVisible = ref(false)
const tooltipX = ref(0)
const tooltipY = ref(0)

function onEnter(event: MouseEvent) {
  tooltipVisible.value = true
  updatePos(event)
}

function onMove(event: MouseEvent) {
  updatePos(event)
}

function onLeave() {
  tooltipVisible.value = false
}

function updatePos(event: MouseEvent) {
  tooltipX.value = event.clientX + 12
  tooltipY.value = event.clientY - 8
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H"
    class="block overflow-visible cursor-default"
    @mouseenter="onEnter"
    @mousemove="onMove"
    @mouseleave="onLeave"
  >
    <!-- Secondary (what-if) line drawn first so primary renders on top -->
    <g v-for="(seg, si) in secondarySegments" :key="`s${si}`">
      <polyline
        v-if="seg.length > 1"
        :points="seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')"
        fill="none"
        stroke="#94a3b8"
        stroke-width="1.5"
        stroke-dasharray="3 3"
        stroke-linejoin="round"
        stroke-linecap="round"
        opacity="0.7"
      />
    </g>
    <!-- Primary (closed-only) line -->
    <g v-for="(seg, si) in segments" :key="si">
      <polyline
        v-if="seg.length > 1"
        :points="seg.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')"
        fill="none"
        :stroke="color"
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    </g>
    <circle
      v-for="(dot, di) in dots"
      :key="di"
      :cx="dot.x.toFixed(1)"
      :cy="dot.y.toFixed(1)"
      r="2.5"
      :fill="color"
    />
    <text
      :x="CHART_W + 8"
      :y="H / 2 + 4"
      font-size="11"
      :fill="color"
      class="tabular-nums"
    >{{ formatDays(lastValue) }}</text>
  </svg>

  <Teleport to="body">
    <div
      v-if="tooltipVisible"
      class="pointer-events-none fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900"
      :style="{ left: `${tooltipX}px`, top: `${tooltipY}px` }"
    >
      <table class="text-xs">
        <tr>
          <th class="px-2.5 pt-2 pb-0.5 font-medium text-slate-400 dark:text-slate-500 underline">Opened:</th>
          <th
            v-for="label in WINDOW_LABELS"
            :key="label"
            class="px-2.5 pt-2 pb-0.5 font-medium text-slate-400 dark:text-slate-500 underline"
          >{{ label === 'All' ? label : `≤${label}` }}</th>
        </tr>
        <tr>
          <td class="px-2 pb-1 pt-0.5 text-slate-500 dark:text-slate-400">Closed</td>
          <td
            v-for="(v, i) in values"
            :key="i"
            class="px-2.5 pb-1 pt-0.5 tabular-nums font-semibold text-slate-800 dark:text-slate-200"
          >{{ formatDays(v) }}</td>
        </tr>
        <tr v-if="secondaryValues">
          <td class="px-2 pb-2 pt-0 text-slate-400 dark:text-slate-500">+Open</td>
          <td
            v-for="(v, i) in secondaryValues"
            :key="i"
            class="px-2.5 pb-2 pt-0 tabular-nums text-slate-500 dark:text-slate-400"
          >{{ formatDays(v) }}</td>
        </tr>
      </table>
    </div>
  </Teleport>
</template>
