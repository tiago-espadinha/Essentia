import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signOut } from './auth'
import { AuthForm } from './AuthForm'
import { storedUserId } from './client'
import { useAuth, type Auth } from './useAuth'

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

type Listener = (event: string, session: { user: { id: string; email?: string } } | null) => void

/** Just the auth calls the package makes, with a listener the test can fire. */
function fakeClient() {
  let listener: Listener = () => {}
  const auth = {
    onAuthStateChange: vi.fn((callback: Listener) => {
      listener = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    }),
    signInWithPassword: vi.fn(async () => ({ error: null as unknown })),
    signUp: vi.fn(async () => ({ data: { session: null as unknown }, error: null as unknown })),
    signOut: vi.fn(async () => ({ error: null as unknown })),
  }
  const emit: Listener = (event, session) => act(() => listener(event, session))
  return { client: { auth } as unknown as SupabaseClient, auth, emit }
}

let container: HTMLElement
let root: Root

function render(element: ReactNode) {
  act(() => root.render(element))
}

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!

function type(input: HTMLInputElement, value: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setValue.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submit() {
  await act(async () => $<HTMLFormElement>('form').requestSubmit())
}

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('useAuth', () => {
  let seen: Auth
  function Probe({ client }: { client: SupabaseClient | null }) {
    seen = useAuth(client)
    return null
  }

  it('is disabled without a client', () => {
    render(<Probe client={null} />)
    expect(seen).toEqual({ status: 'disabled' })
  })

  it('loads, then follows sign-in and sign-out from any app', () => {
    const { client, emit } = fakeClient()
    render(<Probe client={client} />)
    expect(seen).toEqual({ status: 'loading' })

    emit('INITIAL_SESSION', null)
    expect(seen).toEqual({ status: 'signed-out' })

    emit('SIGNED_IN', { user: { id: 'u1', email: 'ana@example.com' } })
    expect(seen).toEqual({ status: 'signed-in', userId: 'u1', email: 'ana@example.com' })

    emit('SIGNED_OUT', null)
    expect(seen).toEqual({ status: 'signed-out' })
  })

  it('clears every app’s account data on sign-out, even apps not open, and keeps data with no account', () => {
    localStorage.clear()
    const saved = {
      'essentia-virtus-sync': { owner: 'u1', habits: {}, days: {} },
      'essentia-virtus-habits': [{ id: 'h1' }],
      'essentia-dictum-sync': { owner: 'u1', docs: {} },
      'essentia-dictum-documents': [{ id: 'd1' }],
      'essentia-dictum-versions': [{ id: 'v1' }],
      'essentia-aurum-sync': { owner: 'u1', deleted: {} },
      'essentia-aurum-transactions': [{ id: 't1' }],
      'essentia-aurum-budgets': { budgets: [], deleted: {} },
      'essentia-aurum-recurring': { items: [], deleted: {} },
      'essentia-folio-notes': [{ id: 'n1' }],
      'essentia-acta-tasks': [{ id: 'a1' }],
      'essentia-theme': 'dark',
    }
    for (const [key, value] of Object.entries(saved)) localStorage.setItem(key, JSON.stringify(value))
    // Made while signed out in Dictum: not an account's, so it stays.
    localStorage.setItem('essentia-dictum-sync', JSON.stringify({ owner: null, docs: {} }))
    const { client, emit } = fakeClient()
    render(<Probe client={client} />)

    emit('SIGNED_OUT', null)
    expect(Object.keys(localStorage).sort()).toEqual([
      'essentia-acta-tasks',
      'essentia-dictum-documents',
      'essentia-dictum-sync',
      'essentia-dictum-versions',
      'essentia-folio-notes',
      'essentia-theme',
    ])
  })
})

describe('offline with an expired token', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('keeps the account’s data: Supabase reports no session but still stores it', () => {
    localStorage.clear()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd.supabase.co')
    localStorage.setItem('sb-abcd-auth-token', JSON.stringify({ user: { id: 'u1' } }))
    localStorage.setItem('essentia-virtus-sync', JSON.stringify({ owner: 'u1' }))
    const { client, emit } = fakeClient()
    function Probe() {
      useAuth(client)
      return null
    }
    render(<Probe />)

    emit('INITIAL_SESSION', null)
    expect(localStorage.getItem('essentia-virtus-sync')).not.toBeNull()
  })
})

describe('storedUserId', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('reads the account of the session stored on this device', () => {
    localStorage.clear()
    expect(storedUserId()).toBeNull()
    vi.stubEnv('VITE_SUPABASE_URL', 'https://abcd.supabase.co')
    expect(storedUserId()).toBeNull()
    localStorage.setItem('sb-abcd-auth-token', JSON.stringify({ access_token: 'x', user: { id: 'u1' } }))
    expect(storedUserId()).toBe('u1')
    localStorage.setItem('sb-abcd-auth-token', '{broken')
    expect(storedUserId()).toBeNull()
  })
})

