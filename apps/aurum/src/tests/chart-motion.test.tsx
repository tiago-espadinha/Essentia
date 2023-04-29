import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { barMotion, heightsOnly, sameBucket } from '../components/chartMotion'
import MonthBars from '../components/MonthBars'
import { periodTotals } from '../domain/insights'
import { createTransaction } from '../domain/transactions'
import type { BarRectangleItem } from 'recharts'

// What each bar was told about animating, as recharts receives it.
const barProps = vi.hoisted(() => [] as { dataKey: string; isAnimationActive: boolean; animationDuration: number }[])
vi.mock('recharts', async (original) => ({
  ...(await original<typeof import('recharts')>()),
  Bar: (props: (typeof barProps)[number]) => {
    barProps.push(props)
    return null
  },
}))

let reduced = false
let root: Root | null = null
const container = document.createElement('div')

const list = [
  createTransaction(
    { description: 'Rent', amount: 90000, type: 'expense', category: 'housing', date: '2023-04-28' },
    new Date('2023-04-28T10:00:00Z'),
  ),
]
const months = periodTotals(list, 'months', '2023-04-30')
const weeks = periodTotals(list, 'weeks', '2023-04-30')

function draw(props: ComponentProps<typeof MonthBars>) {
  barProps.length = 0
  act(() => (root ??= createRoot(container)).render(<MonthBars {...props} />))
  return barProps.filter((bar) => bar.dataKey === 'expenses').at(-1)!
}

beforeEach(() => {
  reduced = false
  vi.stubGlobal('matchMedia', () => ({ get matches() { return reduced } }))
  document.documentElement.style.setProperty('--duration-normal', '250ms')
  document.documentElement.style.setProperty('--ease', 'ease-out')
})

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.documentElement.removeAttribute('style')
  vi.unstubAllGlobals()
})

describe('barMotion', () => {
  it('takes the suite duration and easing', () => {
    expect(barMotion()).toEqual({ duration: 250, easing: 'ease-out' })
  })

  it('has no duration under reduced motion', () => {
    reduced = true
    expect(barMotion().duration).toBe(0)
  })

  it('has no duration when the token is missing or zero', () => {
    document.documentElement.style.setProperty('--duration-normal', '0ms')
    expect(barMotion().duration).toBe(0)
    document.documentElement.removeAttribute('style')
    expect(barMotion()).toEqual({ duration: 0, easing: 'ease' })
  })
})

describe('heightsOnly', () => {
  // A bar as recharts lays it out; y is its top, so its base is y + height.
  const bar = (period: string, x: number, y: number, height: number) =>
    ({ x, y, width: 10, height, payload: { period } }) as unknown as BarRectangleItem

  it('pairs bars by their bucket, not their place', () => {
    expect(sameBucket(bar('2023-04', 0, 0, 0), 5)).toBe('2023-04')
  })

  it('keeps each bar in its new slot and moves only its height', () => {
    const items = [
      { status: 'matched', prev: bar('2023-04', 50, 60, 40), next: bar('2023-04', 20, 20, 80) },
      { status: 'added', next: bar('2023-05', 40, 50, 50) },
      { status: 'removed', prev: bar('2023-03', 0, 0, 100) },
    ] as const
    const half = heightsOnly(items, 0.5, 'horizontal')
    expect(half.map(({ x, y, height }) => ({ x, y, height }))).toEqual([
      { x: 20, y: 40, height: 60 },
      { x: 40, y: 75, height: 25 },
    ])
    expect(heightsOnly(items, 1, 'horizontal').map(({ y, height }) => [y, height])).toEqual([[20, 80], [50, 50]])
  })
})

describe('bars moving between intervals', () => {
  it('draws the first interval still, then eases to the next one', () => {
    expect(draw({ periods: months, weekly: false }).isAnimationActive).toBe(false)
    const next = draw({ periods: weeks, weekly: true })
    expect(next.isAnimationActive).toBe(true)
    expect(next.animationDuration).toBe(250)
  })

  it('does not animate under reduced motion', () => {
    reduced = true
    draw({ periods: months, weekly: false })
    const next = draw({ periods: weeks, weekly: true })
    expect(next.isAnimationActive).toBe(false)
    expect(next.animationDuration).toBe(0)
  })
})
