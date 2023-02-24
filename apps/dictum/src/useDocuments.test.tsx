import type { SupabaseClient } from '@supabase/supabase-js'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { DOCS_KEY, VERSIONS_KEY } from './storage'
import './testing'
import { useDocuments } from './useDocuments'

const rendered: { current: ReturnType<typeof useDocuments> | null } = { current: null }
const hook = () => rendered.current!
let root: Root
let container: HTMLElement

function Probe({ client }: { client: SupabaseClient | null }) {
  const value = useDocuments(client)
  useEffect(() => {
    rendered.current = value
  })
  return null
}

/** Renders without letting the auth event in: what the first paint shows. */
function paint(client: SupabaseClient | null) {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  act(() => root.render(<Probe client={client} />))
}

async function open(client: SupabaseClient | null) {
  paint(client)
  await settle()
}

function close() {
  act(() => root.unmount())
  container.remove()
}

/** Adds a document with a title and returns its id. */
function write(title: string, content = ''): string {
  let id = ''
  act(() => {
    id = hook().add().id
  })
  act(() => hook().update(id, { title, content }))
  return id
}

const titles = () => hook().docs.map((doc) => doc.title)

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2022-10-21T09:00:00Z'))
})

afterEach(() => {
  if (container?.isConnected) close()
  vi.useRealTimers()
})

describe('syncing documents with the account', () => {
  it('stays on the device without a Supabase project', async () => {
    await open(null)
    write('Local only')
    await settle()
    expect(hook().syncState).toBe('off')
    expect(JSON.parse(localStorage.getItem(DOCS_KEY)!).map((doc: { title: string }) => doc.title)).toEqual(['Local only'])
  })

  it('uploads documents written before signing in once asked to, and they open on another device without their versions', async () => {
    const server = fakeServer()
    const laptop = server.client(null)
    await open(laptop.client)
    const id = write('Essay', '# Essay')
    act(() => hook().saveVersion(id))
    expect(hook().syncState).toBe('off')

    await laptop.signInAs('ana')
    expect(hook().unclaimed).toBe(1)
    expect(server.documents).toEqual([])
    await settle(() => hook().answer(true))
    expect(hook().unclaimed).toBe(0)
    expect(hook().syncState).toBe('synced')
    expect(server.documents.map((row) => [row.title, row.user_id])).toEqual([['Essay', 'ana']])
    close()

    localStorage.clear()
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    expect(titles()).toEqual(['Essay'])
    expect(hook().docs[0].content).toBe('# Essay')
    expect(hook().versions).toEqual([])
  })

  it('removes documents written before signing in when told to, versions included, and shows the account’s own', async () => {
    const server = fakeServer()
    await open(server.client({ user: { id: 'ana' } }).client)
    write('Ana’s essay')
    await settle()
    close()

    localStorage.clear()
    const shared = server.client(null)
    await open(shared.client)
    const id = write('Someone else’s note')
    act(() => hook().saveVersion(id))
    await shared.signInAs('ana')
    expect(titles()).toEqual(['Someone else’s note'])

    await settle(() => hook().answer(false))
    expect(titles()).toEqual(['Ana’s essay'])
    expect(hook().versions).toEqual([])
    expect(server.documents.map((row) => row.title)).toEqual(['Ana’s essay'])
  })

  it('sends an edit after a pause in typing, and nothing more once both sides match', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    const id = write('Plan')
    await settle()
    const before = server.calls.upserts

    act(() => hook().update(id, { content: 'first' }))
    act(() => hook().update(id, { content: 'first draft' }))
    await settle()
    expect(server.calls.upserts).toBe(before + 1)
    expect(server.documents[0].content).toBe('first draft')

    await act(async () => {
      await hook().sync()
    })
    expect(server.calls.upserts).toBe(before + 1)
  })

  it('removes a document deleted on another device', async () => {
    const server = fakeServer()
    const laptop = server.client({ user: { id: 'ana' } })
    await open(laptop.client)
    const id = write('Old notes')
    await settle()
    close()

    localStorage.clear()
    const phone = server.client({ user: { id: 'ana' } })
    await open(phone.client)
    vi.setSystemTime(new Date('2022-10-21T10:00:00Z'))
    act(() => void hook().remove(id))
    await settle()
    expect(server.documents[0].deleted_at).toBe('2022-10-21T10:00:00.000Z')
    close()

    await open(laptop.client)
    expect(titles()).toEqual([])
  })

  it('keeps a document whose delete was undone after the deletion reached the account', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    const id = write('Keep me')
    await settle()

    let removed: ReturnType<ReturnType<typeof useDocuments>['remove']> | undefined
    act(() => {
      removed = hook().remove(id)
    })
    await settle()
    expect(server.documents[0].deleted_at).not.toBeNull()

    vi.setSystemTime(new Date('2022-10-21T09:05:00Z'))
    act(() => hook().putBack(removed!))
    await settle()
    expect(titles()).toEqual(['Keep me'])
    expect(server.documents[0].deleted_at).toBeNull()
  })

  it('clears the device on sign-out, versions included, and the documents come back on signing in', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    const id = write('Essay')
    act(() => hook().saveVersion(id))
    await settle()

    await device.signInAs(null)
    expect(titles()).toEqual([])
    expect(JSON.parse(localStorage.getItem(DOCS_KEY)!)).toEqual([])
    expect(JSON.parse(localStorage.getItem(VERSIONS_KEY)!)).toEqual([])

    await device.signInAs('ana')
    expect(titles()).toEqual(['Essay'])
  })

  it('never shows one account’s documents to the next account on the same device', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    write('Ana’s draft')
    await settle()
    close()

    // Signed out in another app, then Ben signs in here.
    const shared = server.client({ user: { id: 'ben' } })
    await open(shared.client)
    expect(titles()).toEqual([])
    write('Ben’s draft')
    await settle()
    expect(server.documents.map((row) => [row.title, row.user_id])).toEqual([
      ['Ana’s draft', 'ana'],
      ['Ben’s draft', 'ben'],
    ])
  })

  it('still syncs the next account when it signs in while the last account’s sync is out', async () => {
    const server = fakeServer()
    server.documents.push({ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', user_id: 'ben', title: 'Ben’s draft', content: '', folder: '', tags: [], created_at: '2022-10-20T09:00:00.000Z', updated_at: '2022-10-20T09:00:00.000Z', deleted_at: null })
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    server.slow(1000)
    write('Ana’s draft')
    // The sync after the edit is out when another tab switches to Ben.
    await act(() => vi.advanceTimersByTimeAsync(2100))
    device.emit(null)
    device.emit('ben')
    await settle()
    await settle()
    expect(titles()).toEqual(['Ben’s draft'])
    expect(hook().syncState).toBe('synced')
  })

  it('never writes one account’s documents under another’s session', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    server.slow(1000)
    write('Ana’s draft')
    // Ben signs in from another tab while Ana's sync is out; this tab has not heard yet.
    await act(() => vi.advanceTimersByTimeAsync(2100))
    device.swapToken('ben')
    await act(() => vi.advanceTimersByTimeAsync(5000))
    expect(server.documents.filter((row) => row.user_id === 'ben')).toEqual([])
    expect(hook().syncState).toBe('failed')
    expect(titles()).toEqual(['Ana’s draft'])
  })

  it('shows no sync failure for a request cut off by signing out', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    server.slow(1000)
    write('Draft')
    await act(() => vi.advanceTimersByTimeAsync(2100))
    // Signed out while the request is out; it then fails, as an anonymous one would.
    server.fail(true)
    device.emit(null)
    await settle()
    expect(hook().syncState).toBe('off')
    expect(titles()).toEqual([])
  })

  it('keeps changes on the device when a sync fails, and sends them on retry', async () => {
    const server = fakeServer()
    const device = server.client({ user: { id: 'ana' } })
    await open(device.client)
    server.fail(true)
    write('Offline draft')
    await settle()
    expect(hook().syncState).toBe('failed')
    expect(titles()).toEqual(['Offline draft'])

    server.fail(false)
    await act(async () => {
      await hook().sync()
    })
    expect(hook().syncState).toBe('synced')
    expect(server.documents.map((row) => row.title)).toEqual(['Offline draft'])
  })
})

