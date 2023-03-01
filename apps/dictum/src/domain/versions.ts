// Saved versions of a document: snapshots of its title and text.
import { newId, type Doc } from './documents'

export interface Version {
  id: string
  docId: string
  title: string
  content: string
  savedAt: string
}

/** Versions kept per document; past it the oldest go. */
export const MAX_VERSIONS = 20

/** Newest first. */
export function versionsOf(versions: Version[], docId: string): Version[] {
  return versions.filter((version) => version.docId === docId).sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

/**
 * Saves the document as it is now, unless its newest version already holds the
 * same title and text. Keeps the newest MAX_VERSIONS for that document.
 */
export function addVersion(versions: Version[], doc: Doc, now: Date = new Date(), id: string = newId()): Version[] {
  const own = versionsOf(versions, doc.id)
  if (own[0] && own[0].content === doc.content && own[0].title === doc.title) return versions
  const version = { id, docId: doc.id, title: doc.title, content: doc.content, savedAt: now.toISOString() }
  const kept = new Set([version, ...own].slice(0, MAX_VERSIONS))
  return [version, ...versions].filter((v) => v.docId !== doc.id || kept.has(v))
}

/** A short plain preview of a version's text. */
export function excerpt(content: string, length = 80): string {
  const text = content.replace(/[#>*_`~-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}
