<script setup lang="ts">
import type { RepoCardData } from '~/composables/useOverviewData'
import { formatRelative, formatLocalTime } from '~/composables/useTimeBuckets'
import { useAnchoredTooltip } from '~/composables/useAnchoredTooltip'
import { repoDisplayName } from '~/config'

const spanEl = ref<HTMLElement | null>(null)
const { triggerRef, isHovered, pos, onMouseEnter } = useAnchoredTooltip()
watchEffect(() => { triggerRef.value = spanEl.value })

const props = defineProps<{ repo: RepoCardData }>()

function formatRelease(published_at: string): string {
  return new Date(published_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const sparklineTotal = computed(() => props.repo.sparkline.reduce((s, v) => s + v, 0))
const sparklinePeak = computed(() => Math.max(...props.repo.sparkline))
</script>

<template>
  <article class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/80">
    <div class="flex items-start justify-between gap-2">
      <a
        :href="repo.html_url"
        target="_blank"
        rel="noopener"
        class="text-base font-semibold text-bc-indigo-500 hover:underline dark:text-bc-indigo-300 flex items-center gap-1.5"
      >
        {{ repoDisplayName(repo.name) }}
        <i v-if="repo.private" role="img" aria-label="Private repository" class="fa-solid fa-lock text-xs text-slate-400 dark:text-slate-500" />
      </a>
      <a
        v-if="repo.latest_release && !repo.archived"
        :href="`https://github.com/${repo.full_name}/releases/tag/${repo.latest_release.tag_name}`"
        target="_blank"
        rel="noopener"
        class="shrink-0 rounded-full border border-bc-teal-400 px-2 py-0.5 text-xs text-bc-teal-600 transition-colors hover:bg-bc-teal-400 hover:text-white dark:border-bc-teal-400 dark:text-bc-teal-300 dark:hover:bg-bc-teal-500 dark:hover:text-white"
      >
        {{ repo.latest_release.tag_name }} · {{ formatRelease(repo.latest_release.published_at) }}
      </a>
      <span
        v-else-if="repo.archived"
        class="shrink-0 rounded-full border border-slate-300 px-2 py-0.5 text-xs text-slate-400 dark:border-slate-600 dark:text-slate-500"
      >
        archived
      </span>
    </div>

    <p v-if="repo.description" class="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      {{ repo.description }}
    </p>

    <div class="flex flex-wrap gap-4 text-sm text-slate-500 dark:text-slate-400">
      <a :href="`${repo.html_url}/stargazers`" target="_blank" rel="noopener" title="Stars" class="flex items-center gap-1.5 transition-colors hover:text-slate-700 dark:hover:text-slate-200"><i class="fa-regular fa-star w-3.5 text-center text-bc-teal-500 dark:text-bc-teal-400" aria-hidden="true" />{{ repo.stargazers_count.toLocaleString() }}</a>
      <a :href="`${repo.html_url}/forks`" target="_blank" rel="noopener" title="Forks" class="flex items-center gap-1.5 transition-colors hover:text-slate-700 dark:hover:text-slate-200"><i class="fa-solid fa-code-fork w-3.5 text-center text-bc-teal-500 dark:text-bc-teal-400" aria-hidden="true" />{{ repo.forks_count.toLocaleString() }}</a>
      <a :href="`${repo.html_url}/issues`" target="_blank" rel="noopener" title="Open issues" class="flex items-center gap-1.5 transition-colors hover:text-slate-700 dark:hover:text-slate-200"><i class="fa-regular fa-circle-dot w-3.5 text-center text-bc-teal-500 dark:text-bc-teal-400" aria-hidden="true" />{{ repo.open_issues_count.toLocaleString() }}</a>
      <a :href="`${repo.html_url}/pulls`" target="_blank" rel="noopener" title="Open PRs" class="flex items-center gap-1.5 transition-colors hover:text-slate-700 dark:hover:text-slate-200"><i class="fa-solid fa-code-pull-request w-3.5 text-center text-bc-teal-500 dark:text-bc-teal-400" aria-hidden="true" />{{ repo.open_pr_count.toLocaleString() }}</a>
      <a :href="`${repo.html_url}/graphs/contributors`" target="_blank" rel="noopener" title="Contributors" class="flex items-center gap-1.5 transition-colors hover:text-slate-700 dark:hover:text-slate-200"><i class="fa-solid fa-users w-3.5 text-center text-bc-teal-500 dark:text-bc-teal-400" aria-hidden="true" />{{ repo.contributors.toLocaleString() }}</a>
      <span
        v-if="repo.updated_at"
        ref="spanEl"
        class="flex items-center gap-1.5 cursor-default"
        @mouseenter="onMouseEnter"
        @mouseleave="isHovered = false"
      >
        <i class="fa-regular fa-clock w-3.5 text-center text-bc-teal-500 dark:text-bc-teal-400" aria-hidden="true" />{{ formatRelative(repo.updated_at) }}
      </span>
      <Teleport to="body">
        <div
          v-if="isHovered"
          class="pointer-events-none fixed z-50"
          :style="{ left: `${pos.x}px`, top: `${pos.y}px`, transform: `translateX(${pos.tx}) translateY(${pos.ty})` }"
        >
          <div class="w-64 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <p class="font-medium text-slate-900 dark:text-slate-100">Updated {{ formatLocalTime(repo.updated_at) }}</p>
            <p class="mt-1 text-slate-500 dark:text-slate-400">Activity · last 12 months · commits + merged PRs</p>
            <div class="mt-2 text-bc-teal-500/70 dark:text-bc-teal-400/70">
              <SparkLine :values="repo.sparkline" />
            </div>
            <div class="mt-2 flex gap-4">
              <span>Total <span class="text-slate-700 dark:text-slate-200">{{ sparklineTotal }}</span></span>
              <span>Peak <span class="text-slate-700 dark:text-slate-200">{{ sparklinePeak }}</span></span>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </article>
</template>
