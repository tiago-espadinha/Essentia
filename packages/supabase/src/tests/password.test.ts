import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, createClient, type AuthChangeEvent, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { passwordEligibility, passwordError, passwordUpdate, requestPasswordCode, requestPasswordRecovery } from '../data/password'

const USER = { id: 'ana', email: 'ana@example.com', email_confirmed_at: '2026-01-01', is_anonymous: false, identities: [{ provider: 'email' }] } as User

function fakeClient(user: User | null = USER) {
  let listener: (event: AuthChangeEvent, session: Session | null) => void = () => {}
  const unsubscribe = vi.fn()
  const grant = vi.fn(async () => new Response(JSON.stringify({ user: USER, access_token: 'temporary-token' }), { status: 200 }))
  const logout = vi.fn(async () => new Response(null, { status: 204 }))
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-ana', user: USER } }, error: null })),
    getUser: vi.fn(async (): Promise<{ data: { user: User | null }; error: unknown }> => ({ data: { user }, error: null })),
    updateUser: vi.fn(async (body?: unknown): Promise<{ error: unknown }> => { void body; return { error: null } }),
    reauthenticate: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
    resetPasswordForEmail: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
    onAuthStateChange: vi.fn((callback: typeof listener) => {
      listener = callback
      return { data: { subscription: { unsubscribe } } }
    }),
  }
  vi.stubEnv('VITE_SUPABASE_URL', 'https://password-test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/token?grant_type=password')) return grant()
    if (String(input).includes('/logout?scope=local')) return logout()
    const result = String(input).endsWith('/reauthenticate') ? await auth.reauthenticate() : await auth.updateUser(JSON.parse(String(init?.body)))
    if (result.error) {
      const error = result.error as AuthApiError
      if (!error.status || error.status === 0) throw error
      return new Response(JSON.stringify({ code: error.code }), { status: error.status })
    }
    return new Response(JSON.stringify({ id: 'ana' }), { status: 200 })
  }))
  return {
    client: { auth } as unknown as SupabaseClient, auth, unsubscribe, grant, logout,
    emit: (event: AuthChangeEvent, userId: string | null) => listener(event, userId ? { user: { id: userId } } as Session : null),
  }
}

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('password account eligibility', () => {
  it('verifies the account on the server, including email identities that may be passwordless', async () => {
    const { client, auth } = fakeClient()
    expect(await passwordEligibility(client, 'ana')).toBe('supported')
    expect(auth.getUser).toHaveBeenCalledExactlyOnceWith()
  })

  it.each([
    { ...USER, email_confirmed_at: undefined },
    { ...USER, email: undefined },
    { ...USER, is_anonymous: true },
    { ...USER, is_sso_user: true },
    { ...USER, identities: [] },
    { ...USER, identities: [{ provider: 'google' }] },
    { ...USER, identities: [{ provider: 'phone' }] },
  ])('does not offer a password change for an unsupported account: %j', async (user) => {
    const { client } = fakeClient(user as User)
    expect(await passwordEligibility(client, 'ana')).toBe('unsupported')
  })

  it('rejects missing, switched, expired and unverified sessions', async () => {
    expect(await passwordEligibility(fakeClient(null).client, 'ana')).toBe('expired')
    expect(await passwordEligibility(fakeClient().client, 'bea')).toBe('expired')
    const { client, auth } = fakeClient()
    auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: new AuthSessionMissingError() })
    expect(await passwordEligibility(client, 'ana')).toBe('expired')
    auth.getUser.mockRejectedValueOnce(new Error('private service failure'))
    expect(await passwordEligibility(client, 'ana')).toBe('failed')
  })
})

