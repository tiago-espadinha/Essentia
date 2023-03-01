import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account, fakeServer, settle } from './fakeServer'
import { buttonNamed, newDoc, renderApp, rowTitles, setupApp } from './testing'

vi.mock('@essentia/supabase', async (original) => {
  const { appClient } = await import('./fakeServer')
  return { ...(await original<typeof import('@essentia/supabase')>()), getSupabase: () => appClient }
})

setupApp()

let server: ReturnType<typeof fakeServer>
let device: ReturnType<ReturnType<typeof fakeServer>['client']>

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2022-10-28T09:00:00Z') })
  server = fakeServer()
  device = server.client(null)
  account.client = device.client
  renderApp()
  await settle()
  newDoc('Draft')
  await settle()
  await device.signInAs('ana')
})

const question = () => document.querySelector<HTMLDialogElement>('dialog[open]')

describe('signing in with documents written while signed out', () => {
  it('asks first, with no way to dismiss the question, focused on adding', () => {
    expect(question()?.querySelector('h2')?.textContent).toBe('Add what’s on this device?')
    expect(question()?.textContent).toContain('This device has 1 document made while signed out. Add it to')
    expect([...question()!.querySelectorAll('button')].map((button) => button.textContent)).toEqual(['Remove from device', 'Add to account'])
    expect(document.activeElement).toBe(buttonNamed('Add to account'))
    expect(server.documents).toEqual([])
  })

  it('adds them to the account', async () => {
    await settle(() => buttonNamed('Add to account').click())
    expect(question()).toBeNull()
    expect(rowTitles()).toEqual(['Draft'])
    expect(server.documents.map((row) => [row.title, row.user_id])).toEqual([['Draft', 'ana']])
  })

  it('removes them from this device', async () => {
    await settle(() => buttonNamed('Remove from device').click())
    expect(question()).toBeNull()
    expect(rowTitles()).toEqual([])
    expect(server.documents).toEqual([])
  })
})
