import type { SupabaseClient } from '@supabase/supabase-js'

export type RecoverySnapshot = { userId: string; email: string; attempt: number } | null
type RecoveryStore = {
  getSnapshot: () => RecoverySnapshot
  subscribe: (listener: () => void) => () => void
  dismiss: () => void
}

const stores = new WeakMap<SupabaseClient, RecoveryStore>()

export const emptyRecoveryStore: RecoveryStore = {
  getSnapshot: () => null,
  subscribe: () => () => {},
  dismiss: () => {},
}

/** Capture at client creation: SDK recovery initialization can finish before React mounts. */
export function ensureRecoveryCapture(client: SupabaseClient): RecoveryStore {
  const existing = stores.get(client)
  if (existing) return existing
  let snapshot: RecoverySnapshot = null
  let attempt = 0
  const listeners = new Set<() => void>()
  function update(next: RecoverySnapshot) {
    if (next === snapshot) return
    snapshot = next
    for (const listener of listeners) listener()
  }
  const store: RecoveryStore = {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    dismiss: () => update(null),
  }
  stores.set(client, store)
  // This observer lasts for the SDK client's lifetime. It retains identifiers only,
  // never a session, token, password or code, and survives component unmounts.
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
      update({ userId: session.user.id, email: session.user.email ?? '', attempt: ++attempt })
    } else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || (snapshot && session?.user.id !== snapshot.userId)) {
      update(null)
    }
  })
  return store
}
