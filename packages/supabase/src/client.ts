import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

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
    client = url && key ? createClient(url, key) : null
  }
  return client
}
