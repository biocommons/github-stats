<script setup lang="ts">
defineProps<{ label: string; value: number }>()
</script>

<template>
  <article class="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3">
    <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold text-white">{{ value.toLocaleString() }}</p>
  </article>
</template>
