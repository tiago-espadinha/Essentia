import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NOTES_KEY, VERSIONS_KEY } from '../data/storage'
import { $, buttonNamed, click, newNote, renderApp, savedNotes, setupApp, type, writeBody } from './testing'

const savedVersions = () => JSON.parse(localStorage.getItem(VERSIONS_KEY) ?? '[]')
const dialogLines = () => [...document.querySelectorAll('dialog[open] .convert p')].map((p) => p.textContent)
const original = '<h1>Plan</h1><p>an <u>underlined</u> <strong>word</strong></p>'

describe('converting a note in Folio', () => {
  setupApp()

  it('asks first, naming only the losses that apply, and changes nothing on Cancel', () => {
    renderApp()
    newNote('Plan')
    writeBody(original)
    click(buttonNamed('Convert to markdown'))
    expect(document.querySelector('#convert-title')?.textContent).toBe('Convert to markdown?')
    expect(dialogLines()).toEqual([
      'Folio saves this version first; restore it any time from Versions.',
      'Headings, lists, quotes, bold and italic carry over.',
      'Underline is removed.',
    ])
    click(buttonNamed('Cancel'))
    expect(document.querySelector('dialog[open]')).toBeNull()
    expect(savedNotes()[0]).toMatchObject({ format: 'rich', body: original })
    expect(savedVersions()).toEqual([])
  })

  it('converts after saving a version, and restoring that version undoes it exactly', () => {
    renderApp()
    newNote('Plan')
    writeBody(original)
    click(buttonNamed('Convert to markdown'))
    click(buttonNamed('Convert'))
    expect(savedNotes()[0]).toMatchObject({ format: 'markdown', body: '# Plan\n\nan underlined **word**' })
    expect($<HTMLTextAreaElement>('#note-source').value).toBe('# Plan\n\nan underlined **word**')
    expect(savedVersions()).toMatchObject([{ format: 'rich', body: original, title: 'Plan' }])

    click(buttonNamed('Versions'))
    click(buttonNamed(/^Restore the version from/))
    expect(savedNotes()[0]).toMatchObject({ format: 'rich', body: original, title: 'Plan' })
    expect($('.editor__body').innerHTML).toBe(original)
  })

  it('names what stays as text going to rich text, or says nothing is lost', () => {
    renderApp()
    newNote('Notes')
    click(buttonNamed('Convert to markdown'))
    expect(dialogLines().at(-1)).toBe('Nothing is lost.')
    click(buttonNamed('Convert'))
    type($<HTMLTextAreaElement>('#note-source'), '### Deep\n\nSee [docs](https://example.com) and `code`.')
    click(buttonNamed('Convert to rich text'))
    expect(dialogLines().slice(2)).toEqual([
      'Code and links stay as text, with their markdown symbols.',
      'Headings below level 2 become level 2.',
    ])
    click(buttonNamed('Convert'))
    expect(savedNotes()[0]).toMatchObject({
      format: 'rich',
      body: '<h2>Deep</h2><p>See [docs](https://example.com) and `code`.</p>',
    })
  })

  it('leaves the note as it was when its version cannot be saved first', () => {
    renderApp()
    newNote('Plan')
    writeBody(original)
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === VERSIONS_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    // A second try must not take the refused version as saved.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      click(buttonNamed('Convert to markdown'))
      click(buttonNamed('Convert'))
    }
    expect(savedNotes()[0]).toMatchObject({ format: 'rich', body: original })
    expect($('.editor__body').innerHTML).toBe(original)
    expect($('[role="alert"]').textContent).toContain('Couldn’t save on this device')
  })

  it('shows the converted body when another tab converts the open note', () => {
    renderApp()
    newNote('Plan')
    click(buttonNamed('Convert to markdown'))
    click(buttonNamed('Convert'))
    type($<HTMLTextAreaElement>('#note-source'), '**bold**')
    act(() => {
      localStorage.setItem(NOTES_KEY, JSON.stringify([{ ...savedNotes()[0], format: 'rich', body: '<p><strong>bold</strong></p>' }]))
      window.dispatchEvent(new StorageEvent('storage', { key: NOTES_KEY }))
    })
    expect($('.editor__body').innerHTML).toBe('<p><strong>bold</strong></p>')
  })
})
