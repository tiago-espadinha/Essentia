// An in-memory stand-in for acta_write_task and the acta_tasks table, following
// supabase/migration.sql step by step: owner check, validation, receipt first,
// then the version check.
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncPort } from '../data/sync'
import { isContent, type Content, type Operation } from '../data/syncStorage'

interface Row { version: number; content: Content | null; created_at: string }
interface Receipt { taskId: string; expectedVersion: number; content: string; result: object; at: number }

export class ServerError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const RECEIPT_DAYS = 30
const DAY = 86_400_000

export class FakeAccount {
  tables = new Map<string, Map<string, Row>>()
  receipts = new Map<string, Map<string, Receipt>>()
  /** Milliseconds; tests move it on to expire receipts. */
  now = Date.parse('2023-04-01T10:00:00Z')
  writes = 0

  write(caller: string | null, owner: string, { operationId, taskId, expectedVersion, content }: Operation): object {
    if (caller === null) throw new ServerError('42501', 'Not signed in')
    if (owner !== caller) throw new ServerError('42501', 'Wrong account')
    if (!isContent(content)) throw new ServerError('22023', 'Invalid task')
    const receipts = this.receipts.get(caller) ?? new Map<string, Receipt>()
    this.receipts.set(caller, receipts)
    for (const [id, receipt] of receipts) if (receipt.at < this.now - RECEIPT_DAYS * DAY) receipts.delete(id)
    const receipt = receipts.get(operationId)
    if (receipt) {
      if (receipt.taskId !== taskId || receipt.expectedVersion !== expectedVersion || receipt.content !== JSON.stringify(content)) {
        throw new ServerError('22023', 'Operation ID already used')
      }
      return receipt.result
    }
    const table = this.tables.get(caller) ?? new Map<string, Row>()
    this.tables.set(caller, table)
    const current = table.get(taskId)
    let result: object
    if ((current?.version ?? 0) !== expectedVersion) {
      result = { status: 'conflict', version: current?.version ?? 0, content: current?.content ?? null, created_at: current?.created_at ?? null }
    } else {
      this.now += 1000
      const row = { version: expectedVersion + 1, content, created_at: current?.created_at ?? new Date(this.now).toISOString() }
      table.set(taskId, row)
      result = { status: 'applied', ...row }
    }
    receipts.set(operationId, { taskId, expectedVersion, content: JSON.stringify(content), result, at: this.now })
    this.writes++
    return structuredClone(result)
  }

  /** What row level security lets `caller` read. */
  read(caller: string | null): unknown[] {
    if (caller === null) return []
    return [...(this.tables.get(caller) ?? new Map<string, Row>())].map(([id, row]) => structuredClone({ id, ...row }))
  }

  /** One device's way in. `session` is whoever is signed in when the request arrives. */
  port(session: () => string | null, network: { down?: boolean; loseNextAnswer?: boolean } = {}): SyncPort {
    return {
      write: async (owner, operation) => {
        if (network.down) throw new TypeError('Failed to fetch')
        const answer = this.write(session(), owner, operation)
        if (network.loseNextAnswer) {
          network.loseNextAnswer = false
          throw new TypeError('Failed to fetch')
        }
        return answer
      },
      read: async () => {
        if (network.down) throw new TypeError('Failed to fetch')
        return this.read(session())
      },
    }
  }
}

type Listener = (event: string, session: { user: { id: string } } | null) => void

/** The stored session's key for VITE_SUPABASE_URL https://test.supabase.co. */
export const SESSION_KEY = 'sb-test-auth-token'

/** The few Supabase client calls Acta makes, answered by `server`, with every auth subscriber told. */
export function fakeClient(server: FakeAccount, network: { down?: boolean } = {}) {
  let user: string | null = null
  const listeners = new Set<Listener>()
  const port = server.port(() => user, network)
  const answer = async (request: () => Promise<unknown>) => {
    try {
      return { data: await request(), error: null }
    } catch (error) {
      return { data: null, error }
    }
  }
  const query = { select: () => query, order: () => query, range: () => answer(port.read) }
  const client = {
    from: () => query,
    rpc: (_name: string, args: Record<string, unknown>) => answer(() => port.write(args.p_owner as string, {
      operationId: args.p_operation_id, taskId: args.p_task_id, expectedVersion: args.p_expected_version, content: args.p_content,
    } as Operation)),
    auth: {
      onAuthStateChange: (callback: Listener) => {
        listeners.add(callback)
        queueMicrotask(() => callback('INITIAL_SESSION', user ? { user: { id: user } } : null))
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
      },
    },
  } as unknown as SupabaseClient
  /** A session already stored on this device, as after a reload. */
  const restore = (id: string) => {
    user = id
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { id } }))
  }
  /** Signs in or out as Supabase does: the stored session first, then the event. */
  const signIn = (id: string | null) => {
    if (id) restore(id)
    else {
      user = null
      localStorage.removeItem(SESSION_KEY)
    }
    for (const listener of listeners) listener(id ? 'SIGNED_IN' : 'SIGNED_OUT', id ? { user: { id } } : null)
  }
  return { client, restore, signIn }
}
