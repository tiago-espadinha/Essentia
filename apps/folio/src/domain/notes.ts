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

export type NoteChanges = Partial<Pick<Note, 'format' | 'title' | 'body' | 'tags' | 'pinned'>>

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

/** Notes matching the search (title, body text, tags) and the tag; pinned first, then the latest edited. */
export function filterNotes(notes: Note[], query: string, tag: string | null): Note[] {
  const needle = query.trim().toLowerCase()
  return notes
    .filter((note) => {
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
