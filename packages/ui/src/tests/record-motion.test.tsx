import { act, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRecordMotion } from '../hooks/useRecordMotion'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root
let reduced: boolean
let preferenceListeners: Set<() => void>
let animations: { target: Element; cancel: ReturnType<typeof vi.fn> }[]
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate')

function Harness() {
  const main = useRef<HTMLElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const focus = useRef<string | null>(null)
  const run = useRecordMotion(main)
  const [records, setRecords] = useState(['First', 'Second'])
  const [deleted, setDeleted] = useState<string | null>(null)
  const [filtered, setFiltered] = useState(false)

  useLayoutEffect(() => {
    if (focus.current) main.current?.querySelector<HTMLElement>(`[data-motion-item="${focus.current}"] button`)?.focus()
    focus.current = null
  })

  return (
    <main ref={main} style={{ '--duration-normal': '250ms', '--space-1': '4px', '--ease': 'ease' } as CSSProperties}>
      <input ref={input} aria-label="New record" />
      <button onClick={() => run(() => {
        setRecords(['New', ...records])
        input.current?.focus()
      })}>Add</button>
      <button onClick={() => setFiltered(!filtered)}>Filter</button>
      {records.length === 0 && <p className="empty">No records.</p>}
      <ul>
        {records.filter((record) => !filtered || record === 'First').map((record) => (
          <li data-motion-item={record} key={record}>
            <button onClick={() => run(() => {
              setRecords(records.filter((item) => item !== record))
              setDeleted(record)
              input.current?.focus()
            })}>Delete {record}</button>
          </li>
        ))}
      </ul>
      <div className="undo" role="status">
        {deleted && <>Deleted {deleted}. <button onClick={() => run(() => {
          setRecords([deleted, ...records])
          focus.current = deleted
          setDeleted(null)
        })}>Undo</button></>}
      </div>
    </main>
  )
}

function button(name: string) {
  return [...container.querySelectorAll('button')].find((element) => element.textContent === name)!
}

function click(name: string) {
  act(() => button(name).click())
}

function recordNames() {
  return [...container.querySelectorAll<HTMLElement>('[data-motion-item]')].map((element) => element.dataset.motionItem)
}

beforeEach(() => {
  reduced = false
  preferenceListeners = new Set()
  animations = []
  vi.stubGlobal('matchMedia', () => ({
    get matches() { return reduced },
    addEventListener: (_: string, listener: () => void) => preferenceListeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => preferenceListeners.delete(listener),
  }))
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    return [this.getBoundingClientRect()] as unknown as DOMRectList
  })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const index = [...document.querySelectorAll('[data-motion-item]')].indexOf(this)
    return new DOMRect(0, Math.max(0, index) * 50, 300, 50)
  })
  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: function (this: Element) {
      const animation = { target: this, cancel: vi.fn() }
      animations.push(animation)
      return animation
    },
  })
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate)
  else Reflect.deleteProperty(Element.prototype, 'animate')
})

describe('record motion', () => {
  it('updates records, feedback and focus without waiting for an animation to finish', () => {
    act(() => root.render(<Harness />))
    const removed = button('Delete First').parentElement!
    click('Delete First')
    expect(recordNames()).toEqual(['Second'])
    expect(removed.isConnected).toBe(false)
    expect(container.querySelector('[role="status"]')!.textContent).toContain('Deleted First.')
    expect(document.activeElement).toBe(container.querySelector('input'))
    expect(animations.some((animation) => animation.target.textContent?.includes('Second'))).toBe(true)

    click('Undo')
    expect(recordNames()).toEqual(['First', 'Second'])
    expect(document.activeElement).toBe(button('Delete First'))
    expect(container.querySelector('[role="status"]')!.textContent).toBe('')
    click('Add')
    expect(recordNames()).toEqual(['New', 'First', 'Second'])
    expect(document.activeElement).toBe(container.querySelector('input'))
  })

  it('keeps initial render and filtering still', () => {
    act(() => root.render(<Harness />))
    expect(recordNames()).toEqual(['First', 'Second'])
    expect(animations).toEqual([])
    click('Filter')
    expect(recordNames()).toEqual(['First'])
    expect(animations).toEqual([])
    click('Filter')
    expect(recordNames()).toEqual(['First', 'Second'])
    expect(animations).toEqual([])
  })

  it('cancels previous motion on rapid actions and immediately reveals the final empty state', () => {
    act(() => root.render(<Harness />))
    click('Delete First')
    const firstMotion = [...animations]
    click('Delete Second')
    expect(firstMotion.length).toBeGreaterThan(0)
    expect(firstMotion.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
    expect(recordNames()).toEqual([])
    expect(container.querySelector('.empty')!.textContent).toBe('No records.')
    expect(container.querySelectorAll('li')).toHaveLength(0)
    expect(document.activeElement).toBe(container.querySelector('input'))
    expect(animations.some((animation) => animation.target.classList.contains('empty'))).toBe(true)
    click('Undo')
    expect(recordNames()).toEqual(['Second'])
    expect(document.activeElement).toBe(button('Delete Second'))
    expect(container.querySelector('.empty')).toBeNull()
  })

  it('suppresses motion with reduced motion while preserving add/delete/Undo and focus', () => {
    reduced = true
    act(() => root.render(<Harness />))
    click('Add')
    expect(recordNames()).toEqual(['New', 'First', 'Second'])
    click('Delete New')
    expect(recordNames()).toEqual(['First', 'Second'])
    click('Undo')
    expect(recordNames()).toEqual(['New', 'First', 'Second'])
    expect(document.activeElement).toBe(button('Delete New'))
    expect(animations).toEqual([])
  })

  it('cancels active motion when reduced motion is enabled live', () => {
    act(() => root.render(<Harness />))
    click('Add')
    expect(animations.length).toBeGreaterThan(0)
    reduced = true
    act(() => preferenceListeners.forEach((listener) => listener()))
    expect(animations.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
    const prior = animations.length
    click('Delete New')
    expect(recordNames()).toEqual(['First', 'Second'])
    expect(document.activeElement).toBe(container.querySelector('input'))
    expect(animations).toHaveLength(prior)
  })

  it('cancels on pagehide and removes preference listeners on unmount', () => {
    act(() => root.render(<Harness />))
    click('Add')
    const beforePagehide = [...animations]
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(beforePagehide.length).toBeGreaterThan(0)
    expect(beforePagehide.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
    expect(recordNames()).toEqual(['New', 'First', 'Second'])
    click('Delete New')
    act(() => root.render(null))
    expect(animations.every((animation) => animation.cancel.mock.calls.length > 0)).toBe(true)
    expect(preferenceListeners.size).toBe(0)
    expect(container.childElementCount).toBe(0)
  })

  it('keeps actions immediate when browser animation and media-query APIs are absent', () => {
    Reflect.deleteProperty(Element.prototype, 'animate')
    vi.stubGlobal('matchMedia', undefined)
    act(() => root.render(<Harness />))
    click('Add')
    expect(recordNames()).toEqual(['New', 'First', 'Second'])
    click('Delete New')
    expect(recordNames()).toEqual(['First', 'Second'])
    click('Undo')
    expect(recordNames()).toEqual(['New', 'First', 'Second'])
    expect(document.activeElement).toBe(button('Delete New'))
    expect(animations).toEqual([])
  })
})
