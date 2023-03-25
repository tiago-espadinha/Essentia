import { AuthApiError, createClient, type AuthChangeEvent, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { act, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PasswordRecovery } from '../components/PasswordRecovery'
import { ensureRecoveryCapture } from '../data/recovery'
import { getSupabase } from '../data/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
HTMLDialogElement.prototype.showModal = function () { this.open = true }
const USER = { id: 'ana', email: 'ana@example.com', email_confirmed_at: '2026-01-01', identities: [{ provider: 'email' }] } as User

function fakeClient() {
  const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>()
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-ana', user: USER } }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: USER }, error: null })),
    updateUser: vi.fn(async (body?: unknown): Promise<{ error: unknown }> => { void body; return { error: null } }),
    reauthenticate: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
    onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
      listeners.add(callback)
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
    },
  }
  vi.stubEnv('VITE_SUPABASE_URL', 'https://password-test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const result = await auth.updateUser(JSON.parse(String(init?.body)))
    if (result.error) {
      const error = result.error as AuthApiError
      if (!error.status) throw error
      return new Response(JSON.stringify({ code: error.code }), { status: error.status })
    }
    return new Response(JSON.stringify({ id: 'ana' }), { status: 200 })
  }))
  return { client: { auth } as unknown as SupabaseClient, auth, emit: (event: AuthChangeEvent, id: string | null = 'ana') => {
    for (const callback of listeners) callback(event, id ? { user: { ...USER, id } } as Session : null)
  } }
}

