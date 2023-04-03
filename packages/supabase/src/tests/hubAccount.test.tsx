import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountMenu } from '../components/AccountMenu'
import { useAuth } from '../hooks/useAuth'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom does not implement native modal behavior; browser checks cover focus trapping.
HTMLDialogElement.prototype.showModal = function () { this.open = true }

const SESSION_KEY = 'sb-hubtest-auth-token'
type Session = { user: { id: string; email: string } }
type Listener = (event: string, session: Session | null) => void

function fakeClient() {
  let listener: Listener = () => {}
  function emit(event: string, id: string | null) {
    const session = id ? { user: { id, email: `${id}@example.com` } } : null
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
    listener(event, session)
  }
  const signOut = vi.fn(async (...options: [{ scope: string }]): Promise<{ error: AuthRetryableFetchError | null }> => {
    expect(options).toEqual([{ scope: 'local' }])
    emit('SIGNED_OUT', null)
    return { error: null }
  })
  const client = { auth: {
    onAuthStateChange: (callback: Listener) => {
      listener = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    },
    signOut,
  } } as unknown as SupabaseClient
  return { client, signOut, emit }
}

function HubAccount({ client }: { client: SupabaseClient }) {
  const auth = useAuth(client)
  return <AccountMenu scope="suite" client={client} auth={auth} text={{ intro: 'Choose whether to add local work in each app.' }} />
}

let root: Root
let container: HTMLElement
let server: ReturnType<typeof fakeClient>

function button(name: string) {
  const found = [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === name)
  if (!found) throw new Error(`Missing button: ${name}`)
  return found
}

async function click(name: string) {
  await act(async () => button(name).click())
}

function seedAccountData() {
  const values: Record<string, unknown> = {
    'essentia-virtus-sync': { owner: 'ana' },
    'essentia-virtus-habits': [{ id: 'habit' }],
    'essentia-dictum-sync': { owner: 'ana' },
    'essentia-dictum-documents': [{ id: 'doc' }],
    'essentia-dictum-versions': [{ id: 'version' }],
    'essentia-aurum-sync': { owner: 'ana' },
    'essentia-aurum-transactions': [{ id: 'transaction' }],
    'essentia-aurum-budgets': [{ id: 'budget' }],
    'essentia-aurum-recurring': [{ id: 'recurring' }],
    'essentia-folio-notes': [{ id: 'note' }],
    'essentia-acta-tasks': [{ id: 'task' }],
    'essentia-theme': 'dark',
    'essentia-locale': 'pt-PT',
    'essentia-accent': 'blue',
  }
  for (const [key, value] of Object.entries(values)) localStorage.setItem(key, JSON.stringify(value))
  return values
}

