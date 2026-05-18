<script setup lang="ts">
import { useOverviewData } from '~/composables/useOverviewData'
import { useDataSource } from '~/composables/useDataSource'

const tabs = ['Overview', 'Issues', 'PRs', 'Resolution Time', 'Contributors'] as const
type Tab = (typeof tabs)[number]

const activeTab = ref<Tab>('Overview')

const { orgSummary, repoCards, isLoading } = useOverviewData()
const { isLocal, toggle } = useDataSource()
const isDev = import.meta.dev
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <header class="border-b border-slate-800 px-6 py-4">
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

        <div
          v-if="isDev"
          class="ml-auto flex items-center rounded-full border border-slate-700 bg-slate-900 p-0.5 text-xs font-mono"
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
    </nav>

    <main class="mx-auto max-w-6xl px-6 py-8">

      <!-- Overview tab -->
      <template v-if="activeTab === 'Overview'">
        <div v-if="isLoading" class="flex items-center justify-center py-24 text-slate-500">
          Loading…
        </div>
        <template v-else>
          <div v-if="orgSummary" class="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <!-- Placeholder tabs -->
      <template v-else>
        <div class="flex items-center justify-center py-24 text-slate-500">
          {{ activeTab }} — coming soon
        </div>
      </template>

    </main>
  </div>
</template>
