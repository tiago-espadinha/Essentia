// The account's copy of the transactions in Supabase; row level security limits
// every query to the signed-in user's rows.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Push } from './sync'

/** PostgREST's default cap on rows per response; longer tables are read in pages. */
const PAGE = 1000

/**
 * Every transaction of the account, deleted ones included, unchecked: `readRemote`
 * decides what to trust. Pages follow the id, so a row added meanwhile cannot
 * shift a later page and hide another row.
 */
export async function fetchRemote(client: SupabaseClient): Promise<unknown[]> {
  const rows: unknown[] = []
  let after: string | null = null
  for (;;) {
    let query = client
      .from('transactions')
      .select('id, description, amount, type, category, occurred_on, created_at, updated_at, deleted_at')
      .order('id')
    if (after !== null) query = query.gt('id', after)
    const { data, error } = await query.limit(PAGE)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
    after = (data.at(-1) as { id: string }).id
  }
}

/**
 * Sends the merge's changes for `user`. Each row names its owner, so if the
 * session has switched to another account meanwhile, the table refuses it.
 */
export async function pushChanges(client: SupabaseClient, push: Push, user: string) {
  const rows = push.rows.map((row) => ({ ...row, user_id: user }))
  // A first sign-in or a CSV import can bring many rows; one request each stays small.
  for (let from = 0; from < rows.length; from += PAGE) {
    const { error } = await client.from('transactions').upsert(rows.slice(from, from + PAGE))
    if (error) throw error
  }
  // A deletion only stamps the row; deletions are rare enough per sync that one request each is fine.
  // It skips a row another device changed after the deletion, which then comes back next sync.
  for (const { id, at } of push.deletions) {
    const { error } = await client
      .from('transactions')
      .update({ deleted_at: at, updated_at: at })
      .eq('id', id)
      .lt('updated_at', at)
    if (error) throw error
  }
}
