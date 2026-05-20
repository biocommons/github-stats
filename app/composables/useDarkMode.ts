const isDark = ref(false)

export function useDarkMode() {
  onMounted(() => {
    const saved = localStorage.getItem('color-mode')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    isDark.value = saved !== null ? saved === 'dark' : prefersDark
    document.documentElement.classList.toggle('dark', isDark.value)
  })

  function toggle() {
    isDark.value = !isDark.value
    document.documentElement.classList.toggle('dark', isDark.value)
    localStorage.setItem('color-mode', isDark.value ? 'dark' : 'light')
  }

  return { isDark, toggle }
}
