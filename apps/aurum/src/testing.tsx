// Minimal render helpers on react-dom, matching the suite's other tests.
import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, vi } from 'vitest'
import App from './App'
import { settle } from './fakeServer'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom has <dialog> without its methods; the browser's focus trap and Esc are not emulated.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event('close'))
}

let container: HTMLElement
let root: Root | null = null

/** Fake timers from a fixed morning, a clean device, and the page torn down after each test. */
export function setupApp() {
  beforeEach(() => {
    localStorage.clear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2022-11-08T09:00:00Z'))
  })
  afterEach(() => {
    unmount()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
}

export async function renderApp(client: SupabaseClient | null): Promise<HTMLElement> {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  await settle(() => root!.render(<App client={client} />))
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
  const match = [...container.querySelectorAll('button')].find((button) => {
    const label = button.getAttribute('aria-label') ?? button.textContent?.trim() ?? ''
    return typeof name === 'string' ? label === name : name.test(label)
  })
  if (!match) throw new Error(`No button named ${name}`)
  return match
}

export function type(field: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setValue.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function click(element: HTMLElement) {
  act(() => element.click())
}

export const text = () => container.textContent ?? ''
