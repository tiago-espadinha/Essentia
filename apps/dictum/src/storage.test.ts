import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDoc, type Doc } from './documents'
import { DOCS_KEY, loadDocs, loadVersions, save, VERSIONS_KEY } from './storage'
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
