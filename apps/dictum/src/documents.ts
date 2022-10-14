// The document model and the pure rules around it. Content is markdown;
// dates are ISO timestamps.

export interface Doc {
  id: string
  title: string
  /** Markdown source. */
  content: string
  /** '' means unfiled. */
  folder: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type DocChanges = Partial<Pick<Doc, 'title' | 'content' | 'folder' | 'tags'>>

/** Narrows the list: `null` means any folder or any tag; folder '' means unfiled. */
export interface DocFilter {
  query: string
  folder: string | null
  tag: string | null
}

/**
 * A random (version 4) uuid, the form a synced table stores. `crypto.randomUUID`
 * exists only in secure contexts (https or localhost), so plain-http LAN testing
 * builds one from `getRandomValues`.
 */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function createDoc(folder = '', now: Date = new Date(), id: string = newId()): Doc {
  const stamp = now.toISOString()
  return { id, title: '', content: '', folder, tags: [], createdAt: stamp, updatedAt: stamp }
}

export function applyChanges(doc: Doc, changes: DocChanges, now: Date = new Date()): Doc {
  return { ...doc, ...changes, updatedAt: now.toISOString() }
}

export function displayTitle(doc: Doc): string {
  return doc.title.trim() || 'Untitled'
}

/** '  Work   notes ' -> 'Work notes'. */
export function cleanFolder(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

/** 'Work, #ideas, work' -> ['work', 'ideas']: trimmed, lowercased, no '#', no repeats. */
export function parseTags(input: string): string[] {
  const tags = input.split(',').map((tag) => tag.trim().replace(/^#+/, '').trim().toLowerCase())
  return [...new Set(tags.filter(Boolean))]
}

export function foldersOf(docs: Doc[]): string[] {
  return [...new Set(docs.map((doc) => doc.folder).filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export function tagsOf(docs: Doc[]): string[] {
  return [...new Set(docs.flatMap((doc) => doc.tags))].sort((a, b) => a.localeCompare(b))
}

/** Documents in the folder, with the tag, matching the search (title, text, tags); newest edit first. */
export function filterDocs(docs: Doc[], { query, folder, tag }: DocFilter): Doc[] {
  const needle = query.trim().toLowerCase()
  return docs
    .filter((doc) => {
      if (folder !== null && doc.folder !== folder) return false
      if (tag !== null && !doc.tags.includes(tag)) return false
      if (!needle) return true
      return [doc.title, doc.content, doc.tags.join(' ')].some((field) => field.toLowerCase().includes(needle))
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/** Words in markdown: markers such as '#', '-', '>' and code fences are not words. */
export function countWords(markdown: string): number {
  return markdown.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}

/** Minutes to read at 200 words a minute, rounded up; at least 1 once there is text. */
export function readingMinutes(words: number): number {
  return Math.ceil(words / 200)
}

/** 'Oct 7, 2022' in the user's own time zone. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** A safe file name for the export: 'Plan: v2?' -> 'Plan v2.md'. */
export function fileName(doc: Doc): string {
  const base = displayTitle(doc)
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return `${base || 'Untitled'}.md`
}
