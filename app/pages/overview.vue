<script setup lang="ts">
const { orgSummary, repoCards, isLoading } = useOverviewData()
</script>

<template>
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
