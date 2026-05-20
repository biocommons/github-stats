<script setup lang="ts">
import { useOverviewData } from '~/composables/useOverviewData'
import { useDataSource } from '~/composables/useDataSource'
import { useFlowStats } from '~/composables/useFlowStats'
import { useEmbedMode } from '~/composables/useEmbedMode'
import { useDarkMode } from '~/composables/useDarkMode'

const tabs = ['Overview', 'Issues', 'PRs', 'Contributors'] as const
type Tab = (typeof tabs)[number]

const TAB_SLUG: Record<Tab, string> = {
  'Overview': 'overview',
  'Issues': 'issues',
  'PRs': 'prs',
  'Contributors': 'contributors',
}
const SLUG_TAB: Record<string, Tab> = Object.fromEntries(
  Object.entries(TAB_SLUG).map(([tab, slug]) => [slug, tab as Tab])
)

const route = useRoute()
const router = useRouter()

function tabFromQuery(): Tab {
  const slug = typeof route.query.tab === 'string' ? route.query.tab : ''
  return SLUG_TAB[slug] ?? 'Overview'
}

const activeTab = ref<Tab>(tabFromQuery())

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab: TAB_SLUG[tab] } })
})

watch(() => route.query.tab, () => {
  const t = tabFromQuery()
  if (t !== activeTab.value) activeTab.value = t
})

const { orgSummary, repoCards, isLoading, collectedAt, relativeTime, formatLocalTime } = useOverviewData()
const { stats: issueStats, allRepos: issueAllRepos, granularity, selectedRepos, toggleRepo } = useFlowStats('issues')
const { stats: prStats, allRepos: prAllRepos, granularity: prGranularity, selectedRepos: prSelectedRepos, toggleRepo: prToggleRepo } = useFlowStats('prs')

// Keep PR granularity in sync with the shared URL-driven granularity ref
watch(granularity, (g) => { prGranularity.value = g }, { immediate: true })

function granularityFromQuery(): 'month' | 'quarter' {
  const g = typeof route.query.granularity === 'string' ? route.query.granularity : ''
  return g === 'quarter' ? 'quarter' : 'month'
}

granularity.value = granularityFromQuery()

watch(granularity, (g) => {
  router.replace({ query: { ...route.query, granularity: g } })
})

watch(() => route.query.granularity, () => {
  const g = granularityFromQuery()
  if (g !== granularity.value) granularity.value = g
})
const { isLocal, toggle } = useDataSource()
const { isEmbedded } = useEmbedMode()
const isDev = import.meta.dev
const { isDark, toggle: toggleDark } = useDarkMode()
</script>

