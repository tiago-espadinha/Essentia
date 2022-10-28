import axe from 'axe-core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account, fakeServer, settle } from './fakeServer'
import { SharedView } from './SharedView'
import { $, buttonNamed, click, newDoc, previewLoaded, renderApp, setupApp, type } from './testing'

vi.mock('@essentia/supabase', async (original) => {
  const { appClient } = await import('./fakeServer')
  return { ...(await original<typeof import('@essentia/supabase')>()), getSupabase: () => appClient }
})

setupApp()

let server: ReturnType<typeof fakeServer>
let signInAs: (id: string | null) => Promise<void>

beforeEach(() => {
  server = fakeServer()
  ;({ client: account.client, signInAs } = server.client(null))
})

// Moderate findings fail too; minor ones are best-practice notes. jsdom has no layout
// or computed colours, so contrast is checked in the browser by the design critique
// instead. The whole body, so open dialogs are included.
async function violations(): Promise<string[]> {
  const { violations } = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
  return violations
    .filter((violation) => violation.impact !== 'minor')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
}

const MARKDOWN = [
  '# Launch plan',
  'Some **bold**, a [link](https://example.com) and `code`.[^1]',
  '| Step | Owner |\n| --- | --- |\n| Draft | Ana |',
  '- [x] Outline\n- [ ] Edit',
  '> A quote',
  '```ts\nconst done = true\n```',
  '[^1]: A footnote.',
].join('\n\n')

/** Signs in with fake timers, then hands back real ones for axe. */
async function signedIn() {
  vi.useFakeTimers()
  renderApp()
  await signInAs('ana')
  vi.useRealTimers()
}

describe('accessibility', () => {
  it('has no violations in the empty state', async () => {
    renderApp()
    expect(await violations()).toEqual([])
  })

  it('has no violations while writing', async () => {
    renderApp()
    newDoc('Launch plan', MARKDOWN)
    expect(await violations()).toEqual([])
  })

  it('has no violations in the rendered preview', async () => {
    renderApp()
    newDoc('Launch plan', MARKDOWN)
    click(buttonNamed('Preview'))
    await previewLoaded()
    expect(await violations()).toEqual([])
  })

  it('has no violations when a search matches nothing', async () => {
    renderApp()
    newDoc('Launch plan')
    type($<HTMLInputElement>('#search'), 'swim')
    expect(await violations()).toEqual([])
  })

  it('has no violations in the versions dialog, empty and with versions', async () => {
    renderApp()
    newDoc('Launch plan', 'First draft')
    click(buttonNamed('Versions'))
    expect(await violations()).toEqual([])
    click(buttonNamed('Save this version'))
    expect(await violations()).toEqual([])
  })

  it('has no violations with the undo notice shown', async () => {
    renderApp()
    newDoc('Gone')
    click(buttonNamed('Delete'))
    expect(await violations()).toEqual([])
  })

  it('has no violations on a phone, in the list and in a document', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    renderApp()
    newDoc('Launch plan', 'Text')
    expect(await violations()).toEqual([])
    click(buttonNamed('Documents'))
    expect(await violations()).toEqual([])
  })

  it('has no violations in the sign-in and share dialogs while signed out', async () => {
    renderApp()
    await act(async () => {})
    newDoc('Launch plan')
    click(buttonNamed('Sign in'))
    expect(await violations()).toEqual([])
    click(buttonNamed('Close'))
    click(buttonNamed('Share'))
    expect(await violations()).toEqual([])
  })

  it('has no violations in the account and share dialogs while signed in', async () => {
    await signedIn()
    newDoc('Launch plan', 'Text')
    click(buttonNamed('Account'))
    expect(await violations()).toEqual([])
    click(buttonNamed('Close'))
    await act(async () => buttonNamed('Share').click())
    expect(await violations()).toEqual([])
    await act(async () => buttonNamed('Create link').click())
    expect(buttonNamed('Copy link')).toBeTruthy()
    expect(await violations()).toEqual([])
  })

  it('has no violations with the sync failure shown', async () => {
    await signedIn()
    vi.useFakeTimers()
    server.fail(true)
    newDoc('Launch plan')
    await settle()
    vi.useRealTimers()
    expect(buttonNamed('Try again')).toBeTruthy()
    expect(await violations()).toEqual([])
  })
})

describe('accessibility of a shared link', () => {
  async function openShared(linkId: string) {
    const root = createRoot(document.body.appendChild(document.createElement('div')))
    await act(async () => root.render(<SharedView linkId={linkId} client={account.client} />))
    await previewLoaded()
    return () => act(() => root.unmount())
  }

  it('has no violations in the reading view or for a link that is not shared', async () => {
    const link = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    server.documents.push({ id: 'a', user_id: 'ana', title: 'Launch plan', content: MARKDOWN, updated_at: '2022-10-25T09:00:00.000Z', share_id: link, deleted_at: null })
    let close = await openShared(link)
    expect(document.querySelector('h1')?.textContent).toBe('Launch plan')
    expect(await violations()).toEqual([])
    close()

    close = await openShared('cccccccc-cccc-4ccc-8ccc-cccccccccccc')
    expect(document.querySelector('h1')?.textContent).toBe('This document isn’t shared any more.')
    expect(await violations()).toEqual([])
    close()
  })
})