beforeEach(() => {
  localStorage.clear()
  document.documentElement.lang = 'en-GB'
  vi.stubEnv('VITE_SUPABASE_URL', 'https://hubtest.supabase.co')
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  server = fakeClient()
  act(() => root.render(<HubAccount client={server.client} />))
  act(() => server.emit('INITIAL_SESSION', 'ana'))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('hub suite account', () => {
  it('requires a separate discard confirmation and cancellation preserves session and data', async () => {
    seedAccountData()
    const before = { ...localStorage }
    await click('Account')
    expect(container.textContent).toContain('including Dictum versions')
    expect([...container.querySelectorAll('nav a')].map((link) => link.getAttribute('href'))).toEqual(['/acta/', '/virtus/', '/dictum/', '/merces/'])
    await click('Sign out')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('cannot check whether every app has synced')
    expect(server.signOut).not.toHaveBeenCalled()
    expect({ ...localStorage }).toEqual(before)
    await click('Cancel')
    expect(container.querySelector('dialog')).toBeNull()
    expect({ ...localStorage }).toEqual(before)
    expect(document.activeElement).toBe(button('Account'))
    await click('Account')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('signs out this device and clears every owned app cache, including closed Dictum versions', async () => {
    const saved = seedAccountData()
    await click('Account')
    await click('Sign out')
    await click('Sign out and discard')
    expect(server.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' })
    for (const key of Object.keys(saved)) {
      if (/essentia-(virtus|dictum|aurum)-/.test(key)) expect(localStorage.getItem(key)).toBeNull()
      else expect(localStorage.getItem(key)).toBe(JSON.stringify(saved[key]))
    }
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(container.querySelector('dialog')).toBeNull()
    expect(document.activeElement).toBe(button('Sign in'))
  })

  it('preserves work with no account owner while clearing the other apps', async () => {
    seedAccountData()
    localStorage.setItem('essentia-dictum-sync', JSON.stringify({ owner: null }))
    await click('Account')
    await click('Sign out')
    await click('Sign out and discard')
    expect(localStorage.getItem('essentia-dictum-documents')).toBe(JSON.stringify([{ id: 'doc' }]))
    expect(localStorage.getItem('essentia-dictum-versions')).toBe(JSON.stringify([{ id: 'version' }]))
    expect(localStorage.getItem('essentia-virtus-habits')).toBeNull()
    expect(localStorage.getItem('essentia-aurum-transactions')).toBeNull()
  })

  it('retains data and shows safe retry feedback when the session survives a failed sign-out', async () => {
    seedAccountData()
    const before = { ...localStorage }
    server.signOut.mockResolvedValueOnce({ error: new AuthRetryableFetchError('private service detail', 0) })
    await click('Account')
    await click('Sign out')
    await click('Sign out and discard')
    expect(container.textContent).toContain('Check your connection and try again.')
    expect(container.textContent).not.toContain('private service detail')
    expect({ ...localStorage }).toEqual(before)
    await click('Try again')
    expect(server.signOut).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(SESSION_KEY)).toBeNull()
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('recovers from a thrown request and lets the user retry', async () => {
    server.signOut.mockRejectedValueOnce(new Error('private exception'))
    await click('Account')
    await click('Sign out')
    await click('Sign out and discard')
    expect(container.textContent).toContain('Something went wrong. Try again.')
    expect(container.textContent).not.toContain('private exception')
    expect(localStorage.getItem(SESSION_KEY)).not.toBeNull()
    await click('Try again')
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('ignores duplicate confirmation clicks and prevents dismissal while sign-out is pending', async () => {
    let finish!: (value: { error: null }) => void
    server.signOut.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    await click('Account')
    await click('Sign out')
    act(() => {
      button('Sign out and discard').click()
      button('Sign out and discard').click()
    })
    expect(server.signOut).toHaveBeenCalledTimes(1)
    expect(button('Cancel').disabled).toBe(true)
    expect(button('Signing out…').getAttribute('aria-disabled')).toBe('true')
    const cancel = new Event('cancel', { bubbles: false, cancelable: true })
    act(() => { container.querySelector('dialog')!.dispatchEvent(cancel) })
    expect(cancel.defaultPrevented).toBe(true)
    await click('Signing out…')
    expect(server.signOut).toHaveBeenCalledTimes(1)
    await act(async () => {
      server.emit('SIGNED_OUT', null)
      finish({ error: null })
    })
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('discards stale confirmation when another account replaces the active session', async () => {
    await click('Account')
    await click('Sign out')
    act(() => server.emit('SIGNED_IN', 'bea'))
    expect(container.querySelector('dialog')).toBeNull()
    expect(server.signOut).not.toHaveBeenCalled()
    await click('Account')
    expect(container.textContent).toContain('bea@example.com')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    await click('Sign out')
    expect(server.signOut).not.toHaveBeenCalled()
  })

  it('warns offline without pretending to sync or requiring a network preflight', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    await click('Account')
    await click('Sign out')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('discard any unsynced account changes')
    expect(server.signOut).not.toHaveBeenCalled()
    await click('Sign out and discard')
    expect(server.signOut).toHaveBeenCalledExactlyOnceWith({ scope: 'local' })
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('continues handling sign-out when one app has malformed ownership metadata', async () => {
    seedAccountData()
    localStorage.setItem('essentia-dictum-sync', '{broken')
    await click('Account')
    await click('Sign out')
    await click('Sign out and discard')
    expect(container.querySelector('dialog')).toBeNull()
    expect(button('Sign in')).toBeDefined()
    expect(localStorage.getItem('essentia-virtus-habits')).toBeNull()
    expect(localStorage.getItem('essentia-aurum-transactions')).toBeNull()
    // Unreadable ownership cannot establish that this copy belongs to an account.
    expect(localStorage.getItem('essentia-dictum-versions')).not.toBeNull()
  })

  it('does not crash the auth transition when browser storage refuses cache removal', () => {
    seedAccountData()
    localStorage.removeItem(SESSION_KEY)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      if (key === SESSION_KEY) return
      throw new DOMException('Storage access blocked', 'SecurityError')
    })
    expect(() => act(() => server.emit('SIGNED_OUT', null))).not.toThrow()
    expect(button('Sign in')).toBeDefined()
    // The event completed, but blocked storage has not been cleaned successfully.
    expect(localStorage.getItem('essentia-dictum-versions')).not.toBeNull()
  })
})