let root: Root
let container: HTMLElement
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!
function type(id: string, value: string) {
  act(() => {
    const input = $<HTMLInputElement>(`#${id}`)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function submit() { await act(async () => $<HTMLFormElement>('form').requestSubmit()) }
async function mount(url = '/', server = fakeClient()) {
  history.replaceState(null, '', url)
  await act(async () => root.render(<PasswordRecovery client={server.client} />))
  return server
}
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); document.documentElement.lang = 'en-GB'
  container = document.body.appendChild(document.createElement('div')); root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove(); history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('hub password recovery', () => {
  it('primes the recovery observer when creating the shared client, before any UI subscribes', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://early-capture.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(USER), { status: 200 })))
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: USER.id, exp: expiresAt }))}.c2lnbmF0dXJl`
    history.replaceState(null, '', `/#access_token=${token}&refresh_token=recovery-refresh&expires_in=3600&token_type=bearer&type=recovery`)
    const client = getSupabase()!
    const recovered = new Promise<void>(resolve => {
      client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') resolve() })
    })
    try {
      await client.auth.initialize(); await recovered
      // First store access after initialization must still contain the captured event.
      expect(ensureRecoveryCapture(client).getSnapshot()).toEqual({ userId: 'ana', email: USER.email, attempt: 1 })
      expect(location.hash).toBe('')
    } finally {
      await client.auth.dispose()
      localStorage.clear()
    }
  })

  it('retains a real SDK recovery callback completed before React mounts and across StrictMode remounts', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600
    const token = `${btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${btoa(JSON.stringify({ sub: USER.id, exp: expiresAt }))}.c2lnbmF0dXJl`
    history.replaceState(null, '', `/#access_token=${token}&refresh_token=recovery-refresh&expires_in=3600&token_type=bearer&type=recovery`)
    const transport = vi.fn(async () => new Response(JSON.stringify(USER), { status: 200 }))
    const client = createClient('https://password-test.supabase.co', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true, storageKey: 'early-recovery-test' },
      global: { fetch: transport },
    })
    const store = ensureRecoveryCapture(client)
    const recovered = new Promise<void>(resolve => {
      client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') resolve() })
    })
    try {
      await client.auth.initialize()
      await recovered
      expect(location.hash).toBe('')
      expect(store.getSnapshot()).toEqual({ userId: 'ana', email: USER.email, attempt: 1 })
      await act(async () => root.render(<StrictMode><PasswordRecovery client={client} /></StrictMode>))
      expect($('#password-new')).not.toBeNull()
      expect(container.querySelector('#recovery-email')).toBeNull()
      type('password-new', 'transient old secret')
      await act(async () => root.render(null))
      expect(store.getSnapshot()?.userId).toBe('ana')
      await act(async () => root.render(<StrictMode><PasswordRecovery client={client} /></StrictMode>))
      expect($<HTMLInputElement>('#password-new').value).toBe('')
      expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0)
      expect(JSON.stringify(store.getSnapshot())).not.toContain(token)
      act(() => $<HTMLButtonElement>('.account__close').click())
      expect(store.getSnapshot()).toBeNull()
      await act(async () => root.render(null))
      await act(async () => root.render(<PasswordRecovery client={client} />))
      expect(container.querySelector('dialog')).toBeNull()
    } finally {
      await client.auth.dispose()
    }
  })

  it('captures only identifiers before mounting and discards them on ordinary auth transitions', async () => {
    const server = fakeClient()
    const store = ensureRecoveryCapture(server.client)
    server.emit('PASSWORD_RECOVERY')
    expect(store.getSnapshot()).toEqual({ userId: 'ana', email: USER.email, attempt: 1 })
    server.emit('TOKEN_REFRESHED')
    expect(store.getSnapshot()?.attempt).toBe(1)
    server.emit('SIGNED_IN')
    expect(store.getSnapshot()).toBeNull()
    server.emit('PASSWORD_RECOVERY'); server.emit('SIGNED_OUT', null)
    expect(store.getSnapshot()).toBeNull()
    server.emit('PASSWORD_RECOVERY'); server.emit('TOKEN_REFRESHED', 'bea')
    expect(store.getSnapshot()).toBeNull()
    await mount('/', server)
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('allows a query flag to request email but never to authorize changing a password', async () => {
    const server = await mount('/?recover=password&type=recovery&keep=yes')
    expect($('#recovery-email')).not.toBeNull()
    expect(container.querySelector('#password-new')).toBeNull()
    expect(location.search).toBe('?type=recovery&keep=yes')
    expect(server.auth.getUser).not.toHaveBeenCalled()
    await act(async () => server.emit('SIGNED_IN'))
    expect(container.querySelector('#password-new')).toBeNull()
  })

  it('ignores a forged recovery hash and ordinary initial sessions', async () => {
    const server = await mount('/#type=recovery')
    await act(async () => server.emit('INITIAL_SESSION'))
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('validates email inline then gives neutral account-existence feedback with a fixed hub redirect', async () => {
    const server = await mount('/?recover=password')
    await submit()
    expect(document.activeElement).toBe($('#recovery-email'))
    expect($('#recovery-error').textContent).toContain('name@example.com')
    type('recovery-email', '  unknown@example.com  '); await submit()
    expect(server.auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith('unknown@example.com', { redirectTo: new URL('/', location.origin).href })
    expect($('[role="status"]').textContent).toContain('If this email has an account')
    expect(container.querySelector('input')).toBeNull()
  })

  it('blocks duplicate email requests and closing while pending; maps refusal safely and supports retry', async () => {
    const server = await mount('/?recover=password')
    let finish!: (value: { error: unknown }) => void
    server.auth.resetPasswordForEmail.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    type('recovery-email', USER.email!)
    await act(async () => { $<HTMLFormElement>('form').requestSubmit(); $<HTMLFormElement>('form').requestSubmit() })
    expect(server.auth.resetPasswordForEmail).toHaveBeenCalledOnce()
    expect($<HTMLButtonElement>('.account__close').disabled).toBe(true)
    await act(async () => finish({ error: new AuthApiError('private address', 429, 'over_email_send_rate_limit') }))
    expect($('[role="alert"]').textContent).toContain('Too many emails')
    expect(container.textContent).not.toContain('private address')
    await submit()
    expect($('[role="status"]').textContent).toContain('If this email has an account')
  })

  it.each(['/?error_code=otp_expired&error_description=private&keep=yes', '/#error_code=otp_expired&error_description=private'])('shows an actionable expired-link request and removes service errors: %s', async url => {
    await mount(url)
    expect($('[role="alert"]').textContent).toContain('invalid or expired')
    expect(container.textContent).not.toContain('private')
    expect(location.href).not.toContain('error_description')
    expect(location.href).not.toContain('otp_expired')
    expect($('#recovery-email')).not.toBeNull()
  })

  it('opens reset only for a real SDK recovery event, submits without current_password and clears secrets', async () => {
    const server = await mount()
    await act(async () => server.emit('PASSWORD_RECOVERY'))
    expect(container.querySelector('#password-current')).toBeNull()
    expect(document.activeElement).toBe($('#password-new'))
    type('password-new', ' recovery secret λ '); type('password-confirm', ' recovery secret λ ')
    await submit()
    expect(server.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: ' recovery secret λ ' })
    expect($('[role="status"]').textContent).toContain('has been changed')
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0)
    expect(container.querySelector('input')).toBeNull()
  })

  it('explains a server current-password restriction during recovery without bypassing it', async () => {
    const server = await mount()
    server.auth.updateUser.mockResolvedValueOnce({ error: new AuthApiError('private', 400, 'current_password_missing') })
    await act(async () => server.emit('PASSWORD_RECOVERY'))
    type('password-new', 'recovery secret'); type('password-confirm', 'recovery secret'); await submit()
    expect($('[role="alert"]').textContent).toContain('requires the current password')
    expect(server.auth.updateUser).toHaveBeenCalledOnce()
    expect(container.querySelector('#password-current')).toBeNull()
  })

  it('resets same-account recovery attempts and ends recovery authority on ordinary same-account sign-in', async () => {
    const server = await mount()
    await act(async () => server.emit('PASSWORD_RECOVERY'))
    type('password-new', 'first recovery secret'); type('password-confirm', 'first recovery secret')
    await act(async () => server.emit('PASSWORD_RECOVERY'))
    expect($<HTMLInputElement>('#password-new').value).toBe('')
    type('password-new', 'second recovery secret'); type('password-confirm', 'second recovery secret'); await submit()
    expect($('[role="status"]').textContent).toContain('has been changed')
    await act(async () => server.emit('PASSWORD_RECOVERY'))
    expect($<HTMLInputElement>('#password-new').value).toBe('')
    await act(async () => server.emit('SIGNED_IN'))
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('clears reset fields on cancellation or account switch and ignores a late update success', async () => {
    const server = await mount()
    await act(async () => server.emit('PASSWORD_RECOVERY'))
    type('password-new', 'recovery secret'); type('password-confirm', 'recovery secret')
    act(() => $<HTMLButtonElement>('.account__close').click())
    expect(container.querySelector('input')).toBeNull()
    await act(async () => server.emit('PASSWORD_RECOVERY'))
    expect($<HTMLInputElement>('#password-new').value).toBe('')
    let finish!: (value: { error: null }) => void
    server.auth.updateUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    type('password-new', 'another recovery secret'); type('password-confirm', 'another recovery secret'); await submit()
    await act(async () => server.emit('SIGNED_IN', 'bea'))
    expect(container.querySelector('dialog')).toBeNull()
    await act(async () => finish({ error: null }))
    expect(container.querySelector('dialog')).toBeNull()
  })
})