describe('AuthForm', () => {
  it('explains what is missing under each field and focuses the first one', async () => {
    const { client, auth } = fakeClient()
    render(<AuthForm client={client} intro="Sign in to sync." />)

    await submit()
    expect($('#auth-email-error').textContent).toBe('Enter your email address.')
    expect($('#auth-password-error').textContent).toBe('Enter a password.')
    expect($('#auth-email').getAttribute('aria-describedby')).toBe('auth-email-error')
    expect(document.activeElement).toBe($('#auth-email'))

    type($('#auth-email'), 'ana')
    type($('#auth-password'), 'secret1')
    await submit()
    expect($('#auth-email-error').textContent).toBe('Enter an email address like name@example.com.')
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('signs in with the trimmed address and explains the refusal in its own words', async () => {
    const { client, auth } = fakeClient()
    auth.signInWithPassword.mockResolvedValueOnce({ error: new AuthApiError('Invalid login credentials', 400, 'invalid_credentials') })
    render(<AuthForm client={client} intro="Sign in to sync." />)

    type($('#auth-email'), '  ana@example.com ')
    type($('#auth-password'), 'wrong')
    await submit()

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'wrong' })
    expect($('[role="alert"]').textContent).toBe('That email and password don’t match an account.')
  })

  it.each([
    ['email_not_confirmed', 'Confirm your email first: open the link we sent you.'],
    ['user_already_exists', 'An account with this email already exists. Sign in instead.'],
    ['email_exists', 'An account with this email already exists. Sign in instead.'],
    ['weak_password', 'Choose a stronger password.'],
    ['email_address_invalid', 'This email address can’t be used. Try another one.'],
    ['over_request_rate_limit', 'Too many attempts. Wait a minute and try again.'],
    ['over_email_send_rate_limit', 'Too many emails sent. Wait a few minutes and try again.'],
    ['signup_disabled', 'New accounts can’t be created right now.'],
    ['some_new_code', 'Something went wrong. Try again.'],
    ['constructor', 'Something went wrong. Try again.'],
  ])('shows fixed wording for %s, never the server’s message', async (code, wording) => {
    const { client, auth } = fakeClient()
    auth.signInWithPassword.mockResolvedValueOnce({ error: new AuthApiError('Raw server text', 400, code) })
    render(<AuthForm client={client} intro="Sign in to sync." />)

    type($('#auth-email'), 'ana@example.com')
    type($('#auth-password'), 'secret1')
    await submit()

    expect($('[role="alert"]').textContent).toBe(wording)
  })

  it('says when the server can’t be reached', async () => {
    const { client, auth } = fakeClient()
    auth.signInWithPassword.mockResolvedValueOnce({ error: new AuthRetryableFetchError('Failed to fetch', 0) })
    render(<AuthForm client={client} intro="Sign in to sync." />)

    type($('#auth-email'), 'ana@example.com')
    type($('#auth-password'), 'secret1')
    await submit()

    expect($('[role="alert"]').textContent).toBe('Couldn’t reach the server. Check your connection and try again.')
  })

  it('creates an account and asks for the emailed confirmation', async () => {
    const { client, auth } = fakeClient()
    render(<AuthForm client={client} intro="Sign in to sync." />)

    act(() => [...container.querySelectorAll('button')].find((b) => b.textContent === 'Create one')!.click())
    expect($('#auth-password').getAttribute('autocomplete')).toBe('new-password')
    type($('#auth-email'), 'ana@example.com')
    type($('#auth-password'), 'secret1')
    await submit()

    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@example.com', password: 'secret1' }))
    expect($('[role="status"]').textContent).toContain('Check your inbox at ana@example.com')
  })
})

describe('signOut', () => {
  it('signs out this device only, so other devices keep their unsynced changes', async () => {
    const { client, auth } = fakeClient()
    expect(await signOut(client)).toBeNull()
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('counts an unreachable server as signed out, since the session is already gone here', async () => {
    const { client, auth } = fakeClient()
    auth.signOut.mockResolvedValueOnce({ error: new AuthRetryableFetchError('Failed to fetch', 0) })
    expect(await signOut(client)).toBeNull()
  })

  it('reports any other failure', async () => {
    const { client, auth } = fakeClient()
    auth.signOut.mockResolvedValueOnce({ error: new AuthApiError('Internal error', 500, undefined) })
    expect(await signOut(client)).not.toBeNull()
  })
})
