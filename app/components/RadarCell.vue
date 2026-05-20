<script setup lang="ts">
import type { ContributorCounts } from '~/composables/useContributorStats'

const props = defineProps<{
  counts: ContributorCounts
  maxes: ContributorCounts
}>()

const isEmpty = computed(
  () =>
    props.counts.commits === 0 &&
    props.counts.issues_opened === 0 &&
    props.counts.prs_opened === 0 &&
    props.counts.reviews_submitted === 0,
)

function r(value: number, max: number, maxR: number): number {
  if (value === 0 || max === 0) return 0
  return (0.15 + 0.7 * (value / max)) * maxR
}

function polyPoints(cx: number, cy: number, maxR: number, counts: typeof props.counts, maxes: typeof props.maxes): string {
  const c  = r(counts.commits,            maxes.commits,            maxR)
  const p  = r(counts.prs_opened,         maxes.prs_opened,         maxR)
  const rv = r(counts.reviews_submitted,  maxes.reviews_submitted,  maxR)
  const i  = r(counts.issues_opened,      maxes.issues_opened,      maxR)
  return [
    [cx,      cy - c ],
    [cx + p,  cy     ],
    [cx,      cy + rv],
    [cx - i,  cy     ],
  ].map(([x, y]) => `${x},${y}`).join(' ')
}

const points = computed(() => polyPoints(20, 20, 16, props.counts, props.maxes))
const largePoints = computed(() => polyPoints(80, 80, 54, props.counts, props.maxes))

const { triggerRef, isHovered, pos, onMouseEnter } = useAnchoredTooltip()
</script>

<template>
  <div ref="triggerRef" class="h-10 w-10" @mouseenter="onMouseEnter" @mouseleave="isHovered = false">
    <svg v-if="!isEmpty" viewBox="0 0 40 40" width="40" height="40">
      <line x1="20" y1="4" x2="20" y2="36" stroke="var(--chart-axis-guide)" stroke-width="0.5" />
      <line x1="4" y1="20" x2="36" y2="20" stroke="var(--chart-axis-guide)" stroke-width="0.5" />
      <polygon :points="points" fill="rgba(0,189,164,0.25)" stroke="rgba(0,189,164,0.85)" stroke-width="1.2" stroke-linejoin="round" />
    </svg>
    <div v-else class="h-10 w-10" />

    <Teleport to="body">
      <Transition enter-active-class="transition-opacity duration-150" enter-from-class="opacity-0" leave-active-class="transition-opacity duration-100" leave-to-class="opacity-0">
        <div
          v-if="!isEmpty && isHovered"
          class="pointer-events-none fixed z-50"
          :style="{ left: `${pos.x}px`, top: `${pos.y}px`, transform: `translateX(${pos.tx}) translateY(${pos.ty})` }"
        >
          <div class="rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <svg viewBox="0 0 160 160" width="160" height="160">
              <!-- Axis guides, shortened to leave label room -->
              <line x1="80" y1="28" x2="80" y2="132" stroke="var(--chart-axis-guide)" stroke-width="0.75" />
              <line x1="28" y1="80" x2="132" y2="80" stroke="var(--chart-axis-guide)" stroke-width="0.75" />
              <polygon :points="largePoints" fill="rgba(0,189,164,0.2)" stroke="rgba(0,189,164,0.85)" stroke-width="1.5" stroke-linejoin="round" />
              <!-- Top: commits -->
              <text x="80" y="9"  text-anchor="middle" font-size="11" fill="var(--chart-label)">commits</text>
              <text x="80" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="var(--chart-label)">{{ counts.commits }}</text>
              <!-- Bottom: reviews -->
              <text x="80" y="141" text-anchor="middle" font-size="14" font-weight="bold" fill="var(--chart-label)">{{ counts.reviews_submitted }}</text>
              <text x="80" y="153" text-anchor="middle" font-size="11" fill="var(--chart-label)">reviews</text>
              <!-- Left: issues label rotated CCW, count upright -->
              <text x="8"  y="80" text-anchor="middle" font-size="11" fill="var(--chart-label)" transform="rotate(-90, 8, 80)">issues</text>
              <text x="22" y="83" text-anchor="middle" font-size="14" font-weight="bold" fill="var(--chart-label)">{{ counts.issues_opened }}</text>
              <!-- Right: PRs label rotated CW, count upright -->
              <text x="152" y="80" text-anchor="middle" font-size="11" fill="var(--chart-label)" transform="rotate(90, 152, 80)">PRs</text>
              <text x="138" y="83" text-anchor="middle" font-size="14" font-weight="bold" fill="var(--chart-label)">{{ counts.prs_opened }}</text>
            </svg>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
