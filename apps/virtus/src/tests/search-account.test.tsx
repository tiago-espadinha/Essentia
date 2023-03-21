import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { $, click, renderApp, setupApp, type } from './testing'

const account = vi.hoisted(() => ({ client: null as unknown as SupabaseClient }))
vi.mock('@essentia/supabase', async (original) => ({
  ...(await original<typeof import('@essentia/supabase')>()),
  getSupabase: () => ({
    from: (table: string) => account.client.from(table),
    auth: { onAuthStateChange: (callback: never) => account.client.auth.onAuthStateChange(callback) },
  }),
}))
setupApp()
HTMLDialogElement.prototype.close = function () { this.open = false }

type Session = { user: { id: string } } | null

// Read fixtures follow the existing hook server contract, with every auth subscriber notified.
function deviceWithHabits(delay = 0) {
  let session: Session = { user: { id: 'ana' } }
  const listeners = new Set<(event: string, session: Session) => void>()
  const rows = ['ana', 'ben'].map((owner, index) => ({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`, user_id: owner,
    name: `${owner} private`, category: 'General', days: [], unit: '', target: null,
    created_at: '2022-08-01T09:00:00Z', updated_at: '2022-08-01T09:00:00Z', deleted_at: null,
  }))
  const client = {
    from: (table: string) => ({
      select: () => {
        const query = {
          order: () => query,
          range: (start: number, end: number) => {
            const data = table === 'habits' ? rows.filter(row => row.user_id === session?.user.id).slice(start, end + 1) : []
            return delay ? new Promise(resolve => setTimeout(() => resolve({ data, error: null }), delay)) : Promise.resolve({ data, error: null })
          },
        }
        return query
      },
      upsert: () => Promise.resolve({ error: null }),
    }),
    auth: { onAuthStateChange: (callback: (event: string, value: Session) => void) => {
      listeners.add(callback)
      queueMicrotask(() => callback('INITIAL_SESSION', session))
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
    } },
  } as unknown as SupabaseClient
  const emit = (id: string | null) => {
    session = id ? { user: { id } } : null
    act(() => listeners.forEach(callback => callback(id ? 'SIGNED_IN' : 'SIGNED_OUT', session)))
  }
  return { client, emit, fast: () => { delay = 0 } }
}
async function settle() { await act(() => vi.advanceTimersByTimeAsync(2500)) }
function search(query: string) {
  click($('.ui-search-trigger'))
  type($<HTMLInputElement>('dialog input'), query)
}

describe('habit search session boundary', () => {
  it('clears open results on direct account switch and sign-out', async () => {
    vi.useFakeTimers()
    const device = deviceWithHabits()
    account.client = device.client
    renderApp()
    await settle()
    search('ana')
    expect($('dialog button[role="option"]').textContent).toBe('ana private')
    device.emit('ben')
    expect(document.querySelector('dialog')).toBeNull()
    await settle()
    search('ana')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    type($<HTMLInputElement>('dialog input'), 'ben')
    expect($('dialog button[role="option"]').textContent).toBe('ben private')
    device.emit(null)
    expect(document.querySelector('dialog')).toBeNull()
    search('private')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
  })

  it('does not expose an old account after its delayed read completes', async () => {
    vi.useFakeTimers()
    const device = deviceWithHabits(5000)
    account.client = device.client
    renderApp()
    await settle()
    search('ana')
    device.emit('ben')
    expect(document.querySelector('dialog')).toBeNull()
    device.fast()
    await settle()
    await settle()
    await settle()
    search('ana')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    // Existing sync retries on reconnect after the old in-flight request has settled.
    act(() => window.dispatchEvent(new Event('online')))
    await settle()
    type($<HTMLInputElement>('dialog input'), 'ben')
    expect($('dialog button[role="option"]').textContent).toBe('ben private')
  })
})
