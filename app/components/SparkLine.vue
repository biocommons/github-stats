<script setup lang="ts">
const props = defineProps<{ values: number[] }>()

const W = 120
const H = 32
const PAD = 2

const points = computed(() => {
  const max = Math.max(...props.values, 1)
  const n = props.values.length
  if (n < 2) return ''
  return props.values
    .map((v, i) => {
      const x = PAD + (i / (n - 1)) * (W - 2 * PAD)
      const y = PAD + (1 - v / max) * (H - 2 * PAD)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
})
</script>

<template>
  <svg :width="W" :height="H" class="overflow-visible">
    <polyline
      :points="points"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  </svg>
</template>
