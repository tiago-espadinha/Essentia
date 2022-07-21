import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createNote, type Note } from './notes'
import { loadNotes, saveNotes, STORAGE_KEY } from './storage'

const valid: Note = {
  ...createNote(new Date('2022-06-20T10:00:00Z'), 'a'),
  title: 'Plan',
  body: '<p>Write</p>',
  tags: ['work'],
}

const store = (value: unknown) => localStorage.setItem(STORAGE_KEY, JSON.stringify(value))

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('note storage', () => {
  it('starts empty when nothing is saved', () => {
    expect(loadNotes()).toEqual([])
  })

  it('round-trips the notes under the prefixed key', () => {
    expect(saveNotes([valid])).toBe(true)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual([valid])
    expect(loadNotes()).toEqual([valid])
  })

  it('does not read the old unprefixed key', () => {
    localStorage.setItem('folio-notes', JSON.stringify([valid]))
    expect(loadNotes()).toEqual([])
  })

  it('ignores corrupt or non-list data', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
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
    ])
    expect(loadNotes()).toEqual([valid])
  })

  it('drops repeated ids and unknown fields, and cleans the tags', () => {
    store([valid, { ...valid, title: 'Copy' }, { ...valid, id: 'b', tags: [' Work ', 'work', ''], extra: 1 }])
    expect(loadNotes()).toEqual([valid, { ...valid, id: 'b', tags: ['work'] }])
  })

  it('sanitizes saved bodies, which may have been tampered with', () => {
    store([{ ...valid, body: '<p onclick="alert(1)">Write</p><script>alert(1)</script><img src=x onerror=alert(1)>' }])
    expect(loadNotes()[0].body).toBe('<p>Write</p>')
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
