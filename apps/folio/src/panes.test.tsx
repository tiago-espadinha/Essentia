import { beforeEach, describe, expect, it, vi } from 'vitest'
import { $, buttonNamed, click, newNote, renderApp, rowTitles, setupApp, type, unmount } from './testing'

setupApp()

function filterToggle() {
  return buttonNamed('Filter')
}

describe('the Filter bar (the Library below 1024 px)', () => {
  it('starts closed and opens on Filter', () => {
    renderApp()
    newNote('A')
    expect(filterToggle().getAttribute('aria-expanded')).toBe('false')
    expect($('#library').hasAttribute('data-open')).toBe(false)
    click(filterToggle())
    expect(filterToggle().getAttribute('aria-expanded')).toBe('true')
    expect($('#library').hasAttribute('data-open')).toBe(true)
  })

  it('stays open while a filter is active, and closing clears it', () => {
    renderApp()
    newNote('Apple')
    newNote('Pear')
    click(filterToggle())
    type($<HTMLInputElement>('#search'), 'app')
    expect(rowTitles()).toEqual(['Apple'])
    click(filterToggle())
    expect($('#library').hasAttribute('data-open')).toBe(false)
    expect($<HTMLInputElement>('#search').value).toBe('')
    expect(rowTitles()).toEqual(['Pear', 'Apple'])
  })

  it('is not offered before there are notes', () => {
    renderApp()
    expect(() => filterToggle()).toThrow()
  })
})

describe('one pane at a time on a phone', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(width < 768px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  })

  const view = () => $('main').dataset.view

  function renderAgain() {
    unmount()
    renderApp()
  }

  it('starts on the list, even with notes saved', () => {
    renderApp()
    newNote('A')
    renderAgain()
    expect(view()).toBe('list')
  })

  it('opens a note in the editor with its title focused', () => {
    renderApp()
    newNote('A')
    newNote('B')
    click(buttonNamed('Notes'))
    click(buttonNamed(/^A/))
    expect(view()).toBe('editor')
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('A')
    expect(document.activeElement).toBe($('#note-title'))
  })

  it('goes back to the list with focus on the note that was open', () => {
    renderApp()
    newNote('A')
    newNote('B')
    click(buttonNamed('Notes'))
    click(buttonNamed(/^A/))
    click(buttonNamed('Notes'))
    expect(view()).toBe('list')
    expect(document.activeElement).toBe(buttonNamed(/^A/))
  })

  it('opens a new note straight in the editor', () => {
    renderApp()
    click(buttonNamed('New note'))
    expect(view()).toBe('editor')
    expect(document.activeElement).toBe($('#note-title'))
  })

  it('returns to the list after a delete, on the next note', () => {
    renderApp()
    newNote('A')
    newNote('B')
    click(buttonNamed('Delete'))
    expect(view()).toBe('list')
    expect(document.activeElement).toBe(buttonNamed(/^A/))
  })
})

describe('opening a note on a wider screen', () => {
  it('leaves focus on the row, since the list stays in view', () => {
    renderApp()
    newNote('A')
    newNote('B')
    const row = buttonNamed(/^A/)
    row.focus()
    click(row)
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('A')
    expect(document.activeElement).toBe(row)
  })
})
