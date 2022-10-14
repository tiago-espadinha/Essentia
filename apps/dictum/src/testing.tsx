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

let container: HTMLElement
let root: Root | null = null

/** `phone` makes the one-pane media query match. */
export function setupApp({ phone = false } = {}) {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: phone, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  })
  afterEach(() => {
    unmount()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    vi.useRealTimers()
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

/** Unmounts and renders again, as a page reload would. */
export function reload(): HTMLElement {
  unmount()
  return renderApp()
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

export function type(field: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!
  act(() => {
    setValue.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function click(element: HTMLElement) {
  act(() => element.click())
}

export function press(element: HTMLElement, key: string, modifiers: KeyboardEventInit = {}) {
  act(() => element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...modifiers })))
}

export function blur(element: HTMLElement) {
  act(() => element.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
}

export function rowTitles(): string[] {
  return [...container.querySelectorAll('.doc-row__title')].map((element) => element.textContent ?? '')
}

export const titleField = () => $<HTMLInputElement>('#doc-title')
export const contentField = () => $<HTMLTextAreaElement>('#doc-content')

export function newDoc(title?: string, content?: string) {
  click(buttonNamed('New document'))
  if (title !== undefined) type(titleField(), title)
  if (content !== undefined) type(contentField(), content)
}

export function savedDocs() {
  return JSON.parse(localStorage.getItem('essentia-dictum-documents') ?? '[]')
}

/** Waits for the lazily loaded preview to render. */
export async function previewLoaded() {
  await act(() => import('./Preview'))
}

export function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

/** A field by its visible label text, within the document or the filters. */
export function fieldLabelled<T extends HTMLElement = HTMLInputElement>(scope: string, label: string): T {
  const match = [...container.querySelectorAll(`${scope} label`)].find(
    (element) => element.querySelector('.label')?.textContent === label,
  )
  const field = match?.querySelector<T>('input, select')
  if (!field) throw new Error(`No ${label} field in ${scope}`)
  return field
}
