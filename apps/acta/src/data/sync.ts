// Acta's sync with the account. Unlike the other apps, nothing is merged by
// time: every write names the server version it was based on, and one based
// on an older version comes back as a conflict the person resolves. All of
// this is pure; the hook persists each state and sends the writes.
import type { Task } from '../domain/tasks'
import {
  isContent, isServerTask, UUID, type AccountState, type Content, type Operation, type ServerTask,
} from './syncStorage'

/** The server's answer to one write. */
export type WriteResult = ServerTask & { status: 'applied' | 'conflict' }

/** A task row read from the account. */
export type RemoteRow = ServerTask & { id: string }

/** Which side deleted the task, if either; shown on the task's row. */
export type ConflictKind = 'changed' | 'deleted-there' | 'deleted-here'

const sameContent = (a: Content | null | undefined, b: Content | null | undefined) =>
  a === b || (!!a && !!b && a.text === b.text && a.completed === b.completed && a.category === b.category && a.due === b.due)

const contentOf = ({ text, completed, category, due }: Task): Content => ({ text, completed, category, due })

/** Whether the account can hold a task made while signed out; one it can't stays on the device. */
export const claimable = (task: Task) => isContent(contentOf(task))

/** The task as this device has it: its last unsent write, else the server's row. */
function localContent(state: AccountState, id: string): Content | null | undefined {
  const pending = state.operations.findLast((operation) => operation.taskId === id)
  return pending ? pending.content : state.tasks[id]?.content
}

/** The tasks to show, in this device's order. A task deleted here but changed elsewhere shows the other side. */
export function visibleTasks(state: AccountState): Task[] {
  return state.order.flatMap((id) => {
    const content = localContent(state, id) ?? state.conflicts[id]?.content
    return content ? [{ id, ...content }] : []
  })
}

export function conflictOf(state: AccountState, id: string): ConflictKind | null {
  const theirs = state.conflicts[id]
  if (!theirs) return null
  if (localContent(state, id) === null) return 'deleted-here'
  return theirs.content === null ? 'deleted-there' : 'changed'
}

/** Whether every change made here has reached the account. */
export const isSettled = (state: AccountState) =>
  state.operations.length === 0 && Object.keys(state.conflicts).length === 0

/**
 * Records a local change to one task as a write to send. A write chains on the
 * task's last unsent one, so several offline edits go up in order.
 * `beforeId` places a task this device isn't showing, as an undone delete.
 */
export function change(state: AccountState, id: string, task: Task | null, operationId: string, beforeId: string | null = null): AccountState {
  const content = task && contentOf(task)
  if (!isContent(content) || sameContent(content, localContent(state, id))) return state
  const pending = state.operations.findLast((operation) => operation.taskId === id)
  const expectedVersion = pending ? pending.expectedVersion + 1 : (state.tasks[id]?.version ?? 0)
  let order = state.order
  if (!order.includes(id)) {
    const index = beforeId === null ? -1 : order.indexOf(beforeId)
    order = beforeId === null ? [id, ...order] : order.toSpliced(index === -1 ? order.length : index, 0, id)
  }
  return { ...state, order, operations: [...state.operations, { operationId, taskId: id, expectedVersion, content }] }
}

/** The next write to send; a conflicted task's writes wait for the person's choice. */
export const nextOperation = (state: AccountState): Operation | undefined =>
  state.operations.find((operation) => !state.conflicts[operation.taskId])

const newer = (row: ServerTask, known: ServerTask | undefined) => !known || row.version > known.version

function withoutTask(state: AccountState, id: string): Pick<AccountState, 'operations' | 'conflicts'> {
  const conflicts = { ...state.conflicts }
  delete conflicts[id]
  return { operations: state.operations.filter((operation) => operation.taskId !== id), conflicts }
}

/** Takes the server's answer to `operation`, which another tab may already have taken. */
export function applyResult(state: AccountState, operation: Operation, result: WriteResult): AccountState {
  const { taskId } = operation
  const row: ServerTask = { version: result.version, content: result.content, createdAt: result.createdAt }
  const tasks = result.version > 0 && newer(row, state.tasks[taskId]) ? { ...state.tasks, [taskId]: row } : state.tasks
  const operations = state.operations.filter((pending) => pending.operationId !== operation.operationId)
  if (operations.length === state.operations.length) return { ...state, tasks }
  if (result.status === 'applied') return { ...state, tasks, operations }
  // The server already holds what this device wants, as after a retry whose receipt has expired.
  if (sameContent(result.content, localContent(state, taskId))) return { ...state, tasks, ...withoutTask(state, taskId) }
  return { ...state, tasks, conflicts: { ...state.conflicts, [taskId]: row } }
}

