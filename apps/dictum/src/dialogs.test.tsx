import { beforeEach, describe, expect, it, vi } from 'vitest'
import { account, fakeServer, settle } from './fakeServer'
import { buttonNamed, click, newDoc, renderApp, rowTitles, setupApp, titleField } from './testing'

vi.mock('@essentia/supabase', async (original) => {
  const { appClient } = await import('./fakeServer')
  return { ...(await original<typeof import('@essentia/supabase')>()), getSupabase: () => appClient }
})

setupApp()

let server: ReturnType<typeof fakeServer>

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2022-10-28T09:00:00Z') })
  server = fakeServer()
  const device = server.client(null)
  account.client = device.client
  renderApp()
  await device.signInAs('ana')
})

/** Deletes a document on another device, then brings this page back into view. */
async function deletedElsewhere(title: string) {
  const row = server.documents.find((existing) => existing.title === title)!
  Object.assign(row, { deleted_at: '2022-10-28T10:00:00.000Z', updated_at: '2022-10-28T10:00:00.000Z' })
  await settle(() => document.dispatchEvent(new Event('visibilitychange')))
}

describe('a dialog whose document a sync removes', () => {
  it.each(['Versions', 'Share'])('closes the %s dialog rather than turn to another document', async (dialog) => {
    newDoc('Kept')
    newDoc('Gone')
    await settle()
    await settle(() => buttonNamed(dialog).click())
    expect(document.querySelector('dialog[open]')).not.toBeNull()

    await deletedElsewhere('Gone')
    expect(rowTitles()).toEqual(['Kept'])
    expect(document.querySelector('dialog')).toBeNull()
    expect(titleField().value).toBe('Kept')
    // Focus goes back to the same control, now on the document that opened.
    expect(document.activeElement).toBe(buttonNamed(dialog))
  })

  it('leaves a dialog open for a document the sync keeps', async () => {
    newDoc('Kept')
    newDoc('Gone')
    await settle()
    click(buttonNamed('Versions'))
    await deletedElsewhere('Kept')
    expect(rowTitles()).toEqual(['Gone'])
    expect(document.querySelector('dialog[open] h2')?.textContent).toBe('Versions')
  })
})
