import { useSyncExternalStore } from 'react'
import { currentTheme, setTheme, subscribeTheme, type Theme } from './theme'

export function useTheme(): { theme: Theme; toggle: () => void } {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme)
  return { theme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}
