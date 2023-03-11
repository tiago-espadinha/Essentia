import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { Dialog } from '../components/Dialog'
import { HubLink } from '../components/HubLink'
import { ThemeToggle } from '../components/ThemeToggle'
import { AccentSelect } from '../components/AccentSelect'
import { THEME_KEY } from '../domain/theme'

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
  vi.restoreAllMocks()
})

describe('AccentSelect', () => {
  it('offers named palettes and saves a keyboard-compatible native selection', () => {
    delete document.documentElement.dataset.accent
    render(<AccentSelect />)
    const select = container.querySelector('select')!
    expect(container.querySelector('label')?.textContent).toBe('Accent')
    expect(container.querySelector('label')?.htmlFor).toBe(select.id)
    expect(Array.from(select.options, (option) => option.text)).toEqual(['Terracotta', 'Blue', 'Violet'])
    expect(select.value).toBe('terracotta')
    act(() => {
      select.value = 'blue'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(select.value).toBe('blue')
    expect(localStorage.getItem('essentia-accent')).toBe('blue')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('')
  })

  it('announces unsaved choice when persistence fails and clears feedback on retry', () => {
    render(<AccentSelect />)
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const select = container.querySelector('select')!
    act(() => {
      select.value = 'violet'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(select.value).toBe('violet')
    expect(select.getAttribute('aria-describedby')).toBe(container.querySelector('[role="status"]')?.id)
    expect(container.querySelector('[role="status"]')?.textContent).toContain('could not save')
    act(() => {
      document.documentElement.dataset.accent = 'blue'
      window.dispatchEvent(new Event('essentia-accent-change'))
    })
    expect(select.value).toBe('blue')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('')
    save.mockRestore()
    act(() => {
      select.value = 'terracotta'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(container.querySelector('[role="status"]')?.textContent).toBe('')
    expect(select.hasAttribute('aria-describedby')).toBe(false)
  })
})

describe('ThemeToggle', () => {
  it('is a labelled toggle button that switches and stores the theme', () => {
    render(<ThemeToggle />)
    const button = container.querySelector('button')!
    expect(button.textContent).toBe('Dark theme')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    const moon = button.querySelector('svg')!.innerHTML
    expect(button.querySelector('circle')).toBeNull()
    expect(button.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')

    act(() => button.click())
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(button.querySelector('circle')).not.toBeNull()
    expect(button.querySelector('svg')!.innerHTML).not.toBe(moon)
    expect(button.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(button.textContent).toBe('Dark theme')

    act(() => button.click())
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
    expect(button.querySelector('svg')!.innerHTML).toBe(moon)
  })

  it('starts from the stored choice', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    render(<ThemeToggle />)
    expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('svg circle')).not.toBeNull()
  })

  it('shows the sun when the system prefers dark and there is no stored choice', () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    render(<ThemeToggle />)
    expect(container.querySelector('button')!.getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('svg circle')).not.toBeNull()
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

  it('without onClose, must be answered: no close button, and Esc is refused', () => {
    render(
      <Dialog title="Keep these?" titleId="keep-title" returnFocusId="opener">
        <button type="button">Keep</button>
      </Dialog>,
    )
    const dialog = container.querySelector('dialog')!
    expect([...dialog.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Keep'])
    const esc = new Event('cancel', { cancelable: true })
    act(() => dialog.dispatchEvent(esc))
    expect(esc.defaultPrevented).toBe(true)
    act(() => dialog.click())
    expect(dialog.open).toBe(true)
    // Closed anyway, as Chrome allows on a repeated Esc: it opens again.
    dialog.open = false
    act(() => dialog.dispatchEvent(new Event('close')))
    expect(dialog.open).toBe(true)
  })
})
