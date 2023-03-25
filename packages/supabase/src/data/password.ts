import { isAuthRetryableFetchError, isAuthSessionMissingError, type SupabaseClient, type User } from '@supabase/supabase-js'
import { fetchWithTimeout } from './client'

export type PasswordResult =
  | { status: 'success' }
  | { status: 'reauthenticate' }
  | { status: 'error'; message: string; uncertain?: boolean }

const EXPIRED = new Set(['bad_jwt', 'no_authorization', 'user_not_found', 'session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used'])
const SESSION_MESSAGE = 'Your session has expired or changed. Sign in again before changing your password.'
const UNSUPPORTED_MESSAGE = 'Password changes need a confirmed email account. Use your sign-in provider to manage its password.'
const NETWORK_MESSAGE = 'Couldn’t reach the server. Check your connection and try again.'
const UNCERTAIN_MESSAGE = 'The password change could not be confirmed. Try signing in with the new password before submitting another change.'
const PROOF_UNCERTAIN = 'Current-password verification could not be confirmed. A temporary sign-in may remain active. No password change was submitted.'
const CLEANUP_FAILURE = 'The temporary verification session could not be closed. No password change was submitted. Try again later.'
const MESSAGES = new Map([
  ['weak_password', 'Choose a stronger password. Your account’s password rules still apply.'],
  ['same_password', 'Choose a new password different from your current password.'],
  ['invalid_credentials', 'The current password was not accepted. Check it and try again.'],
  ['current_password_invalid', 'The current password was not accepted. Check it and try again.'],
  ['current_password_mismatch', 'The current password was not accepted. Check it and try again.'],
  ['current_password_required', 'Your account requires the current password. Sign in with it before changing your password.'],
  ['current_password_missing', 'Your account requires the current password. Sign in with it before changing your password.'],
  ['reauthentication_not_valid', 'That verification code is invalid or expired. Request a new code and try again.'],
  ['otp_expired', 'That verification code is invalid or expired. Request a new code and try again.'],
  ['over_request_rate_limit', 'Too many attempts. Wait a minute and try again.'],
  ['over_email_send_rate_limit', 'Too many emails sent. Wait a few minutes and try again.'],
  ['email_not_confirmed', 'Confirm your email before changing your password.'],
  ['email_address_invalid', 'Enter a valid email address and try again.'],
  ['insufficient_aal', 'Your account requires additional verification. Complete your usual sign-in verification and try again.'],
  ['captcha_failed', 'Current-password verification requires a CAPTCHA. Use your usual sign-in flow before trying again.'],
  ['user_sso_managed', 'This account is managed by a sign-in provider. Change its password with that provider.'],
  ['user_banned', 'Your account cannot change its password right now. Contact the account administrator.'],
])

function codeOf(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' ? error.code : ''
}

function expired(error: unknown): boolean {
  return isAuthSessionMissingError(error) || EXPIRED.has(codeOf(error))
}

/** Never expose server messages, which can contain request or account details. */
export function passwordError(error: unknown, updating = false): PasswordResult {
  const code = codeOf(error)
  if (code === 'reauthentication_needed' || code === 'reauth_nonce_missing') return { status: 'reauthenticate' }
  if (expired(error)) return { status: 'error', message: SESSION_MESSAGE }
  if (isAuthRetryableFetchError(error) || code === 'request_timeout') {
    return { status: 'error', message: updating ? UNCERTAIN_MESSAGE : NETWORK_MESSAGE, ...(updating ? { uncertain: true } : {}) }
  }
  const message = MESSAGES.get(code)
  if (message) return { status: 'error', message }
  // A thrown fetch/SDK exception or server failure may follow a completed update.
  if (updating && (!code || code === 'unexpected_failure')) return { status: 'error', message: UNCERTAIN_MESSAGE, uncertain: true }
  return { status: 'error', message: 'The request could not be completed. Try again.' }
}

function supported(user: User): boolean {
  // Email identity alone does not establish that the account has a password.
  return !user.is_anonymous && !user.is_sso_user && !!user.email && !!user.email_confirmed_at && !!user.identities?.some(identity => identity.provider === 'email')
}

export async function passwordEligibility(client: SupabaseClient, expectedUserId: string): Promise<'supported' | 'unsupported' | 'expired' | 'failed'> {
  try {
    const { data, error } = await client.auth.getUser()
    if (error) return expired(error) ? 'expired' : 'failed'
    const user = data.user
    if (!user || user.id !== expectedUserId) return 'expired'
    return supported(user) ? 'supported' : 'unsupported'
  } catch {
    return 'failed'
  }
}

async function withAccount(
  client: SupabaseClient,
  expectedUserId: string,
  operation: (token: string, user: User, isCurrent: () => boolean) => Promise<PasswordResult>,
): Promise<PasswordResult> {
  let changed = false
  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (session && session.user.id !== expectedUserId)) changed = true
  })
  try {
    const { data: saved, error: sessionError } = await client.auth.getSession()
    const token = saved.session?.access_token
    if (changed || sessionError || !token || saved.session?.user.id !== expectedUserId) return { status: 'error', message: SESSION_MESSAGE }
    // Explicit JWT prevents getUser from rereading another tab's mutable session.
    const { data: verified, error } = await client.auth.getUser(token)
    if (changed) return { status: 'error', message: SESSION_MESSAGE }
    if (error) return passwordError(error)
    if (!verified.user || verified.user.id !== expectedUserId) return { status: 'error', message: SESSION_MESSAGE }
    if (!supported(verified.user)) return { status: 'error', message: UNSUPPORTED_MESSAGE }
    const result = await operation(token, verified.user, () => !changed)
    return changed ? { status: 'error', message: SESSION_MESSAGE } : result
  } catch (error) {
    return passwordError(error)
  } finally {
    data.subscription.unsubscribe()
  }
}

