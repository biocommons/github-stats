import { relativeTime, formatLocalTime } from './useTimeBuckets'

const EXPECTED_SCHEMA_VERSION = '1.2'

interface MetaResponse {
  collected_at: string
  schema_version?: string
}

function parseVersion(v: string): [number, number] {
  const parts = v.split('.').map(Number)
  return [parts[0] ?? 0, parts[1] ?? 0]
}

// Compatible when: same major AND data version >= expected version.
// Different major = breaking change (incompatible either direction).
// Older minor = data predates a required additive field (too old).
// Newer minor = data is a superset; frontend ignores unknown fields (fine).
function isSchemaCompatible(dataVersion: string | undefined): boolean {
  if (!dataVersion) return false
  const [dataMajor, dataMinor] = parseVersion(dataVersion)
  const [expMajor, expMinor] = parseVersion(EXPECTED_SCHEMA_VERSION)
  return dataMajor === expMajor && dataMinor >= expMinor
}

export function useDataMeta() {
  const { dataBase } = useDataSource()

  const { data } = useAsyncData(
    () => `meta:${dataBase.value}`,
    () => $fetch<MetaResponse>(`${dataBase.value}/meta.json`, { responseType: 'json' }),
  )

  const collectedAt = computed(() => data.value?.collected_at ?? null)
  const schemaVersionMismatch = computed(() =>
    data.value != null && !isSchemaCompatible(data.value.schema_version)
  )

  return { collectedAt, schemaVersionMismatch, relativeTime, formatLocalTime }
}
