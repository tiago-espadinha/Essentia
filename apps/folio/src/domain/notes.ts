// The note model and the pure rules around it. Bodies are sanitized HTML
// (see sanitize.ts); dates are ISO timestamps.

export interface Note {
  id: string
  title: string
  /** Sanitized HTML from the editor. */
  body: string
  tags: string[]
  pinned: boolean
  createdAt: string
  updatedAt: string
}

export type NoteChanges = Partial<Pick<Note, 'title' | 'body' | 'tags' | 'pinned'>>

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
  return { id, title: '', body: '', tags: [], pinned: false, createdAt: stamp, updatedAt: stamp }
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

/** Notes matching the search (title, body text, tags) and the tag; pinned first, then newest. */
export function filterNotes(notes: Note[], query: string, tag: string | null): Note[] {
  const needle = query.trim().toLowerCase()
  return notes
    .filter((note) => {
      if (tag !== null && !note.tags.includes(tag)) return false
      if (!needle) return true
      return [note.title, plainText(note.body), note.tags.join(' ')].some((field) =>
        field.toLowerCase().includes(needle),
      )
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt))
}

/** 'Jun 20, 2022' in the user's own time zone. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
