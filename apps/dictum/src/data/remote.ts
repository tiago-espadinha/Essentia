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

/**
 * Sends a merge's changes for `user`. Each row names its owner, so if the
 * session has switched to another account meanwhile, the table refuses it.
 */
export async function pushChanges(client: SupabaseClient, push: Push, user: string) {
  if (push.docs.length > 0) {
    const { error } = await client.from('documents').upsert(push.docs.map((doc) => ({ ...doc, user_id: user })))
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

/** The link id of one of the account's documents, or null while it is not shared. */
export async function fetchShareId(client: SupabaseClient, documentId: string): Promise<string | null> {
  const { data, error } = await client.from('documents').select('share_id').eq('id', documentId).maybeSingle()
  if (error) throw error
  return (data as { share_id: string | null } | null)?.share_id ?? null
}

/** Shares the document and returns its link id; null when the account does not have it. */
export async function shareDocument(client: SupabaseClient, documentId: string): Promise<string | null> {
  const { data, error } = await client.rpc('share_document', { document_id: documentId })
  if (error) throw error
  return typeof data === 'string' ? data : null
}

export async function unshareDocument(client: SupabaseClient, documentId: string) {
  const { error } = await client.rpc('unshare_document', { document_id: documentId })
  if (error) throw error
}

/** The document behind a share link, unchecked; anyone may call it, signed in or not. */
export async function fetchShared(client: SupabaseClient, linkId: string): Promise<unknown> {
  const { data, error } = await client.rpc('get_shared_document', { link_id: linkId })
  if (error) throw error
  return Array.isArray(data) ? (data[0] ?? null) : null
}