describe('password update', () => {
  const values = { password: '  new password λ  ', currentPassword: ' old password ', nonce: '123456' }

  it('preserves exact passwords and submits the current password and nonce without re-signing in', async () => {
    const { client, auth, unsubscribe } = fakeClient()
    expect(await passwordUpdate(client, 'ana', values, false)).toEqual({ status: 'success' })
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: values.password, current_password: values.currentPassword, nonce: values.nonce })
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('requires the current password for ordinary email changes, including passwordless users', async () => {
    const { client, auth } = fakeClient()
    expect(await passwordUpdate(client, 'ana', { password: 'new password' }, false)).toMatchObject({ status: 'error', message: 'Enter your current password.' })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('omits current_password only for the caller’s SDK recovery flow', async () => {
    const { client, auth } = fakeClient()
    expect(await passwordUpdate(client, 'ana', values, true)).toEqual({ status: 'success' })
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: values.password, nonce: values.nonce })
  })

  it('rechecks identity and eligibility immediately before updating', async () => {
    const { client, auth } = fakeClient({ ...USER, id: 'bea' })
    expect(await passwordUpdate(client, 'ana', values, false)).toMatchObject({ status: 'error' })
    expect(auth.updateUser).not.toHaveBeenCalled()
    auth.getUser.mockResolvedValueOnce({ data: { user: { ...USER, identities: [] } }, error: null })
    expect(await passwordUpdate(client, 'ana', values, true)).toMatchObject({ status: 'error' })
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it.each(['SIGNED_IN', 'SIGNED_OUT'] as const)('does not update if identity changes during getUser (%s)', async (event) => {
    const server = fakeClient()
    server.auth.getUser.mockImplementationOnce(async () => {
      server.emit(event, event === 'SIGNED_OUT' ? null : 'bea')
      return { data: { user: USER }, error: null }
    })
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error' })
    expect(server.auth.updateUser).not.toHaveBeenCalled()
    expect(server.unsubscribe).toHaveBeenCalledOnce()
  })

  it('does not report stale success after a change of identity during the update', async () => {
    const server = fakeClient()
    server.auth.updateUser.mockImplementationOnce(async () => {
      server.emit('SIGNED_IN', 'bea')
      return { error: null }
    })
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error' })
  })

  it('requests server-required proof without automatically resubmitting the password', async () => {
    const { client, auth } = fakeClient()
    auth.updateUser.mockResolvedValueOnce({ error: new AuthApiError('private', 400, 'reauthentication_needed') })
    expect(await passwordUpdate(client, 'ana', values, false)).toEqual({ status: 'reauthenticate' })
    expect(auth.updateUser).toHaveBeenCalledOnce()
    expect(auth.reauthenticate).not.toHaveBeenCalled()
  })

  it.each(['update', 'code'] as const)('binds %s to the verified token when the real SDK storage changes accounts during verification', async operation => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://password-test.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const jwt = (id: string) => `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: id, exp: expiresAt }))}.c2lnbmF0dXJl`
    const session = (id: string) => ({ access_token: jwt(id), refresh_token: `refresh-${id}`, expires_at: expiresAt, expires_in: 3600, token_type: 'bearer', user: { ...USER, id } })
    let saved = JSON.stringify(session('ana'))
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value }, removeItem: () => { saved = '' } }
    const mutations: { method: string; token: string | null }[] = []
    const transport = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const token = new Headers(init?.headers).get('Authorization')
      if (url.endsWith('/user') && method === 'GET') {
        expect(token).toBe(`Bearer ${jwt('ana')}`)
        // Another tab can replace storage without this tab receiving its event yet.
        saved = JSON.stringify(session('bea'))
        await Promise.resolve()
        return new Response(JSON.stringify(USER), { status: 200 })
      }
      if (url.includes('/token?grant_type=password')) return new Response(JSON.stringify({ user: USER, access_token: 'temporary-token' }), { status: 200 })
      if (url.includes('/logout?scope=local')) {
        expect(token).toBe('Bearer temporary-token')
        return new Response(null, { status: 204 })
      }
      mutations.push({ method, token })
      expect(new Headers(init?.headers).get('X-Supabase-Api-Version')).toBe('2024-01-01')
      return new Response(JSON.stringify(operation === 'update' ? USER : {}), { status: 200 })
    })
    vi.stubGlobal('fetch', transport)
    const client = createClient('https://password-test.supabase.co', 'public-test-key', {
      auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false, storageKey: `password-race-${operation}`, storage },
      global: { fetch: transport },
    })
    const sharedMutation = vi.spyOn(client.auth, 'updateUser')
    const sharedCode = vi.spyOn(client.auth, 'reauthenticate')
    try {
      const result = operation === 'update' ? await passwordUpdate(client, 'ana', values, false) : await requestPasswordCode(client, 'ana')
      expect(result).toEqual({ status: 'success' })
      expect(mutations).toEqual([{ method: operation === 'update' ? 'PUT' : 'GET', token: `Bearer ${jwt('ana')}` }])
      expect((await client.auth.getSession()).data.session?.user.id).toBe('bea')
      expect(JSON.parse(saved).user.id).toBe('bea')
      expect(sharedMutation).not.toHaveBeenCalled(); expect(sharedCode).not.toHaveBeenCalled()
    } finally {
      await client.auth.dispose()
    }
  })

  it('requires the server to confirm the expected user ID after a successful PUT', async () => {
    const { client } = fakeClient()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'bea' }), { status: 200 })))
    expect(await passwordUpdate(client, 'ana', values, false)).toMatchObject({ status: 'error', uncertain: true })
  })

  it.each([
    new AuthRetryableFetchError('private credentials', 0),
    new AuthApiError('private details', 500, 'unexpected_failure'),
    new Error('private exception'),
  ])('treats a lost update response as uncertain without an automatic retry', async (error) => {
    const { client, auth } = fakeClient()
    auth.updateUser.mockRejectedValueOnce(error)
    const result = await passwordUpdate(client, 'ana', values, false)
    expect(result).toMatchObject({ status: 'error', uncertain: true })
    expect(JSON.stringify(result)).not.toContain('private')
    expect(auth.updateUser).toHaveBeenCalledOnce()
  })
})

