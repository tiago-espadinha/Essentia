// The account's copy of its records in Supabase; row level security limits
// every query to the signed-in user's rows.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Changes, Push } from './sync'

/** A synced table: the columns the app reads, and the column that names a row for its owner. */
export interface Table {
  name: string
  columns: string
  key: string
}

export const TRANSACTIONS: Table = {
  name: 'transactions',
  columns: 'id, description, amount, type, category, occurred_on, created_at, updated_at, deleted_at',
  key: 'id',
}

export const BUDGETS: Table = { name: 'budgets', columns: 'category, amount, updated_at, deleted_at', key: 'category' }

/** PostgREST's default cap on rows per response; longer tables are read in pages. */
const PAGE = 1000

/**
 * Every row of the account, deleted ones included, unchecked: the table's reader
 * decides what to trust. Pages follow the key, so a row added meanwhile cannot
 * shift a later page and hide another row.
 */
export async function fetchRows(client: SupabaseClient, table: Table): Promise<unknown[]> {
  const rows: unknown[] = []
  let after: string | null = null
  for (;;) {
    let query = client.from(table.name).select(table.columns).order(table.key)
    if (after !== null) query = query.gt(table.key, after)
    const { data, error } = await query.limit(PAGE)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
    after = (data.at(-1) as unknown as Record<string, string>)[table.key]
  }
}

/**
 * Sends a merge's changes for `user`. Each row names its owner, so if the
 * session has switched to another account meanwhile, the table refuses it.
 */
export async function pushRows<R extends object>(client: SupabaseClient, table: Table, push: Changes<R>, user: string) {
  const rows = push.rows.map((row) => ({ ...row, user_id: user }))
  // A first sign-in or a CSV import can bring many rows; one request each stays small.
  for (let from = 0; from < rows.length; from += PAGE) {
    const { error } = await client.from(table.name).upsert(rows.slice(from, from + PAGE))
    if (error) throw error
  }
  // A deletion only stamps the row; deletions are rare enough per sync that one request each is fine.
  // It skips a row another device changed after the deletion, which then comes back next sync.
  for (const { id, at } of push.deletions) {
    const { error } = await client
      .from(table.name)
      .update({ deleted_at: at, updated_at: at })
      .eq(table.key, id)
      .lt('updated_at', at)
    if (error) throw error
  }
}

/** Every transaction of the account; `readRemote` decides what to trust. */
export const fetchRemote = (client: SupabaseClient) => fetchRows(client, TRANSACTIONS)

export const pushChanges = (client: SupabaseClient, push: Push, user: string) => pushRows(client, TRANSACTIONS, push, user)
