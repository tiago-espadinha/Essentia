import { describe, expect, it } from 'vitest'
import { createDoc, type Doc } from './documents'
import { LIMITS, merge, NO_STAMPS, readRemote, stampDeletions, type DocRow, type Stamps } from './sync'

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const T1 = '2022-10-20T10:00:00.000Z'
const T2 = '2022-10-20T11:00:00.000Z'
const T3 = '2022-10-20T12:00:00.000Z'

function doc(changes: Partial<Doc> = {}): Doc {
  return { ...createDoc('', new Date(T1), ID), title: 'Plan', content: '# Plan', ...changes }
}

function row(changes: Partial<DocRow> = {}): DocRow {
  return {
    id: ID,
    title: 'Plan',
    content: '# Plan',
    folder: '',
    tags: [],
    created_at: T1,
    updated_at: T1,
    deleted_at: null,
    ...changes,
  }
}

const stamps = (deleted: Record<string, string> = {}): Stamps => ({ owner: 'ana', deleted })

describe('merge', () => {
  it('uploads documents the account does not have yet', () => {
    const local = doc()
    const result = merge([local], stamps(), [])
    expect(result.docs).toEqual([local])
    expect(result.push.docs).toEqual([row()])
  })

  it('adds the account’s documents this device does not have', () => {
    const result = merge([], stamps(), [row({ title: 'From the laptop', updated_at: '2022-10-20T12:00:00+00:00' })])
    expect(result.docs).toEqual([doc({ title: 'From the laptop', updatedAt: T3 })])
    expect(result.push).toEqual({ docs: [], deletions: [] })
  })

  it('keeps the newer side of a document changed on both', () => {
    const newerHere = merge([doc({ content: 'here', updatedAt: T3 })], stamps(), [row({ content: 'there', updated_at: T2 })])
    expect(newerHere.docs[0].content).toBe('here')
    expect(newerHere.push.docs.map((r) => r.content)).toEqual(['here'])

    const newerThere = merge([doc({ content: 'here', updatedAt: T2 })], stamps(), [row({ content: 'there', updated_at: T3 })])
    expect(newerThere.docs[0].content).toBe('there')
    expect(newerThere.push.docs).toEqual([])
  })

  it('takes folder and tags with the rest of the document', () => {
    const result = merge([doc()], stamps(), [row({ folder: 'Work', tags: ['draft'], updated_at: T2 })])
    expect(result.docs[0]).toMatchObject({ folder: 'Work', tags: ['draft'], updatedAt: T2 })
  })

  it('sends nothing once both sides match', () => {
    const first = merge([doc({ updatedAt: T2 })], stamps(), [])
    const again = merge(first.docs, first.stamps, first.push.docs)
    expect(again.push).toEqual({ docs: [], deletions: [] })
    expect(again.docs).toEqual(first.docs)
  })

  it('drops a document deleted elsewhere after this device last changed it', () => {
    const result = merge([doc({ updatedAt: T1 })], stamps(), [row({ updated_at: T2, deleted_at: T2 })])
    expect(result.docs).toEqual([])
    expect(result.push.docs).toEqual([])
  })

  it('brings a document back when it was edited here after being deleted elsewhere', () => {
    const result = merge([doc({ content: 'kept', updatedAt: T3 })], stamps(), [row({ updated_at: T2, deleted_at: T2 })])
    expect(result.docs.map((d) => d.content)).toEqual(['kept'])
    expect(result.push.docs).toEqual([row({ content: 'kept', updated_at: T3 })])
  })

  it('tells the server about a deletion, and forgets it once the server has it', () => {
    const first = merge([], stamps({ [ID]: T2 }), [row({ updated_at: T1 })])
    expect(first.docs).toEqual([])
    expect(first.push.deletions).toEqual([{ id: ID, at: T2 }])
    expect(first.stamps.deleted).toEqual({ [ID]: T2 })

    const again = merge([], first.stamps, [row({ updated_at: T2, deleted_at: T2 })])
    expect(again.push).toEqual({ docs: [], deletions: [] })
    expect(again.stamps.deleted).toEqual({})
  })

  it('brings back a document deleted here when the account has a newer edit', () => {
    const result = merge([], stamps({ [ID]: T2 }), [row({ content: 'edited there', updated_at: T3 })])
    expect(result.docs.map((d) => d.content)).toEqual(['edited there'])
    expect(result.push.deletions).toEqual([])
    expect(result.stamps.deleted).toEqual({})
  })

  it('does not send a deletion the server already has from another device', () => {
    const result = merge([], stamps({ [ID]: T3 }), [row({ updated_at: T2, deleted_at: T2 })])
    expect(result.docs).toEqual([])
    expect(result.push.deletions).toEqual([])
    expect(result.stamps.deleted).toEqual({})
  })

  it('forgets a deletion the server never heard of', () => {
    const result = merge([], stamps({ [ID]: T2 }), [])
    expect(result.push).toEqual({ docs: [], deletions: [] })
    expect(result.stamps.deleted).toEqual({})
  })

  it('keeps documents the table cannot hold on this device only', () => {
    const local = [doc({ id: 'old-id' }), doc({ id: OTHER, title: 'x'.repeat(LIMITS.title + 1) })]
    const result = merge(local, stamps(), [])
    expect(result.docs).toEqual(local)
    expect(result.push.docs).toEqual([])
  })
})

describe('readRemote', () => {
  it('keeps well-formed rows and tidies their folder and tags', () => {
    expect(readRemote([row({ folder: '  Work   notes ', tags: ['#Draft', 'draft', ' ideas '] })])).toEqual([
      row({ folder: 'Work notes', tags: ['draft', 'ideas'] }),
    ])
  })

  it('drops rows it cannot trust', () => {
    const bad = [
      null,
      'row',
      row({ id: 'not-a-uuid' }),
      { ...row(), title: 1 },
      { ...row(), tags: 'draft' },
      { ...row(), tags: [1] },
      row({ updated_at: 'yesterday' }),
      row({ deleted_at: 'gone' }),
    ]
    expect(readRemote(bad)).toEqual([])
  })
})

describe('stampDeletions', () => {
  it('stamps documents that a change removed', () => {
    const a = doc()
    const b = doc({ id: OTHER })
    expect(stampDeletions([a, b], [a], stamps(), T2).deleted).toEqual({ [OTHER]: T2 })
  })

  it('drops the stamp of a document put back', () => {
    expect(stampDeletions([], [doc()], stamps({ [ID]: T2 }), T3)).toEqual({ owner: 'ana', deleted: {} })
  })

  it('leaves the owner alone', () => {
    expect(stampDeletions([], [], NO_STAMPS, T2)).toEqual(NO_STAMPS)
  })
})
