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

/** The app's own keys, on Ctrl+Alt (⌥⌘ on a Mac) so they leave the browser's alone. */
export const VIEW_KEYS = { newDoc: shortcut('n', { alt: true }), preview: shortcut('p', { alt: true }) }

/**
 * Whether a keydown is Ctrl or Cmd with Alt on `letter`, read from the key's place
 * since Option changes the character on a Mac. AltGr (Ctrl+Alt on Windows) types
 * letters such as ń, and a dialog has the page to itself, so neither counts. A held
 * key acts once.
 */
export function isViewKey(event: KeyboardEvent, letter: string): boolean {
  return (
    !event.repeat &&
    (event.ctrlKey || event.metaKey) &&
    event.altKey &&
    !event.shiftKey &&
    event.code === `Key${letter.toUpperCase()}` &&
    !event.getModifierState('AltGraph') &&
    !document.querySelector('dialog[open]')
  )
}
