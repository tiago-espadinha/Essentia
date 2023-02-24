import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

/** Supabase's own default key, named here so the apps can read it before the client has loaded the session. */
function sessionKey(url: string): string {
  return `sb-${new URL(url).hostname.split('.')[0]}-auth-token`
}

/**
 * The suite's one Supabase client, or null when this build has no project
 * configured: sign-in is then hidden and every app stays on this device. Every
 * app is served from one origin, so they share the session Supabase keeps in
 * localStorage.
 */
export function getSupabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = import.meta.env.VITE_SUPABASE_URL
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY
    client = url && key ? createClient(url, key, { auth: { storageKey: sessionKey(url) } }) : null
  }
  return client
}

/**
 * The account of the session stored on this device, read at once: an app can
 * then hold back another account's data on its first paint, before Supabase
 * has loaded the session.
 */
export function storedUserId(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) return null
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(sessionKey(url)) ?? 'null')
    const id = (saved as { user?: { id?: unknown } } | null)?.user?.id
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}
