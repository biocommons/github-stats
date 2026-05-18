<script setup lang="ts">
import type { RepoCardData } from '~/composables/useOverviewData'

defineProps<{ repo: RepoCardData }>()

function formatRelease(published_at: string): string {
  const d = new Date(published_at)
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}
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
      <span
        v-if="repo.latest_release"
        class="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-xs text-slate-400"
      >
        {{ repo.latest_release.tag_name }} · {{ formatRelease(repo.latest_release.published_at) }}
      </span>
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

    <div class="text-emerald-400/70">
      <SparkLine :values="repo.sparkline" />
    </div>
  </article>
</template>
