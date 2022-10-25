// The account's copy of the documents in Supabase; row level security limits
// every query to the signed-in user's rows.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Push } from './sync'

/** PostgREST's default cap on rows per response; longer tables are read in pages. */
const PAGE = 1000

/** Every document of the account, deleted ones included, unchecked: `readRemote` decides what to trust. */
export async function fetchRemote(client: SupabaseClient): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from('documents')
      .select('id, title, content, folder, tags, created_at, updated_at, deleted_at')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

export async function pushChanges(client: SupabaseClient, push: Push) {
  if (push.docs.length > 0) {
    const { error } = await client.from('documents').upsert(push.docs)
    if (error) throw error
  }
  // A deletion only stamps the row; deletions are rare enough per sync that one request each is fine.
  // It skips a row another device changed after the deletion, which then comes back next sync.
  for (const { id, at } of push.deletions) {
    const { error } = await client
      .from('documents')
      .update({ deleted_at: at, updated_at: at })
      .eq('id', id)
      .lt('updated_at', at)
    if (error) throw error
  }
}
