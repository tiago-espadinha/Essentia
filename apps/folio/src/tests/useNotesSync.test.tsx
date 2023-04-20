import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNotes } from '../hooks/useNotes'
import { DEVICE_KEY, NOTES_KEY, SYNC_KEY } from '../data/storage'
import { fakeServer, settle } from './fakeServer'

// Who holds the stored Supabase session on this device, as `storedUserId` reads it.
const stored = vi.hoisted(() => ({ id: null as string | null }))
vi.mock('@essentia/supabase', async (original) => ({
  ...(await original<typeof import('@essentia/supabase')>()),
  storedUserId: () => stored.id,
}))

let server: ReturnType<typeof fakeServer>
const roots: Root[] = []

/** Renders the hook in a component of its own; `result.current` is its latest return. */
function renderHook<T>(hook: () => T) {
  const result = { current: undefined as T }
  function Probe() {
    result.current = hook()
    return null
  }
  const root = createRoot(document.createElement('div'))
  roots.push(root)
  act(() => root.render(<Probe />))
  return { result }
}

beforeEach(() => {
  localStorage.clear()
  stored.id = null
  vi.useFakeTimers({ now: new Date('2023-04-17T09:00:00Z') })
  server = fakeServer()
})
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  vi.useRealTimers()
})

/** A device running Folio, with its own session. */
async function device(session: string | null = null) {
  stored.id = session
  const { client, emit } = server.client(session ? { user: { id: session } } : null)
  const hook = renderHook(() => useNotes(client))
  await settle()
  const signIn = async (id: string | null) => {
    stored.id = id
    emit(id)
    await settle()
  }
  return { hook, signIn, notes: () => hook.result.current }
}

async function write(d: Awaited<ReturnType<typeof device>>, title: string, folder = '') {
  let id = ''
  act(() => {
    id = d.notes().add(folder).id
  })
  act(() => d.notes().update(id, { title }))
  await settle()
  return id
}

const titles = (d: Awaited<ReturnType<typeof device>>) => d.notes().notes.map((note) => note.title).sort()
const serverTitles = (user: string) =>
  server.tables.documents.filter((row) => row.user_id === user && !row.deleted_at).map((row) => row.title).sort()
const read = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null')

