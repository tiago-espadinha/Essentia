import { describe, expect, it, vi } from 'vitest'
import { account, fakeServer, settle } from './fakeServer'
import { $, click, renderApp, setupApp, type } from './testing'

vi.mock('@essentia/supabase', async (original) => {
  const { appClient } = await import('./fakeServer')
  return { ...(await original<typeof import('@essentia/supabase')>()), getSupabase: () => appClient }
})
setupApp()
HTMLDialogElement.prototype.close = function () { this.open = false }

function serverWithDocuments() {
  const server = fakeServer()
  for (const [index, owner] of ['ana', 'ben'].entries()) server.documents.push({
    id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index + 1).padStart(12, '0')}`, user_id: owner,
    title: `${owner} private`, content: '', folder: '', tags: [], created_at: '2022-10-20T09:00:00Z',
    updated_at: '2022-10-20T09:00:00Z', deleted_at: null,
  })
  return server
}
function search(query: string) {
  click($('.ui-search-trigger'))
  type($<HTMLInputElement>('dialog input'), query)
}

describe('document search session boundary', () => {
  it('clears open results on direct account switch and sign-out', async () => {
    vi.useFakeTimers({ now: new Date('2022-10-28T09:00:00Z') })
    const server = serverWithDocuments()
    const device = server.client({ user: { id: 'ana' } })
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
    vi.useFakeTimers({ now: new Date('2022-10-28T09:00:00Z') })
    const server = serverWithDocuments()
    server.slow(5000)
    const device = server.client({ user: { id: 'ana' } })
    account.client = device.client
    renderApp()
    await settle()
    search('ana')
    device.emit('ben')
    expect(document.querySelector('dialog')).toBeNull()
    server.slow(0)
    await settle()
    await settle()
    search('ana')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    type($<HTMLInputElement>('dialog input'), 'ben')
    expect($('dialog button[role="option"]').textContent).toBe('ben private')
  })
})
