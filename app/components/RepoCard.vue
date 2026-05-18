<script setup lang="ts">
import type { RepoCardData } from '~/composables/useOverviewData'

const props = defineProps<{ repo: RepoCardData }>()

function formatRelease(published_at: string): string {
  return new Date(published_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const sparklineTotal = computed(() => props.repo.sparkline.reduce((s, v) => s + v, 0))
const sparklinePeak = computed(() => Math.max(...props.repo.sparkline))
</script>

<template>
  <article class="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-5">
    <div class="flex items-start justify-between gap-2">
      <a
        :href="repo.html_url"
        target="_blank"
        rel="noopener"
        class="text-base font-semibold text-emerald-300 hover:underline"
      >{{ repo.name }}</a>
      <a
        v-if="repo.latest_release"
        :href="`https://github.com/${repo.full_name}/releases/tag/${repo.latest_release.tag_name}`"
        target="_blank"
        rel="noopener"
        class="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400 hover:border-slate-500 hover:text-slate-200 transition-colors"
      >
        {{ repo.latest_release.tag_name }} · {{ formatRelease(repo.latest_release.published_at) }}
      </a>
    </div>

    <p v-if="repo.description" class="text-sm leading-relaxed text-slate-300">
      {{ repo.description }}
    </p>

    <div class="flex flex-wrap gap-4 text-sm text-slate-400">
      <span title="Stars">★ {{ repo.stargazers_count.toLocaleString() }}</span>
      <span title="Forks">⑂ {{ repo.forks_count.toLocaleString() }}</span>
      <span title="Open issues">Issues: {{ repo.open_issues_count.toLocaleString() }}</span>
      <span title="Open PRs">PRs: {{ repo.open_pr_count.toLocaleString() }}</span>
      <span title="Contributors">Contributors: {{ repo.contributors.toLocaleString() }}</span>
    </div>

    <div class="group relative text-emerald-400/70">
      <SparkLine :values="repo.sparkline" />
      <div class="pointer-events-none absolute bottom-full left-0 mb-2 hidden w-max max-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 shadow-lg group-hover:block">
        <p class="font-medium text-slate-100">Activity · last 12 months</p>
        <p class="mt-1 text-slate-400">Commits + merged PRs per month</p>
        <div class="mt-2 flex gap-4">
          <span>Total <span class="text-slate-200">{{ sparklineTotal }}</span></span>
          <span>Peak <span class="text-slate-200">{{ sparklinePeak }}</span></span>
        </div>
      </div>
    </div>
  </article>
</template>
