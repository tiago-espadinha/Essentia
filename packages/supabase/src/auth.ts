import { isAuthRetryableFetchError, type AuthError, type SupabaseClient } from '@supabase/supabase-js'
import { storedUserId } from './client'

/** Fixed wording for the refusals people can act on; Supabase's own messages never reach the page. */
const MESSAGES = new Map([
  ['invalid_credentials', 'That email and password don’t match an account.'],
  ['email_not_confirmed', 'Confirm your email first: open the link we sent you.'],
  ['user_already_exists', 'An account with this email already exists. Sign in instead.'],
  ['email_exists', 'An account with this email already exists. Sign in instead.'],
  ['weak_password', 'Choose a stronger password.'],
  ['email_address_invalid', 'This email address can’t be used. Try another one.'],
  ['over_request_rate_limit', 'Too many attempts. Wait a minute and try again.'],
  ['over_email_send_rate_limit', 'Too many emails sent. Wait a few minutes and try again.'],
  ['signup_disabled', 'New accounts can’t be created right now.'],
])

function describe(error: AuthError): string {
  if (isAuthRetryableFetchError(error)) return 'Couldn’t reach the server. Check your connection and try again.'
  return MESSAGES.get(error.code ?? '') ?? 'Something went wrong. Try again.'
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
  // The device is signed out once the session has left it, whatever the server said. Offline with
  // an expired token, supabase-js keeps the session and the error is the one to show.
  return error && storedUserId() !== null ? describe(error) : null
}
