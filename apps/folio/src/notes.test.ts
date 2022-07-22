import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyChanges,
  countWords,
  createNote,
  filterNotes,
  formatDate,
  newId,
  parseTags,
  plainText,
  tagsOf,
  type Note,
} from './notes'

const note = (id: string, fields: Partial<Note> = {}): Note => ({
  ...createNote(new Date(`2022-06-${id.padStart(2, '0')}T10:00:00Z`), id),
  ...fields,
})

describe('createNote', () => {
  it('starts blank, unpinned and stamped with the creation time', () => {
    expect(createNote(new Date('2022-06-20T09:30:00Z'), 'a')).toEqual({
      id: 'a',
      title: '',
      body: '',
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

  it('puts pinned notes first, then the newest', () => {
    expect(ids(filterNotes(notes, '', null))).toEqual(['2', '3', '1'])
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

describe('formatDate', () => {
  it('shows a short calendar date', () => {
    expect(formatDate('2022-06-20T12:00:00Z')).toBe('Jun 20, 2022')
  })
})
