import { useState } from 'react'

export const SIDEBAR_KEY = 'essentia-folio-sidebar'

/**
 * Whether the folder sidebar is hidden on wide screens, remembered on this
 * device. It is a convenience: unreadable or refused storage leaves it shown,
 * or as last chosen until the page closes.
 */
export function useSidebar() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === 'hidden'
    } catch {
      return false
    }
  })

  function toggle() {
    setHidden(!hidden)
    try {
      localStorage.setItem(SIDEBAR_KEY, hidden ? 'shown' : 'hidden')
    } catch {
      // Kept for this visit only; nothing else depends on it.
    }
  }

  return { hidden, toggle }
}
