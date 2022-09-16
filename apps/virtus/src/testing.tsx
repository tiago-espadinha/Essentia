// Minimal render helpers on react-dom, matching the suite's other tests.
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, vi } from 'vitest'
import App from './App'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom has <dialog> without its methods; the browser's focus trap and Esc are not emulated.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true
}

export const TODAY_DATE = new Date(2022, 7, 15, 9, 30)
export const TODAY = '2022-08-15'

let container: HTMLElement
let root: Root | null = null

export function setupApp() {
  beforeEach(() => {
    localStorage.clear()
    // Monday 15 August 2022, mid-morning; only Date is faked, so timers still run.
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY_DATE)
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  })
  afterEach(() => {
    unmount()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })
}

export function renderApp(): HTMLElement {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  act(() => root!.render(<App />))
  return container
}

export function unmount() {
  if (!root) return
  act(() => root!.unmount())
  container.remove()
  root = null
}

export function $<T extends Element = HTMLElement>(selector: string): T {
  const element = container.querySelector<T>(selector)
  if (!element) throw new Error(`No element matches ${selector}`)
  return element
}

export function buttonNamed(name: string | RegExp): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((button) =>
    typeof name === 'string' ? button.textContent?.trim() === name : name.test(button.textContent ?? ''),
  )
  if (!match) throw new Error(`No button named ${name}`)
  return match
}

export function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setValue.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

export function submit(form: HTMLFormElement) {
  act(() => form.requestSubmit())
}

export function click(element: HTMLElement) {
  act(() => element.click())
}

export function habitNames(): string[] {
  return [...container.querySelectorAll('.habit__name')].map((element) => element.textContent ?? '')
}

export function addHabit(name: string) {
  type($<HTMLInputElement>('#add-habit'), name)
  submit($<HTMLFormElement>('form.add'))
}
