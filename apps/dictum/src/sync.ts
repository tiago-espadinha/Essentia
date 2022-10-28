// Merging this device's documents with the account's copy in Supabase. Each
// document carries the time it last changed; the newer side wins, and the merge
// lists what the server is missing or has older. Versions stay on the device.
import { cleanFolder, parseTags, type Doc } from './documents'

/** What this device has to remember between syncs. */
export interface Stamps {
  /** The account these documents belong to, or null while they have never been synced. */
  owner: string | null
  /** Documents deleted here, and when, until the server has the deletion. */
  deleted: Record<string, string>
}

export const NO_STAMPS: Stamps = { owner: null, deleted: {} }

export interface DocRow {
  id: string
  title: string
  content: string
  folder: string
  tags: string[]
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface Push {
  docs: DocRow[]
  deletions: { id: string; at: string }[]
}

/** The table's checks (supabase/migration.sql); a document past them stays on this device. */
export const LIMITS = { title: 300, content: 1_000_000, folder: 100, tags: 50 }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Ids from before sync or tampered ones cannot be stored as uuids, and the table refuses oversized documents. */
export const syncable = (doc: Doc) =>
  UUID.test(doc.id) &&
  doc.title.length <= LIMITS.title &&
  doc.content.length <= LIMITS.content &&
  doc.folder.length <= LIMITS.folder &&
  doc.tags.length <= LIMITS.tags

const time = (stamp: string) => Date.parse(stamp)
const isStamp = (value: unknown): value is string => typeof value === 'string' && !Number.isNaN(time(value))
const isString = (value: unknown): value is string => typeof value === 'string'

function isDocRow(row: unknown): row is DocRow {
  if (typeof row !== 'object' || row === null) return false
  const value = row as Record<string, unknown>
  return (
    isString(value.id) &&
    UUID.test(value.id) &&
    isString(value.title) &&
    isString(value.content) &&
    isString(value.folder) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    isStamp(value.created_at) &&
    isStamp(value.updated_at) &&
    (value.deleted_at === null || isStamp(value.deleted_at))
  )
}

/** Keeps the rows the app can trust, with folder and tags tidied as saved data is. */
export function readRemote(rows: unknown[]): DocRow[] {
  return rows.filter(isDocRow).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    folder: cleanFolder(row.folder),
    tags: parseTags(row.tags.join(',')),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  }))
}

/** Stamps the documents a change removed; a document put back (undo) drops its stamp. */
export function stampDeletions(before: Doc[], after: Doc[], stamps: Stamps, at: string): Stamps {
  const kept = new Set(after.map((doc) => doc.id))
  const deleted = { ...stamps.deleted }
  for (const doc of before) if (!kept.has(doc.id)) deleted[doc.id] = at
  for (const id of kept) delete deleted[id]
  return { ...stamps, deleted }
}

const toRow = (doc: Doc): DocRow => ({
  id: doc.id,
  title: doc.title,
  content: doc.content,
  folder: doc.folder,
  tags: doc.tags,
  created_at: doc.createdAt,
  updated_at: doc.updatedAt,
  deleted_at: null,
})

const fromRow = (row: DocRow): Doc => ({
  id: row.id,
  title: row.title,
  content: row.content,
  folder: row.folder,
  tags: row.tags,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
})

/** Merges the account's rows into this device's documents. */
export function merge(local: Doc[], stamps: Stamps, remote: DocRow[]) {
  const deleted = { ...stamps.deleted }
  const push: Push = { docs: [], deletions: [] }
  const rows = new Map(remote.map((row) => [row.id, row]))
  const docs: Doc[] = []

  for (const doc of local) {
    const row = rows.get(doc.id)
    rows.delete(doc.id)
    if (!syncable(doc)) docs.push(doc)
    else if (!row || time(doc.updatedAt) > time(row.updated_at)) {
      // Also brings back a document deleted elsewhere before this edit.
      push.docs.push(toRow(doc))
      docs.push(doc)
    } else if (!row.deleted_at) docs.push(time(doc.updatedAt) === time(row.updated_at) ? doc : fromRow(row))
    // Otherwise it was deleted elsewhere after this device last changed it.
  }

  // Deleted here: tell the server unless it has a newer version, which comes back.
  for (const [id, at] of Object.entries(stamps.deleted)) {
    const row = rows.get(id)
    rows.delete(id)
    if (row && !row.deleted_at && time(at) > time(row.updated_at)) {
      // The stamp stays until a later sync sees the deletion on the server.
      push.deletions.push({ id, at })
      continue
    }
    delete deleted[id]
    if (row && !row.deleted_at) docs.push(fromRow(row))
  }

  for (const row of rows.values()) if (!row.deleted_at) docs.push(fromRow(row))

  return { docs, stamps: { ...stamps, deleted }, push }
}
