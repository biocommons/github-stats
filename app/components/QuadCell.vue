<script setup lang="ts">
import type { ContributorCounts } from '~/composables/useContributorStats'

const props = defineProps<{
  counts: ContributorCounts
  maxes: ContributorCounts
  ringColor?: string
}>()

const isEmpty = computed(
  () =>
    props.counts.commits === 0 &&
    props.counts.issues_opened === 0 &&
    props.counts.prs_opened === 0 &&
    props.counts.reviews_submitted === 0,
)

function alpha(value: number, max: number): number {
  if (value === 0 || max === 0) return 0
  return 0.15 + 0.7 * (value / max)
}

const styles = computed(() => ({
  commits: `background: rgba(64,81,181,${alpha(props.counts.commits, props.maxes.commits).toFixed(3)})`,
  issues:  `background: rgba(230,159,0,${alpha(props.counts.issues_opened, props.maxes.issues_opened).toFixed(3)})`,
  prs:     `background: rgba(86,180,233,${alpha(props.counts.prs_opened, props.maxes.prs_opened).toFixed(3)})`,
  reviews: `background: rgba(0,158,115,${alpha(props.counts.reviews_submitted, props.maxes.reviews_submitted).toFixed(3)})`,
}))

const QUAD_RGB: { commits: [number,number,number]; issues: [number,number,number]; prs: [number,number,number]; reviews: [number,number,number] } = {
  commits: [64,  81,  181],
  issues:  [230, 159, 0  ],
  prs:     [86,  180, 233],
  reviews: [0,   158, 115],
}

function contrastFor(r: number, g: number, b: number, a: number): string {
  const lr = r * a + 255 * (1 - a)
  const lg = g * a + 255 * (1 - a)
  const lb = b * a + 255 * (1 - a)
  return (0.299 * lr + 0.587 * lg + 0.114 * lb) / 255 > 0.55 ? '#1e293b' : '#ffffff'
}

function tooltipStyle(rgb: [number, number, number], value: number, max: number): string {
  const [r, g, b] = rgb
  const a = alpha(value, max)
  const color = contrastFor(r, g, b, a)
  return `background: rgba(${r},${g},${b},${a.toFixed(3)}); border: 1.5px solid rgba(${r},${g},${b},0.65); color: ${color}`
}

const tooltipStyles = computed(() => ({
  commits: tooltipStyle(QUAD_RGB.commits, props.counts.commits,            props.maxes.commits),
  issues:  tooltipStyle(QUAD_RGB.issues,  props.counts.issues_opened,      props.maxes.issues_opened),
  prs:     tooltipStyle(QUAD_RGB.prs,     props.counts.prs_opened,         props.maxes.prs_opened),
  reviews: tooltipStyle(QUAD_RGB.reviews, props.counts.reviews_submitted,  props.maxes.reviews_submitted),
}))

const { triggerRef, isHovered, pos, onMouseEnter } = useAnchoredTooltip()
</script>

<template>
  <div ref="triggerRef" class="h-10 w-10 rounded" @mouseenter="onMouseEnter" @mouseleave="isHovered = false" :style="ringColor ? { outline: `2px solid ${ringColor}`, outlineOffset: '2px' } : {}">
    <div v-if="!isEmpty" class="grid grid-cols-2 gap-px h-10 w-10">
      <div :style="styles.commits" class="rounded-sm" />
      <div :style="styles.issues"  class="rounded-sm" />
      <div :style="styles.prs"     class="rounded-sm" />
      <div :style="styles.reviews" class="rounded-sm" />
    </div>
    <div v-else class="h-10 w-10" />

    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-100" leave-to-class="opacity-0">
        <div
          v-if="!isEmpty && isHovered"
          class="pointer-events-none fixed z-50"
          :style="{ left: `${pos.x}px`, top: `${pos.y}px`, transform: `translateX(${pos.tx}) translateY(${pos.ty})` }"
        >
          <div class="rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <div class="grid grid-cols-2 gap-1.5" style="width:160px">
              <div :style="tooltipStyles.commits" class="flex flex-col items-center justify-center rounded p-2">
                <span class="text-[10px] opacity-80">commits</span>
                <span class="text-xl font-bold">{{ counts.commits }}</span>
              </div>
              <div :style="tooltipStyles.issues" class="flex flex-col items-center justify-center rounded p-2">
                <span class="text-[10px] opacity-80">issues</span>
                <span class="text-xl font-bold">{{ counts.issues_opened }}</span>
              </div>
              <div :style="tooltipStyles.prs" class="flex flex-col items-center justify-center rounded p-2">
                <span class="text-[10px] opacity-80">PRs</span>
                <span class="text-xl font-bold">{{ counts.prs_opened }}</span>
              </div>
              <div :style="tooltipStyles.reviews" class="flex flex-col items-center justify-center rounded p-2">
                <span class="text-[10px] opacity-80">reviews</span>
                <span class="text-xl font-bold">{{ counts.reviews_submitted }}</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
