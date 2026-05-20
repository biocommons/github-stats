<script setup lang="ts">
const tabs = [
  { label: 'Overview', to: '/overview' },
  { label: 'Issues', to: '/issues' },
  { label: 'PRs', to: '/prs' },
  { label: 'Contributors', to: '/contributors' },
]

const route = useRoute()
const { isLocal, toggle } = useDataSource()
const { isEmbedded } = useEmbedMode()
const isDev = import.meta.dev
const { isDark, toggle: toggleDark } = useDarkMode()
const { collectedAt, relativeTime, formatLocalTime } = useDataMeta()
</script>

<template>
  <div :class="['text-slate-900 dark:text-slate-100', isEmbedded ? 'bg-transparent' : 'min-h-screen bg-slate-50 dark:bg-slate-950']">
    <header v-if="!isEmbedded" class="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-transparent">
      <NuxtLink to="/overview" class="flex items-center gap-3">
        <img src="/logo.svg" alt="biocommons logo" class="h-8 w-8" />
        <p class="text-xs font-semibold uppercase tracking-[0.2em] text-bc-indigo-500 dark:text-bc-indigo-400">
          biocommons · GitHub Stats
        </p>
      </NuxtLink>
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

    <nav v-if="!isEmbedded" class="border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-transparent">
      <div class="flex items-center gap-1">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.to"
          :to="tab.to"
          class="px-4 py-3 text-sm font-medium transition-colors"
          :class="route.path === tab.to
            ? 'border-b-2 border-bc-indigo-500 text-bc-indigo-600 dark:border-bc-indigo-400 dark:text-bc-indigo-300'
            : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'"
        >{{ tab.label }}</NuxtLink>

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
      <slot />
    </main>
  </div>
</template>
