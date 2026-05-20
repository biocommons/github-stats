<script setup lang="ts">
import { useOverviewData } from '~/composables/useOverviewData'
import { useDataSource } from '~/composables/useDataSource'
import { useFlowStats } from '~/composables/useFlowStats'
import { useEmbedMode } from '~/composables/useEmbedMode'

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
</script>

<template>
  <div :class="['text-slate-100', isEmbedded ? 'bg-transparent' : 'min-h-screen bg-slate-950']">
    <header v-if="!isEmbedded" class="flex items-center justify-between border-b border-slate-800 px-6 py-4">
      <p class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
        biocommons · GitHub Stats
      </p>
    </header>

    <nav class="border-b border-slate-800 px-6">
      <div class="flex items-center gap-1">
        <button
          v-for="tab in tabs"
          :key="tab"
          class="px-4 py-3 text-sm font-medium transition-colors"
          :class="
            activeTab === tab
              ? 'border-b-2 border-emerald-400 text-emerald-300'
              : 'text-slate-400 hover:text-slate-200'
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
            class="flex items-center rounded-full border border-slate-700 bg-slate-900 p-0.5 text-xs font-mono"
            title="Toggle data source between local /data and GitHub raw"
          >
            <button
              class="rounded-full px-3 py-1 transition-colors"
              :class="isLocal ? 'bg-amber-500/20 text-amber-400' : 'text-slate-500 hover:text-slate-300'"
              @click="isLocal || toggle()"
            >local</button>
            <button
              class="rounded-full px-3 py-1 transition-colors"
              :class="!isLocal ? 'bg-sky-500/20 text-sky-400' : 'text-slate-500 hover:text-slate-300'"
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
          <div class="mt-10 border-t border-slate-800 pt-8">
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
          <div class="mt-10 border-t border-slate-800 pt-8">
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
