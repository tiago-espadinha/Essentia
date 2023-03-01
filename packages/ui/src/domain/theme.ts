// One theme for the whole suite: every app shares the origin, so the choice
// stored here applies everywhere. Without a stored choice the system
// preference applies (tokens.css handles that case in CSS alone).

export type Theme = 'light' | 'dark'

export const THEME_KEY = 'essentia-theme'

const listeners = new Set<() => void>()

function darkQuery(): MediaQueryList | undefined {
  return window.matchMedia?.('(prefers-color-scheme: dark)')
}

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(THEME_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

// The applied attribute is the source of truth: it holds the choice even when
// storage is unavailable and the choice could not be saved.
export function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme
  if (applied === 'light' || applied === 'dark') return applied
  return readStoredTheme() ?? (darkQuery()?.matches ? 'dark' : 'light')
}

/** Call once before the first render so a stored choice applies immediately. */
export function applyStoredTheme(): void {
  const stored = readStoredTheme()
  if (stored) document.documentElement.dataset.theme = stored
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Storage unavailable (private mode, blocked): the choice lasts this page only.
  }
  listeners.forEach((notify) => notify())
}

export function subscribeTheme(notify: () => void): () => void {
  const query = darkQuery()
  listeners.add(notify)
  query?.addEventListener('change', notify)
  return () => {
    listeners.delete(notify)
    query?.removeEventListener('change', notify)
  }
}
