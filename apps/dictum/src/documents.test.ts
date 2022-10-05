import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  applyChanges,
  cleanFolder,
  countWords,
  createDoc,
  displayTitle,
  fileName,
  filterDocs,
  foldersOf,
  formatDate,
  newId,
  parseTags,
  readingMinutes,
  tagsOf,
  type Doc,
  type DocFilter,
} from './documents'

const doc = (id: string, fields: Partial<Doc> = {}): Doc => ({
  ...createDoc('', new Date(`2022-10-${id.padStart(2, '0')}T10:00:00Z`), id),
  ...fields,
})

const all: DocFilter = { query: '', folder: null, tag: null }

describe('createDoc', () => {
  it('starts blank in the given folder, stamped with the creation time', () => {
    expect(createDoc('Drafts', new Date('2022-10-03T09:30:00Z'), 'a')).toEqual({
      id: 'a',
      title: '',
      content: '',
      folder: 'Drafts',
      tags: [],
      createdAt: '2022-10-03T09:30:00.000Z',
      updatedAt: '2022-10-03T09:30:00.000Z',
    })
  })
})

describe('applyChanges', () => {
  it('merges the changes and moves the update time, keeping the creation time', () => {
    const edited = applyChanges(doc('1'), { content: '# Plan', folder: 'Work' }, new Date('2022-10-05T12:00:00Z'))
    expect(edited).toMatchObject({ content: '# Plan', folder: 'Work', createdAt: '2022-10-01T10:00:00.000Z' })
    expect(edited.updatedAt).toBe('2022-10-05T12:00:00.000Z')
  })
})

describe('newId', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('builds version 4 uuids outside a secure context, where randomUUID is missing', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
    const ids = new Set(Array.from({ length: 100 }, newId))
    expect(ids.size).toBe(100)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
})

describe('names', () => {
  it('shows Untitled for a blank title', () => {
    expect(displayTitle(doc('1', { title: '  ' }))).toBe('Untitled')
    expect(displayTitle(doc('1', { title: 'Essay' }))).toBe('Essay')
  })

  it('tidies folder names', () => {
    expect(cleanFolder('  Work   notes ')).toBe('Work notes')
  })

  it('parses tags trimmed, lowercased, without # and repeats', () => {
    expect(parseTags('Work, #ideas, work, ,##Draft')).toEqual(['work', 'ideas', 'draft'])
  })

  it('makes an export file name without characters file systems refuse', () => {
    expect(fileName(doc('1', { title: 'Plan: v2?' }))).toBe('Plan v2.md')
    expect(fileName(doc('1', { title: '///' }))).toBe('Untitled.md')
    expect(fileName(doc('1'))).toBe('Untitled.md')
  })
})

describe('foldersOf and tagsOf', () => {
  it('lists each folder and tag once, sorted, leaving out unfiled', () => {
    const docs = [doc('1', { folder: 'Work', tags: ['b'] }), doc('2', { tags: ['a', 'b'] }), doc('3', { folder: 'Essays' })]
    expect(foldersOf(docs)).toEqual(['Essays', 'Work'])
    expect(tagsOf(docs)).toEqual(['a', 'b'])
  })
})

describe('filterDocs', () => {
  const docs = [
    doc('1', { title: 'Letter', folder: 'Work', tags: ['draft'] }),
    doc('3', { title: 'Essay', content: 'On *quiet* tools' }),
    doc('2', { title: 'Notes', folder: 'Work', tags: ['ideas'] }),
  ]
  const ids = (filter: Partial<DocFilter>) => filterDocs(docs, { ...all, ...filter }).map((d) => d.id)

  it('lists the most recently edited first', () => {
    expect(ids({})).toEqual(['3', '2', '1'])
  })

  it('keeps a folder, or unfiled documents for the empty folder', () => {
    expect(ids({ folder: 'Work' })).toEqual(['2', '1'])
    expect(ids({ folder: '' })).toEqual(['3'])
  })

  it('keeps a tag, combined with the folder', () => {
    expect(ids({ tag: 'draft' })).toEqual(['1'])
    expect(ids({ folder: 'Work', tag: 'ideas' })).toEqual(['2'])
  })

  it('searches title, text and tags, ignoring case', () => {
    expect(ids({ query: 'QUIET' })).toEqual(['3'])
    expect(ids({ query: 'letter' })).toEqual(['1'])
    expect(ids({ query: ' idea ' })).toEqual(['2'])
    expect(ids({ query: 'nothing' })).toEqual([])
  })
})

describe('countWords', () => {
  it('counts words, not markdown markers', () => {
    expect(countWords('')).toBe(0)
    expect(countWords('  \n ')).toBe(0)
    expect(countWords('# A title\n\n- one item\n> quoted **bold** text\n```\ncode\n```')).toBe(8)
  })

  it('counts words in any script', () => {
    expect(countWords('café olá 2022')).toBe(3)
  })
})

describe('readingMinutes', () => {
  it('rounds up at 200 words a minute', () => {
    expect(readingMinutes(0)).toBe(0)
    expect(readingMinutes(1)).toBe(1)
    expect(readingMinutes(200)).toBe(1)
    expect(readingMinutes(201)).toBe(2)
  })
})

describe('formatDate', () => {
  it('shows a short date', () => {
    expect(formatDate('2022-10-07T12:00:00Z')).toBe('Oct 7, 2022')
  })
})
