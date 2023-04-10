const MAC = /Mac|iPhone|iPad/.test(navigator.platform)

interface Shortcut {
  /** For a tooltip, in the platform's own notation. */
  label: string
  /** For `aria-keyshortcuts`: Ctrl and Cmd both work everywhere. */
  aria: string
}

/** A Ctrl or Cmd shortcut on a letter. */
export function shortcut(key: string): Shortcut {
  const letter = key.toUpperCase()
  return { label: MAC ? `⌘${letter}` : `Ctrl+${letter}`, aria: `Control+${letter} Meta+${letter}` }
}
