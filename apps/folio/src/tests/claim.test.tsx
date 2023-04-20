import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account, fakeServer, settle } from './fakeServer'
import { buttonNamed, newNote, renderApp, rowTitles, setupApp } from './testing'

const stored = vi.hoisted(() => ({ id: null as string | null }))
vi.mock('@essentia/supabase', async (original) => {
  const { appClient } = await import('./fakeServer')
  return { ...(await original<typeof import('@essentia/supabase')>()), getSupabase: () => appClient, storedUserId: () => stored.id }
})

setupApp()

let server: ReturnType<typeof fakeServer>

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2023-04-18T09:00:00Z') })
  stored.id = null
  server = fakeServer()
  const device = server.client(null)
  account.client = device.client
  renderApp()
  await settle()
  newNote('Diary')
  await settle()
  stored.id = 'ana'
  device.emit('ana')
  await settle()
})

const question = () => document.querySelector<HTMLDialogElement>('dialog[open]')

describe('signing in to Folio with notes written while signed out', () => {
  it('asks first, says claimed notes leave the device on sign-out, and offers to keep them here only', () => {
    expect(question()?.querySelector('h2')?.textContent).toBe('Add what’s on this device?')
    expect(question()?.textContent).toContain('This device has 1 note made while signed out.')
    expect(question()?.textContent).toContain('Notes added to your account leave this device when you sign out.')
    expect([...question()!.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Keep on this device', 'Add to account'])
    expect(server.calls.upserts).toEqual([])
  })

  it('adds them to the account', async () => {
    buttonNamed('Add to account').click()
    await settle()
    expect(question()).toBeNull()
    expect(rowTitles()).toEqual(['Diary'])
    expect(server.tables.documents.map((row) => [row.title, row.user_id])).toEqual([['Diary', 'ana']])
  })

  it('keeps them on this device only, out of the account', async () => {
    buttonNamed('Keep on this device').click()
    await settle()
    expect(question()).toBeNull()
    expect(rowTitles()).toEqual([])
    expect(server.calls.upserts).toEqual([])
  })
})
