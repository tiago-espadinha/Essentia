import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { Dialog } from './Dialog'
import { HubLink } from './HubLink'
import { ThemeToggle } from './ThemeToggle'
import { THEME_KEY } from './theme'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom has <dialog> without its methods; the browser's focus trap and Esc are not emulated.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true
}

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

describe('Dialog', () => {
  function open(onClose = vi.fn()) {
    const opener = document.body.appendChild(document.createElement('button'))
    opener.id = 'opener'
    onTestFinished(() => opener.remove())
    render(
      <Dialog title="Rename" titleId="rename-title" returnFocusId="opener" onClose={onClose}>
        <input aria-label="Name" />
      </Dialog>,
    )
    return { dialog: container.querySelector('dialog')!, opener, onClose }
  }

  it('opens as a modal named by its title, focused on its first field', () => {
    const { dialog } = open()
    expect(dialog.open).toBe(true)
    expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)!.textContent).toBe('Rename')
    expect(document.activeElement).toBe(dialog.querySelector('input'))
  })

  it('closes from its close button and from the backdrop, not from a click inside', () => {
    const { dialog, onClose } = open()
    act(() => dialog.querySelector('input')!.click())
    expect(onClose).not.toHaveBeenCalled()
    act(() => dialog.querySelector<HTMLButtonElement>('button')!.click())
    act(() => dialog.click())
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('hands focus back to its opener when it goes', () => {
    const { opener } = open()
    render(null)
    expect(document.activeElement).toBe(opener)
  })
})