describe('the first paint after opening', () => {
  beforeEach(() => vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co'))
  afterEach(() => vi.unstubAllEnvs())

  async function leaveAnasCopy(server: ReturnType<typeof fakeServer>) {
    await open(server.client({ user: { id: 'ana' } }).client)
    write('Ana’s draft')
    await settle()
    close()
  }

  it('holds back an account’s documents when this device has no session for it', async () => {
    const server = fakeServer()
    await leaveAnasCopy(server)

    // Ana's session ended while no app was open.
    paint(server.client(null).client)
    expect(titles()).toEqual([])
    await settle()
    expect(titles()).toEqual([])
    expect(JSON.parse(localStorage.getItem(DOCS_KEY)!)).toEqual([])
  })

  it('keeps the account’s copy offline with an expired token, when Supabase reports no session but keeps it', async () => {
    const server = fakeServer()
    await leaveAnasCopy(server)
    localStorage.setItem('sb-test-auth-token', JSON.stringify({ user: { id: 'ana' } }))

    await open(server.client(null).client)
    expect(titles()).toEqual(['Ana’s draft'])
    expect(hook().syncState).toBe('off')
  })

  it('paints the signed-in account’s own documents at once', async () => {
    const server = fakeServer()
    await leaveAnasCopy(server)
    localStorage.setItem('sb-test-auth-token', JSON.stringify({ user: { id: 'ana' } }))

    paint(server.client({ user: { id: 'ana' } }).client)
    expect(titles()).toEqual(['Ana’s draft'])
  })
})
