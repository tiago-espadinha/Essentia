import { matchByDataKey, type BarProps, type EasingInput } from 'recharts'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

/**
 * How the bars move to new values: the suite's --duration-normal and --ease,
 * read when the chart draws so a changed preference applies on the next change.
 * Under reduced motion the duration is 0 and the chart does not animate.
 */
export function barMotion(root: Element = document.documentElement): { duration: number; easing: EasingInput } {
  if (window.matchMedia?.(REDUCED_MOTION).matches) return { duration: 0, easing: 'ease' }
  const style = getComputedStyle(root)
  const duration = parseFloat(style.getPropertyValue('--duration-normal'))
  const easing = (style.getPropertyValue('--ease').trim() || 'ease') as EasingInput
  return { duration: duration > 0 ? duration : 0, easing }
}

type BarInterpolate = NonNullable<BarProps['animationInterpolateFn']>

/** Pairs bars by bucket, so a bar only ever moves to its own bucket's new value. */
export const sameBucket = matchByDataKey('period')

/**
 * Bars take their new slot at once and only their height moves: a bucket that is
 * still shown eases from its old height, a new one grows from the baseline, and
 * one that left goes at once. No bar ever stands under another bucket's label.
 */
export const heightsOnly: BarInterpolate = (items, elapsed) =>
  (items ?? []).flatMap((item) => {
    if (item.status === 'removed') return []
    const { next } = item
    const from = item.status === 'matched' ? item.prev : { y: next.y + next.height, height: 0 }
    const between = (a: number, b: number) => a + (b - a) * elapsed
    return [{ ...next, y: between(from.y, next.y), height: between(from.height, next.height) }]
  })
