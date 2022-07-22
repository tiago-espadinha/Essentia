import { act } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  $,
  blur,
  buttonNamed,
  click,
  newNote,
  renderApp,
  rowTitles,
  savedNotes,
  setupApp,
  type,
  unmount,
  writeBody,
} from './testing'

setupApp()

describe('first use', () => {
  it('shows the empty library with one way to start', () => {
    const app = renderApp()
    expect(app.querySelector('.empty__title')?.textContent).toBe('No notes yet.')
    expect([...app.querySelectorAll('button')].filter((b) => b.textContent?.includes('New note'))).toHaveLength(1)
    expect(app.querySelector('.editor')).toBeNull()
  })
})

describe('creating notes', () => {
  it('adds a blank note at the top, opens it and focuses the title', () => {
    renderApp()
    newNote('First')
    newNote()
    expect(rowTitles()).toEqual(['Untitled', 'First'])
    expect(document.activeElement).toBe($('#note-title'))
    expect($('.note-row[aria-current="true"]').textContent).toContain('Untitled')
    expect(savedNotes()).toHaveLength(2)
  })
})

describe('editing notes', () => {
  it('saves the title, body and tags, and restores them after a reload', () => {
    renderApp()
    newNote('Roadmap')
    writeBody('<h2>Phase one</h2><p>Keep it calm.</p>')
    const tags = $<HTMLInputElement>('.tags-field__input')
    type(tags, 'Work, #planning, work')
    blur(tags)
    expect(tags.value).toBe('work, planning')

    unmount()
    renderApp()
    expect(rowTitles()).toEqual(['Roadmap'])
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('Roadmap')
    expect($('.editor__body').innerHTML).toBe('<h2>Phase one</h2><p>Keep it calm.</p>')
    expect($<HTMLInputElement>('.tags-field__input').value).toBe('work, planning')
    expect($('.note-row__preview').textContent).toBe('Phase one Keep it calm.')
  })

  it('moves from the title to the body on Enter, and saves tags on Enter', () => {
    renderApp()
    newNote('Plan')
    const title = $<HTMLTextAreaElement>('#note-title')
    act(() => title.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(document.activeElement).toBe($('.editor__body'))
    const tags = $<HTMLInputElement>('.tags-field__input')
    type(tags, 'Work')
    act(() => tags.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(savedNotes()[0].tags).toEqual(['work'])
  })

  it('keeps a title on one line', () => {
    renderApp()
    newNote('one\ntwo')
    expect(savedNotes()[0].title).toBe('one two')
  })

  it('sanitizes the body before saving it', () => {
    renderApp()
    newNote('x')
    writeBody('<p onclick="alert(1)">Hi</p><img src="x" onerror="alert(1)">')
    expect(savedNotes()[0].body).toBe('<p>Hi</p>')
  })

  it('counts words and characters as you write', () => {
    renderApp()
    newNote('x')
    writeBody('<p>three small words</p>')
    expect($('.editor__meta').textContent).toContain('3 words · 17 characters')
  })

  it('opens another note from the list', () => {
    renderApp()
    newNote('First')
    newNote('Second')
    click(buttonNamed(/^First/))
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('First')
  })
})

describe('deleting notes', () => {
  it('removes the note and opens the next one, then the previous one', () => {
    renderApp()
    newNote('A')
    newNote('B')
    newNote('C')
    click(buttonNamed(/^B/))
    click(buttonNamed('Delete'))
    expect(rowTitles()).toEqual(['C', 'A'])
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('A')
    click(buttonNamed('Delete'))
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('C')
    click(buttonNamed('Delete'))
    expect($('.empty__title').textContent).toBe('No notes yet.')
    expect(savedNotes()).toEqual([])
  })
})

describe('saving', () => {
  it('says so when the device refuses to save', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    renderApp()
    newNote('x')
    expect($('[role="alert"]').textContent).toContain('Couldn’t save on this device')
  })
})

describe('rich text', () => {
  // jsdom has no execCommand; this stand-in inserts HTML the way a browser does.
  function stubEditing() {
    const execCommand = vi.fn((command: string, _ui?: boolean, value?: string) => {
      if (command === 'insertHTML') $('.editor__body').insertAdjacentHTML('beforeend', value ?? '')
      return true
    })
    Object.assign(document, { execCommand })
    return execCommand
  }

  function dispatchWithData(kind: 'paste' | 'drop', html: string) {
    const event = new Event(kind, { bubbles: true, cancelable: true })
    const data = { getData: (type: string) => (type === 'text/html' ? html : '') }
    Object.defineProperty(event, kind === 'paste' ? 'clipboardData' : 'dataTransfer', { value: data })
    act(() => $('.editor__body').dispatchEvent(event))
    return event
  }

  afterEach(() => delete (document as Partial<Document>).execCommand)

  it('strips scripts and event handlers from pasted HTML', () => {
    const execCommand = stubEditing()
    renderApp()
    newNote('x')
    const event = dispatchWithData('paste', '<p onclick="alert(1)">safe</p><script>alert(1)</script><img src=x onerror=alert(1)>')
    expect(event.defaultPrevented).toBe(true)
    expect(execCommand).toHaveBeenCalledWith('insertHTML', false, '<p>safe</p>')
    expect($('.editor__body').innerHTML).toBe('<p>safe</p>')
    expect(savedNotes()[0].body).toBe('<p>safe</p>')
  })

  it('strips dropped HTML from outside the editor', () => {
    const execCommand = stubEditing()
    renderApp()
    newNote('x')
    dispatchWithData('drop', '<p style="color:red">dropped</p><iframe src="https://example.com"></iframe>')
    expect(execCommand).toHaveBeenCalledWith('insertHTML', false, '<p>dropped</p>')
    expect(savedNotes()[0].body).toBe('<p>dropped</p>')
  })

  it('formats from the toolbar and saves the result', () => {
    const execCommand = stubEditing()
    renderApp()
    newNote('x')
    expect($('[role="toolbar"]').getAttribute('aria-label')).toBe('Formatting')
    click(buttonNamed('Bold'))
    expect(execCommand).toHaveBeenCalledWith('bold', false, undefined)
    expect(document.activeElement).toBe($('.editor__body'))
  })
})

describe('finding notes', () => {
  function seed() {
    newNote('Roadmap')
    writeBody('<p>Phase one</p>')
    newNote('Recipes')
    writeBody('<p>Sourdough starter</p>')
    const tags = $<HTMLInputElement>('.tags-field__input')
    type(tags, 'home')
    blur(tags)
  }

  const search = (query: string) => type($<HTMLInputElement>('#search'), query)

  it('searches titles, body text and tags', () => {
    renderApp()
    seed()
    search('SOURDOUGH')
    expect(rowTitles()).toEqual(['Recipes'])
    search('road')
    expect(rowTitles()).toEqual(['Roadmap'])
    search('home')
    expect(rowTitles()).toEqual(['Recipes'])
  })

  it('shows when nothing matches and clears the search', () => {
    renderApp()
    seed()
    search('lisbon')
    expect($('.empty__title').textContent).toBe('Nothing matches.')
    click(buttonNamed('Clear search'))
    expect($<HTMLInputElement>('#search').value).toBe('')
    expect(rowTitles()).toEqual(['Recipes', 'Roadmap'])
  })

  it('filters by a tag and back to all notes', () => {
    renderApp()
    seed()
    click(buttonNamed('#home'))
    expect(buttonNamed('#home').getAttribute('aria-pressed')).toBe('true')
    expect(rowTitles()).toEqual(['Recipes'])
    click(buttonNamed('All notes'))
    expect(rowTitles()).toEqual(['Recipes', 'Roadmap'])
  })

  it('clears the filters for a new note so it shows in the list', () => {
    renderApp()
    seed()
    click(buttonNamed('#home'))
    search('sour')
    newNote()
    expect(rowTitles()).toEqual(['Untitled', 'Recipes', 'Roadmap'])
    expect($<HTMLInputElement>('#search').value).toBe('')
  })

  it('drops the tag filter once no note has the tag', () => {
    renderApp()
    seed()
    click(buttonNamed('#home'))
    const tags = $<HTMLInputElement>('.tags-field__input')
    type(tags, '')
    blur(tags)
    expect(rowTitles()).toEqual(['Recipes', 'Roadmap'])
    expect(document.body.querySelector('.tag-list')).toBeNull()
  })
})

describe('pinning notes', () => {
  it('lists pinned notes first, under Pinned, and keeps the pin after a reload', () => {
    renderApp()
    newNote('Old')
    newNote('New')
    click(buttonNamed(/^Old/))
    click(buttonNamed('Pin'))
    expect(buttonNamed('Pin').getAttribute('aria-pressed')).toBe('true')
    expect(rowTitles()).toEqual(['Old', 'New'])
    expect([...document.querySelectorAll('.group-label')].map((label) => label.textContent)).toEqual(['Pinned', 'Notes'])

    unmount()
    renderApp()
    expect(rowTitles()).toEqual(['Old', 'New'])
    click(buttonNamed('Pin'))
    expect(rowTitles()).toEqual(['New', 'Old'])
    expect(document.querySelector('.group-label')).toBeNull()
  })
})

describe('editing while the list changes', () => {
  it('keeps the open note when an edit moves it out of the filtered list', () => {
    renderApp()
    newNote('Alpha')
    newNote('Beta')
    unmount()
    renderApp()
    type($<HTMLInputElement>('#search'), 'beta')
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('Beta')
    type($<HTMLTextAreaElement>('#note-title'), 'Gamma')
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('Gamma')
    expect(savedNotes().map((note: { title: string }) => note.title)).toEqual(['Gamma', 'Alpha'])
  })

  it('saves both the tags and the body when the toolbar is used straight from the tags field', () => {
    Object.assign(document, { execCommand: vi.fn(() => true) })
    renderApp()
    newNote('x')
    const tags = $<HTMLInputElement>('.tags-field__input')
    act(() => tags.focus())
    type(tags, 'work')
    click(buttonNamed('Bold'))
    expect(savedNotes()[0].tags).toEqual(['work'])
    delete (document as Partial<Document>).execCommand
  })
})
