<script setup lang="ts">
defineProps<{ label: string; value: number }>()
</script>

<template>
  <article class="rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ value.toLocaleString() }}</p>
  </article>
</template>
