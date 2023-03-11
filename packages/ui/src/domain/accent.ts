export const ACCENT_KEY = 'essentia-accent'
export const accents = ['terracotta', 'blue', 'violet'] as const
export type Accent = typeof accents[number]

function validAccent(value: unknown): Accent {
  return accents.includes(value as Accent) ? value as Accent : 'terracotta'
}

export function currentAccent(): Accent {
  return validAccent(document.documentElement.dataset.accent)
}

/** Returns whether the choice could be saved beyond this page. */
export function setAccent(accent: Accent): boolean {
  const value = validAccent(accent)
  document.documentElement.dataset.accent = value
  let saved = true
  try {
    localStorage.setItem(ACCENT_KEY, value)
  } catch {
    saved = false
  }
  window.dispatchEvent(new Event('essentia-accent-change'))
  return saved
}

export function subscribeAccent(notify: () => void): () => void {
  window.addEventListener('essentia-accent-change', notify)
  return () => window.removeEventListener('essentia-accent-change', notify)
}
