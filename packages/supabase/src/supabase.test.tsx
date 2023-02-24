import { AuthApiError, AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { signOut } from './auth'
import { AuthForm } from './AuthForm'
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

  it('signs in with the trimmed address and shows the server’s refusal', async () => {
    const { client, auth } = fakeClient()
    auth.signInWithPassword.mockResolvedValueOnce({ error: { name: 'AuthApiError', message: 'Invalid login credentials' } })
    render(<AuthForm client={client} intro="Sign in to sync." />)

    type($('#auth-email'), '  ana@example.com ')
    type($('#auth-password'), 'wrong')
    await submit()

    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'wrong' })
    expect($('[role="alert"]').textContent).toBe('Invalid login credentials')
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
