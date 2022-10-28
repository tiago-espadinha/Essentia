const MAC = /Mac|iPhone|iPad/.test(navigator.platform)

interface Shortcut {
  /** For a tooltip, in the platform's own notation. */
  label: string
  /** For `aria-keyshortcuts`: Ctrl and Cmd both work everywhere. */
  aria: string
}

/** A Ctrl or Cmd shortcut on a letter, with Alt (Option) when `alt` is set. */
export function shortcut(key: string, { alt = false } = {}): Shortcut {
  const letter = key.toUpperCase()
  const extra = alt ? 'Alt+' : ''
  const label = MAC ? `${alt ? '⌥' : ''}⌘${letter}` : `Ctrl+${extra}${letter}`
  return { label, aria: `Control+${extra}${letter} Meta+${extra}${letter}` }
}
