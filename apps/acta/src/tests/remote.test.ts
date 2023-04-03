import type { SupabaseClient } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { supabasePort } from '../data/remote'

/** A query builder that answers each `range` from `pages`, in turn. */
function clientWith(pages: { data: unknown[] | null; error: Error | null }[], rpc = vi.fn()) {
  const query = { select: () => query, order: () => query, range: vi.fn(async () => pages.shift()!) }
  return { client: { from: () => query, rpc } as unknown as SupabaseClient, query }
}

describe('the Supabase port', () => {
  it('reads every page of a long list', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const { client, query } = clientWith([{ data: full, error: null }, { data: [{ id: 'last' }], error: null }])
    expect(await supabasePort(client).read()).toHaveLength(1001)
    expect(query.range).toHaveBeenNthCalledWith(2, 1000, 1999)
  })

  it('fails the read on an error rather than returning part of the list', async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ id: i }))
    const { client } = clientWith([{ data: full, error: null }, { data: null, error: new Error('timeout') }])
    await expect(supabasePort(client).read()).rejects.toThrow('timeout')
  })

  it('names the account each write was queued for', async () => {
    const rpc = vi.fn(async () => ({ data: { status: 'applied' }, error: null }))
    const { client } = clientWith([], rpc)
    const operation = { operationId: 'op', taskId: 'task', expectedVersion: 2, content: null }
    expect(await supabasePort(client).write('owner', operation)).toEqual({ status: 'applied' })
    expect(rpc).toHaveBeenCalledWith('acta_write_task', {
      p_owner: 'owner', p_operation_id: 'op', p_task_id: 'task', p_expected_version: 2, p_content: null,
    })
  })

  it('throws a refused write, so it stays queued', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: new Error('Wrong account') }))
    const { client } = clientWith([], rpc)
    await expect(supabasePort(client).write('owner', { operationId: 'op', taskId: 't', expectedVersion: 0, content: null }))
      .rejects.toThrow('Wrong account')
  })
})
