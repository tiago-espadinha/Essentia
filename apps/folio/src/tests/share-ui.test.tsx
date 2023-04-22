import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account, fakeServer, settle } from './fakeServer'
import { buttonNamed, click, newNote, renderApp, rowNamed, rowTitles, setupApp } from './testing'

const stored = vi.hoisted(() => ({ id: null as string | null }))
vi.mock('@essentia/supabase', async (original) => {
  const { appClient } = await import('./fakeServer')
  return { ...(await original<typeof import('@essentia/supabase')>()), getSupabase: () => appClient, storedUserId: () => stored.id }
})

setupApp()

let server: ReturnType<typeof fakeServer>

/** Folio on a device signed in as `user`, or signed out, with one note written. */
async function start(user: string | null) {
  vi.useFakeTimers({ now: new Date('2023-04-21T09:00:00Z') })
  stored.id = user
  server = fakeServer()
  account.client = server.client(user ? { user: { id: user, email: `${user}@example.com` } } : null).client
  renderApp()
  await settle()
  newNote('Plan')
  await settle()
}

const dialog = () => document.querySelector<HTMLDialogElement>('dialog[open]')
const row = () => server.tables.documents.find((r) => r.title === 'Plan')!
const readLink = async (linkId: string) =>
  (await server.client(null).client.rpc('get_shared_document', { link_id: linkId })).data as unknown[]

const closeDialog = () => act(() => dialog()!.dispatchEvent(new Event('close')))

async function share() {
  click(buttonNamed('Share'))
  await settle()
  click(buttonNamed('Create link'))
  await settle()
}

describe('sharing a note', () => {
  beforeEach(() => start('ana'))

  it('makes a Folio link from the account’s copy, and stops it', async () => {
    await share()
    const linkId = row().share_id as string
    expect(document.querySelector<HTMLInputElement>('#share-url')?.value).toBe(`${location.origin}/folio/shared/${linkId}`)
    expect(dialog()?.textContent).toContain('Link created. Anyone with it can read this note.')
    expect(await readLink(linkId)).toEqual([expect.objectContaining({ title: 'Plan', format: 'rich' })])

    click(buttonNamed('Stop sharing'))
    await settle()
    expect(row().share_id).toBeNull()
    expect(await readLink(linkId)).toEqual([])
    expect(buttonNamed('Create link')).toBeTruthy()
  })

  it('deletes a note that is not shared at once, without asking', async () => {
    click(buttonNamed('Delete'))
    expect(dialog()).toBeNull()
    expect(rowTitles()).toEqual([])
  })

  it('asks before deleting a shared note, and keeps it on Cancel', async () => {
    await share()
    closeDialog()
    click(buttonNamed('Delete'))
    expect(dialog()?.querySelector('h2')?.textContent).toBe('Delete “Plan”?')
    expect(dialog()?.textContent).toContain('Anyone with the link will lose access.')

    click(buttonNamed('Cancel'))
    expect(dialog()).toBeNull()
    expect(rowTitles()).toEqual(['Plan'])
  })

  it('stops the link on delete, brings it back on undo, and lets sharing stop there', async () => {
    await share()
    const linkId = row().share_id as string
    closeDialog()
    click(buttonNamed('Delete'))
    click(buttonNamed('Delete note'))
    await settle()
    expect(rowTitles()).toEqual([])
    // As for any delete, focus goes to the list, here its New note button.
    expect(document.activeElement?.textContent).toBe('New note')
    expect(await readLink(linkId)).toEqual([])

    click(buttonNamed('Undo'))
    await settle()
    expect(rowTitles()).toEqual(['Plan'])
    expect(await readLink(linkId)).toHaveLength(1)
    expect(document.querySelector('.link-notice')?.textContent).toContain('The share link for “Plan” works again.')

    click(buttonNamed('Stop sharing'))
    await settle()
    expect(row().share_id).toBeNull()
    expect(document.querySelector('.link-notice')?.textContent).toBe('Sharing stopped. The old link no longer works.')
    click(buttonNamed('Delete'))
    expect(dialog()).toBeNull()
  })

  it('drops the link notice once another note opens, or sharing stops elsewhere', async () => {
    await share()
    closeDialog()
    click(buttonNamed('Delete'))
    click(buttonNamed('Delete note'))
    await settle()
    click(buttonNamed('Undo'))
    await settle()
    newNote('Other')
    await settle()
    click(rowNamed('Plan'))
    expect(document.querySelector('.link-notice')).toBeNull()

    click(buttonNamed('Delete'))
    click(buttonNamed('Delete note'))
    await settle()
    click(buttonNamed('Undo'))
    await settle()
    expect(document.querySelector('.link-notice')).not.toBeNull()
    click(buttonNamed('Share'))
    await settle()
    click(dialog()!.querySelector<HTMLButtonElement>('.button-ghost--danger')!)
    await settle()
    expect(row().share_id).toBeNull()
    expect(document.querySelector('.link-notice')).toBeNull()
  })

  it('says so when the account cannot be reached, and tries again', async () => {
    server.fail(true)
    click(buttonNamed('Share'))
    await settle()
    expect(dialog()?.textContent).toContain('Couldn’t reach your account, so this note can’t be shared yet.')
    server.fail(false)
    click(dialog()!.querySelector<HTMLButtonElement>('.share__primary')!)
    await settle()
    expect(buttonNamed('Create link')).toBeTruthy()
  })
})

describe('sharing while signed out', () => {
  beforeEach(() => start(null))

  it('asks to sign in first, and makes no link', async () => {
    click(buttonNamed('Share'))
    await settle()
    expect(dialog()?.textContent).toContain('Sign in to share. A shared note is read from your account.')
    expect(server.calls.rpcs).toEqual([])
  })
})
