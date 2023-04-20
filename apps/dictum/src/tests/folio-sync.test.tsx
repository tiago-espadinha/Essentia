import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MOVED_KEY } from '../data/storage'
import { account, fakeServer, settle } from './fakeServer'
import { buttonNamed, newDoc, renderApp, rowTitles, setupApp } from './testing'

vi.mock('@essentia/supabase', async (original) => {
  const { appClient } = await import('./fakeServer')
  return { ...(await original<typeof import('@essentia/supabase')>()), getSupabase: () => appClient }
})

setupApp()

let server: ReturnType<typeof fakeServer>
let device: ReturnType<ReturnType<typeof fakeServer>['client']>

const row = (id: string, title: string, format: string) => ({
  id, user_id: 'ana', format, title, content: format === 'rich' ? `<p>${title}</p>` : `# ${title}`, folder: '', tags: [],
  created_at: '2022-10-20T09:00:00.000Z', updated_at: '2022-10-20T09:00:00.000Z', deleted_at: null,
})

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2022-10-28T09:00:00Z') })
  server = fakeServer()
  device = server.client(null)
  account.client = device.client
})

describe('Dictum beside Folio', () => {
  it('never shows, edits or sends back a rich note from Folio', async () => {
    server.documents.push(row('16fd2706-8baf-433b-82eb-8c7fada847da', 'Rich', 'rich'), row('886313e1-3b8a-4372-9b90-0c9aee199e5d', 'Plain', 'markdown'))
    renderApp()
    await settle()
    await device.signInAs('ana')
    expect(rowTitles()).toEqual(['Plain'])
    newDoc('Another')
    await settle()
    expect(server.documents.find((r) => r.title === 'Rich')).toMatchObject({ content: '<p>Rich</p>', format: 'rich' })
  })

  it('stops syncing an account once Folio has taken it over, writes nothing new, and says so', async () => {
    localStorage.setItem(MOVED_KEY, JSON.stringify({ schema: 1, imported: {}, moved: [], accounts: ['ana'], skipped: { folio: 0, dictum: 0 } }))
    server.documents.push(row('886313e1-3b8a-4372-9b90-0c9aee199e5d', 'Plain', 'markdown'))
    const app = renderApp()
    await settle()
    await device.signInAs('ana')
    expect(server.calls.upserts).toBe(0)
    expect(rowTitles()).toEqual([])
    expect([...app.querySelectorAll('button')].some((button) => button.textContent?.includes('New document'))).toBe(false)
    expect(app.querySelector('.empty__title')?.textContent).toBe('Your documents are in Folio now.')
    expect(app.querySelector<HTMLAnchorElement>('.empty a')?.getAttribute('href')).toBe('/folio/')

    await settle(() => buttonNamed(/account/i).click())
    expect(document.querySelector('dialog[open]')?.textContent).toContain('Your documents now sync in Folio.')
  })
})
