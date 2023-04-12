import { describe, expect, it } from 'vitest'
import { FOLDERS_KEY, NOTES_KEY } from '../data/storage'
import { createNote, type Note } from '../domain/notes'
import { $, buttonNamed, click, newNote, press, renderApp, rowTitles, savedNotes, setupApp, type } from './testing'

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

const folderButtons = () => [...document.querySelectorAll('.folder-button')]
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

const nameField = () => $<HTMLInputElement>('.folder-form input')
const submit = () => click(buttonNamed(/^(Add|Rename)$/))
const keptFolders = () => JSON.parse(localStorage.getItem(FOLDERS_KEY) ?? '[]')
const errorOf = (field: HTMLInputElement) => document.getElementById(field.getAttribute('aria-describedby') ?? '')?.textContent

describe('creating, renaming and deleting folders', () => {
  setupApp()

  it('creates an empty folder, shows it and moves focus to it', () => {
    seed()
    renderApp()
    click(buttonNamed('New folder'))
    expect(document.activeElement).toBe(nameField())
    type(nameField(), '  Garden   plans ')
    submit()
    expect(keptFolders()).toContain('Garden plans')
    expect(pressed()).toBe('Garden plans, 0 notes')
    expect(document.activeElement).toBe(buttonNamed('Garden plans, 0 notes'))
    expect($('[role="status"]:not(:empty)').textContent).toBe('Added the folder “Garden plans”.')
  })

  it('picks an existing folder for a name it already has, in any case', () => {
    seed()
    renderApp()
    click(buttonNamed('New folder'))
    type(nameField(), 'work')
    submit()
    expect(folderButtons()).toHaveLength(4)
    expect(pressed()).toBe('Work, 1 note')
  })

  it('refuses a blank or overlong name inline, until it is fixed', () => {
    renderApp()
    click(buttonNamed('New folder'))
    submit()
    expect(nameField().getAttribute('aria-invalid')).toBe('true')
    expect(errorOf(nameField())).toBe('Give the folder a name.')
    type(nameField(), 'a'.repeat(101))
    expect(nameField().getAttribute('aria-invalid')).toBeNull()
    submit()
    expect(errorOf(nameField())).toBe('Use 100 characters or fewer.')
    expect(localStorage.getItem(FOLDERS_KEY)).toBeNull()
  })

  it('cancels with Escape, returning focus to New folder', () => {
    renderApp()
    click(buttonNamed('New folder'))
    type(nameField(), 'Draft')
    press(nameField(), 'Escape')
    expect(document.querySelector('.folder-form')).toBeNull()
    expect(document.activeElement).toBe(buttonNamed('New folder'))
    expect(localStorage.getItem(FOLDERS_KEY)).toBeNull()
  })

  it('offers rename and delete only for a named folder', () => {
    seed()
    renderApp()
    expect(buttonNamed('Rename folder', { optional: true })).toBeNull()
    click(buttonNamed('Unfiled, 1 note'))
    expect(buttonNamed('Delete folder', { optional: true })).toBeNull()
    click(buttonNamed('Work, 1 note'))
    expect(buttonNamed('Rename folder')).toBeTruthy()
    expect(buttonNamed('Delete folder')).toBeTruthy()
  })

  it('renames a folder with its notes, keeping it shown and their tags as they were', () => {
    seed()
    renderApp()
    click(buttonNamed('Work, 1 note'))
    click(buttonNamed('Rename folder'))
    expect(nameField().value).toBe('Work')
    type(nameField(), 'Jobs')
    submit()
    expect(pressed()).toBe('Jobs, 1 note')
    expect(rowTitles()).toEqual(['Plan'])
    expect(savedNotes().find((saved: Note) => saved.title === 'Plan')).toMatchObject({ folder: 'Jobs', tags: ['q2'] })
    expect(document.activeElement).toBe(buttonNamed('Jobs, 1 note'))
  })

  it('changes nothing when the name is submitted unchanged', () => {
    seed()
    renderApp()
    const before = localStorage.getItem(NOTES_KEY)
    click(buttonNamed('Work, 1 note'))
    click(buttonNamed('Rename folder'))
    submit()
    expect(localStorage.getItem(NOTES_KEY)).toBe(before)
    expect(pressed()).toBe('Work, 1 note')
  })

  it('refuses renaming onto another folder, but allows a change of case', () => {
    seed()
    renderApp()
    click(buttonNamed('Work, 1 note'))
    click(buttonNamed('Rename folder'))
    type(nameField(), 'HOME')
    submit()
    expect(errorOf(nameField())).toBe('Another folder has this name.')
    type(nameField(), 'WORK')
    submit()
    expect(pressed()).toBe('WORK, 1 note')
  })

  it('asks before deleting a folder, then unfiles its notes and deletes none', () => {
    seed()
    renderApp()
    click(buttonNamed('Work, 1 note'))
    click(buttonNamed('Delete folder'))
    expect($('dialog').textContent).toContain('Delete “Work”?')
    expect($('dialog').textContent).toContain('Its one note moves to Unfiled. No note is deleted.')
    click(buttonNamed('Cancel'))
    expect(document.querySelector('dialog')).toBeNull()
    expect(pressed()).toBe('Work, 1 note')

    click(buttonNamed('Delete folder'))
    click($('dialog .button-primary'))
    expect(savedNotes()).toHaveLength(3)
    expect(savedNotes().find((saved: Note) => saved.title === 'Plan')).toMatchObject({ folder: '', tags: ['q2'] })
    expect(folderButtons().map((button) => button.getAttribute('aria-label'))).toEqual(['All notes, 3 notes', 'Unfiled, 2 notes', 'Home, 1 note'])
    expect(document.activeElement).toBe(buttonNamed('All notes, 3 notes'))
  })

  it('says when a folder to delete holds no notes', () => {
    seed(['Empty'])
    renderApp()
    click(buttonNamed('Empty, 0 notes'))
    click(buttonNamed('Delete folder'))
    expect($('dialog').textContent).toContain('It holds no notes.')
    click($('dialog .button-primary'))
    expect(keptFolders()).not.toContain('Empty')
  })
})
