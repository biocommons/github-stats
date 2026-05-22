<script setup lang="ts">
import { REPO_SETS, repoDisplayName, repoColor as getRepoColor, contrastColor } from '~/config'
import type { RepoSet } from '~/config'
import type { FlowTimespan } from '~/composables/useFlowStats'
import type { TimeBucket } from '~/composables/useTimeBuckets'

const props = defineProps<{
  repoSet: RepoSet
  allRepos: string[]
  selectedRepos: Set<string>
  granularity: TimeBucket
  timespan: FlowTimespan
  scrollMode: boolean
}>()

const emit = defineEmits<{
  'update:repoSet': [value: RepoSet]
  'update:granularity': [value: TimeBucket]
  'update:timespan': [value: FlowTimespan]
  'update:scrollMode': [value: boolean]
  'toggle-repo': [repo: string]
}>()

function repoColor(repo: string): string {
  return getRepoColor(repo, props.allRepos)
}

const TIMESPANS: { label: string; value: FlowTimespan }[] = [
  { label: 'All time', value: 'all' },
  { label: '12 mo',   value: '12mo' },
  { label: '6 mo',    value: '6mo' },
  { label: '3 mo',    value: '3mo' },
  { label: '1 mo',    value: '1mo' },
]
</script>

<template>
  <div class="mb-4 flex flex-col gap-2">
    <!-- Row 1: repo-set switch + repo chips -->
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="s in REPO_SETS"
          :key="s.key"
          class="rounded-full px-3 py-1 transition-colors"
          :class="repoSet === s.key
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="emit('update:repoSet', s.key)"
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
          @click="emit('toggle-repo', repo)"
        >{{ repoDisplayName(repo) }}</button>
      </div>
    </div>

    <!-- Row 2: timespan + granularity + fit/pan -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="ts in TIMESPANS"
          :key="ts.value"
          class="rounded-full px-3 py-1 transition-colors"
          :class="timespan === ts.value
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="emit('update:timespan', ts.value)"
        >{{ ts.label }}</button>
      </div>
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="g in (['week', 'month', 'quarter'] as const)"
          :key="g"
          class="rounded-full px-3 py-1 capitalize transition-colors"
          :class="granularity === g
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="emit('update:granularity', g)"
        >{{ g }}</button>
      </div>
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium dark:border-slate-700 dark:bg-slate-900">
        <button
          v-for="[mode, label] in [['fit', 'Fit'], ['pan', 'Pan']] as const"
          :key="mode"
          class="rounded-full px-3 py-1 transition-colors"
          :class="(mode === 'pan') === scrollMode
            ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
          @click="emit('update:scrollMode', mode === 'pan')"
        >{{ label }}</button>
      </div>
    </div>
  </div>
</template>
