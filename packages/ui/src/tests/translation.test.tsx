import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { createTranslator, formatDate, formatNumber, setLocale } from '../domain/locale'
import { LocaleSelect } from '../components/LocaleSelect'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  document.documentElement.lang = 'en-GB'
  localStorage.clear()
  vi.restoreAllMocks()
})

it('interpolates content literally and falls back to English for a missing key', () => {
  const t = createTranslator({ 'Open {name}': 'Abrir {name}' })
  setLocale('pt-PT')
  expect(t('Open {name}', { name: '<script>$&</script>' })).toBe('Abrir <script>$&</script>')
  expect(t('Missing {count}', { count: 2 })).toBe('Missing 2')
  expect(t('constructor')).toBe('constructor')
  expect(t('__proto__')).toBe('__proto__')
  setLocale('en-GB')
  expect(t('Open {name}', { name: 'Folio' })).toBe('Open Folio')
})

it('formats dates and amounts regionally without changing the value', () => {
  for (const locale of ['en-GB', 'pt-PT'] as const) {
    setLocale(locale)
    expect(formatNumber(1234.56)).toBe(new Intl.NumberFormat(locale).format(1234.56))
    expect(formatNumber(-3.5, { style: 'currency', currency: 'EUR' })).toBe(
      new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(-3.5))
    const date = new Date('2024-02-29T00:00:00Z')
    expect(formatDate(date, { timeZone: 'UTC', day: 'numeric', month: 'long' })).toBe(
      new Intl.DateTimeFormat(locale, { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(date))
  }
})

it('keeps the selector focused and announces failed saving in the chosen language', () => {
  const host = document.body.appendChild(document.createElement('div'))
  const root = createRoot(host)
  act(() => root.render(<LocaleSelect />))
  const select = host.querySelector('select')!
  select.focus()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  act(() => {
    select.value = 'pt-PT'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(document.activeElement).toBe(select)
  expect(select.value).toBe('pt-PT')
  expect(host.querySelector('label')?.textContent).toBe('Idioma')
  expect(host.querySelector('[role="status"]')?.textContent).toContain('não conseguiu guardá-lo')
  expect(select.getAttribute('aria-describedby')).toBe(host.querySelector('[role="status"]')?.id)
  act(() => root.unmount())
  host.remove()
})
