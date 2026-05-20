<script setup lang="ts">
import { useFlowStats, type FlowTimespan } from '~/composables/useFlowStats'

const route = useRoute()
const router = useRouter()
const { stats, allRepos, granularity, timespan, selectedRepos, toggleRepo } = useFlowStats('prs')

function granularityFromQuery(): 'week' | 'month' | 'quarter' {
  const g = typeof route.query.granularity === 'string' ? route.query.granularity : ''
  if (g === 'quarter') return 'quarter'
  if (g === 'week') return 'week'
  return 'month'
}

function timespanFromQuery(): FlowTimespan {
  const t = typeof route.query.timespan === 'string' ? route.query.timespan : ''
  return (['all', '12mo', '6mo', '3mo', '1mo'] as FlowTimespan[]).includes(t as FlowTimespan) ? t as FlowTimespan : '12mo'
}

granularity.value = granularityFromQuery()
timespan.value = timespanFromQuery()
if (!route.query.granularity) {
  granularity.value = timespan.value === 'all' ? 'month' : 'week'
}

watch([granularity, timespan], ([g, t]) => {
  router.replace({ query: { ...route.query, granularity: g, timespan: t } })
})

watch(() => route.query.granularity, () => {
  const g = granularityFromQuery()
  if (g !== granularity.value) granularity.value = g
})

watch(() => route.query.timespan, () => {
  const t = timespanFromQuery()
  if (t !== timespan.value) timespan.value = t
})
</script>

<template>
  <div v-if="!stats" class="flex items-center justify-center py-24 text-slate-500">
    Loading…
  </div>
  <template v-else>
    <FlowChart
      :stats="stats"
      :all-repos="allRepos"
      :granularity="granularity"
      :timespan="timespan"
      :selected-repos="selectedRepos"
      item-label="PRs"
      @update:granularity="granularity = $event"
      @update:timespan="timespan = $event"
      @toggle-repo="toggleRepo"
    />
    <div class="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
      <ResolutionByRepo :stats="stats" :all-repos="allRepos" item-label="PRs" />
    </div>
  </template>
</template>
