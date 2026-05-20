export function useAnchoredTooltip() {
  const triggerRef = ref<HTMLElement | null>(null)
  const isHovered = ref(false)
  const pos = ref({ x: 0, y: 0, tx: '0%', ty: '0%' })

  function onMouseEnter() {
    if (!triggerRef.value) return
    const rect = triggerRef.value.getBoundingClientRect()
    const inBottomHalf = (rect.top + rect.height / 2) > window.innerHeight / 2
    const inRightHalf  = (rect.left + rect.width / 2) > window.innerWidth / 2
    pos.value = {
      x:  inRightHalf  ? rect.right      : rect.left,
      y:  inBottomHalf ? rect.top - 8    : rect.bottom + 8,
      tx: inRightHalf  ? '-100%'         : '0%',
      ty: inBottomHalf ? '-100%'         : '0%',
    }
    isHovered.value = true
  }

  return { triggerRef, isHovered, pos, onMouseEnter }
}
