import type { Note, NoteVersion } from '../domain/notes'
import { isRecord, isString, isTimestamp, readList, readRaw, unique } from './storage'

// The stores Folio and Dictum kept before notes moved into one. They are read
// here and never written: they stay as they are, so nothing is lost if the move
// has to be undone.
export const FOLIO_KEY = 'essentia-folio-notes'
export const DICTUM_DOCS_KEY = 'essentia-dictum-documents'
export const DICTUM_VERSIONS_KEY = 'essentia-dictum-versions'
export const DICTUM_SYNC_KEY = 'essentia-dictum-sync'

/** Valid entries in a source, and how many entries were malformed or repeated. */
export interface Source {
  notes: Note[]
  skipped: number
}

type FolioNote = Omit<Note, 'format' | 'folder'>

interface DictumDoc {
  id: string
  title: string
  content: string
  folder: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface DictumVersion {
  id: string
  docId: string
  title: string
  content: string
  savedAt: string
}

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every(isString)

function isFolioNote(value: unknown): value is FolioNote {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isString(value.body) &&
    isStringList(value.tags) &&
    typeof value.pinned === 'boolean' &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

function isDictumDoc(value: unknown): value is DictumDoc {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.title) &&
    isString(value.content) &&
    isString(value.folder) &&
    isStringList(value.tags) &&
    isTimestamp(value.createdAt) &&
    isTimestamp(value.updatedAt)
  )
}

function isDictumVersion(value: unknown): value is DictumVersion {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.docId) &&
    isString(value.title) &&
    isString(value.content) &&
    isTimestamp(value.savedAt)
  )
}

/** Folio's notes from before format and folder existed: rich and unfiled. */
export function readFolio(): Source {
  const { items } = readList(FOLIO_KEY)
  const notes = unique(items.filter(isFolioNote)).map(
    ({ id, title, body, tags, pinned, createdAt, updatedAt }): Note => ({
      id, format: 'rich', title, body, folder: '', tags, pinned, createdAt, updatedAt,
    }),
  )
  return { notes, skipped: items.length - notes.length }
}

/** Whether Dictum's documents on this device belong to an account. Unreadable stamps count as none, as in Dictum. */
export function dictumOwned(): boolean {
  try {
    const stamps: unknown = JSON.parse(readRaw(DICTUM_SYNC_KEY) ?? 'null')
    return isRecord(stamps) && isString(stamps.owner)
  } catch {
    return false
  }
}

/** Dictum's documents, as markdown notes. */
export function readDictum(): Source {
  const { items } = readList(DICTUM_DOCS_KEY)
  const notes = unique(items.filter(isDictumDoc)).map(
    ({ id, title, content, folder, tags, createdAt, updatedAt }): Note => ({
      id, format: 'markdown', title, body: content, folder, tags, pinned: false, createdAt, updatedAt,
    }),
  )
  return { notes, skipped: items.length - notes.length }
}

/** Dictum's device versions, as versions of markdown notes. */
export function readDictumVersions(): NoteVersion[] {
  return unique(readList(DICTUM_VERSIONS_KEY).items.filter(isDictumVersion)).map(
    ({ id, docId, title, content, savedAt }) => ({ id, noteId: docId, title, body: content, format: 'markdown', savedAt }),
  )
}
