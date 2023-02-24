import type { Auth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from './AccountMenu'
import './testing'
import type { SyncState } from './useHabits'

const signOut = vi.fn(async () => ({ error: null }))
const client = { auth: { signOut } } as unknown as SupabaseClient
const ANA: Auth = { status: 'signed-in', userId: 'ana', email: 'ana@example.com' }

let container: HTMLElement
let root: Root

function render(auth: Auth, { syncState = 'synced', onSync = vi.fn(async () => true), withClient = true } = {}) {
  act(() =>
    root.render(<AccountMenu auth={auth} client={withClient ? client : null} syncState={syncState as SyncState} onSync={onSync} />),
  )
  return onSync
}

const button = (name: string) => [...container.querySelectorAll('button')].find((b) => b.textContent?.trim() === name)
const click = async (name: string) => act(async () => button(name)!.click())

beforeEach(() => {
  signOut.mockClear()
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('AccountMenu', () => {
  it('shows nothing without a Supabase project or while the session loads', () => {
    render({ status: 'disabled' }, { withClient: false })
    expect(container.innerHTML).toBe('')
    render({ status: 'loading' })
    expect(container.innerHTML).toBe('')
  })

  it('opens the sign-in form, and closes it once signed in with focus on the account button', async () => {
    render({ status: 'signed-out' })
    await click('Sign in')
    expect(container.querySelector('#sign-in-title')?.textContent).toBe('Sign in')
    expect(container.querySelector('#auth-email')).not.toBeNull()

    render(ANA)
    expect(container.querySelector('dialog')).toBeNull()
    expect(document.activeElement).toBe(container.querySelector('#account-button'))
    expect(container.querySelector('#account-button')?.textContent).toBe('Account')
  })

  it('syncs before signing out, and says the device is cleared', async () => {
    const onSync = render(ANA)
    await click('Account')
    expect(container.textContent).toContain('Signed in as ana@example.com.')
    expect(container.textContent).toContain('Signing out removes your habits from this device.')

    await click('Sign out')
    expect(onSync).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('warns when the latest changes could not be sent, and can sign out anyway', async () => {
    const onSync = render(ANA, { syncState: 'failed', onSync: vi.fn(async () => false) })
    await click('Account')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Couldn’t sync with your account.')

    await click('Sign out')
    expect(signOut).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('sign out anyway and lose them.')

    await click('Sign out anyway')
    expect(onSync).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('offline, warns at once instead of waiting on a sync that cannot finish', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    const onSync = render(ANA)
    await click('Account')

    await click('Sign out')
    expect(onSync).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('sign out anyway and lose them.')

    await click('Sign out anyway')
    expect(signOut).toHaveBeenCalledOnce()
    online.mockRestore()
  })
})
