// Minimal render helpers on react-dom, matching the suite's other tests.
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, vi } from 'vitest'
import App from './App'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root | null = null

export function setupApp() {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  })
  afterEach(() => {
    unmount()
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

/** Stands in for typing into the contentEditable body. */
export function writeBody(html: string) {
  const body = $('.editor__body')
  act(() => {
    body.innerHTML = html
    body.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

export function click(element: HTMLElement) {
  act(() => element.click())
}

export function press(element: HTMLElement, key: string) {
  act(() => element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })))
}

export function blur(element: HTMLElement) {
  act(() => element.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
}

export function rowTitles(): string[] {
  return [...container.querySelectorAll('.note-row__title')].map((element) => element.textContent ?? '')
}

export function newNote(title?: string) {
  click(buttonNamed('New note'))
  if (title !== undefined) type($<HTMLTextAreaElement>('#note-title'), title)
}

export function savedNotes() {
  return JSON.parse(localStorage.getItem('essentia-folio-notes') ?? '[]')
}
