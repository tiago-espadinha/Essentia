import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function rows(root: HTMLElement) {
  return [...root.querySelectorAll<HTMLElement>('[data-motion-item]')].filter((element) => element.getClientRects().length > 0)
}

/** Animate explicit record actions after React commits; data and focus never wait for motion. */
export function useRecordMotion(root: RefObject<HTMLElement | null>) {
  const before = useRef<Map<string, DOMRect> | null>(null)
  const animations = useRef<Animation[]>([])

  function cancel() {
    animations.current.forEach((animation) => animation.cancel())
    animations.current = []
    before.current = null
  }

  useEffect(() => {
    const query = window.matchMedia?.(REDUCED_MOTION)
    const onPreference = () => { if (query?.matches) cancel() }
    query?.addEventListener('change', onPreference)
    window.addEventListener('pagehide', cancel)
    return () => {
      cancel()
      query?.removeEventListener('change', onPreference)
      window.removeEventListener('pagehide', cancel)
    }
  }, [])

  useLayoutEffect(() => {
    const previous = before.current
    before.current = null
    const element = root.current
    if (!previous || !element || window.matchMedia?.(REDUCED_MOTION).matches) return
    const style = getComputedStyle(element)
    const duration = parseFloat(style.getPropertyValue('--duration-normal'))
    const distance = style.getPropertyValue('--space-1').trim()
    if (!(duration > 0)) return
    const animate = (target: HTMLElement, transform: string) => {
      if (!target.animate) return
      animations.current.push(target.animate(
        [{ transform }, { transform: 'translate(0, 0)' }],
        { duration, easing: style.getPropertyValue('--ease').trim() },
      ))
    }
    for (const row of rows(element)) {
      const old = previous.get(row.dataset.motionItem!)
      const next = row.getBoundingClientRect()
      if (!old) animate(row, `translateY(${distance})`)
      else if (old.top !== next.top || old.left !== next.left) {
        animate(row, `translate(${old.left - next.left}px, ${old.top - next.top}px)`)
      }
    }
    // Covers a hidden mobile library, the last/bottom deletion, and filtered-out additions.
    for (const feedback of element.querySelectorAll<HTMLElement>('[data-motion-detail], .empty, .undo')) {
      if (feedback.getClientRects().length && feedback.textContent?.trim()) animate(feedback, `translateY(${distance})`)
    }
  })

  return function run<T>(action: () => T): T {
    cancel()
    if (root.current && !window.matchMedia?.(REDUCED_MOTION).matches) {
      before.current = new Map(rows(root.current).map((row) => [row.dataset.motionItem!, row.getBoundingClientRect()]))
    }
    return action()
  }
}
