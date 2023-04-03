// The account's tasks in Supabase. Row level security limits reads to the
// signed-in user, and every write goes through acta_write_task.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncPort } from './sync'

/** PostgREST's default cap on rows per response; longer lists are read in pages. */
const PAGE = 1000

export function supabasePort(client: SupabaseClient): SyncPort {
  return {
    async read() {
      const rows: unknown[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await client
          .from('acta_tasks')
          .select('id, version, content, created_at')
          .order('created_at', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        rows.push(...data)
        if (data.length < PAGE) return rows
      }
    },
    async write(owner, { operationId, taskId, expectedVersion, content }) {
      const { data, error } = await client.rpc('acta_write_task', {
        p_owner: owner,
        p_operation_id: operationId,
        p_task_id: taskId,
        p_expected_version: expectedVersion,
        p_content: content,
      })
      if (error) throw error
      return data
    },
  }
}
