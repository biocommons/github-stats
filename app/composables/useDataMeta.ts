import { relativeTime, formatLocalTime } from './useTimeBuckets'

const EXPECTED_SCHEMA_VERSION = '2.0'

interface MetaResponse {
  collected_at: string
  schema_version?: string
}

export function useDataMeta() {
  const { dataBase } = useDataSource()

  const { data } = useAsyncData(
    () => `meta:${dataBase.value}`,
    () => $fetch<MetaResponse>(`${dataBase.value}/meta.json`, { responseType: 'json' }),
  )

  const collectedAt = computed(() => data.value?.collected_at ?? null)
  const schemaVersionMismatch = computed(() =>
    data.value != null && data.value.schema_version !== EXPECTED_SCHEMA_VERSION
  )

  return { collectedAt, schemaVersionMismatch, relativeTime, formatLocalTime }
}
