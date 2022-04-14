import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { THEME_KEY, applyStoredTheme, currentTheme, setTheme, subscribeTheme } from './theme'

function mockSystemDark(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  mockSystemDark(false)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('theme', () => {
  it('follows the system preference when nothing is stored', () => {
    expect(currentTheme()).toBe('light')
    mockSystemDark(true)
    expect(currentTheme()).toBe('dark')
  })

  it('stores the choice under the suite-wide key and applies it', () => {
    setTheme('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(currentTheme()).toBe('dark')
  })

  it('a stored choice wins over the system preference', () => {
    localStorage.setItem(THEME_KEY, 'light')
    mockSystemDark(true)
    expect(currentTheme()).toBe('light')
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem(THEME_KEY, 'sepia')
    expect(currentTheme()).toBe('light')
    applyStoredTheme()
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('applyStoredTheme sets data-theme only when a choice is stored', () => {
    applyStoredTheme()
    expect(document.documentElement.dataset.theme).toBeUndefined()
    localStorage.setItem(THEME_KEY, 'dark')
    applyStoredTheme()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('still works when storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(currentTheme()).toBe('light')
    expect(() => setTheme('dark')).not.toThrow()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(currentTheme()).toBe('dark')
    setTheme('light')
    expect(currentTheme()).toBe('light')
  })

  it('notifies subscribers on change until they unsubscribe', () => {
    const notify = vi.fn()
    const unsubscribe = subscribeTheme(notify)
    setTheme('dark')
    expect(notify).toHaveBeenCalledTimes(1)
    unsubscribe()
    setTheme('light')
    expect(notify).toHaveBeenCalledTimes(1)
  })
})