<template>
  <div :class="['text-slate-900 dark:text-slate-100', isEmbedded ? 'bg-transparent' : 'min-h-screen bg-slate-50 dark:bg-slate-950']">
    <header v-if="!isEmbedded" class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-transparent">
      <div class="flex items-center gap-3">
        <img src="/logo.svg" alt="biocommons logo" class="h-8 w-8" />
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-bc-indigo-500 dark:text-bc-indigo-400">
          biocommons · GitHub Stats
        </p>
      </div>
      <button
        class="rounded-full p-1.5 text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
        :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        @click="toggleDark()"
      >
        <svg v-if="isDark" viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4.22 1.78a1 1 0 011.42 1.42l-.71.7a1 1 0 11-1.42-1.41l.71-.71zm-9.86 0l.71.71a1 1 0 01-1.42 1.41l-.7-.7a1 1 0 011.41-1.42zM10 6a4 4 0 100 8 4 4 0 000-8zm-7 4a1 1 0 100 2H2a1 1 0 100-2h1zm15 0a1 1 0 100 2h-1a1 1 0 100-2h1zM5.64 14.36l-.71.71a1 1 0 01-1.41-1.42l.7-.7a1 1 0 011.42 1.41zm10.14-.71l.7.7a1 1 0 01-1.41 1.42l-.71-.71a1 1 0 011.42-1.41zM10 16a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" />
        </svg>
        <svg v-else viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      </button>
    </header>

    <nav class="border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-transparent">
      <div class="flex items-center gap-1">
        <button
          v-for="tab in tabs"
          :key="tab"
          class="px-4 py-3 text-sm font-medium transition-colors"
          :class="
            activeTab === tab
              ? 'border-b-2 border-bc-indigo-500 text-bc-indigo-600 dark:border-bc-indigo-400 dark:text-bc-indigo-300'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          "
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>

        <div class="ml-auto flex items-center gap-4">
          <p
            v-if="collectedAt"
            class="text-xs text-slate-500"
            :title="formatLocalTime(collectedAt)"
          >updated {{ relativeTime(collectedAt) }}</p>

          <div
            v-if="isDev"
            class="flex items-center rounded-full border border-slate-200 bg-slate-100 p-0.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-900"
            title="Toggle data source between local /data and GitHub raw"
          >
            <button
              class="rounded-full px-3 py-1 transition-colors"
              :class="isLocal ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'"
              @click="isLocal || toggle()"
            >local</button>
            <button
              class="rounded-full px-3 py-1 transition-colors"
              :class="!isLocal ? 'bg-bc-teal-500/20 text-bc-teal-600 dark:text-bc-teal-300' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'"
              @click="isLocal && toggle()"
            >github raw</button>
          </div>
        </div>
      </div>
    </nav>

    <main :class="['mx-auto max-w-6xl px-6', isEmbedded ? 'py-4' : 'py-8']">

      <!-- Overview tab -->
      <template v-if="activeTab === 'Overview'">
        <div v-if="isLoading" class="flex items-center justify-center py-24 text-slate-500">
          Loading…
        </div>
        <template v-else>
          <div v-if="orgSummary" class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <OrgSummaryCard label="Total stars" :value="orgSummary.totalStars" />
            <OrgSummaryCard label="Contributors" :value="orgSummary.uniqueContributors" />
            <OrgSummaryCard label="Open issues" :value="orgSummary.openIssues" />
            <OrgSummaryCard label="Open PRs" :value="orgSummary.openPRs" />
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <RepoCard v-for="repo in repoCards" :key="repo.name" :repo="repo" />
          </div>
        </template>
      </template>

      <!-- Issues tab -->
      <template v-else-if="activeTab === 'Issues'">
        <div v-if="!issueStats" class="flex items-center justify-center py-24 text-slate-500">
          Loading…
        </div>
        <template v-else>
          <FlowChart
            :stats="issueStats"
            :all-repos="issueAllRepos"
            :granularity="granularity"
            :selected-repos="selectedRepos"
            item-label="issues"
            @update:granularity="granularity = $event"
            @toggle-repo="toggleRepo"
          />
          <div class="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
            <ResolutionByRepo :stats="issueStats" item-label="issues" />
          </div>
        </template>
      </template>

      <!-- PRs tab -->
      <template v-else-if="activeTab === 'PRs'">
        <div v-if="!prStats" class="flex items-center justify-center py-24 text-slate-500">
          Loading…
        </div>
        <template v-else>
          <FlowChart
            :stats="prStats"
            :all-repos="prAllRepos"
            :granularity="granularity"
            :selected-repos="prSelectedRepos"
            item-label="PRs"
            @update:granularity="granularity = $event"
            @toggle-repo="prToggleRepo"
          />
          <div class="mt-10 border-t border-slate-200 pt-8 dark:border-slate-800">
            <ResolutionByRepo :stats="prStats" item-label="PRs" />
          </div>
        </template>
      </template>

      <!-- Contributors tab -->
      <template v-else-if="activeTab === 'Contributors'">
        <ContributorTable />
      </template>

      <!-- Placeholder tabs -->
      <template v-else>
        <div class="flex items-center justify-center py-24 text-slate-500">
          {{ activeTab }} — coming soon
        </div>
      </template>

    </main>
  </div>
</template>