describe('isolated current-password proof', () => {
  const values = { password: 'new password', currentPassword: ' old password λ ' }

  it('uses verified email and exact current password, revokes only the temporary token, then updates with the original token', async () => {
    const server = fakeClient()
    expect(await passwordUpdate(server.client, 'ana', values, false)).toEqual({ status: 'success' })
    const calls = vi.mocked(fetch).mock.calls
    expect(calls.map(([url]) => new URL(String(url)).pathname + new URL(String(url)).search)).toEqual(['/auth/v1/token?grant_type=password', '/auth/v1/logout?scope=local', '/auth/v1/user'])
    expect(JSON.parse(String(calls[0][1]?.body))).toEqual({ email: USER.email, password: values.currentPassword })
    expect(calls.map(([, init]) => new Headers(init?.headers).get('Authorization'))).toEqual(['Bearer public-test-key', 'Bearer temporary-token', 'Bearer token-ana'])
    expect(calls.every(([, init]) => new Headers(init?.headers).get('apikey') === 'public-test-key')).toBe(true)
    expect(calls.map(([, init]) => init?.method)).toEqual(['POST', 'POST', 'PUT'])
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0)
  })

  it.each(['wrong current password', 'passwordless email account'])('rejects %s without a mutation', async () => {
    const server = fakeClient()
    server.grant.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'invalid_credentials', message: 'private' }), { status: 400 }))
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error', message: 'The current password was not accepted. Check it and try again.' })
    expect(server.auth.updateUser).not.toHaveBeenCalled(); expect(server.logout).not.toHaveBeenCalled()
  })

  it('revokes a mismatched temporary account before refusing the update', async () => {
    const server = fakeClient()
    server.grant.mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 'bea' }, access_token: 'wrong-account-token' }), { status: 200 }))
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error' })
    expect(server.auth.updateUser).not.toHaveBeenCalled(); expect(server.logout).toHaveBeenCalledOnce()
    const cleanup = vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('/logout'))!
    expect(new Headers(cleanup[1]?.headers).get('Authorization')).toBe('Bearer wrong-account-token')
  })

  it.each([401, 500])('blocks password mutation if temporary logout returns %s', async status => {
    const server = fakeClient()
    server.logout.mockResolvedValueOnce(new Response(null, { status }))
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error', uncertain: true, message: 'The temporary verification session could not be closed. No password change was submitted. Try again later.' })
    expect(server.auth.updateUser).not.toHaveBeenCalled()
  })

  it('cleans up after an observed account switch during proof, then blocks mutation', async () => {
    const server = fakeClient()
    server.grant.mockImplementationOnce(async () => {
      server.emit('SIGNED_IN', 'bea')
      return new Response(JSON.stringify({ user: USER, access_token: 'temporary-token' }), { status: 200 })
    })
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error' })
    expect(server.logout).toHaveBeenCalledOnce(); expect(server.auth.updateUser).not.toHaveBeenCalled()
  })

  it('blocks mutation when the account changes while cleanup is awaiting confirmation', async () => {
    const server = fakeClient()
    server.logout.mockImplementationOnce(async () => { server.emit('SIGNED_OUT', null); return new Response(null, { status: 204 }) })
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error' })
    expect(server.auth.updateUser).not.toHaveBeenCalled()
  })

  it('never revokes the original shared token if a malformed grant returns it', async () => {
    const server = fakeClient()
    server.grant.mockResolvedValueOnce(new Response(JSON.stringify({ user: USER, access_token: 'token-ana' }), { status: 200 }))
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error', uncertain: true })
    expect(server.logout).not.toHaveBeenCalled(); expect(server.auth.updateUser).not.toHaveBeenCalled()
  })

  it.each(['network', 'server', 'malformed'] as const)('reports uncertain proof on %s response without automatic retry or mutation', async failure => {
    const server = fakeClient()
    if (failure === 'network') server.grant.mockRejectedValueOnce(new Error('private request'))
    else server.grant.mockResolvedValueOnce(new Response(failure === 'server' ? '{}' : 'invalid', { status: failure === 'server' ? 500 : 200 }))
    const result = await passwordUpdate(server.client, 'ana', values, false)
    expect(result).toMatchObject({ status: 'error', uncertain: true })
    expect(JSON.stringify(result)).not.toContain('private request')
    expect(server.grant).toHaveBeenCalledOnce(); expect(server.auth.updateUser).not.toHaveBeenCalled()
  })

  it('reports uncertain cleanup on a lost logout response and never mutates', async () => {
    const server = fakeClient()
    server.logout.mockRejectedValueOnce(new Error('private token'))
    expect(await passwordUpdate(server.client, 'ana', values, false)).toMatchObject({ status: 'error', uncertain: true })
    expect(server.auth.updateUser).not.toHaveBeenCalled()
  })

  it.each(['captcha_failed', 'insufficient_aal', 'user_sso_managed'])('stops proof for %s with fixed actionable feedback', async code => {
    const server = fakeClient()
    server.grant.mockResolvedValueOnce(new Response(JSON.stringify({ code, message: 'private' }), { status: 400 }))
    const result = await passwordUpdate(server.client, 'ana', values, false)
    expect(result.status).toBe('error'); expect(JSON.stringify(result)).not.toContain('private')
    expect(server.auth.updateUser).not.toHaveBeenCalled()
  })

  it('keeps explicit recovery separate and creates no password-grant session', async () => {
    const server = fakeClient()
    expect(await passwordUpdate(server.client, 'ana', { password: 'new password' }, true)).toEqual({ status: 'success' })
    expect(server.grant).not.toHaveBeenCalled(); expect(server.logout).not.toHaveBeenCalled()
  })
})

