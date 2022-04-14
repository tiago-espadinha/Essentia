import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HubLink } from './HubLink'
import { ThemeToggle } from './ThemeToggle'
import { THEME_KEY } from './theme'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root

function render(element: ReactNode) {
  act(() => root.render(element))
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('ThemeToggle', () => {
  it('is a labelled toggle button that switches and stores the theme', () => {
    render(<ThemeToggle />)
    const button = container.querySelector('button')!
    expect(button.textContent).toBe('Dark theme')
    expect(button.getAttribute('aria-pressed')).toBe('false')

    act(() => button.click())
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    act(() => button.click())
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    render(<ThemeToggle />)
    expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('true')
  })
})

describe('HubLink', () => {
  it('links to the hub at the site root with a descriptive name', () => {
    render(<HubLink />)
    const link = container.querySelector('a')!
    expect(link.getAttribute('href')).toBe('/')
    expect(link.textContent).toBe('Back to Essentia')
  })
})
