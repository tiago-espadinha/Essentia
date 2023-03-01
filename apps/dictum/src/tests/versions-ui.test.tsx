import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  $,
  buttonNamed,
  click,
  contentField,
  newDoc,
  reload,
  renderApp,
  rowTitles,
  savedDocs,
  setupApp,
  titleField,
  type,
} from './testing'

const savedVersions = () => JSON.parse(localStorage.getItem('essentia-dictum-versions') ?? '[]')
const versionRows = () => [...document.querySelectorAll('.version__excerpt')].map((element) => element.textContent)
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

describe('versions', () => {
  setupApp()

  it('saves a version once typing pauses for 30 seconds', () => {
    vi.useFakeTimers()
    renderApp()
    newDoc('Essay', 'First draft')
    wait(29_000)
    expect(savedVersions()).toEqual([])
    type(contentField(), 'Second draft')
    wait(29_000)
    expect(savedVersions()).toEqual([])
    wait(1_000)
    expect(savedVersions()).toMatchObject([{ title: 'Essay', content: 'Second draft' }])
  })

  it('saves the pending version of a document at once when another is edited', () => {
    vi.useFakeTimers()
    renderApp()
    newDoc('One', 'text one')
    newDoc('Two', 'text two')
    expect(savedVersions()).toMatchObject([{ title: 'One', content: 'text one' }])
  })

  it('lists versions newest first, saves one on request and restores one', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date('2022-10-10T09:00:00'))
    renderApp()
    newDoc('Essay', 'First draft')
    click(buttonNamed('Versions'))
    expect($('.versions__empty').textContent).toBe('No versions yet.')
    click(buttonNamed('Save this version'))
    expect(buttonNamed('This version is saved').disabled).toBe(true)
    click(buttonNamed('Close'))

    vi.setSystemTime(new Date('2022-10-10T09:05:00'))
    type(contentField(), 'Second draft')
    click(buttonNamed('Versions'))
    click(buttonNamed('Save this version'))
    expect(versionRows()).toEqual(['Second draft', 'First draft'])

    vi.setSystemTime(new Date('2022-10-10T09:10:00'))
    type(contentField(), 'Third draft, unsaved')
    click(buttonNamed('Restore the version from Oct 10, 9:00 AM'))
    expect(document.querySelector('dialog')).toBeNull()
    expect(contentField().value).toBe('First draft')
    expect(document.activeElement).toBe(buttonNamed('Versions'))
    // The text that was replaced is a version too, so the restore can be undone.
    click(buttonNamed('Versions'))
    expect(versionRows()).toEqual(['Third draft, unsaved', 'Second draft', 'First draft'])
  })

  it('keeps versions after a reload', () => {
    renderApp()
    newDoc('Essay', 'Draft')
    click(buttonNamed('Versions'))
    click(buttonNamed('Save this version'))
    reload()
    click(buttonNamed('Versions'))
    expect(versionRows()).toEqual(['Draft'])
  })
})

describe('deleting', () => {
  setupApp()

  it('deletes at once, opens the next document and offers an undo that brings back its versions', () => {
    renderApp()
    newDoc('Older', 'kept')
    newDoc('Newer', 'gone')
    click(buttonNamed('Versions'))
    click(buttonNamed('Save this version'))
    click(buttonNamed('Close'))

    click(buttonNamed('Delete'))
    expect(rowTitles()).toEqual(['Older'])
    expect(titleField().value).toBe('Older')
    expect(document.activeElement).toBe($('.doc-row'))
    expect($('.undo').textContent).toContain('Deleted “Newer” and its versions.')
    expect(savedDocs()).toHaveLength(1)
    expect(savedVersions().map((version: { content: string }) => version.content)).toEqual(['kept'])

    click(buttonNamed('Undo'))
    expect(rowTitles()).toEqual(['Newer', 'Older'])
    expect(titleField().value).toBe('Newer')
    expect($('.undo').textContent).toBe('')
    click(buttonNamed('Versions'))
    expect(versionRows()).toEqual(['gone'])
  })

  it('moves focus to New document when the last document in view goes', () => {
    renderApp()
    newDoc('Kept')
    newDoc('Draft')
    type($<HTMLInputElement>('#search'), 'Draft')
    click(buttonNamed('Delete'))
    expect(document.activeElement).toBe(buttonNamed('New document'))
  })

  it('shows the empty state after the last document goes', () => {
    renderApp()
    newDoc('Only')
    click(buttonNamed('Delete'))
    expect($('.empty__title').textContent).toBe('Nothing written yet.')
    expect($('.undo').textContent).toContain('Deleted “Only”')
  })
})

describe('saving', () => {
  setupApp()

  it('warns while the documents could not be saved, even when a later change saves versions', () => {
    renderApp()
    newDoc('Essay', 'Draft')
    const setItem = Storage.prototype.setItem
    const refuse = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === 'essentia-dictum-documents') throw new DOMException('full', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    type(contentField(), 'Draft, longer')
    expect($('.notice').textContent).toContain('Couldn’t save on this device.')
    click(buttonNamed('Versions'))
    click(buttonNamed('Save this version'))
    expect(document.querySelector('.notice')).not.toBeNull()
    refuse.mockRestore()
    type(contentField(), 'Draft, saved')
    expect(document.querySelector('.notice')).toBeNull()
  })
})

describe('export', () => {
  setupApp()

  it('downloads the markdown as a .md file named after the title', () => {
    const blobs: Blob[] = []
    vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => (blobs.push(blob), 'blob:doc'), revokeObjectURL: vi.fn() })
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe('Plan v2.md')
      expect(this.href).toBe('blob:doc')
    })
    renderApp()
    newDoc('Plan: v2?', '# Plan')
    click(buttonNamed('Export'))
    expect(clicked).toHaveBeenCalledOnce()
    expect(blobs[0].type).toBe('text/markdown')
  })
})
