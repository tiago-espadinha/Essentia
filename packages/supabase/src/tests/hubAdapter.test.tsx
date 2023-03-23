import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Account } from '../../../../apps/hub/src/Account'
import { getSupabase } from '../data/client'

// Keep useAuth, shared dialogs and the hub adapter real; replace client creation only.
vi.mock('../data/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../data/client')>(),
  getSupabase: vi.fn(),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
HTMLDialogElement.prototype.showModal = function () { this.open = true }

type Listener = (event: string, session: { user: { id: string; email: string } } | null) => void
let root: Root
let container: HTMLElement

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en-GB'
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

describe('actual hub account adapter', () => {
  it('explains that accounts are unavailable when the build has no configured client', () => {
    vi.mocked(getSupabase).mockReturnValue(null)
    act(() => root.render(<Account />))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Account unavailable in this build.')
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('form')).toBeNull()
  })

  it('shows loading then follows actual shared auth events into sign-in and account access', () => {
    let emit: Listener = () => {}
    const unsubscribe = vi.fn()
    const client = { auth: {
      onAuthStateChange: (listener: Listener) => {
        emit = listener
        return { data: { subscription: { unsubscribe } } }
      },
    } } as unknown as SupabaseClient
    vi.mocked(getSupabase).mockReturnValue(client)
    act(() => root.render(<Account />))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Loading account…')
    expect(container.querySelector('button')).toBeNull()

    act(() => emit('INITIAL_SESSION', null))
    expect(container.querySelector('[role="status"]')).toBeNull()
    const signIn = container.querySelector<HTMLButtonElement>('#account-button')!
    expect(signIn.textContent).toBe('Sign in')
    act(() => signIn.click())
    expect(container.querySelector('#auth-email')).not.toBeNull()
    expect(container.textContent).toContain('Local work is added only when you choose in each app.')

    act(() => emit('SIGNED_IN', { user: { id: 'ana', email: 'ana@example.com' } }))
    expect(container.querySelector('dialog')).toBeNull()
    const account = container.querySelector<HTMLButtonElement>('#account-button')!
    expect(account.textContent).toBe('Account')
    act(() => account.click())
    expect(container.textContent).toContain('ana@example.com')
    expect(container.textContent).toContain('One account connects Virtus, Dictum and Merces.')

    act(() => emit('SIGNED_OUT', null))
    expect(container.querySelector('dialog')).toBeNull()
    expect(container.querySelector('#account-button')?.textContent).toBe('Sign in')
  })
})
