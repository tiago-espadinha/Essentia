import { useSyncExternalStore } from 'react'

export type Locale = 'en-GB' | 'pt-PT'
export const LOCALE_KEY = 'essentia-locale'

export function currentLocale(): Locale {
  return document.documentElement.lang === 'pt-PT' ? 'pt-PT' : 'en-GB'
}

export function subscribeLocale(notify: () => void): () => void {
  window.addEventListener('essentia-locale-change', notify)
  return () => window.removeEventListener('essentia-locale-change', notify)
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribeLocale, currentLocale)
}

/** The document retains the selection even if the browser cannot save it. */
export function setLocale(locale: Locale): boolean {
  const value = locale === 'pt-PT' ? locale : 'en-GB'
  document.documentElement.lang = value
  let saved = true
  try {
    localStorage.setItem(LOCALE_KEY, value)
  } catch {
    saved = false
  }
  window.dispatchEvent(new Event('essentia-locale-change'))
  return saved
}

/** English templates are also the deterministic fallback for missing keys. */
export function createTranslator(messages: Record<string, string>) {
  return (message: string, values: Record<string, string | number> = {}): string => {
    const template = currentLocale() === 'pt-PT' && Object.hasOwn(messages, message) ? messages[message] ?? message : message
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
      Object.hasOwn(values, key) ? String(values[key]) : match)
  }
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(currentLocale(), options).format(value)
}

export function formatDate(value: Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(currentLocale(), options).format(value)
}
