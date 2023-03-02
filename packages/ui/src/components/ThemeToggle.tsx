import { useTheme } from '../hooks/useTheme'
import '../ui.css'

/** The icon offers the other theme; the stable toggle name and pressed state describe dark mode. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      type="button"
      className="ui-icon-button"
      aria-pressed={theme === 'dark'}
      title="Dark theme"
      onClick={toggle}
    >
      <span className="visually-hidden">Dark theme</span>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        {theme === 'dark' ? (
          <g stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="10" cy="10" r="3" />
            <path d="M10 2v2m0 12v2M2 10h2m12 0h2M4.34 4.34l1.42 1.42m8.48 8.48 1.42 1.42M4.34 15.66l1.42-1.42m8.48-8.48 1.42-1.42" />
          </g>
        ) : (
          <path
            d="M16.5 11.6A6.5 6.5 0 0 1 8.4 3.5a6.5 6.5 0 1 0 8.1 8.1Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </button>
  )
}
