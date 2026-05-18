export default defineNuxtPlugin(() => {
    if (typeof window === "undefined" || window.parent === window) return;

    const sendHeight = () => {
        window.parent.postMessage(
            { type: "github-stats-resize", height: document.body.scrollHeight },
            "*",
        );
    };

    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.body);
    sendHeight();
});
