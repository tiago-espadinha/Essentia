import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '@essentia/ui'
import { fakeServer, type Row } from './fakeServer'
import { SharedView } from '../components/SharedView'
import { readSharePath, shareUrl } from '../domain/share'
import './testing'

const LINK = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const HOSTILE = '<p>Hello</p><script>window.hacked = 1</script><img src="x" onerror="window.hacked = 1"><iframe src="https://example.com"></iframe><a href="javascript:alert(1)">link</a><p style="color:red" onclick="x()">Styled</p>'

let container: HTMLElement
let root: Root

async function open(element: ReactNode) {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  await act(async () => root.render(element))
  // The rendered markdown is loaded on its own.
  await act(() => import('../components/Preview'))
}

function serverWith(changes: Partial<Row> = {}) {
  const server = fakeServer()
  server.tables.documents.push({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user_id: 'ana',
    format: 'rich',
    title: 'Launch plan',
    content: '<h2>Goals</h2><p>Ship <strong>it</strong>.</p>',
    folder: 'Private folder',
    tags: ['secret-tag'],
    pinned: true,
    updated_at: '2023-04-21T09:00:00.000Z',
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
const dangerous = () => container.querySelectorAll('script, iframe, img, [onerror], [onclick], [style], a[href^="javascript"]')

afterEach(() => {
  if (container?.isConnected) close()
  document.documentElement.lang = 'en-GB'
  vi.restoreAllMocks()
})

describe('SharedView', () => {
  it('shows a rich note’s title, date and formatting to a signed-out reader, and nothing else', async () => {
    const server = serverWith()
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(heading()).toBe('Launch plan')
    expect(container.querySelector('.shared__body h2')?.textContent).toBe('Goals')
    expect(container.querySelector('.shared__body strong')?.textContent).toBe('it')
    expect(container.textContent).toContain('Updated 21 Apr 2023')
    expect(container.textContent).not.toContain('Private folder')
    expect(container.textContent).not.toContain('secret-tag')
    expect(container.querySelector('textarea, input, [contenteditable="true"]')).toBeNull()
    expect(document.title).toBe('Launch plan · Folio')
  })

  it('cleans a rich body of scripts, handlers, frames, styles and unsafe links, whoever wrote it', async () => {
    const server = serverWith({ content: HOSTILE })
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(container.textContent).toContain('Hello')
    expect(container.textContent).toContain('Styled')
    expect(dangerous()).toHaveLength(0)
    expect(container.querySelector('.shared__body a')).toBeNull()
    expect((window as { hacked?: number }).hacked).toBeUndefined()
  })

  it('shows a markdown note’s raw HTML as text, and titles the page from its own heading', async () => {
    const server = serverWith({ format: 'markdown', content: `# Goals\n\n${HOSTILE}\n\n[bad](javascript:alert(1))` })
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(heading()).toBe('Goals')
    expect(container.querySelector('.prose')?.textContent).toContain('<script>')
    expect(dangerous()).toHaveLength(0)
  })

  it('shows a markdown image as a link, so opening the note loads nothing from elsewhere', async () => {
    const server = serverWith({ format: 'markdown', content: 'Look: ![The chart](https://tracker.example/pixel.png)' })
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(container.querySelector('img')).toBeNull()
    const link = container.querySelector<HTMLAnchorElement>('.prose a')!
    expect(link.textContent).toBe('The chart')
    expect(link.getAttribute('href')).toBe('https://tracker.example/pixel.png')
    expect(link.rel).toBe('noopener noreferrer')
  })

  it('reads a body as markdown unless the reply says it is rich, as before the format was returned', async () => {
    for (const format of [undefined, null, 'html']) {
      const server = serverWith({ format })
      await open(<SharedView linkId={LINK} client={server.client(null).client} />)
      expect(container.querySelector('.shared__body')).toBeNull()
      expect(container.querySelector('.prose')?.textContent).toContain('<h2>Goals</h2>')
      close()
    }
  })

  it('says a stopped or deleted share is not shared any more, with a way to the hub', async () => {
    for (const changes of [{ share_id: null }, { deleted_at: '2023-04-21T10:00:00.000Z' }]) {
      const server = serverWith(changes)
      await open(<SharedView linkId={LINK} client={server.client(null).client} />)
      expect(heading()).toBe('This note isn’t shared any more.')
      expect(container.querySelector('main a')?.getAttribute('href')).toBe('/')
      close()
    }
  })

  it('says the same for a malformed link, or without a project, without asking the server', async () => {
    const server = serverWith()
    const client = server.client(null).client
    const rpc = vi.spyOn(client, 'rpc')
    await open(<SharedView linkId={null} client={client} />)
    expect(heading()).toBe('This note isn’t shared any more.')
    expect(rpc).not.toHaveBeenCalled()
    close()

    await open(<SharedView linkId={LINK} client={null} />)
    expect(heading()).toBe('This note isn’t shared any more.')
  })

  it('ignores a reply it cannot trust', async () => {
    const server = serverWith()
    const client = server.client(null).client
    vi.spyOn(client, 'rpc').mockResolvedValue({ data: [{ title: 1, content: null }], error: null } as never)
    await open(<SharedView linkId={LINK} client={client} />)
    expect(heading()).toBe('This note isn’t shared any more.')
  })

  it('offers to try again, in Portuguese too, asking only for the link', async () => {
    const server = serverWith()
    server.fail(true)
    await open(<SharedView linkId={LINK} client={server.client(null).client} />)
    expect(heading()).toBe('Couldn’t load this note.')
    act(() => { setLocale('pt-PT') })
    expect(heading()).toBe('Não foi possível carregar esta nota.')
    expect(document.title).toBe('Nota partilhada · Folio')

    server.fail(false)
    await act(async () => container.querySelector<HTMLButtonElement>('main button')!.click())
    expect(heading()).toBe('Launch plan')
    expect(container.textContent).toContain('Atualizada em 21/04/2023')
    expect(server.calls.rpcs.map((call) => call.args)).toEqual([{ link_id: LINK }, { link_id: LINK }])
  })
})

describe('share links', () => {
  it('are made under Folio', () => {
    expect(shareUrl(LINK, '/folio/', 'https://essentia.example')).toBe(`https://essentia.example/folio/shared/${LINK}`)
  })

  it('open from Folio’s path and from Dictum’s older one, and nowhere else', () => {
    expect(readSharePath(`/folio/shared/${LINK}`)).toEqual({ id: LINK })
    expect(readSharePath(`/dictum/shared/${LINK.toUpperCase()}/`)).toEqual({ id: LINK })
    for (const junk of ['/folio/shared/', '/folio/shared/not-a-link', `/folio/shared/../${LINK}`, `/folio/shared/${LINK}/x`]) {
      expect(readSharePath(junk), junk).toEqual({ id: null })
    }
    for (const other of ['/folio/', '/dictum/', `/acta/shared/${LINK}`]) expect(readSharePath(other), other).toBeNull()
  })
})
