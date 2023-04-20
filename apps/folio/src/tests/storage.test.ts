import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote, type Note } from '../domain/notes'
import {
  clearKept, DEVICE_KEY, FOLDERS_KEY, loadFolders, loadKept, loadNotes, loadStamps, loadVersions, NOTES_KEY, saveFolders, saveNotes,
  saveStamps, setAside, SYNC_KEY, VERSIONS_KEY,
} from '../data/storage'
import { NO_STAMPS } from '../data/sync'

const valid: Note = {
  ...createNote(new Date('2022-06-20T10:00:00Z'), 'a'),
  title: 'Plan',
  body: '<p>Write</p>',
  tags: ['work'],
}

const store = (value: unknown) => localStorage.setItem(NOTES_KEY, JSON.stringify(value))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('note storage', () => {
  it('starts empty when nothing is saved', () => {
    expect(loadNotes()).toEqual([])
  })

  it('round-trips the notes under the shared key', () => {
    expect(saveNotes([valid])).toBe(true)
    expect(JSON.parse(localStorage.getItem(NOTES_KEY)!)).toEqual([valid])
    expect(loadNotes()).toEqual([valid])
  })

  it('does not read the old unprefixed key', () => {
    localStorage.setItem('folio-notes', JSON.stringify([valid]))
    expect(loadNotes()).toEqual([])
  })

  it('ignores corrupt or non-list data', () => {
    localStorage.setItem(NOTES_KEY, '{not json')
    expect(loadNotes()).toEqual([])
    store({ id: 'a' })
    expect(loadNotes()).toEqual([])
  })

  it('skips malformed entries and keeps the valid ones', () => {
    store([
      valid,
      null,
      { ...valid, id: 1 },
      { ...valid, tags: 'work' },
      { ...valid, tags: [1] },
      { ...valid, pinned: 'yes' },
      { ...valid, updatedAt: 'May 26' },
      { ...valid, format: 'html' },
      { ...valid, folder: null },
    ])
    expect(loadNotes()).toEqual([valid])
  })

  it('drops repeated ids and unknown fields, and cleans the tags and folder', () => {
    store([valid, { ...valid, title: 'Copy' }, { ...valid, id: 'b', folder: '  Work  notes ', tags: [' Work ', 'work', ''], extra: 1 }])
    expect(loadNotes()).toEqual([valid, { ...valid, id: 'b', folder: 'Work notes', tags: ['work'] }])
  })

  it('sanitizes saved rich bodies, which may have been tampered with', () => {
    store([{ ...valid, body: '<p onclick="alert(1)">Write</p><script>alert(1)</script><img src=x onerror=alert(1)>' }])
    expect(loadNotes()[0].body).toBe('<p>Write</p>')
  })

  it('keeps markdown bodies exactly as written', () => {
    const markdown = { ...valid, format: 'markdown' as const, body: '# Plan\n\n<b>raw</b> `code`\n' }
    store([markdown])
    expect(loadNotes()).toEqual([markdown])
  })

  it('keeps versions only for notes that still exist', () => {
    const version = { id: 'v', noteId: 'a', title: 'Plan', body: '# Plan', format: 'markdown', savedAt: valid.createdAt }
    localStorage.setItem(VERSIONS_KEY, JSON.stringify([version, { ...version, id: 'w', noteId: 'gone' }, { ...version, id: 'x', format: 1 }]))
    expect(loadVersions(['a'])).toEqual([version])
  })

  it('reports a failed save instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(saveNotes([valid])).toBe(false)
  })

  it('treats unreadable storage as empty', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Denied', 'SecurityError')
    })
    expect(loadNotes()).toEqual([])
  })
})

