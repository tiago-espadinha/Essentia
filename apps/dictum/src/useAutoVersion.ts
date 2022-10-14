import { useEffect, useRef } from 'react'

/** A version is saved once typing has paused this long. */
const AUTO_VERSION_MS = 30_000

/**
 * Saves a version of a document once its edits pause. Each edit restarts the
 * timer; editing another document saves the pending one at once.
 */
export function useAutoVersion(saveVersion: (id: string) => void) {
  // The pending version: which document, and its timer.
  const pending = useRef<{ id: string; timer: number } | null>(null)

  useEffect(() => () => window.clearTimeout(pending.current?.timer), [])

  return {
    schedule(id: string) {
      if (pending.current) {
        window.clearTimeout(pending.current.timer)
        if (pending.current.id !== id) saveVersion(pending.current.id)
      }
      const timer = window.setTimeout(() => {
        pending.current = null
        saveVersion(id)
      }, AUTO_VERSION_MS)
      pending.current = { id, timer }
    },
    /** Drops a pending version of the document (it is being deleted). */
    cancel(id: string) {
      if (pending.current?.id !== id) return
      window.clearTimeout(pending.current.timer)
      pending.current = null
    },
  }
}
