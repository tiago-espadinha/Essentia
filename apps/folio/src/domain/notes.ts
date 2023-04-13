import { currentLocale } from '@essentia/ui'
// The note model and the pure rules around it. A note keeps the format it was
// written in: rich bodies are sanitized HTML (see sanitize.ts), markdown bodies
// are source text. Dates are ISO timestamps.

export type NoteFormat = 'rich' | 'markdown'

export interface Note {
  id: string
  format: NoteFormat
  title: string
  /** Sanitized HTML when rich, markdown source when markdown. */
  body: string
  /** '' when the note is in no folder. */
  folder: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

/** A saved earlier state of a note, kept on this device only. */
export interface NoteVersion {
  id: string
  noteId: string
  title: string
  body: string
  format: NoteFormat
  savedAt: string
}

export type NoteChanges = Partial<Pick<Note, 'format' | 'title' | 'body' | 'folder' | 'tags' | 'pinned'>>

/**
 * A random id. `crypto.randomUUID` exists only in secure contexts (https or
 * localhost), so plain-http LAN testing falls back to `getRandomValues`.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function createNote(now: Date = new Date(), id: string = newId()): Note {
  const stamp = now.toISOString()
  return { id, format: 'rich', title: '', body: '', folder: '', tags: [], pinned: false, createdAt: stamp, updatedAt: stamp }
}

export function applyChanges(note: Note, changes: NoteChanges, now: Date = new Date()): Note {
  return { ...note, ...changes, updatedAt: now.toISOString() }
}

/** The text of a body, with block and line breaks read as spaces. */
export function plainText(html: string): string {
  const spaced = html.replace(/<\/(p|div|h1|h2|blockquote|li)>|<br\s*\/?>/gi, '$& ')
  const text = new DOMParser().parseFromString(spaced, 'text/html').body.textContent ?? ''
  return text.replace(/\s+/g, ' ').trim()
}

/** The words of a note as one line: rich text without its markup, markdown as written. */
export function noteText(note: Pick<Note, 'format' | 'body'>): string {
  return note.format === 'rich' ? plainText(note.body) : note.body.replace(/\s+/g, ' ').trim()
}

/**
 * Markdown read as plain words, for a short excerpt: markers, fences, rules and
 * table rows go, links and images leave their text, emphasis its words.
 */
export function markdownText(source: string): string {
  return source
    .replace(/^ {0,3}(`{3,}|~{3,}).*$/gm, '')
    .replace(/^ {0,3}([-*_])( *\1){2,} *$/gm, '')
    .replace(/^ *\|?[ :|-]*-[ :|-]*$/gm, '')
    .replace(/^ *(?:(?:#{1,6}|>|[-*+]|\d+[.)])(?: +|$))+(?:\[[ xX]\] +)?/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(?<![\\\w])(\*{1,3}|_{1,3}|~~)(?=\S)([\s\S]*?[^\s\\])\1(?!\w)/g, '$2')
    .replace(/`+/g, '')
    .replace(/\|/g, ' ')
    .replace(/\\([!-/:-@[-`{-~])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** The words of a note for an excerpt: rich text without its markup, markdown without its syntax. */
export function excerptText(note: Pick<Note, 'format' | 'body'>): string {
  // An excerpt shows a line or two, so a long markdown note is read only as far as that.
  return note.format === 'rich' ? plainText(note.body) : markdownText(note.body.slice(0, 500))
}

/** 'Ideas  2023 ' -> 'Ideas 2023': a folder name with its spacing tidied. */
export function cleanFolder(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** The longest folder name, matching what an account can hold. */
export const FOLDER_LIMIT = 100

export type FolderError = 'blank' | 'long' | 'taken'

/** Folder names are compared without regard to case: 'Work' and 'work' are one folder. */
export function sameFolder(a: string, b: string): boolean {
  return a.toLocaleLowerCase() === b.toLocaleLowerCase()
}

/**
 * A typed folder name, cleaned, or why it cannot be used. When `renaming` is
 * given, that folder may keep its name or change only its case; any other
 * existing name is taken. Without it, an existing name is not an error: the
 * caller reuses that folder (see `existingFolder`).
 */
export function checkFolderName(
  input: string,
  folders: string[],
  renaming?: string,
): { name: string; error?: undefined } | { name?: undefined; error: FolderError } {
  const name = cleanFolder(input)
  if (!name) return { error: 'blank' }
  if (name.length > FOLDER_LIMIT) return { error: 'long' }
  if (renaming !== undefined && folders.some((folder) => folder !== renaming && sameFolder(folder, name))) {
    return { error: 'taken' }
  }
  return { name }
}

/** The existing folder a name refers to, in its saved spelling. */
export function existingFolder(folders: string[], name: string): string | undefined {
  return folders.find((folder) => folder === name) ?? folders.find((folder) => sameFolder(folder, name))
}

/** Every folder: those kept on their own and those notes are in, sorted, without Unfiled. */
export function foldersOf(notes: Note[], kept: string[] = []): string[] {
  const names = new Set([...kept, ...notes.map((note) => note.folder)].filter(Boolean))
  return [...names].sort((a, b) => a.localeCompare(b))
}

/** How many notes each folder holds; '' counts the unfiled ones. */
export function countByFolder(notes: Note[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const note of notes) counts.set(note.folder, (counts.get(note.folder) ?? 0) + 1)
  return counts
}

/** Moves every note in `from` to `to` (to '' to unfile them). Other notes are returned as they were. */
export function refileNotes(notes: Note[], from: string, to: string, now: Date = new Date()): Note[] {
  return notes.map((note) => (note.folder === from ? applyChanges(note, { folder: to }, now) : note))
}

export function countWords(text: string): number {
  return text ? text.split(' ').length : 0
}

/** 'Work, #ideas, work' -> ['work', 'ideas']: trimmed, lowercased, no '#', no repeats. */
export function parseTags(input: string): string[] {
  const tags = input.split(',').map((tag) => tag.trim().replace(/^#+/, '').trim().toLowerCase())
  return [...new Set(tags.filter(Boolean))]
}

export function tagsOf(notes: Note[]): string[] {
  return [...new Set(notes.flatMap((note) => note.tags))].sort((a, b) => a.localeCompare(b))
}

/**
 * Notes matching the search (title, body text, tags), the tag and the folder;
 * pinned first, then the latest edited. A `null` tag or folder means any; the
 * folder '' means unfiled.
 */
export function filterNotes(notes: Note[], query: string, tag: string | null, folder: string | null = null): Note[] {
  const needle = query.trim().toLowerCase()
  return notes
    .filter((note) => {
      if (folder !== null && note.folder !== folder) return false
      if (tag !== null && !note.tags.includes(tag)) return false
      if (!needle) return true
      return [note.title, noteText(note), note.tags.join(' ')].some((field) =>
        field.toLowerCase().includes(needle),
      )
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
}

/** The selected locale's short date, in the user's own time zone. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(currentLocale(), { month: 'short', day: 'numeric', year: 'numeric' })
}
