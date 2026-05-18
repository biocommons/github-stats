const isEmbedded = ref(false)

export function useEmbedMode() {
    if (import.meta.client) {
        isEmbedded.value = window.parent !== window
    }
    return { isEmbedded: readonly(isEmbedded) }
}
