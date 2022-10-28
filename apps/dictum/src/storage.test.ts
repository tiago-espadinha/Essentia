import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDoc, type Doc } from './documents'
import { DOCS_KEY, loadDocs, loadStamps, loadVersions, save, SYNC_KEY, VERSIONS_KEY } from './storage'
import { NO_STAMPS } from './sync'
import type { Version } from './versions'

const doc: Doc = {
  ...createDoc('Work', new Date('2022-10-04T10:00:00Z'), 'a'),
  title: 'Essay',
  content: '# Essay',
  tags: ['draft'],
}
const version: Version = { id: 'v1', docId: 'a', title: 'Essay', content: '#', savedAt: '2022-10-04T10:05:00.000Z' }

const store = (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('document storage', () => {
  it('starts empty when nothing is saved', () => {
    expect(loadDocs()).toEqual([])
  })

  it('round-trips the documents under the prefixed key', () => {
    expect(save(DOCS_KEY, [doc])).toBe(true)
    expect(JSON.parse(localStorage.getItem(DOCS_KEY)!)).toEqual([doc])
    expect(loadDocs()).toEqual([doc])
  })

  it('does not read the old MarkFlow keys', () => {
    store('markflow_documents', [doc])
    expect(loadDocs()).toEqual([])
  })

  it('ignores corrupt or non-list data', () => {
    localStorage.setItem(DOCS_KEY, '{not json')
    expect(loadDocs()).toEqual([])
    store(DOCS_KEY, { id: 'a' })
    expect(loadDocs()).toEqual([])
  })

  it('skips malformed and repeated entries, keeps the valid ones and drops unknown fields', () => {
    store(DOCS_KEY, [
      { ...doc, extra: '<script>' },
      { ...doc, title: 'Second copy' },
      { ...doc, id: 'b', tags: [1] },
      { ...doc, id: 'c', updatedAt: 'yesterday' },
      { ...doc, id: 'd', folder: undefined },
      null,
    ])
    expect(loadDocs()).toEqual([doc])
  })

  it('tidies folder names and tags from storage', () => {
    store(DOCS_KEY, [{ ...doc, folder: '  Work   notes ', tags: ['#Draft', 'draft', ' '] }])
    expect(loadDocs()[0]).toMatchObject({ folder: 'Work notes', tags: ['draft'] })
  })

  it('reports a refused write instead of throwing', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    expect(save(DOCS_KEY, [doc])).toBe(false)
  })
})

describe('version storage', () => {
  it('round-trips versions of known documents', () => {
    save(VERSIONS_KEY, [version])
    expect(loadVersions(['a'])).toEqual([version])
  })

  it('drops versions of documents that no longer exist, and malformed ones', () => {
    store(VERSIONS_KEY, [version, { ...version, id: 'v2', docId: 'gone' }, { ...version, id: 'v3', savedAt: 5 }])
    expect(loadVersions(['a'])).toEqual([version])
  })
})

describe('sync stamps', () => {
  it('start with no owner and no deletions', () => {
    expect(loadStamps()).toEqual(NO_STAMPS)
  })

  it('round-trip the owner and the deletions', () => {
    const stamps = { owner: 'ana', deleted: { a: '2022-10-20T10:00:00.000Z' } }
    expect(save(SYNC_KEY, stamps)).toBe(true)
    expect(loadStamps()).toEqual(stamps)
  })

  it('start over when the saved stamps are malformed', () => {
    for (const bad of [{ owner: 1, deleted: {} }, { owner: null, deleted: [] }, { owner: null, deleted: { a: 'soon' } }, 'x']) {
      store(SYNC_KEY, bad)
      expect(loadStamps()).toEqual(NO_STAMPS)
    }
    localStorage.setItem(SYNC_KEY, '{')
    expect(loadStamps()).toEqual(NO_STAMPS)
  })
})
