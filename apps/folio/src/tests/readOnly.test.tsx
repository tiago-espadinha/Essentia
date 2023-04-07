import { describe, expect, it, vi } from 'vitest'
import { $, buttonNamed, click, renderApp, rowTitles, setupApp } from './testing'

const stamp = '2023-01-12T10:30:00.000Z'
const folioNotes = JSON.stringify([
  { id: '1b4e28ba-2fa1-4d2a-883f-0016d3cca427', title: 'Groceries', body: '<p>Milk</p>', tags: [], pinned: false, createdAt: stamp, updatedAt: stamp },
])

function refuseNotes() {
  const setItem = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (key === 'essentia-notes') throw new DOMException('Quota exceeded', 'QuotaExceededError')
    setItem.call(this, key, value)
  })
}

describe('notes that cannot be stored on this device', () => {
  setupApp()

  it('shows them read-only with an alert, and offers no way to change them', () => {
    localStorage.setItem('essentia-folio-notes', folioNotes)
    refuseNotes()
    const app = renderApp()
    expect($('[role="alert"]').textContent).toContain('Nothing is lost')
    expect(rowTitles()).toEqual(['Groceries'])
    expect($<HTMLTextAreaElement>('#note-title').readOnly).toBe(true)
    expect($('.editor__format').textContent).toBe('Read-only')
    expect($('.editor__body').getAttribute('contenteditable')).toBe('false')
    expect($<HTMLInputElement>('.tags-field__input').readOnly).toBe(true)
    expect(() => buttonNamed('New note')).toThrow()
    expect(app.querySelector('.pin-button')).toBeNull()
    expect(app.querySelector('.toolbar')).toBeNull()
    expect(localStorage.getItem('essentia-folio-notes')).toBe(folioNotes)
    expect(localStorage.getItem('essentia-notes-migration')).toBeNull()
  })

  it('exports every note as one JSON file', async () => {
    localStorage.setItem('essentia-folio-notes', folioNotes)
    refuseNotes()
    const blobs: Blob[] = []
    vi.stubGlobal('URL', { createObjectURL: (blob: Blob) => (blobs.push(blob), 'blob:x'), revokeObjectURL: vi.fn() })
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderApp()
    click(buttonNamed('Export all'))
    expect(clicked).toHaveBeenCalledOnce()
    const saved = JSON.parse(await blobs[0].text())
    expect(saved.notes).toMatchObject([{ title: 'Groceries', body: '<p>Milk</p>', format: 'rich' }])
    expect(saved.versions).toEqual([])
  })

  it('opens normally once storage works again', () => {
    localStorage.setItem('essentia-folio-notes', folioNotes)
    const app = renderApp()
    expect(app.querySelector('.read-only')).toBeNull()
    expect(buttonNamed('New note')).toBeTruthy()
  })
})
