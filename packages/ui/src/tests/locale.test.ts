import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LOCALE_KEY, currentLocale, setLocale, subscribeLocale } from '../domain/locale'

const startup = readFileSync('../tokens/locale-init.js', 'utf8')

beforeEach(() => {
  vi.spyOn(window, 'addEventListener')
  localStorage.clear()
  document.documentElement.lang = ''
})
afterEach(() => {
  for (const [name, listener] of vi.mocked(window.addEventListener).mock.calls) {
    if (name === 'storage') window.removeEventListener(name, listener)
  }
  vi.restoreAllMocks()
})

describe('suite locale', () => {
  it.each(['en-GB', 'pt-PT'] as const)('applies and saves %s without changing other data', (locale) => {
    localStorage.setItem('essentia-theme', 'dark')
    localStorage.setItem('app-record', 'keep')
    expect(setLocale(locale)).toBe(true)
    expect(currentLocale()).toBe(locale)
    expect(localStorage.getItem(LOCALE_KEY)).toBe(locale)
    expect(localStorage.getItem('essentia-theme')).toBe('dark')
    expect(localStorage.getItem('app-record')).toBe('keep')
  })

  it('notifies until unsubscribed', () => {
    const notify = vi.fn()
    const unsubscribe = subscribeLocale(notify)
    setLocale('pt-PT')
    expect(notify).toHaveBeenCalledTimes(1)
    unsubscribe()
    setLocale('en-GB')
    expect(notify).toHaveBeenCalledTimes(1)
  })

  it('retains page choice and reports failed persistence', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(setLocale('pt-PT')).toBe(false)
    expect(currentLocale()).toBe('pt-PT')
  })

  it.each([null, '', 'BLUE', 'unknown', '{"accent":"blue"}', 'url(evil)'])('uses default for invalid stored value %s', (value) => {
    if (value !== null) localStorage.setItem(LOCALE_KEY, value)
    window.eval(startup)
    expect(currentLocale()).toBe('en-GB')
  })

  it('applies saved choice in the standalone startup script', () => {
    localStorage.setItem(LOCALE_KEY, 'pt-PT')
    window.eval(startup)
    expect(currentLocale()).toBe('pt-PT')
  })

  it('startup tolerates blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    expect(() => window.eval(startup)).not.toThrow()
    expect(currentLocale()).toBe('en-GB')
  })

  it('receives cross-tab replacement, invalid value, removal and clear, ignoring other keys/areas', () => {
    window.eval(startup)
    const update = (key: string | null, newValue: string | null, storageArea: Storage = localStorage) => {
      window.dispatchEvent(new StorageEvent('storage', { key, newValue, storageArea }))
    }
    update(LOCALE_KEY, 'pt-PT')
    expect(currentLocale()).toBe('pt-PT')
    update('other-key', 'en-GB')
    update(LOCALE_KEY, 'en-GB', sessionStorage)
    expect(currentLocale()).toBe('pt-PT')
    update(LOCALE_KEY, 'invalid')
    expect(currentLocale()).toBe('en-GB')
    update(LOCALE_KEY, 'en-GB')
    update(LOCALE_KEY, null)
    expect(currentLocale()).toBe('en-GB')
    update(LOCALE_KEY, 'pt-PT')
    update(null, null)
    expect(currentLocale()).toBe('en-GB')
  })
})
