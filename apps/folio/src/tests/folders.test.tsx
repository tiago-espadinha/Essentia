import { describe, expect, it } from 'vitest'
import { FOLDERS_KEY, NOTES_KEY } from '../data/storage'
import { createNote, type Note } from '../domain/notes'
import { $, buttonNamed, click, newNote, renderApp, rowTitles, savedNotes, setupApp, type } from './testing'

// jsdom has no dialog closing.
HTMLDialogElement.prototype.close = function () { this.open = false }

const note = (id: string, title: string, fields: Partial<Note> = {}): Note => ({
  ...createNote(new Date(`2023-04-0${id}T10:00:00Z`), id),
  title,
  ...fields,
})

// Newest first: Trip (Home), Plan (Work, #q2), Loose (unfiled, #q2).
function seed(folders?: string[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify([
    note('1', 'Loose', { tags: ['q2'] }),
    note('2', 'Plan', { folder: 'Work', tags: ['q2'] }),
    note('3', 'Trip', { folder: 'Home' }),
  ]))
  if (folders) localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

const folderButtons = () => [...document.querySelectorAll('nav[aria-labelledby="folders-title"] button')]
const pressed = () => folderButtons().find((button) => button.getAttribute('aria-pressed') === 'true')?.getAttribute('aria-label')
const listHeading = () => $('#list-title').textContent

describe('the folder sidebar', () => {
  setupApp()

  it('lists All notes, Unfiled, then every folder with its count, above the tags', () => {
    seed(['Empty'])
    renderApp()
    expect(folderButtons().map((button) => button.getAttribute('aria-label'))).toEqual([
      'All notes, 3 notes',
      'Unfiled, 1 note',
      'Empty, 0 notes',
      'Home, 1 note',
      'Work, 1 note',
    ])
    expect(pressed()).toBe('All notes, 3 notes')
    const headings = [...document.querySelectorAll('#library h2')].map((heading) => heading.textContent)
    expect(headings).toEqual(['Folders', 'Tags'])
  })

  it('shows only the notes of the chosen folder, or the unfiled ones', () => {
    seed()
    renderApp()
    click(buttonNamed('Work, 1 note'))
    expect(rowTitles()).toEqual(['Plan'])
    expect(listHeading()).toBe('Notes · 1')
    click(buttonNamed('Unfiled, 1 note'))
    expect(rowTitles()).toEqual(['Loose'])
    click(buttonNamed('All notes, 3 notes'))
    expect(rowTitles()).toEqual(['Trip', 'Plan', 'Loose'])
  })

  it('combines the folder with the tag and the search', () => {
    seed()
    renderApp()
    click(buttonNamed('#q2'))
    expect(rowTitles()).toEqual(['Plan', 'Loose'])
    click(buttonNamed('Work, 1 note'))
    expect(rowTitles()).toEqual(['Plan'])
    type($<HTMLInputElement>('#search'), 'loose')
    expect(rowTitles()).toEqual([])
    click(buttonNamed('Any tag'))
    expect(rowTitles()).toEqual([])
    click(buttonNamed('All notes, 3 notes'))
    expect(rowTitles()).toEqual(['Loose'])
  })

  it('says a folder is empty and offers a new note in it', () => {
    seed(['Empty'])
    renderApp()
    click(buttonNamed('Empty, 0 notes'))
    expect($('.list-pane .empty__title').textContent).toBe('No notes in this folder.')
    click(buttonNamed('New note'))
    expect(savedNotes()[0].folder).toBe('Empty')
    expect(rowTitles()).toEqual(['Untitled'])
  })

  it('files a new note into the folder shown, clearing only the search and tag', () => {
    seed()
    renderApp()
    click(buttonNamed('Work, 1 note'))
    click(buttonNamed('#q2'))
    newNote('Idea')
    expect(savedNotes()[0]).toMatchObject({ title: 'Idea', folder: 'Work', tags: [] })
    expect(pressed()).toBe('Work, 2 notes')
    expect(rowTitles()).toEqual(['Idea', 'Plan'])
  })

  it('files a new note as unfiled from Unfiled and from All notes', () => {
    seed()
    renderApp()
    click(buttonNamed('Unfiled, 1 note'))
    click(buttonNamed('New note'))
    click(buttonNamed('All notes, 4 notes'))
    click(buttonNamed('New note'))
    expect(savedNotes().slice(0, 2).map((saved: Note) => saved.folder)).toEqual(['', ''])
  })

  it('keeps the Filter bar open while a folder is chosen, and closing it shows every note', () => {
    seed()
    renderApp()
    click(buttonNamed('Home, 1 note'))
    const toggle = buttonNamed('Filter')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(rowTitles()).toEqual(['Trip', 'Plan', 'Loose'])
  })

  it('offers the Filter bar for kept folders before there are notes', () => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(['Empty']))
    renderApp()
    expect(buttonNamed('Filter')).toBeTruthy()
    expect(buttonNamed('Empty, 0 notes')).toBeTruthy()
  })

  it('opens a note found by the header search even from another folder', () => {
    seed()
    renderApp()
    click(buttonNamed('Home, 1 note'))
    click($('.ui-search-trigger'))
    type($<HTMLInputElement>('dialog input'), 'Plan')
    click($('dialog button[role="option"]'))
    expect(pressed()).toBe('All notes, 3 notes')
    expect(rowTitles()).toContain('Plan')
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('Plan')
  })

  it('drops a folder filter once the folder is gone', () => {
    seed()
    renderApp()
    click(buttonNamed('Home, 1 note'))
    click(buttonNamed('Delete'))
    expect(pressed()).toBe('All notes, 2 notes')
    expect(rowTitles()).toEqual(['Plan', 'Loose'])
  })
})
