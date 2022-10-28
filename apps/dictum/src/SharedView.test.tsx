import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeServer, type Row } from './fakeServer'
import { SharedView } from './SharedView'
import './testing'

const LINK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

let container: HTMLElement
let root: Root

async function open(element: ReactNode) {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  await act(async () => root.render(element))
  // The rendered markdown is loaded on its own.
  await act(() => import('./Preview'))
}

function serverWith(changes: Partial<Row> = {}) {
  const server = fakeServer()
  server.documents.push({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user_id: 'ana',
    title: 'Launch plan',
    content: '# Goals\n\nShip it.',
    folder: 'Private folder',
    tags: ['secret-tag'],
    updated_at: '2022-10-25T09:00:00.000Z',
    share_id: LINK,
    deleted_at: null,
    ...changes,
  })
  return server
}

function close() {
  act(() => root.unmount())
  container.remove()
}

const heading = () => container.querySelector('h1')?.textContent

afterEach(() => {
  if (container?.isConnected) close()
  vi.restoreAllMocks()
})

describe('SharedView', () => {
  it('shows the shared title, date and rendered text to a signed-out reader, and nothing else', async () => {
    const server = serverWith()
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(heading()).toBe('Goals')
    expect(container.textContent).toContain('Updated Oct 25, 2022')
    expect(container.textContent).not.toContain('Private folder')
    expect(container.textContent).not.toContain('secret-tag')
    expect(container.querySelector('textarea, input')).toBeNull()
    expect(document.title).toBe('Launch plan · Dictum')
  })

  it('titles the page from the document when its text has no heading of its own', async () => {
    const server = serverWith({ content: 'Just a paragraph.' })
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(heading()).toBe('Launch plan')
  })

  it('says a stopped or deleted share is not shared any more, with a way to the hub', async () => {
    for (const changes of [{ share_id: null }, { deleted_at: '2022-10-26T09:00:00.000Z' }]) {
      const server = serverWith(changes)
      await open(<SharedView linkId={LINK} client={server.client(null).client} />)
      expect(heading()).toBe('This document isn’t shared any more.')
      expect(container.querySelector('main a')?.getAttribute('href')).toBe('/')
      close()
    }
  })

  it('says the same for a malformed link, or without a project, without asking the server', async () => {
    const server = serverWith()
    const client = server.client(null).client
    const rpc = vi.spyOn(client, 'rpc')
    await open(<SharedView linkId={null} client={client} />)
    expect(heading()).toBe('This document isn’t shared any more.')
    expect(rpc).not.toHaveBeenCalled()
    close()

    await open(<SharedView linkId={LINK} client={null} />)
    expect(heading()).toBe('This document isn’t shared any more.')
  })

  it('offers to try again when the server cannot be reached', async () => {
    const server = serverWith()
    server.fail(true)
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(heading()).toBe('Couldn’t load this document.')

    server.fail(false)
    await act(async () => container.querySelector<HTMLButtonElement>('main button')!.click())
    expect(heading()).toBe('Goals')
  })

  it('ignores a reply it cannot trust', async () => {
    const server = serverWith()
    const client = server.client(null).client
    vi.spyOn(client, 'rpc').mockResolvedValue({ data: [{ title: 1, content: null }], error: null } as never)
    await open(<SharedView linkId={LINK} client={client} />)
    expect(heading()).toBe('This document isn’t shared any more.')
  })
})
