// The account's copy of the notes and folders in Supabase; row level security
// limits every query to the signed-in user's rows (supabase/migration.sql).
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Push } from './sync'

/** PostgREST's default cap on rows per response; longer tables are read in pages. */
const PAGE = 1000

const NOTE_COLUMNS = 'id, format, title, content, folder, tags, pinned, created_at, updated_at, deleted_at'

async function fetchAll(client: SupabaseClient, table: string, columns: string, key: string): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(key)
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...(data as unknown[]))
    if (data.length < PAGE) return rows
  }
}

/** Every note and folder of the account, deleted ones included, unchecked: `readRemote` and `readRemoteFolders` decide what to trust. */
export async function fetchRemote(client: SupabaseClient): Promise<{ notes: unknown[]; folders: unknown[] }> {
  const notes = await fetchAll(client, 'documents', NOTE_COLUMNS, 'id')
  const folders = await fetchAll(client, 'note_folders', 'name, updated_at, deleted_at', 'name')
  return { notes, folders }
}

/**
 * Sends a merge's changes for `user`. Each row names its owner, so if the
 * session has switched to another account meanwhile, the tables refuse it.
 */
export async function pushChanges(client: SupabaseClient, push: Push, user: string) {
  if (push.notes.length > 0) {
    const { error } = await client.from('documents').upsert(push.notes.map((note) => ({ ...note, user_id: user })))
    if (error) throw error
  }
  if (push.folders.length > 0) {
    const { error } = await client
      .from('note_folders')
      .upsert(push.folders.map((folder) => ({ ...folder, user_id: user })), { onConflict: 'user_id,name' })
    if (error) throw error
  }
  // A deletion only stamps the row; deletions are rare enough per sync that one request each is fine.
  // It skips a row another device changed after the deletion, which then comes back next sync.
  for (const { id, at } of push.deletions) {
    const { error } = await client
      .from('documents')
      .update({ deleted_at: at, updated_at: at })
      .eq('id', id)
      .eq('user_id', user)
      .lt('updated_at', at)
    if (error) throw error
  }
  for (const { name, at } of push.folderDeletions) {
    const { error } = await client
      .from('note_folders')
      .update({ deleted_at: at, updated_at: at })
      .eq('user_id', user)
      .eq('name', name)
      .lt('updated_at', at)
    if (error) throw error
  }
}
