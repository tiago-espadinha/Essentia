import type { Auth } from '@essentia/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDoc } from './documents'
import { fakeServer, type Row } from './fakeServer'
import { ShareDialog } from './ShareDialog'
import './testing'

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ANA: Auth = { status: 'signed-in', userId: 'ana', email: 'ana@example.com' }
const doc = { ...createDoc('', new Date('2022-10-25T09:00:00Z'), ID), title: 'Launch plan' }

let container: HTMLElement
let root: Root

async function open(client: SupabaseClient, { auth = ANA, onSync = vi.fn(async () => true) } = {}) {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  await act(async () => root.render(<ShareDialog doc={doc} auth={auth} client={client} onSync={onSync} onClose={() => {}} />))
  return onSync
}

function buttonNamed(name: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === name)
  if (!match) throw new Error(`No button named ${name}`)
  return match
}

/** The app's base path is /dictum/ (see share.test.ts); tests run at the root. */
const linkTo = (linkId: unknown) => `https://essentia.example${import.meta.env.BASE_URL}shared/${linkId}`

async function press(name: string) {
  await act(async () => buttonNamed(name).click())
}

const status = () => container.querySelector('[role="status"]')?.textContent
const link = () => container.querySelector<HTMLInputElement>('#share-url')?.value

/** The account with the document already synced. */
function withDocument(changes: Partial<Row> = {}) {
  const server = fakeServer()
  server.documents.push({ id: ID, user_id: 'ana', title: 'Launch plan', content: '', share_id: null, deleted_at: null, ...changes })
  return server
}

beforeEach(() => {
  vi.stubGlobal('location', new URL('https://essentia.example/'))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('ShareDialog', () => {
  it('asks a signed-out writer to sign in first', async () => {
    const server = fakeServer()
    await open(server.client(null).client, { auth: { status: 'signed-out' } })
    expect(container.querySelector('#auth-email')).not.toBeNull()
    expect(container.textContent).toContain('Sign in to share.')
    expect(container.querySelector('#share-url')).toBeNull()
  })

  it('syncs first, then creates a link under the app’s shared path and announces it', async () => {
    const server = withDocument()
    const onSync = await open(server.client({ user: { id: 'ana' } }).client)
    expect(onSync).toHaveBeenCalledOnce()
    expect(link()).toBeUndefined()

    await press('Create link')
    const linkId = server.documents[0].share_id
    expect(linkId).toMatch(/^[0-9a-f-]{36}$/)
    expect(link()).toBe(linkTo(linkId))
    expect(status()).toBe('Link created. Anyone with it can read this document.')
    expect(document.activeElement).toBe(container.querySelector('#share-url'))
  })

  it('opens on the existing link of a shared document', async () => {
    const server = withDocument({ share_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
    await open(server.client({ user: { id: 'ana' } }).client)
    expect(link()).toBe(linkTo('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
  })

  it('copies the link, and selects it when the browser refuses', async () => {
    const server = withDocument({ share_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    await open(server.client({ user: { id: 'ana' } }).client)

    await press('Copy link')
    expect(writeText).toHaveBeenCalledWith(link())
    expect(status()).toBe('Link copied.')

    writeText.mockRejectedValueOnce(new Error('denied'))
    await press('Copy link')
    expect(document.activeElement).toBe(container.querySelector('#share-url'))
    expect(status()).toContain('The link is selected')
  })

  it('stops sharing, so the old link stops working', async () => {
    const server = withDocument({ share_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
    await open(server.client({ user: { id: 'ana' } }).client)

    await press('Stop sharing')
    expect(server.documents[0].share_id).toBeNull()
    expect(link()).toBeUndefined()
    expect(document.activeElement).toBe(buttonNamed('Create link'))
    expect(status()).toBe('Sharing stopped. The old link no longer works.')
  })

  it('says so when the account cannot be reached, and tries again', async () => {
    const server = withDocument()
    const onSync = vi.fn(async () => false)
    await open(server.client({ user: { id: 'ana' } }).client, { onSync })
    expect(container.textContent).toContain('can’t be shared yet')
    expect(status()).toBe('')
    expect(document.activeElement?.textContent).toBe('Try again')

    onSync.mockResolvedValue(true)
    await press('Try again')
    expect(buttonNamed('Create link')).toBeTruthy()
  })

  it('keeps the link when creating it fails, with a message', async () => {
    const server = withDocument()
    await open(server.client({ user: { id: 'ana' } }).client)
    server.fail(true)
    await press('Create link')
    expect(link()).toBeUndefined()
    expect(status()).toBe('Couldn’t reach your account. Try again.')
    expect(container.querySelector('[role="status"]')?.hasAttribute('data-failed')).toBe(true)
  })

  it('explains that a document too large for the account cannot be shared, without syncing', async () => {
    const server = withDocument()
    const onSync = vi.fn(async () => true)
    container = document.body.appendChild(document.createElement('div'))
    root = createRoot(container)
    const big = { ...doc, tags: Array.from({ length: 51 }, (_, i) => `t${i}`) }
    await act(async () => root.render(<ShareDialog doc={big} auth={ANA} client={server.client({ user: { id: 'ana' } }).client} onSync={onSync} onClose={() => {}} />))
    expect(container.textContent).toContain('too large to keep in your account')
    expect(onSync).not.toHaveBeenCalled()
    expect(container.querySelector('button.share__primary')).toBeNull()
  })
})
