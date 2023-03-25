import { AuthApiError, AuthRetryableFetchError, type AuthChangeEvent, type Session, type SupabaseClient, type User } from '@supabase/supabase-js'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from '../components/AccountMenu'
import { PasswordDialog } from '../components/PasswordDialog'
import { PasswordForm } from '../components/PasswordForm'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
HTMLDialogElement.prototype.showModal = function () { this.open = true }
const USER = { id: 'ana', email: 'ana@example.com', email_confirmed_at: '2026-01-01', identities: [{ provider: 'email' }] } as User

function fakeClient(user = USER) {
  const listeners = new Set<(event: AuthChangeEvent, session: Session | null) => void>()
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'token-ana', user } }, error: null })),
    getUser: vi.fn(async (): Promise<{ data: { user: User }; error: unknown }> => ({ data: { user }, error: null })),
    updateUser: vi.fn(async (body?: unknown): Promise<{ error: unknown }> => { void body; return { error: null } }),
    reauthenticate: vi.fn(async (): Promise<{ error: unknown }> => ({ error: null })),
    onAuthStateChange: (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
      listeners.add(callback)
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
    },
  }
  vi.stubEnv('VITE_SUPABASE_URL', 'https://password-test.supabase.co')
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key')
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes('/token?grant_type=password')) return new Response(JSON.stringify({ user, access_token: 'temporary-token' }), { status: 200 })
    if (String(input).includes('/logout?scope=local')) return new Response(null, { status: 204 })
    const result = String(input).endsWith('/reauthenticate') ? await auth.reauthenticate() : await auth.updateUser(JSON.parse(String(init?.body)))
    if (result.error) {
      const error = result.error as AuthApiError
      if (!error.status) throw error
      return new Response(JSON.stringify({ code: error.code }), { status: error.status })
    }
    return new Response(JSON.stringify({ id: 'ana' }), { status: 200 })
  }))
  return { client: { auth } as unknown as SupabaseClient, auth, emit: (id: string | null) => {
    for (const callback of listeners) callback(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { ...USER, id } } as Session : null)
  } }
}

