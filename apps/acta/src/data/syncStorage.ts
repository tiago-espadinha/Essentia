// Each account's copy of the tasks on this device, under its own key: what the
// server last said, the order shown here, and the writes still to send.
import { isIsoDay, isPriority, LIMITS, type Priority, type Task } from '../domain/tasks'

/**
 * A task as the server stores it: everything but the id. Priority is left out
 * at none, so content written before priorities existed keeps its shape.
 */
export type Content = Omit<Task, 'id' | 'priority'> & { priority?: Exclude<Priority, 'none'> }

/** One write, kept with its ID until the server has answered it. */
export interface Operation {
  operationId: string
  taskId: string
  /** The version this write is based on; 0 for a task the server has never had. */
  expectedVersion: number
  /** null deletes the task. */
  content: Content | null
}

/** A task's row on the server; content is null once deleted. */
export interface ServerTask {
  version: number
  content: Content | null
  /** null only for a task the server has never had. */
  createdAt: string | null
}

export interface AccountState {
  owner: string
  /** The server's rows as last seen, deleted ones included. */
  tasks: Record<string, ServerTask>
  /** Task ids in the order this device shows them. */
  order: string[]
  /** Writes still to send, oldest first. */
  operations: Operation[]
  /** Tasks changed on another device, waiting for Keep mine or Use theirs: the server's side. */
  conflicts: Record<string, ServerTask>
  /** Ids of tasks made while signed out, mapped to the ids they were added to the account under. */
  legacyIds: Record<string, string>
  /** Signed-out tasks were kept on this device rather than added to the account. */
  declined: boolean
}

export type ReadState = { status: 'ok'; state: AccountState } | { status: 'error' }

export const ACCOUNT_PREFIX = 'essentia-acta-account:'
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const isId = (value: unknown): value is string => typeof value === 'string' && UUID.test(value)
const isVersion = (value: unknown, min: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) < Number.MAX_SAFE_INTEGER
const isStamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value))

export const emptyAccount = (owner: string): AccountState => ({
  owner, tasks: {}, order: [], operations: [], conflicts: {}, legacyIds: {}, declined: false,
})

/** The rules acta_write_task checks (supabase/priority.sql); a task outside them can't be sent. */
export function isContent(value: unknown): value is Content | null {
  if (value === null) return true
  if (!isObject(value)) return false
  const ranked = 'priority' in value
  if (ranked && (value.priority === 'none' || !isPriority(value.priority))) return false
  return Object.keys(value).length === (ranked ? 5 : 4) && typeof value.text === 'string' &&
    // The whole text is counted: the server trims only spaces, so a JS-trimmed count could pass here and fail there.
    value.text.trim().length > 0 && value.text.length <= LIMITS.text &&
    typeof value.completed === 'boolean' && typeof value.category === 'string' && value.category.length <= LIMITS.category &&
    typeof value.due === 'string' && (value.due === '' || isIsoDay(value.due))
}

export function isServerTask(value: unknown, minVersion = 1): value is ServerTask {
  return isObject(value) && isVersion(value.version, minVersion) && isContent(value.content) &&
    (value.createdAt === null ? value.version === 0 : isStamp(value.createdAt))
}

function isOperation(value: unknown): value is Operation {
  return isObject(value) && isId(value.operationId) && isId(value.taskId) &&
    isVersion(value.expectedVersion, 0) && isContent(value.content)
}

const isRecordOf = (value: unknown, check: (entry: unknown) => boolean) =>
  isObject(value) && Object.entries(value).every(([id, entry]) => UUID.test(id) && check(entry))

function isState(value: unknown, owner: string): value is AccountState {
  if (!isObject(value) || value.owner !== owner || typeof value.declined !== 'boolean') return false
  const { tasks, order, operations, conflicts, legacyIds } = value
  return isRecordOf(tasks, (task) => isServerTask(task)) &&
    isRecordOf(conflicts, (task) => isServerTask(task, 0)) &&
    Array.isArray(order) && order.every(isId) && new Set(order).size === order.length &&
    Array.isArray(operations) && operations.every(isOperation) &&
    new Set(operations.map((operation: Operation) => operation.operationId)).size === operations.length &&
    isObject(legacyIds) && Object.values(legacyIds).every(isId) &&
    new Set(Object.values(legacyIds)).size === Object.keys(legacyIds).length
}

/** Never replace unreadable or malformed pending work with an empty queue. */
export function readAccountState(owner: string): ReadState {
  try {
    const saved = localStorage.getItem(ACCOUNT_PREFIX + owner)
    if (saved === null) return { status: 'ok', state: emptyAccount(owner) }
    const value: unknown = JSON.parse(saved)
    return isState(value, owner) ? { status: 'ok', state: value } : { status: 'error' }
  } catch {
    return { status: 'error' }
  }
}

/** Persists the whole account copy at once, before any of its writes is sent. */
export function writeAccountState(state: AccountState): boolean {
  if (!isState(state, state.owner)) return false
  try {
    localStorage.setItem(ACCOUNT_PREFIX + state.owner, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}