/** Keep mine: sends this device's version again, based on the server's. */
export function keepMine(state: AccountState, id: string, operationId: string): AccountState {
  const theirs = state.conflicts[id]
  if (!theirs) return state
  const mine = localContent(state, id)
  const rest = { ...state, ...withoutTask(state, id) }
  if (mine === undefined || sameContent(mine, theirs.content)) return rest
  return { ...rest, operations: [...rest.operations, { operationId, taskId: id, expectedVersion: theirs.version, content: mine }] }
}

/** Use theirs: drops this device's unsent changes to the task. */
export function useTheirs(state: AccountState, id: string): AccountState {
  return state.conflicts[id] ? { ...state, ...withoutTask(state, id) } : state
}

/**
 * Takes the account's rows: newer versions replace older ones, and tasks new
 * to this device go on top, newest first. Unsent writes stay on top of them.
 */
export function mergeRemote(state: AccountState, rows: RemoteRow[]): AccountState {
  const tasks = { ...state.tasks }
  const conflicts = { ...state.conflicts }
  const added: RemoteRow[] = []
  for (const { id, ...row } of rows) {
    if (newer(row, tasks[id])) tasks[id] = row
    if (conflicts[id] && newer(row, conflicts[id])) conflicts[id] = row
    if (row.content && !state.order.includes(id) && !added.some((task) => task.id === id)) added.push({ id, ...row })
  }
  added.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.id.localeCompare(b.id))
  let next: AccountState = { ...state, tasks, conflicts, order: [...added.map((task) => task.id), ...state.order] }
  for (const id of Object.keys(conflicts)) {
    if (sameContent(conflicts[id].content, localContent(next, id))) next = { ...next, ...withoutTask(next, id) }
  }
  // Deleted everywhere and settled: nothing left to show or place.
  return { ...next, order: next.order.filter((id) => localContent(next, id) || next.conflicts[id]) }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Keeps the rows the app can trust; the server is checked like any other input. */
export function readRows(rows: unknown[]): RemoteRow[] {
  return rows.flatMap((row) => {
    if (!isObject(row) || typeof row.id !== 'string' || !UUID.test(row.id)) return []
    const task = { version: row.version, content: row.content, createdAt: row.created_at }
    return isServerTask(task) ? [{ id: row.id, ...task }] : []
  })
}

/** The write function's answer, or null when it isn't one. */
export function readResult(value: unknown): WriteResult | null {
  if (!isObject(value) || (value.status !== 'applied' && value.status !== 'conflict')) return null
  const task = { version: value.version, content: value.content ?? null, createdAt: value.created_at ?? null }
  return isServerTask(task, 0) ? { status: value.status, ...task } : null
}

/**
 * Makes the device's signed-out tasks the account's, under ids the server
 * accepts. Each mapping is kept, so claiming again, after a crash or a lost
 * answer, adds nothing twice. Returns the ids claimed; a task the account
 * can't hold stays on the device.
 */
export function claim(state: AccountState, legacy: Task[], newId: () => string): { state: AccountState; claimed: string[] } {
  let next = state
  const claimed: string[] = []
  const used = new Set([...Object.values(state.legacyIds), ...Object.keys(state.tasks), ...state.order])
  // Added from the bottom, so the list keeps its order on top of the account's.
  for (const task of [...legacy].reverse()) {
    if (next.legacyIds[task.id]) {
      claimed.push(task.id)
      continue
    }
    if (!claimable(task)) continue
    const id = UUID.test(task.id) && !used.has(task.id) ? task.id : newId()
    used.add(id)
    next = change({ ...next, legacyIds: { ...next.legacyIds, [task.id]: id } }, id, { ...task, id }, newId())
    claimed.push(task.id)
  }
  return { state: next, claimed }
}

/** How the engine reaches the account; the hook passes Supabase, the tests a fake. */
export interface SyncPort {
  write: (owner: string, operation: Operation) => Promise<unknown>
  read: () => Promise<unknown[]>
}

/** The account copy the hook holds; `update` persists and returns false when it couldn't. */
export interface SyncStore {
  get: () => AccountState
  update: (change: (state: AccountState) => AccountState) => boolean
  /** False once the person has signed out or switched account. */
  current: () => boolean
}

/**
 * Sends every write that can go, then reads the account. Resolves to whether
 * all of this device's changes are in; rejects on a network or server error,
 * keeping every unsent write.
 */
export async function syncAccount(owner: string, port: SyncPort, store: SyncStore): Promise<boolean> {
  for (let operation = nextOperation(store.get()); operation; operation = nextOperation(store.get())) {
    if (!store.current()) return false
    const sent = operation
    const result = readResult(await port.write(owner, sent))
    if (!store.current()) return false
    if (!result) throw new Error('Unexpected answer from the account')
    if (!store.update((state) => applyResult(state, sent, result))) return false
  }
  if (!store.current()) return false
  const rows = readRows(await port.read())
  if (!store.current()) return false
  if (!store.update((state) => mergeRemote(state, rows))) return false
  return isSettled(store.get())
}