describe('notes made while signed out', () => {
  it('never upload before the person answers, whatever asks for a sync', async () => {
    const d = await device()
    await write(d, 'Diary')
    await d.signIn('ana')
    expect(d.notes().unclaimed).toBe(1)

    act(() => window.dispatchEvent(new Event('online')))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    await act(() => d.notes().sync())
    await write(d, 'Another')
    expect(server.calls.upserts).toEqual([])
    expect(read(SYNC_KEY)?.owner ?? null).toBeNull()
  })

  it('join the account with their folders when added, outranking an old deletion of the same folder', async () => {
    server.tables.note_folders.push({ user_id: 'ana', name: 'Work', updated_at: '2023-01-01T00:00:00Z', deleted_at: '2023-01-01T00:00:00Z' })
    const d = await device()
    act(() => d.notes().createFolder('Work'))
    await write(d, 'Diary', 'Work')
    await d.signIn('ana')
    act(() => d.notes().answer(true))
    await settle()

    expect(d.notes().unclaimed).toBe(0)
    expect(d.notes().syncState).toBe('synced')
    const [row] = server.tables.documents
    expect(row).toMatchObject({ user_id: 'ana', title: 'Diary', folder: 'Work', format: 'rich', pinned: false, deleted_at: null })
    expect(server.tables.note_folders).toEqual([expect.objectContaining({ user_id: 'ana', name: 'Work', deleted_at: null })])
    expect(d.notes().folders).toEqual(['Work'])
  })

  it('stay on this device only when kept, hidden while signed in and back after signing out', async () => {
    server.tables.documents.push({ user_id: 'ana', id: crypto.randomUUID(), format: 'markdown', title: 'From the account', content: '', folder: '', tags: [], pinned: false, created_at: '2023-01-01T00:00:00Z', updated_at: '2023-01-01T00:00:00Z', deleted_at: null })
    const d = await device()
    act(() => d.notes().createFolder('Private'))
    await write(d, 'Diary')
    await d.signIn('ana')
    act(() => d.notes().answer(false))
    await settle()

    expect(titles(d)).toEqual(['From the account'])
    expect(d.notes().folders).toEqual([])
    expect(server.tables.documents.map((row) => row.title)).toEqual(['From the account'])
    expect(server.tables.note_folders).toEqual([])
    expect(read(DEVICE_KEY).notes.map((note: { title: string }) => note.title)).toEqual(['Diary'])

    await d.signIn(null)
    expect(titles(d)).toEqual(['Diary'])
    expect(d.notes().folders).toEqual(['Private'])
    expect(localStorage.getItem(DEVICE_KEY)).toBeNull()
  })

  it('are not set aside once another tab has added them to the account', async () => {
    const d = await device()
    await write(d, 'Diary')
    await d.signIn('ana')
    expect(d.notes().unclaimed).toBe(1)
    // The other tab answered Add: the notes are ana's now.
    localStorage.setItem(SYNC_KEY, JSON.stringify({ owner: 'ana', deleted: {}, folders: {} }))
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: SYNC_KEY })))
    expect(d.notes().unclaimed).toBe(0)

    act(() => d.notes().answer(false))
    await settle()
    expect(localStorage.getItem(DEVICE_KEY)).toBeNull()
    expect(titles(d)).toEqual(['Diary'])
  })

  it('come back even when another tab’s sign-out cleared the notes first', async () => {
    const d = await device()
    await write(d, 'Diary')
    await d.signIn('ana')
    act(() => d.notes().answer(false))
    await settle()
    await write(d, 'Ana’s note')
    // The suite's sign-out in another tab: the keys go, then the auth event arrives.
    for (const key of [NOTES_KEY, SYNC_KEY]) localStorage.removeItem(key)
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })))
    await d.signIn(null)
    expect(titles(d)).toEqual(['Diary'])
  })

  it('are not asked about on a device with none', async () => {
    const d = await device()
    await d.signIn('ana')
    expect(d.notes().unclaimed).toBe(0)
    expect(read(SYNC_KEY).owner).toBe('ana')
  })
})

describe('one account at a time', () => {
  it('clears one account’s notes when another signs in, and mixes nothing', async () => {
    const d = await device()
    await d.signIn('ana')
    await write(d, 'Ana’s note')
    expect(serverTitles('ana')).toEqual(['Ana’s note'])

    await d.signIn('ben')
    expect(titles(d)).toEqual([])
    await write(d, 'Ben’s note')
    expect(serverTitles('ana')).toEqual(['Ana’s note'])
    expect(serverTitles('ben')).toEqual(['Ben’s note'])
  })

  it('drops a sync whose account signed out while it was out', async () => {
    const d = await device()
    await d.signIn('ana')
    await write(d, 'Draft')
    server.slow(1000)
    act(() => d.notes().update(d.notes().notes[0].id, { title: 'Changed' }))
    await act(() => vi.advanceTimersByTimeAsync(2100))
    stored.id = null
    await d.signIn(null)
    await act(() => vi.advanceTimersByTimeAsync(2000))

    expect(titles(d)).toEqual([])
    expect(serverTitles('ana')).toEqual(['Draft'])
    expect(d.notes().syncState).toBe('off')
  })

  it('does not paint another account’s notes on load', async () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ owner: 'ana', deleted: {}, folders: {} }))
    localStorage.setItem(NOTES_KEY, JSON.stringify([{ id: crypto.randomUUID(), format: 'rich', title: 'Ana’s', body: '', folder: '', tags: [], pinned: false, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' }]))
    const d = await device('ben')
    expect(titles(d)).toEqual([])
    expect(server.calls.upserts).toEqual([])
  })

  it('follows a sign-out in another tab', async () => {
    const d = await device()
    await d.signIn('ana')
    await write(d, 'Draft')
    // The suite's sign-out removed the account's keys; this tab hears of it.
    localStorage.removeItem(NOTES_KEY)
    localStorage.removeItem(SYNC_KEY)
    stored.id = null
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: null })))
    expect(titles(d)).toEqual([])
  })
})

