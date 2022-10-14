// The account's copy of the habits in Supabase; row level security limits every
// query to the signed-in user's rows.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Push } from './sync'

/** PostgREST's default cap on rows per response; longer tables are read in pages. */
const PAGE = 1000

async function readAll(client: SupabaseClient, table: string, columns: string, order: string[]): Promise<unknown[]> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    let query = client.from(table).select(columns)
    for (const column of order) query = query.order(column)
    const { data, error } = await query.range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < PAGE) return rows
  }
}

/** Every habit and check-in of the account, unchecked: `readRemote` decides what to trust. */
export async function fetchRemote(client: SupabaseClient) {
  const [habits, checkIns] = await Promise.all([
    readAll(client, 'habits', 'id, name, category, days, unit, target, created_at, updated_at, deleted_at', ['id']),
    readAll(client, 'check_ins', 'habit_id, day, value, updated_at', ['habit_id', 'day']),
  ])
  return { habits, checkIns }
}

/** Habits go first, since a check-in must point at one of the user's habits. */
export async function pushChanges(client: SupabaseClient, push: Push) {
  if (push.habits.length > 0) {
    const { error } = await client.from('habits').upsert(push.habits)
    if (error) throw error
  }
  // A deletion only stamps the row, so it needs no settings; deletions are rare
  // enough per sync that one request each is fine.
  for (const { id, at } of push.deletions) {
    const { error } = await client.from('habits').update({ deleted_at: at, updated_at: at }).eq('id', id)
    if (error) throw error
  }
  if (push.checkIns.length > 0) {
    const { error } = await client.from('check_ins').upsert(push.checkIns, { onConflict: 'habit_id,day' })
    if (error) throw error
  }
}
