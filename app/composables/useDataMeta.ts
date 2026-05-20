import { relativeTime, formatLocalTime } from './useTimeBuckets'

export function useDataMeta() {
  const { dataBase } = useDataSource()

  const { data } = useAsyncData(
    () => `meta:${dataBase.value}`,
    () => $fetch<{ collected_at: string }>(`${dataBase.value}/meta.json`, { responseType: 'json' }),
  )

  const collectedAt = computed(() => data.value?.collected_at ?? null)

  return { collectedAt, relativeTime, formatLocalTime }
}
