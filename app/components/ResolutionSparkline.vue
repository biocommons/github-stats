<script setup lang="ts">
const props = defineProps<{ values: (number | null)[] }>()

const W = 200
const H = 28
const CHART_W = 148
const PAD_Y = 4

function formatDays(days: number | null): string {
  if (days === null) return '—'
  if (days < 1) return '<1d'
  if (days === 1) return '1d'
  if (days < 30) return `${Math.round(days)}d`
  if (days < 365) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}

const nonNull = computed(() => props.values.filter((v): v is number => v !== null))
const yMin = computed(() => Math.min(...nonNull.value))
const yMax = computed(() => Math.max(...nonNull.value))

function xOf(i: number): number {
  const n = props.values.length
  return n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W
}

function yOf(v: number): number {
  const range = yMax.value - yMin.value
  if (nonNull.value.length <= 1 || range === 0) return H / 2
  return PAD_Y + (1 - (v - yMin.value) / range) * (H - 2 * PAD_Y)
}

const segments = computed(() => {
  const segs: { x: number; y: number }[][] = []
  let cur: { x: number; y: number }[] = []
  for (let i = 0; i < props.values.length; i++) {
    const v = props.values[i]
    if (v === null) {
      if (cur.length) { segs.push(cur); cur = [] }
    } else {
      cur.push({ x: xOf(i), y: yOf(v) })
    }
  }
  if (cur.length) segs.push(cur)
  return segs
})

const dots = computed(() =>
  props.values
    .map((v, i) => v !== null ? { x: xOf(i), y: yOf(v) } : null)
    .filter((d): d is { x: number; y: number } => d !== null)
)

// Lower = faster resolution = better. Green if improving, red if degrading.
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
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" :width="W" :height="H" class="block overflow-visible">
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
</template>
