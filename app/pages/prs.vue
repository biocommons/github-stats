<script setup lang="ts">
import { useFlowStats, type FlowTimespan } from '~/composables/useFlowStats'
import { REPO_SETS, repoDisplayName, repoColor as getRepoColor, contrastColor } from '~/config'
import type { RepoSet } from '~/config'

const route = useRoute()
const router = useRouter()
const { stats, resolutionWindows, allRepos, granularity, timespan, repoSet, selectedRepos, toggleRepo } = useFlowStats('prs')

const scrollMode = ref(timespan.value === 'all')
watch(timespan, ts => { scrollMode.value = ts === 'all' })

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
  const s = route.query.set
  if (s === 'admin' || s === 'archived') return s
  return 'core'
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

function repoColor(repo: string): string {
  return getRepoColor(repo, allRepos.value)
}
</script>

<template>
  <div v-if="!stats" class="flex items-center justify-center py-24 text-slate-500">
    Loading…
  </div>
  <template v-else>
    <!-- Repo set + repo chips -->
    <div class="mb-4 flex flex-wrap items-center gap-3">
      <span class="text-xs font-medium uppercase tracking-wider text-slate-500">Repos</span>
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="s in REPO_SETS"
          :key="s.key"
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === s.key
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="repoSet = s.key"
        >{{ s.label }}</button>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="repo in allRepos"
          :key="repo"
          class="rounded-full border px-2.5 py-0.5 text-sm font-medium transition-colors"
          :style="selectedRepos.has(repo)
            ? { borderColor: repoColor(repo), background: repoColor(repo) + 'bf', color: contrastColor(repoColor(repo), 0.75) }
            : { borderColor: 'var(--chip-inactive-border)', color: 'var(--chip-inactive-color)' }"
          @click="toggleRepo(repo)"
        >{{ repoDisplayName(repo) }}</button>
      </div>
    </div>

    <!-- Resolution by repo -->
    <ResolutionByRepo :resolution-windows="resolutionWindows" :all-repos="allRepos" item-label="PRs" />

    <!-- Flow chart with inlined controls -->
    <div class="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
      <FlowChart
        :stats="stats"
        :all-repos="allRepos"
        :granularity="granularity"
        :timespan="timespan"
        :scroll-mode="scrollMode"
        item-label="PRs"
        @update:granularity="granularity = $event"
        @update:timespan="timespan = $event"
        @update:scroll-mode="scrollMode = $event"
      />
    </div>
  </template>
</template>
