import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCENT_KEY, currentAccent, setAccent, subscribeAccent } from '../domain/accent'

const startup = readFileSync('../tokens/accent-init.js', 'utf8')

beforeEach(() => {
  vi.spyOn(window, 'addEventListener')
  localStorage.clear()
  delete document.documentElement.dataset.accent
})
afterEach(() => {
  for (const [name, listener] of vi.mocked(window.addEventListener).mock.calls) {
    if (name === 'storage') window.removeEventListener(name, listener)
  }
  vi.restoreAllMocks()
})

describe('suite accent', () => {
  it.each(['terracotta', 'blue', 'violet'] as const)('applies and saves %s without changing other data', (accent) => {
    localStorage.setItem('essentia-theme', 'dark')
    localStorage.setItem('app-record', 'keep')
    expect(setAccent(accent)).toBe(true)
    expect(currentAccent()).toBe(accent)
    expect(localStorage.getItem(ACCENT_KEY)).toBe(accent)
    expect(localStorage.getItem('essentia-theme')).toBe('dark')
    expect(localStorage.getItem('app-record')).toBe('keep')
  })

  it('notifies until unsubscribed', () => {
    const notify = vi.fn()
    const unsubscribe = subscribeAccent(notify)
    setAccent('blue')
    expect(notify).toHaveBeenCalledTimes(1)
    unsubscribe()
    setAccent('violet')
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('retains page choice and reports failed persistence', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(setAccent('blue')).toBe(false)
    expect(currentAccent()).toBe('blue')
  })

  it.each([null, '', 'BLUE', 'unknown', '{"accent":"blue"}', 'url(evil)'])('uses default for invalid stored value %s', (value) => {
    if (value !== null) localStorage.setItem(ACCENT_KEY, value)
    window.eval(startup)
    expect(currentAccent()).toBe('terracotta')
  })

  it('applies saved choice in the standalone startup script', () => {
    localStorage.setItem(ACCENT_KEY, 'violet')
    window.eval(startup)
    expect(currentAccent()).toBe('violet')
  })

  it('startup tolerates blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => window.eval(startup)).not.toThrow()
    expect(currentAccent()).toBe('terracotta')
  })

  it('receives cross-tab replacement, invalid value, removal and clear, ignoring other keys/areas', () => {
    window.eval(startup)
    const update = (key: string | null, newValue: string | null, storageArea: Storage = localStorage) => {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea }))
    }
    update(ACCENT_KEY, 'blue')
    expect(currentAccent()).toBe('blue')
    update('other-key', 'violet')
    update(ACCENT_KEY, 'violet', sessionStorage)
    expect(currentAccent()).toBe('blue')
    update(ACCENT_KEY, 'invalid')
    expect(currentAccent()).toBe('terracotta')
    update(ACCENT_KEY, 'violet')
    update(ACCENT_KEY, null)
    expect(currentAccent()).toBe('terracotta')
    update(ACCENT_KEY, 'blue')
    update(null, null)
    expect(currentAccent()).toBe('terracotta')
  })
})
