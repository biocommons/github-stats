<script setup lang="ts">
defineProps<{ label: string; value: number }>()
</script>

<template>
  <article class="rounded-xl border border-slate-800 bg-slate-900/80 p-5">
    <p class="text-sm font-semibold uppercase tracking-wide text-slate-400">{{ label }}</p>
    <p class="mt-2 text-3xl font-bold text-white">{{ value.toLocaleString() }}</p>
  </article>
</template>
