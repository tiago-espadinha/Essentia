import type { SupabaseClient } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { clearAccountData } from './accountData'
import { storedUserId } from './client'

export type Auth =
  | { status: 'disabled' }
  | { status: 'loading' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; userId: string; email: string }

/** The session shared by the suite; 'disabled' without a configured project. */
export function useAuth(client: SupabaseClient | null): Auth {
  const [auth, setAuth] = useState<Auth>(client ? { status: 'loading' } : { status: 'disabled' })

  useEffect(() => {
    if (!client) return
    // Fires once with the stored session, then on every sign-in, sign-out and
    // refresh, including those made in another app or tab.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      // Offline with an expired token there is no session, but it is still stored: that is no sign-out.
      if (!session && storedUserId() === null) clearAccountData()
      setAuth(
        session
          ? { status: 'signed-in', userId: session.user.id, email: session.user.email ?? '' }
          : { status: 'signed-out' },
      )
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  return auth
}
