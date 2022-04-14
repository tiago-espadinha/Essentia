import { useTheme } from './useTheme'
import './ui.css'

/** A toggle button: the moon is always shown, and its pressed state means dark. */
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
        <path
          d="M16.5 11.6A6.5 6.5 0 0 1 8.4 3.5a6.5 6.5 0 1 0 8.1 8.1Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
