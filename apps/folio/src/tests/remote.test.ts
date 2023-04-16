import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { fetchRemote, pushChanges } from '../data/remote'
import type { NoteRow, Push } from '../data/sync'

type Call = { table: string; op: string; args: unknown[] }

/**
 * A stand-in for the Supabase client that records every call. `pages` answers
 * each table's selects in order; `fail` makes the named operation return an error.
 */
function fakeClient(pages: Record<string, unknown[][]> = {}, fail?: string) {
  const calls: Call[] = []
  const client = {
    from(table: string) {
      const steps: Call[] = []
      const builder = {
        select: (...args: unknown[]) => record('select', args),
        order: (...args: unknown[]) => record('order', args),
        range: (...args: unknown[]) => record('range', args),
        upsert: (...args: unknown[]) => record('upsert', args),
        update: (...args: unknown[]) => record('update', args),
        delete: (...args: unknown[]) => record('delete', args),
        eq: (...args: unknown[]) => record('eq', args),
        lt: (...args: unknown[]) => record('lt', args),
        then(resolve: (value: unknown) => void) {
          const op = steps[0].op
          if (fail === `${table}.${op}`) return resolve({ data: null, error: new Error('refused') })
          const data = op === 'select' ? (pages[table]?.shift() ?? []) : null
          resolve({ data, error: null })
        },
      }
      function record(op: string, args: unknown[]) {
        const call = { table, op, args }
        steps.push(call)
        calls.push(call)
        return builder
      }
      return builder
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

const ROW: NoteRow = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  format: 'rich',
  title: 'Plan',
  content: '<p>Plan</p>',
  folder: '',
  tags: [],
  pinned: true,
  created_at: '2023-04-15T10:00:00.000Z',
  updated_at: '2023-04-15T10:00:00.000Z',
  deleted_at: null,
}

const EMPTY: Push = { notes: [], deletions: [], folders: [], folderDeletions: [] }
const AT = '2023-04-15T12:00:00.000Z'

describe('fetchRemote', () => {
  it('reads both tables in pages of 1000 until a short page', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ i }))
    const { client, calls } = fakeClient({ documents: [full, [{ i: 'last' }]], note_folders: [[{ name: 'Work' }]] })
    const remote = await fetchRemote(client)
    expect(remote.notes).toHaveLength(1001)
    expect(remote.folders).toEqual([{ name: 'Work' }])
    expect(calls.filter((c) => c.op === 'range').map((c) => [c.table, ...c.args])).toEqual([
      ['documents', 0, 999],
      ['documents', 1000, 1999],
      ['note_folders', 0, 999],
    ])
    expect(calls.find((c) => c.table === 'documents' && c.op === 'select')?.args[0]).toContain('format')
    expect(calls.find((c) => c.table === 'documents' && c.op === 'select')?.args[0]).toContain('pinned')
  })

  it('stops at a page shorter than 1000', async () => {
    const { client, calls } = fakeClient({ documents: [Array.from({ length: 999 }, () => ({}))] })
    await fetchRemote(client)
    expect(calls.filter((c) => c.table === 'documents' && c.op === 'range')).toHaveLength(1)
  })

  it('throws when the account cannot be read', async () => {
    const { client } = fakeClient({}, 'documents.select')
    await expect(fetchRemote(client)).rejects.toThrow('refused')
  })
})

describe('pushChanges', () => {
  it('makes no request when there is nothing to send', async () => {
    const { client, calls } = fakeClient()
    await pushChanges(client, EMPTY, 'ana')
    expect(calls).toEqual([])
  })

  it('names the owner on every note and folder it sends, over any owner in the row', async () => {
    const { client, calls } = fakeClient()
    const sneaky = { ...ROW, user_id: 'eve' } as NoteRow
    await pushChanges(client, { ...EMPTY, notes: [sneaky], folders: [{ name: 'Work', updated_at: AT, deleted_at: null }] }, 'ana')
    const upserts = calls.filter((c) => c.op === 'upsert')
    expect(upserts.map((c) => c.table)).toEqual(['documents', 'note_folders'])
    expect((upserts[0].args[0] as { user_id: string }[]).map((r) => r.user_id)).toEqual(['ana'])
    expect(upserts[0].args[0]).toEqual([{ ...ROW, user_id: 'ana' }])
    expect(upserts[1].args).toEqual([[{ name: 'Work', updated_at: AT, deleted_at: null, user_id: 'ana' }], { onConflict: 'user_id,name' }])
  })

  it('deletes by stamping only the owner’s rows older than the deletion, never removing them', async () => {
    const { client, calls } = fakeClient()
    await pushChanges(client, { ...EMPTY, deletions: [{ id: ROW.id, at: AT }], folderDeletions: [{ name: 'Work', at: AT }] }, 'ana')
    expect(calls.some((c) => c.op === 'delete')).toBe(false)
    expect(calls.map((c) => [c.table, c.op, ...c.args])).toEqual([
      ['documents', 'update', { deleted_at: AT, updated_at: AT }],
      ['documents', 'eq', 'id', ROW.id],
      ['documents', 'eq', 'user_id', 'ana'],
      ['documents', 'lt', 'updated_at', AT],
      ['note_folders', 'update', { deleted_at: AT, updated_at: AT }],
      ['note_folders', 'eq', 'user_id', 'ana'],
      ['note_folders', 'eq', 'name', 'Work'],
      ['note_folders', 'lt', 'updated_at', AT],
    ])
  })

  it('stops at the first refused request', async () => {
    const { client, calls } = fakeClient({}, 'documents.upsert')
    const push = { ...EMPTY, notes: [ROW], folders: [{ name: 'Work', updated_at: AT, deleted_at: null }] }
    await expect(pushChanges(client, push, 'ana')).rejects.toThrow('refused')
    expect(calls.some((c) => c.table === 'note_folders')).toBe(false)
  })
})
