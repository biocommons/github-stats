<script setup lang="ts">
import { useFlowStats, type FlowTimespan, type RepoSet } from '~/composables/useFlowStats'

const route = useRoute()
const router = useRouter()
const { stats, allRepos, granularity, timespan, repoSet, selectedRepos, toggleRepo } = useFlowStats('prs')

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

function repoSetFromQuery(): RepoSet {
  return route.query.set === 'admin' ? 'admin' : 'core'
}

granularity.value = granularityFromQuery()
timespan.value = timespanFromQuery()
repoSet.value = repoSetFromQuery()
if (!route.query.granularity) {
  granularity.value = timespan.value === 'all' ? 'month' : 'week'
}

watch([granularity, timespan, repoSet], ([g, t, s]) => {
  router.replace({ query: { ...route.query, granularity: g, timespan: t, set: s === 'core' ? undefined : s } })
})

watch(() => route.query.granularity, () => {
  const g = granularityFromQuery()
  if (g !== granularity.value) granularity.value = g
})

watch(() => route.query.timespan, () => {
  const t = timespanFromQuery()
  if (t !== timespan.value) timespan.value = t
})

watch(() => route.query.set, () => {
  const s = repoSetFromQuery()
  if (s !== repoSet.value) repoSet.value = s
})
</script>

<template>
  <div v-if="!stats" class="flex items-center justify-center py-24 text-slate-500">
    Loading…
  </div>
  <template v-else>
    <div class="mb-4 flex items-center gap-2">
      <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Repos</span>
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === 'core'
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="repoSet = 'core'"
        >Core</button>
        <button
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === 'admin'
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="repoSet = 'admin'"
        >Admin</button>
      </div>
    </div>
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
