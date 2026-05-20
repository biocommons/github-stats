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

const MAX_R = 16
const CX = 20
const CY = 20

function r(value: number, max: number): number {
  if (value === 0 || max === 0) return 0
  return (0.15 + 0.7 * (value / max)) * MAX_R
}

// Axes (clockwise from top): commits, prs, reviews, issues
const points = computed(() => {
  const c = r(props.counts.commits, props.maxes.commits)
  const p = r(props.counts.prs_opened, props.maxes.prs_opened)
  const rv = r(props.counts.reviews_submitted, props.maxes.reviews_submitted)
  const i = r(props.counts.issues_opened, props.maxes.issues_opened)
  return [
    [CX,      CY - c],   // top:    commits
    [CX + p,  CY],       // right:  PRs
    [CX,      CY + rv],  // bottom: reviews
    [CX - i,  CY],       // left:   issues
  ].map(([x, y]) => `${x},${y}`).join(' ')
})

const tooltip = computed(() => {
  const { commits, issues_opened, prs_opened, reviews_submitted } = props.counts
  return `commits: ${commits}  issues: ${issues_opened}  PRs: ${prs_opened}  reviews: ${reviews_submitted}`
})
</script>

<template>
  <div class="w-10 h-10" :title="tooltip">
    <svg v-if="!isEmpty" viewBox="0 0 40 40" width="40" height="40">
      <!-- Axis guides -->
      <line x1="20" y1="4" x2="20" y2="36" stroke="var(--chart-axis-guide)" stroke-width="0.5" />
      <line x1="4" y1="20" x2="36" y2="20" stroke="var(--chart-axis-guide)" stroke-width="0.5" />
      <!-- Radar polygon -->
      <polygon
        :points="points"
        fill="rgba(0,189,164,0.25)"
        stroke="rgba(0,189,164,0.85)"
        stroke-width="1.2"
        stroke-linejoin="round"
      />
    </svg>
    <div v-else class="w-10 h-10" />
  </div>
</template>
