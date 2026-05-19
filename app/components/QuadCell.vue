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

function alpha(value: number, max: number): number {
  if (value === 0 || max === 0) return 0
  return 0.15 + 0.7 * (value / max)
}

const styles = computed(() => ({
  commits: `background: rgba(64,81,181,${alpha(props.counts.commits, props.maxes.commits).toFixed(3)})`,
  issues: `background: rgba(230,159,0,${alpha(props.counts.issues_opened, props.maxes.issues_opened).toFixed(3)})`,
  prs: `background: rgba(86,180,233,${alpha(props.counts.prs_opened, props.maxes.prs_opened).toFixed(3)})`,
  reviews: `background: rgba(0,158,115,${alpha(props.counts.reviews_submitted, props.maxes.reviews_submitted).toFixed(3)})`,
}))

const tooltip = computed(() => {
  const { commits, issues_opened, prs_opened, reviews_submitted } = props.counts
  return `commits: ${commits}  issues: ${issues_opened}  PRs: ${prs_opened}  reviews: ${reviews_submitted}`
})
</script>

<template>
  <div v-if="!isEmpty" class="grid grid-cols-2 gap-px w-10 h-10" :title="tooltip">
    <div :style="styles.commits" class="rounded-sm" />
    <div :style="styles.issues" class="rounded-sm" />
    <div :style="styles.prs" class="rounded-sm" />
    <div :style="styles.reviews" class="rounded-sm" />
  </div>
  <div v-else class="w-10 h-10" />
</template>
