import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyChanges,
  checkFolderName,
  countByFolder,
  countWords,
  createNote,
  excerptText,
  existingFolder,
  filterNotes,
  foldersOf,
  formatDate,
  newId,
  noteText,
  parseTags,
  plainText,
  refileNotes,
  tagsOf,
  type Note,
} from '../domain/notes'

const note = (id: string, fields: Partial<Note> = {}): Note => ({
  ...createNote(new Date(`2022-06-${id.padStart(2, '0')}T10:00:00Z`), id),
  ...fields,
})

describe('createNote', () => {
  it('starts blank, unpinned and stamped with the creation time', () => {
    expect(createNote(new Date('2022-06-20T09:30:00Z'), 'a')).toEqual({
      id: 'a',
      format: 'rich',
      title: '',
      body: '',
      folder: '',
      tags: [],
      pinned: false,
      createdAt: '2022-06-20T09:30:00.000Z',
      updatedAt: '2022-06-20T09:30:00.000Z',
    })
  })
})

describe('applyChanges', () => {
  it('merges the changes and moves the update time, keeping the creation time', () => {
    const edited = applyChanges(note('1'), { title: 'Plan', pinned: true }, new Date('2022-07-01T12:00:00Z'))
    expect(edited).toMatchObject({ title: 'Plan', pinned: true, createdAt: '2022-06-01T10:00:00.000Z' })
    expect(edited.updatedAt).toBe('2022-07-01T12:00:00.000Z')
  })
})

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('still makes unique ids outside a secure context, where randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const ids = new Set(Array.from({ length: 100 }, newId))
    expect(ids.size).toBe(100)
    expect([...ids][0]).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('plainText and countWords', () => {
  it('reads tags as text boundaries and decodes entities', () => {
    expect(plainText('<h1>Plan</h1><p>Fish &amp; chips<br>today</p><ul><li>one</li><li>two</li></ul>')).toBe(
      'Plan Fish & chips today one two',
    )
  })

  it('counts words in the plain text', () => {
    expect(countWords(plainText('<p>three small <strong>words</strong></p>'))).toBe(3)
    expect(countWords(plainText('<p> </p>'))).toBe(0)
  })
})

describe('parseTags', () => {
  it('trims, lowercases, drops # and repeats', () => {
    expect(parseTags(' Work, #ideas,, work ,  ')).toEqual(['work', 'ideas'])
  })
})

describe('tagsOf', () => {
  it('lists every tag once, sorted', () => {
    expect(tagsOf([note('1', { tags: ['work', 'ideas'] }), note('2', { tags: ['ideas'] })])).toEqual(['ideas', 'work'])
  })
})

describe('filterNotes', () => {
  const notes = [
    note('1', { title: 'Roadmap', body: '<p>Phase <strong>one</strong></p>', tags: ['work'] }),
    note('2', { title: 'Recipes', body: '<p>Sourdough</p>', tags: ['home'], pinned: true }),
    note('3', { title: 'Lisbon', body: '<p>Alfama</p>', tags: ['travel', 'home'] }),
  ]
  const ids = (list: Note[]) => list.map((n) => n.id)

  it('puts pinned notes first, then the latest edited', () => {
    expect(ids(filterNotes(notes, '', null))).toEqual(['2', '3', '1'])
    const edited = notes.map((n) => (n.id === '1' ? { ...n, updatedAt: '2022-07-01T10:00:00.000Z' } : n))
    expect(ids(filterNotes(edited, '', null))).toEqual(['2', '1', '3'])
  })

  it('searches markdown notes by their source text', () => {
    const md = note('4', { format: 'markdown', body: '# Plan\n\n- <b>bold</b> item' })
    expect(ids(filterNotes([md], 'bold', null))).toEqual(['4'])
    expect(noteText(md)).toBe('# Plan - <b>bold</b> item')
    expect(noteText(notes[0])).toBe('Phase one')
  })

  it('searches title, body text and tags, ignoring case', () => {
    expect(ids(filterNotes(notes, 'ROAD', null))).toEqual(['1'])
    expect(ids(filterNotes(notes, 'sourdough', null))).toEqual(['2'])
    expect(ids(filterNotes(notes, 'travel', null))).toEqual(['3'])
  })

  it('does not match markup', () => {
    expect(filterNotes(notes, 'strong', null)).toEqual([])
  })

  it('narrows to a tag, together with the search', () => {
    expect(ids(filterNotes(notes, '', 'home'))).toEqual(['2', '3'])
    expect(ids(filterNotes(notes, 'alfama', 'home'))).toEqual(['3'])
    expect(filterNotes(notes, 'roadmap', 'home')).toEqual([])
  })
})

describe('filterNotes by folder', () => {
  const notes = [
    note('1', { title: 'Plan', folder: 'Work', tags: ['q2'] }),
    note('2', { title: 'Plan B', folder: 'Work' }),
    note('3', { title: 'Loose plan', tags: ['q2'] }),
    note('4', { title: 'Trip', folder: 'Home', pinned: true }),
  ]
  const ids = (list: Note[]) => list.map((n) => n.id)

  it('keeps any folder for null, only unfiled notes for the empty folder', () => {
    expect(ids(filterNotes(notes, '', null, null))).toEqual(['4', '3', '2', '1'])
    expect(ids(filterNotes(notes, '', null, ''))).toEqual(['3'])
    expect(ids(filterNotes(notes, '', null, 'Work'))).toEqual(['2', '1'])
  })

  it('combines the folder with the tag and the search', () => {
    expect(ids(filterNotes(notes, '', 'q2', 'Work'))).toEqual(['1'])
    expect(ids(filterNotes(notes, 'plan b', null, 'Work'))).toEqual(['2'])
    expect(ids(filterNotes(notes, 'plan', 'q2', ''))).toEqual(['3'])
    expect(filterNotes(notes, 'trip', null, 'Work')).toEqual([])
  })

  it('matches the folder name exactly', () => {
    expect(filterNotes(notes, '', null, 'work')).toEqual([])
  })
})

describe('foldersOf and countByFolder', () => {
  it('joins kept folders and the ones notes are in, sorted, without unfiled', () => {
    const notes = [note('1', { folder: 'b' }), note('2'), note('3', { folder: 'A' })]
    expect(foldersOf(notes, ['é', 'b', 'Empty'])).toEqual(['A', 'b', 'é', 'Empty'].sort((x, y) => x.localeCompare(y)))
    expect(foldersOf(notes)).not.toContain('')
  })

  it('counts each folder, with unfiled under the empty name', () => {
    const counts = countByFolder([note('1', { folder: 'Work' }), note('2', { folder: 'Work' }), note('3')])
    expect(counts.get('Work')).toBe(2)
    expect(counts.get('')).toBe(1)
    expect(counts.get('Empty')).toBeUndefined()
  })
})

describe('checkFolderName', () => {
  const folders = ['Work', 'Home']

  it('tidies the spacing', () => {
    expect(checkFolderName('  Ideas   2023 ', folders)).toEqual({ name: 'Ideas 2023' })
  })

  it('refuses a blank name and one over 100 characters', () => {
    expect(checkFolderName('   ', folders)).toEqual({ error: 'blank' })
    expect(checkFolderName('a'.repeat(100), folders)).toEqual({ name: 'a'.repeat(100) })
    expect(checkFolderName('a'.repeat(101), folders)).toEqual({ error: 'long' })
    expect(checkFolderName(`${'a'.repeat(50)}    ${'a'.repeat(49)}`, folders).name).toHaveLength(100)
  })

  it('refuses renaming onto another folder, ignoring case, but not onto itself', () => {
    expect(checkFolderName('work', folders, 'Home')).toEqual({ error: 'taken' })
    expect(checkFolderName('work', folders, 'Work')).toEqual({ name: 'work' })
    expect(checkFolderName('Work', folders, 'Work')).toEqual({ name: 'Work' })
  })

  it('leaves an existing name for the caller to reuse when not renaming', () => {
    expect(checkFolderName('work', folders)).toEqual({ name: 'work' })
    expect(existingFolder(folders, 'work')).toBe('Work')
    expect(existingFolder(folders, 'Garden')).toBeUndefined()
  })
})

describe('refileNotes', () => {
  const now = new Date('2023-04-12T10:00:00Z')

  it('moves the folder\'s notes, stamping them, and leaves the rest as they were', () => {
    const inside = note('1', { folder: 'Work', tags: ['q2'], body: '<p>x</p>' })
    const outside = note('2', { folder: 'Home' })
    const [moved, untouched] = refileNotes([inside, outside], 'Work', 'Jobs', now)
    expect(moved).toEqual({ ...inside, folder: 'Jobs', updatedAt: now.toISOString() })
    expect(untouched).toBe(outside)
  })

  it('unfiles them when moved to the empty folder', () => {
    expect(refileNotes([note('1', { folder: 'Work' })], 'Work', '', now)[0].folder).toBe('')
  })
})

describe('formatDate', () => {
  it('shows a short calendar date', () => {
    expect(formatDate('2022-06-20T12:00:00Z')).toBe('20 Jun 2022')
  })
})

describe('excerptText', () => {
  it('reads markdown as plain words for the list', () => {
    const body = [
      '# Plan',
      '> - [x] **done** _well_ and ~~old~~',
      '1. See [docs](https://example.com) ![chart](c.png) `npm test` \\*literal\\*',
      '```js\nconst a = 1\n```',
      '| a | b |\n| - | - |',
      '---',
      'snake_case_name stays',
    ].join('\n\n')
    expect(excerptText({ format: 'markdown', body })).toBe(
      'Plan done well and old See docs chart npm test *literal* const a = 1 a b snake_case_name stays',
    )
  })

  it('reads rich text without its markup', () => {
    expect(excerptText({ format: 'rich', body: '<h1>Plan</h1><p>a <strong>b</strong></p>' })).toBe('Plan a b')
  })
})