describe('password verification and recovery email', () => {
  it('requests a verification code only for the same supported account', async () => {
    const { client, auth, unsubscribe } = fakeClient()
    expect(await requestPasswordCode(client, 'ana')).toEqual({ status: 'success' })
    expect(auth.reauthenticate).toHaveBeenCalledExactlyOnceWith()
    expect(unsubscribe).toHaveBeenCalledOnce()
    expect(await requestPasswordCode(client, 'bea')).toMatchObject({ status: 'error' })
    expect(auth.reauthenticate).toHaveBeenCalledOnce()
  })

  it('allows explicit resend after safe email failure', async () => {
    const { client, auth } = fakeClient()
    auth.reauthenticate.mockResolvedValueOnce({ error: new AuthApiError('private email', 429, 'over_email_send_rate_limit') })
    expect(await requestPasswordCode(client, 'ana')).toMatchObject({ status: 'error', message: 'Too many emails sent. Wait a few minutes and try again.' })
    expect(await requestPasswordCode(client, 'ana')).toEqual({ status: 'success' })
    expect(auth.reauthenticate).toHaveBeenCalledTimes(2)
  })

  it('uses a fixed same-origin hub callback and returns neutral success', async () => {
    const { client, auth } = fakeClient()
    expect(await requestPasswordRecovery(client, '  ana@example.com  ')).toEqual({ status: 'success' })
    expect(auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith('ana@example.com', { redirectTo: new URL('/', location.origin).href })
  })

  it('maps thrown recovery email errors without leaking service details', async () => {
    const { client, auth } = fakeClient()
    auth.resetPasswordForEmail.mockRejectedValueOnce(new Error('private email service'))
    const result = await requestPasswordRecovery(client, 'ana@example.com')
    expect(result).toMatchObject({ status: 'error' })
    expect(JSON.stringify(result)).not.toContain('private')
  })
})

describe('password errors', () => {
  it.each(['weak_password', 'same_password', 'invalid_credentials', 'current_password_missing', 'reauthentication_not_valid', 'otp_expired', 'session_expired', 'insufficient_aal', 'over_request_rate_limit'])('maps %s into fixed actionable feedback', (code) => {
    const result = passwordError(new AuthApiError('untrusted password details', 400, code), true)
    expect(result.status).toBe('error')
    expect(JSON.stringify(result)).not.toContain('untrusted')
    expect(result).not.toHaveProperty('uncertain')
  })

  it('safely handles an unknown error code and prototype names', () => {
    expect(passwordError(new AuthApiError('private', 400, 'constructor'))).toEqual({ status: 'error', message: 'The request could not be completed. Try again.' })
  })
})