describe('folder storage', () => {
  const keep = (value: unknown) => localStorage.setItem(FOLDERS_KEY, JSON.stringify(value))

  it('starts with no folders kept', () => {
    expect(loadFolders()).toEqual([])
  })

  it('round-trips the folders under their own key', () => {
    expect(saveFolders(['Home', 'Work'])).toBe(true)
    expect(loadFolders()).toEqual(['Home', 'Work'])
  })

  it('cleans names and skips blank, overlong, repeated and non-string entries', () => {
    keep([' Work  plans ', 'Work plans', '', '   ', 7, null, 'a'.repeat(101), 'a'.repeat(100), 'Home'])
    expect(loadFolders()).toEqual(['Work plans', 'a'.repeat(100), 'Home'])
  })

  it.each([['{"Work":1}'], ['"Work"'], ['42'], ['null'], ['not json']])('reads %s as no folders and leaves it stored', (raw) => {
    localStorage.setItem(FOLDERS_KEY, raw)
    expect(loadFolders()).toEqual([])
    expect(localStorage.getItem(FOLDERS_KEY)).toBe(raw)
  })

  it('reports a refused write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(saveFolders(['Work'])).toBe(false)
  })
})

describe('sync stamps', () => {
  const stamps = { owner: 'u1', deleted: { a: '2023-04-17T10:00:00.000Z' }, folders: { Work: '2023-04-17T10:00:00.000Z' } }

  it('round-trips the owner, deletions and folder changes', () => {
    expect(saveStamps(stamps)).toBe(true)
    expect(loadStamps()).toEqual(stamps)
  })

  it('reads stamps without folders as having no folder changes', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ owner: 'u1', deleted: {} }))
    expect(loadStamps()).toEqual({ owner: 'u1', deleted: {}, folders: {} })
  })

  it('starts over from unreadable or malformed stamps, so the notes count as never synced', () => {
    for (const value of ['{not json', '[]', '{"owner":5,"deleted":{}}', '{"owner":"u1","deleted":{"a":"soon"}}', '{"owner":"u1","deleted":{},"folders":[]}']) {
      localStorage.setItem(SYNC_KEY, value)
      expect(loadStamps()).toEqual(NO_STAMPS)
    }
  })
})

describe('notes kept on this device only', () => {
  const version = { id: 'v1', noteId: valid.id, title: 'Plan', body: '<p>Old</p>', format: 'rich' as const, savedAt: '2022-06-20T11:00:00.000Z' }

  it('reads nothing when nothing is set aside', () => {
    expect(loadKept()).toEqual({ notes: [], versions: [], folders: [] })
  })

  it('sets notes, their versions and folders aside, adding to what is already there with the newer copy winning', () => {
    const other = { ...valid, id: 'b', title: 'Other' }
    const edited = { ...valid, title: 'Plan, edited' }
    expect(setAside({ notes: [valid], versions: [version], folders: ['Work'] })).toBe(true)
    expect(setAside({ notes: [other, edited], versions: [], folders: ['Home', 'Work'] })).toBe(true)
    expect(loadKept()).toEqual({ notes: [other, edited], versions: [version], folders: ['Home', 'Work'] })
  })

  it('skips malformed entries and versions of notes not kept, and sanitizes rich bodies', () => {
    localStorage.setItem(DEVICE_KEY, JSON.stringify({
      notes: [{ ...valid, body: '<p onclick="x()">Hi</p><script>x()</script>' }, { id: 'bad' }],
      versions: [version, { ...version, id: 'v2', noteId: 'gone' }],
      folders: ['Work', '', 5, ' Work '],
    }))
    const kept = loadKept()
    expect(kept.notes).toHaveLength(1)
    expect(kept.notes[0].body).not.toMatch(/script|onclick/)
    expect(kept.versions.map((v) => v.id)).toEqual(['v1'])
    expect(kept.folders).toEqual(['Work'])
  })

  it('reads an unreadable value as nothing, and forgets it once cleared', () => {
    localStorage.setItem(DEVICE_KEY, '{not json')
    expect(loadKept().notes).toEqual([])
    clearKept()
    expect(localStorage.getItem(DEVICE_KEY)).toBeNull()
  })

  it('reports a refused write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(setAside({ notes: [valid], versions: [], folders: [] })).toBe(false)
  })
})
