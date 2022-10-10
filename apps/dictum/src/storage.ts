import { cleanFolder, parseTags, type Doc } from './documents'
import type { Version } from './versions'

export const DOCS_KEY = 'essentia-dictum-documents'
export const VERSIONS_KEY = 'essentia-dictum-versions'

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

/** Returns false when the browser refuses to store the data (private mode, quota). */
export function save(key: typeof DOCS_KEY | typeof VERSIONS_KEY, items: Doc[] | Version[]): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}
