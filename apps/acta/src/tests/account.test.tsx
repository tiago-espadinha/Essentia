import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { FakeAccount, fakeClient } from './fakeAccount'
import { $, addTask, buttonNamed, click, renderApp, setupApp, taskTexts } from './testing'

const account = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }))
vi.mock('@essentia/supabase', async (original) => ({
  ...(await original<typeof import('@essentia/supabase')>()),
  getSupabase: () => ({
    from: (table: string) => account.client.from(table),
    rpc: (name: string, args: object) => account.client.rpc(name, args),
    auth: { onAuthStateChange: (callback: never) => account.client.auth.onAuthStateChange(callback) },
  }),
}))
setupApp()
// jsdom has <dialog> without its methods; the browser's focus trap and Esc are not emulated.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true }
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) { this.open = false }

const ANA = 'aaaaaaaa-0000-4000-8000-00000000000a'

async function settle(change: () => void = () => {}) {
  act(change)
  await act(() => vi.advanceTimersByTimeAsync(2000))
}

let server: FakeAccount
let device: ReturnType<typeof fakeClient>

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
  vi.useFakeTimers()
  server = new FakeAccount()
  device = fakeClient(server)
  account.client = device.client
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('Acta signed in', () => {
  it('offers to keep signed-out tasks on this device, apart from the account', async () => {
    renderApp()
    await settle()
    addTask('Only here')
    await settle(() => device.signIn(ANA))

    expect(document.querySelector('#claim-title')?.textContent).toBe('Add what’s on this device?')
    click(buttonNamed('Keep on this device'))
    await settle()
    expect(taskTexts()).toEqual([])
    expect(server.read(ANA)).toEqual([])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1)
  })

  it('shows a change from another device on its row until the person chooses', async () => {
    device.restore(ANA)
    renderApp()
    await settle()
    addTask('Plan')
    await settle()
    const [row] = server.read(ANA) as { id: string }[]
    server.write(ANA, ANA, {
      operationId: 'cccccccc-0000-4000-8000-000000000001', taskId: row.id, expectedVersion: 1,
      content: { text: 'Plan the trip', completed: false, category: 'General', due: '' },
    })
    click($('.task__check'))
    await settle()

    expect($('.task__conflict-text').textContent).toBe('Changed on another device.')
    expect($<HTMLInputElement>('.task__check').checked).toBe(true)
    click(buttonNamed('Use theirs “Plan”'))
    await settle()
    expect(taskTexts()).toEqual(['Plan the trip'])
    expect(document.querySelector('.task__conflict')).toBeNull()
  })

  it('offers a retry when the account can’t be reached, keeping the change', async () => {
    device = fakeClient(server, { down: true })
    account.client = device.client
    device.restore(ANA)
    renderApp()
    await settle()
    addTask('Offline')
    await settle()
    expect($('.sync-notice__text').textContent).toBe('Couldn’t sync with your account. Your changes are kept on this device.')
    expect(taskTexts()).toEqual(['Offline'])
  })

  it('limits task text to what the account accepts', () => {
    renderApp()
    expect($<HTMLInputElement>('#add-task').maxLength).toBe(500)
  })
})
