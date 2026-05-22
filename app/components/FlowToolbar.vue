<script setup lang="ts">
import { REPO_SETS } from '~/config'
import type { RepoSet } from '~/config'
import type { FlowTimespan } from '~/composables/useFlowStats'
import type { TimeBucket } from '~/composables/useTimeBuckets'
import { repoDisplayName } from '~/config'

const props = defineProps<{
  repoSet: RepoSet
  reposInSet: string[]
  granularity: TimeBucket
  timespan: FlowTimespan
}>()

const emit = defineEmits<{
  'update:repoSet': [value: RepoSet]
  'update:granularity': [value: TimeBucket]
  'update:timespan': [value: FlowTimespan]
}>()

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
    <!-- Row 1: repo-set switch + active repo list -->
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
      <span class="truncate text-xs text-slate-400 dark:text-slate-500">
        {{ reposInSet.map(repoDisplayName).join(', ') }}
      </span>
    </div>

    <!-- Row 2: timespan + granularity -->
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
      <div class="flex items-center rounded-full border border-slate-200 bg-slate-50 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900">
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
    </div>
  </div>
</template>
