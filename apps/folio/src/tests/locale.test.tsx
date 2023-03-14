import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '@essentia/ui'
import { formatDate } from '../domain/notes'
import { $, buttonNamed, click, renderApp, rowTitles, savedNotes, setupApp, type, writeBody } from './testing'

describe('Folio locale', () => {
  setupApp()
  afterEach(() => { document.documentElement.lang = 'en-GB' })

  it('creates, edits, deletes and restores a note in Portuguese without translating its content', () => {
    setLocale('pt-PT')
    const app = renderApp()
    expect(app.textContent).toContain('Ainda não há notas.')
    click(buttonNamed('Nova nota'))
    expect(rowTitles()).toEqual(['Sem título'])
    expect(savedNotes()[0].title).toBe('')
    type($<HTMLTextAreaElement>('#note-title'), 'My original title')
    writeBody('<p>My original words</p>')
    expect(app.textContent).toContain('3 palavras')
    click(buttonNamed('Eliminar'))
    expect(app.textContent).toContain('“My original title” eliminada.')
    click(buttonNamed('Anular'))
    expect(rowTitles()).toEqual(['My original title'])
    expect(savedNotes()[0]).toMatchObject({ title: 'My original title', body: '<p>My original words</p>' })
  })

  it('switches controls and existing feedback while preserving the editor, selection and tag draft', () => {
    const app = renderApp()
    click(buttonNamed('New note'))
    type($<HTMLTextAreaElement>('#note-title'), 'English title')
    writeBody('<p>Untouched body</p>')
    const tags = $<HTMLInputElement>('.tags-field__input')
    type(tags, 'unsaved, draft')
    tags.focus()
    tags.setSelectionRange(2, 5)
    const body = $('.editor__body')
    const saved = savedNotes()

    act(() => { setLocale('pt-PT') })
    expect(document.title).toBe('Folio · As suas notas · Essentia')
    expect(buttonNamed('Eliminar')).toBeTruthy()
    expect(document.activeElement).toBe(tags)
    expect(tags.value).toBe('unsaved, draft')
    expect([tags.selectionStart, tags.selectionEnd]).toEqual([2, 5])
    expect($('.editor__body')).toBe(body)
    expect(body.innerHTML).toBe('<p>Untouched body</p>')
    expect(savedNotes()).toEqual(saved)

    click(buttonNamed('Eliminar'))
    expect(app.textContent).toContain('“English title” eliminada.')
    act(() => { setLocale('en-GB') })
    expect(app.textContent).toContain('Deleted “English title”.')
    click(buttonNamed('Undo'))
    expect(rowTitles()).toEqual(['English title'])
  })

  it('retranslates an existing failed-save notice without attempting another save', () => {
    const app = renderApp()
    click(buttonNamed('New note'))
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('full') })
    type($<HTMLTextAreaElement>('#note-title'), 'Keep me')
    expect(app.textContent).toContain('Couldn’t save on this device.')
    act(() => { setLocale('pt-PT') })
    expect(app.textContent).toContain('Não foi possível guardar neste dispositivo.')
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('Keep me')
    // The second attempted write is only the locale preference, never the note.
    expect(save.mock.calls.map(([key]) => key)).toEqual(['essentia-folio-notes', 'essentia-locale'])
  })

  it('uses UK and Portugal display dates without changing the ISO timestamp', () => {
    const stamp = '2022-06-20T12:00:00Z'
    setLocale('en-GB')
    expect(formatDate(stamp)).toBe('20 Jun 2022')
    setLocale('pt-PT')
    expect(formatDate(stamp)).toBe('20/06/2022')
    expect(stamp).toBe('2022-06-20T12:00:00Z')
  })
})