describe('keeping devices the same', () => {
  it('brings edits, deletions and folder changes from one device to another', async () => {
    const a = await device('ana')
    await a.signIn('ana')
    const id = await write(a, 'Shopping', 'Home')
    await write(a, 'Gone')
    act(() => a.notes().createFolder('Empty'))
    await settle()

    localStorage.clear()
    const b = await device('ana')
    await b.signIn('ana')
    expect(titles(b)).toEqual(['Gone', 'Shopping'])
    expect(b.notes().folders).toEqual(['Empty', 'Home'])

    act(() => b.notes().remove(b.notes().notes.find((note) => note.title === 'Gone')!.id))
    act(() => b.notes().renameFolder('Empty', 'Later'))
    act(() => b.notes().update(id, { title: 'Shopping list', pinned: true }))
    await settle()
    expect(serverTitles('ana')).toEqual(['Shopping list'])
    expect(server.tables.note_folders.filter((row) => !row.deleted_at).map((row) => row.name).sort()).toEqual(['Home', 'Later'])
    expect(server.tables.documents.find((row) => row.id === id)).toMatchObject({ pinned: true })
  })

  it('puts back an undone deletion that already reached the account', async () => {
    const d = await device()
    await d.signIn('ana')
    const id = await write(d, 'Keep me')
    const note = d.notes().notes[0]
    act(() => d.notes().remove(id))
    await settle()
    expect(serverTitles('ana')).toEqual([])

    act(() => d.notes().restore(note))
    await settle()
    expect(serverTitles('ana')).toEqual(['Keep me'])
    expect(titles(d)).toEqual(['Keep me'])
  })

  it('syncs once after a burst of typing', async () => {
    const d = await device()
    await d.signIn('ana')
    const id = await write(d, 'Draft')
    const before = server.calls.upserts.length
    for (const title of ['D', 'Dr', 'Dra']) act(() => d.notes().update(id, { title }))
    await settle()
    expect(server.calls.upserts.length - before).toBe(1)
  })

  it('keeps changes on the device when a sync fails, and sends them on a retry', async () => {
    const d = await device()
    await d.signIn('ana')
    server.fail(true)
    await write(d, 'Offline note')
    expect(d.notes().syncState).toBe('failed')
    expect(titles(d)).toEqual(['Offline note'])

    server.fail(false)
    act(() => window.dispatchEvent(new Event('online')))
    await settle()
    expect(d.notes().syncState).toBe('synced')
    expect(serverTitles('ana')).toEqual(['Offline note'])
  })

  it('never sends versions', async () => {
    const d = await device()
    await d.signIn('ana')
    const id = await write(d, 'Draft')
    act(() => d.notes().saveVersion(id))
    await settle()
    expect([...server.calls.tables].sort()).toEqual(['documents', 'note_folders'])
    expect(d.notes().versions).toHaveLength(1)
  })
})

describe('Dictum’s account copy', () => {
  it('joins the same account’s notes on sign-in, with its pending deletion', async () => {
    const kept = crypto.randomUUID()
    const deleted = crypto.randomUUID()
    for (const id of [kept, deleted]) {
      server.tables.documents.push({ user_id: 'ana', id, format: 'markdown', title: id === kept ? 'Essay' : 'Old', content: '# Essay', folder: '', tags: [], pinned: false, created_at: '2023-01-01T00:00:00Z', updated_at: '2023-01-01T00:00:00Z', deleted_at: null })
    }
    localStorage.setItem('essentia-dictum-sync', JSON.stringify({ owner: 'ana', deleted: { [deleted]: '2023-02-01T00:00:00.000Z' } }))
    localStorage.setItem('essentia-dictum-documents', JSON.stringify([{ id: kept, title: 'Essay', content: '# Essay', folder: '', tags: [], createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' }]))
    const d = await device()
    expect(titles(d)).toEqual([])
    await d.signIn('ana')

    expect(d.notes().unclaimed).toBe(0)
    expect(titles(d)).toEqual(['Essay'])
    expect(serverTitles('ana')).toEqual(['Essay'])
    expect(read('essentia-notes-migration').accounts).toEqual(['ana'])
  })
})
