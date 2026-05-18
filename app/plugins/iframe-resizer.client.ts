export default defineNuxtPlugin(() => {
    const { isEmbedded } = useEmbedMode()
    if (!isEmbedded.value) return

    const sendHeight = () => {
        window.parent.postMessage(
            { type: "github-stats-resize", height: document.body.scrollHeight },
            "*",
        )
    }

    const observer = new ResizeObserver(sendHeight)
    observer.observe(document.body)
    sendHeight()
})