function authEndpoint(path: string): URL {
  return new URL(`auth/v1/${path}`, `${import.meta.env.VITE_SUPABASE_URL!.replace(/\/$/, '')}/`)
}

function authHeaders(token: string): Record<string, string> {
  return { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' }
}

/** Password grants prove an existing password, independently of optional update policy. */
async function verifyCurrentPassword(token: string, user: User, password: string, isCurrent: () => boolean): Promise<PasswordResult | null> {
  if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return { status: 'error', message: 'The request could not be completed. Try again.' }
  let proof: { access_token?: unknown; user?: { id?: unknown } }
  try {
    const response = await fetchWithTimeout(authEndpoint('token?grant_type=password'), {
      method: 'POST', headers: authHeaders(import.meta.env.VITE_SUPABASE_ANON_KEY), body: JSON.stringify({ email: user.email, password }),
    })
    if (response.status >= 500) return { status: 'error', message: PROOF_UNCERTAIN, uncertain: true }
    const payload: unknown = await response.json()
    if (!response.ok) return passwordError({ code: codeOf(payload) || 'request_rejected' })
    if (!payload || typeof payload !== 'object') return { status: 'error', message: PROOF_UNCERTAIN, uncertain: true }
    proof = payload
  } catch {
    return { status: 'error', message: PROOF_UNCERTAIN, uncertain: true }
  }
  if (typeof proof.access_token !== 'string' || !proof.access_token || proof.access_token === token) {
    return { status: 'error', message: PROOF_UNCERTAIN, uncertain: true }
  }
  // Even a mismatched proof must close its temporary session, using only its token.
  try {
    const cleanup = await fetchWithTimeout(authEndpoint('logout?scope=local'), { method: 'POST', headers: authHeaders(proof.access_token) })
    if (!cleanup.ok) return { status: 'error', message: CLEANUP_FAILURE, uncertain: true }
  } catch {
    return { status: 'error', message: CLEANUP_FAILURE, uncertain: true }
  }
  if (!isCurrent() || proof.user?.id !== user.id) return { status: 'error', message: SESSION_MESSAGE }
  return null
}

/** The request is bound to the verified token, never the SDK's mutable shared session. */
async function boundRequest(token: string, expectedUserId: string, body?: Record<string, string | undefined>): Promise<PasswordResult> {
  const updating = body !== undefined
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return { status: 'error', message: 'The request could not be completed. Try again.' }
  try {
    const response = await fetchWithTimeout(authEndpoint(updating ? 'user' : 'reauthenticate'), {
      method: updating ? 'PUT' : 'GET',
      headers: authHeaders(token),
      ...(updating ? { body: JSON.stringify(body) } : {}),
    })
    const payload: unknown = await response.json()
    if (!response.ok) {
      if (updating && response.status >= 500) return { status: 'error', message: UNCERTAIN_MESSAGE, uncertain: true }
      const code = typeof payload === 'object' && payload !== null && 'code' in payload && typeof payload.code === 'string' ? payload.code : ''
      return passwordError({ code: code || (response.status === 401 ? 'session_expired' : 'request_rejected') })
    }
    if (updating && !(typeof payload === 'object' && payload !== null && 'id' in payload && payload.id === expectedUserId)) {
      return { status: 'error', message: UNCERTAIN_MESSAGE, uncertain: true }
    }
    return { status: 'success' }
  } catch (error) {
    return updating ? { status: 'error', message: UNCERTAIN_MESSAGE, uncertain: true } : passwordError(error)
  }
}

export async function passwordUpdate(
  client: SupabaseClient,
  expectedUserId: string,
  values: { password: string; currentPassword?: string; nonce?: string },
  recovery: boolean,
): Promise<PasswordResult> {
  if (!recovery && !values.currentPassword) return { status: 'error', message: 'Enter your current password.' }
  return withAccount(client, expectedUserId, async (token, user, isCurrent) => {
    if (!recovery) {
      const refusal = await verifyCurrentPassword(token, user, values.currentPassword!, isCurrent)
      if (refusal) return refusal
    }
    if (!isCurrent()) return { status: 'error', message: SESSION_MESSAGE }
    return boundRequest(token, expectedUserId, {
      password: values.password,
      ...(!recovery ? { current_password: values.currentPassword } : {}),
      ...(values.nonce ? { nonce: values.nonce } : {}),
    })
  })
}

export async function requestPasswordCode(client: SupabaseClient, expectedUserId: string): Promise<PasswordResult> {
  return withAccount(client, expectedUserId, token => boundRequest(token, expectedUserId))
}

export async function requestPasswordRecovery(client: SupabaseClient, email: string): Promise<PasswordResult> {
  try {
    const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: new URL('/', location.origin).href })
    return error ? passwordError(error) : { status: 'success' }
  } catch (error) {
    return passwordError(error)
  }
}
