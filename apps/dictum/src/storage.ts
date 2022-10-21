import { cleanFolder, parseTags, type Doc } from './documents'
import { NO_STAMPS, type Stamps } from './sync'
import type { Version } from './versions'

export const DOCS_KEY = 'essentia-dictum-documents'
export const VERSIONS_KEY = 'essentia-dictum-versions'
export const SYNC_KEY = 'essentia-dictum-sync'

const isString = (value: unknown): value is string => typeof value === 'string'
const isTimestamp = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value))
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function isDoc(value: unknown): value is Doc {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.title) &&
    isString(value.content) &&
    isString(value.folder) &&
    Array.isArray(value.tags) &&
    value.tags.every(isString) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

function isVersion(value: unknown): value is Version {
  if (!isRecord(value)) return false
  return (
    isString(value.id) &&
    isString(value.docId) &&
    isString(value.title) &&
    isString(value.content) &&
    isTimestamp(value.savedAt)
  )
}

function readList(key: string): unknown[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

/** Keeps the first entry of each id. */
function unique<T extends { id: string }>(items: T[]): T[] {
  const byId = new Map<string, T>()
  for (const item of items) if (!byId.has(item.id)) byId.set(item.id, item)
  return [...byId.values()]
}

/** Reads the saved documents. Anything unreadable, malformed or repeated is skipped: saved data is not trusted. */
export function loadDocs(): Doc[] {
  return unique(readList(DOCS_KEY).filter(isDoc)).map(({ id, title, content, folder, tags, createdAt, updatedAt }) => ({
    id,
    title,
    content,
    folder: cleanFolder(folder),
    tags: parseTags(tags.join(',')),
    createdAt,
    updatedAt,
  }))
}

/** Reads the saved versions of the given documents; versions of documents that are gone are dropped. */
export function loadVersions(docIds: string[]): Version[] {
  const known = new Set(docIds)
  return unique(readList(VERSIONS_KEY).filter(isVersion))
    .filter((version) => known.has(version.docId))
    .map(({ id, docId, title, content, savedAt }) => ({ id, docId, title, content, savedAt }))
}

function isStamps(value: unknown): value is Stamps {
  return (
    isRecord(value) &&
    (value.owner === null || isString(value.owner)) &&
    isRecord(value.deleted) &&
    !Array.isArray(value.deleted) &&
    Object.values(value.deleted).every(isTimestamp)
  )
}

/**
 * Reads which account the documents belong to and the deletions not yet synced.
 * Unreadable stamps start over: the documents then count as never synced.
 */
export function loadStamps(): Stamps {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SYNC_KEY) ?? 'null')
    return isStamps(saved) ? { owner: saved.owner, deleted: { ...saved.deleted } } : NO_STAMPS
  } catch {
    return NO_STAMPS
  }
}

/** Returns false when the browser refuses to store the data (private mode, quota). */
export function save(key: typeof DOCS_KEY | typeof VERSIONS_KEY | typeof SYNC_KEY, items: Doc[] | Version[] | Stamps): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}
