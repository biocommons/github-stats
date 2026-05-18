const GITHUB_RAW = 'https://raw.githubusercontent.com/biocommons/github-stats/refs/heads/gh-pages/data'
const LOCAL = '/data'

export function useDataSource() {
  const { public: { dataBase: configBase } } = useRuntimeConfig()
  const dataBase = useState('dataSource', () => configBase as string)
  const isLocal = computed(() => dataBase.value === LOCAL)

  function toggle() {
    dataBase.value = isLocal.value ? GITHUB_RAW : LOCAL
  }

  return { dataBase, isLocal, toggle }
}
