import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FOLDERS_KEY, NOTES_KEY, VERSIONS_KEY } from '../data/storage'
import { createNote, type Note } from '../domain/notes'
import { useNotes } from '../hooks/useNotes'

// The hook, rendered on its own so its folder actions can be called directly.
let hook: ReturnType<typeof useNotes>
let root: Root | null = null

function Probe({ onRender }: { onRender: (value: ReturnType<typeof useNotes>) => void }) {
  onRender(useNotes())
  return null
}

function open() {
  const container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
  act(() => root!.render(<Probe onRender={(value) => (hook = value)} />))
}

const note = (id: string, fields: Partial<Note> = {}): Note => ({
  ...createNote(new Date('2023-04-01T10:00:00Z'), id),
  ...fields,
})

function seed(notes: Note[], folders?: string[]) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  if (folders) localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

const stored = <T,>(key: string): T => JSON.parse(localStorage.getItem(key)!)
const storedNotes = () => stored<Note[]>(NOTES_KEY)

beforeEach(() => localStorage.clear())
afterEach(() => {
  if (root) act(() => root!.unmount())
  root = null
  vi.restoreAllMocks()
})

describe('folders in the notes store', () => {
  it('lists kept folders and the folders notes are in, without writing either on load', () => {
    seed([note('1', { folder: 'Work' })], ['Empty'])
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    open()
    expect(hook.folders).toEqual(['Empty', 'Work'])
    expect(setItem.mock.calls.filter(([key]) => key === FOLDERS_KEY)).toEqual([])
  })

  it('keeps a new folder while it holds no notes', () => {
    open()
    act(() => void hook.createFolder('Ideas'))
    expect(hook.folders).toEqual(['Ideas'])
    expect(stored(FOLDERS_KEY)).toEqual(['Ideas'])
  })

  it('renames a folder with its notes, leaving their tags and other notes alone', () => {
    const outside = note('2', { folder: 'Home' })
    seed([note('1', { folder: 'Work', tags: ['q2'] }), outside])
    open()
    act(() => void hook.renameFolder('Work', 'Jobs'))
    const [moved, untouched] = storedNotes()
    expect(moved).toMatchObject({ folder: 'Jobs', tags: ['q2'] })
    expect(moved.updatedAt).not.toBe(note('1').updatedAt)
    expect(untouched).toEqual(outside)
    expect(stored(FOLDERS_KEY)).toEqual(['Home', 'Jobs'])
  })

  it('deletes a folder by unfiling its notes, deleting none', () => {
    seed([note('1', { folder: 'Work', tags: ['q2'] }), note('2', { folder: 'Work' })], ['Work', 'Home'])
    open()
    act(() => void hook.deleteFolder('Work'))
    expect(storedNotes().map((n) => [n.folder, n.tags])).toEqual([['', ['q2']], ['', []]])
    expect(hook.folders).toEqual(['Home'])
    expect(stored(FOLDERS_KEY)).toEqual(['Home'])
  })

  it('keeps a folder once its last note moves out', () => {
    seed([note('1', { folder: 'Work' })])
    open()
    act(() => void hook.moveNote('1', ''))
    expect(storedNotes()[0].folder).toBe('')
    expect(hook.folders).toEqual(['Work'])
  })

  it('keeps a new folder a note is moved into', () => {
    seed([note('1')])
    open()
    act(() => void hook.moveNote('1', 'Garden'))
    expect(storedNotes()[0].folder).toBe('Garden')
    expect(stored(FOLDERS_KEY)).toEqual(['Garden'])
  })

  it('adds a new note to the folder given', () => {
    open()
    act(() => void hook.add('Work'))
    expect(storedNotes()[0].folder).toBe('Work')
  })

  it('leaves versions alone when folders change', () => {
    seed([note('1', { folder: 'Work' })])
    open()
    act(() => void hook.saveVersion('1'))
    const versions = localStorage.getItem(VERSIONS_KEY)
    act(() => void hook.renameFolder('Work', 'Jobs'))
    act(() => void hook.deleteFolder('Jobs'))
    expect(localStorage.getItem(VERSIONS_KEY)).toBe(versions)
  })

  it('reports a refused folder write, keeping the change until the page closes', () => {
    open()
    const setItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === FOLDERS_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      setItem.call(this, key, value)
    })
    let saved = true
    act(() => void (saved = hook.createFolder('Ideas')))
    expect(saved).toBe(false)
    expect(hook.saveFailed).toBe(true)
    expect(hook.folders).toEqual(['Ideas'])
  })

  it('changes nothing when the notes could not be stored at all', () => {
    localStorage.setItem('essentia-folio-notes', JSON.stringify([note('1', { folder: 'Work' })]))
    const setItem = Storage.prototype.setItem
    const writes: string[] = []
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (key === NOTES_KEY) throw new DOMException('Quota exceeded', 'QuotaExceededError')
      writes.push(key)
      setItem.call(this, key, value)
    })
    open()
    expect(hook.readOnly).toBe(true)
    writes.length = 0
    act(() => {
      hook.createFolder('Ideas')
      hook.renameFolder('Work', 'Jobs')
      hook.deleteFolder('Work')
    })
    expect(writes).toEqual([])
    expect(localStorage.getItem(FOLDERS_KEY)).toBeNull()
  })

  it('takes in folders another tab kept, so the next change here keeps them', () => {
    open()
    act(() => {
      localStorage.setItem(FOLDERS_KEY, JSON.stringify(['From the other tab']))
      window.dispatchEvent(new StorageEvent('storage', { key: FOLDERS_KEY }))
    })
    expect(hook.folders).toEqual(['From the other tab'])
    act(() => void hook.createFolder('Here'))
    expect(stored(FOLDERS_KEY)).toEqual(['From the other tab', 'Here'])
  })

  it('does not bring back a folder another tab deleted', () => {
    seed([note('1', { folder: 'Work' })], ['Work'])
    open()
    act(() => {
      seed([note('1')], [])
      window.dispatchEvent(new StorageEvent('storage', { key: NOTES_KEY }))
    })
    expect(hook.folders).toEqual([])
  })
})
