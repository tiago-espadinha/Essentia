import { isAuthRetryableFetchError, type AuthError, type SupabaseClient } from '@supabase/supabase-js'

function describe(error: AuthError): string {
  return isAuthRetryableFetchError(error) ? 'Couldn’t reach the server. Check your connection and try again.' : error.message
}

/** Returns an error to show, or null once signed in. */
export async function signIn(client: SupabaseClient, email: string, password: string): Promise<string | null> {
  const { error } = await client.auth.signInWithPassword({ email, password })
  return error ? describe(error) : null
}

/**
 * Creates an account. With email confirmation on, there is no session yet:
 * `confirm` says the link in the email has to be opened first, and it leads
 * back to the app that sent it.
 */
export async function signUp(
  client: SupabaseClient,
  email: string,
  password: string,
): Promise<{ error: string | null; confirm: boolean }> {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, location.origin).href },
  })
  if (error) return { error: describe(error), confirm: false }
  return { error: null, confirm: data.session === null }
}

/**
 * Signs this device out; other devices stay signed in and keep their unsynced
 * changes. Returns an error to show, or null once signed out.
 */
export async function signOut(client: SupabaseClient): Promise<string | null> {
  const { error } = await client.auth.signOut({ scope: 'local' })
  // Offline, supabase-js has already removed the session here: the device is signed out.
  if (!error || isAuthRetryableFetchError(error)) return null
  return describe(error)
}