let root: Root
let container: HTMLElement
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!
async function render(element: ReactNode) { await act(async () => root.render(element)) }
function type(id: string, value: string) {
  const input = $<HTMLInputElement>(`#password-${id}`)
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
function fill() { type('current', ' old password λ '); type('new', ' new password λ '); type('confirm', ' new password λ ') }
async function submit() { await act(async () => $<HTMLFormElement>('form').requestSubmit()) }
function button(name: string) {
  const found = [...container.querySelectorAll('button')].find(element => element.textContent?.trim() === name)
  if (!found) throw new Error(`Missing button ${name}`)
  return found
}
async function click(name: string) { await act(async () => button(name).click()) }

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear()
  document.documentElement.lang = 'en-GB'
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe('shared password form', () => {
  it('labels fields, focuses inline validation and validates unchanged, short and mismatched passwords', async () => {
    const { client, auth } = fakeClient()
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    expect(document.activeElement).toBe($('#password-current'))
    expect($('#password-current').getAttribute('autocomplete')).toBe('current-password')
    expect($('#password-new').getAttribute('autocomplete')).toBe('new-password')
    await submit()
    expect(document.activeElement).toBe($('#password-current'))
    expect($('#password-current').getAttribute('aria-describedby')).toBe('password-current-error')
    type('current', 'same password'); type('new', 'same password'); type('confirm', 'same password')
    await submit()
    expect($('#password-new-error').textContent).toContain('different')
    type('new', 'short'); type('confirm', 'different')
    await submit()
    expect($('#password-new-error').textContent).toContain('8 characters')
    expect($('#password-confirm-error').textContent).toContain('same new password')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('keeps exact bytes, reports confirmed success, and removes all secret fields without storage or logging', async () => {
    const { client, auth } = fakeClient()
    const log = vi.spyOn(console, 'log'); const warn = vi.spyOn(console, 'warn'); const error = vi.spyOn(console, 'error')
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    fill(); await submit()
    expect(auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password: ' new password λ ', current_password: ' old password λ ' })
    expect($('[role="status"]').textContent).toContain('has been changed')
    expect(container.querySelectorAll('input')).toHaveLength(0)
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0)
    expect(log).not.toHaveBeenCalled(); expect(warn).not.toHaveBeenCalled(); expect(error).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain(' new password λ ')
  })

  it('blocks duplicate submissions and dialog dismissal while a request is pending', async () => {
    const { client, auth } = fakeClient()
    let finish!: (result: { error: null }) => void
    auth.updateUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const close = vi.fn()
    await render(<PasswordDialog client={client} userId="ana" onClose={close} />)
    fill()
    await act(async () => { $<HTMLFormElement>('form').requestSubmit(); $<HTMLFormElement>('form').requestSubmit() })
    expect(auth.updateUser).toHaveBeenCalledOnce()
    expect(button('Close').disabled).toBe(true)
    expect($('#password-current').hasAttribute('disabled')).toBe(true)
    expect(container.querySelector('a[href="/?recover=password"]')).toBeNull()
    const cancel = new Event('cancel', { cancelable: true })
    act(() => $('dialog').dispatchEvent(cancel))
    expect(cancel.defaultPrevented).toBe(true); expect(close).not.toHaveBeenCalled()
    await act(async () => finish({ error: null }))
    expect(button('Close').disabled).toBe(false)
  })

  it('maps wrong current password safely and permits explicit retry', async () => {
    const { client, auth } = fakeClient()
    auth.updateUser.mockResolvedValueOnce({ error: new AuthApiError('private supplied password', 400, 'invalid_credentials') })
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    fill(); await submit()
    expect($('[role="alert"]').textContent).toContain('current password was not accepted')
    expect(container.textContent).not.toContain('private supplied password')
    expect($<HTMLInputElement>('#password-new').value).toBe(' new password λ ')
    await submit()
    expect(auth.updateUser).toHaveBeenCalledTimes(2)
    expect($('[role="status"]').textContent).toContain('has been changed')
  })

  it('requires an explicit verification-code request and handles expiry, resend and successful proof', async () => {
    const { client, auth } = fakeClient()
    auth.updateUser.mockResolvedValueOnce({ error: new AuthApiError('private', 400, 'reauthentication_needed') })
    auth.updateUser.mockResolvedValueOnce({ error: new AuthApiError('private nonce', 400, 'reauthentication_not_valid') })
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    fill(); await submit()
    expect(auth.reauthenticate).not.toHaveBeenCalled()
    await submit()
    expect($('#password-code-error').textContent).toContain('Enter the verification code')
    expect(document.activeElement).toBe($('#password-code'))
    await click('Send verification code')
    expect(auth.reauthenticate).toHaveBeenCalledOnce()
    type('code', ' 111111 '); await submit()
    expect(auth.updateUser).toHaveBeenLastCalledWith({ password: ' new password λ ', current_password: ' old password λ ', nonce: '111111' })
    expect($('[role="alert"]').textContent).toContain('invalid or expired')
    await click('Send a new code')
    expect($<HTMLInputElement>('#password-code').value).toBe('')
    type('code', '222222'); await submit()
    expect($('[role="status"]').textContent).toContain('has been changed')
  })

  it('clears secrets on an uncertain update without auto-retry or claiming success', async () => {
    const { client, auth } = fakeClient()
    auth.updateUser.mockRejectedValueOnce(new AuthRetryableFetchError('private payload', 0))
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    fill(); await submit()
    expect($('[role="alert"]').textContent).toContain('could not be confirmed')
    expect([...container.querySelectorAll('input')].every(input => input.value === '')).toBe(true)
    expect(auth.updateUser).toHaveBeenCalledOnce()
  })

  it('blocks duplicate code requests, maps email limits and permits an explicit resend retry', async () => {
    const { client, auth } = fakeClient()
    auth.updateUser.mockResolvedValueOnce({ error: new AuthApiError('private', 400, 'reauthentication_needed') })
    let finish!: (result: { error: unknown }) => void
    auth.reauthenticate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    fill(); await submit()
    await act(async () => { button('Send verification code').click(); button('Send verification code').click() })
    expect(auth.reauthenticate).toHaveBeenCalledOnce()
    expect(button('Send verification code').disabled).toBe(true)
    await act(async () => finish({ error: new AuthApiError('private email', 429, 'over_email_send_rate_limit') }))
    expect($('[role="alert"]').textContent).toContain('Too many emails')
    expect(container.textContent).not.toContain('private email')
    await click('Send verification code')
    expect(auth.reauthenticate).toHaveBeenCalledTimes(2)
    expect(button('Send a new code')).toBeDefined()
  })

  it('shows loading and rejects expiry rather than offering password fields', async () => {
    const { client, auth } = fakeClient()
    let finish!: (value: { data: { user: User }; error: unknown }) => void
    auth.getUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    expect($('[role="status"]').textContent).toContain('Checking password settings')
    expect(container.querySelector('input')).toBeNull()
    await act(async () => finish({ data: { user: USER }, error: new AuthApiError('private', 401, 'session_expired') }))
    expect($('[role="alert"]').textContent).toContain('session has changed or expired')
    expect(container.querySelector('input')).toBeNull()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('invalidates secrets and late update success when another account signs in', async () => {
    const server = fakeClient()
    let finish!: (result: { error: null }) => void
    server.auth.updateUser.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await render(<PasswordForm client={server.client} userId="ana" onPending={vi.fn()} />)
    fill(); await submit()
    act(() => server.emit('bea'))
    expect(container.querySelector('form')).toBeNull()
    expect($('[role="alert"]').textContent).toContain('session has changed or expired')
    await act(async () => finish({ error: null }))
    expect(container.textContent).not.toContain('has been changed')
    expect(container.querySelector('input')).toBeNull()
  })

  it('shows unsupported accounts without password inputs', async () => {
    const { client, auth } = fakeClient({ ...USER, identities: [{ provider: 'google' }] } as User)
    await render(<PasswordForm client={client} userId="ana" onPending={vi.fn()} />)
    expect($('[role="alert"]').textContent).toContain('sign-in provider')
    expect(container.querySelector('input')).toBeNull()
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it.each(['suite', 'app'] as const)('opens the same password form from %s account settings and clears on close', async scope => {
    const { client } = fakeClient()
    const common = { client, auth: { status: 'signed-in' as const, userId: 'ana', email: USER.email! } }
    await render(scope === 'suite'
      ? <AccountMenu {...common} scope="suite" text={{ intro: '' }} />
      : <AccountMenu {...common} syncState="synced" onSync={async () => true} text={{ intro: '', sync: { off: '', syncing: '', synced: '', failed: '' }, signOut: '' }} />)
    await click('Account'); await click('Change password')
    fill(); await click('Close')
    expect(container.querySelector('dialog')).toBeNull()
    await click('Account'); await click('Change password')
    expect($<HTMLInputElement>('#password-new').value).toBe('')
  })
})
