// '#name' in an add field files the new item under a category. The grammar is
// deliberately small:
// - a tag is a whole word: '#' at the start or after a space, then letters,
//   digits, '-' or '_' up to the next space or the end ('_' reads as a space);
// - the last tag wins; earlier tags stay in the text as typed;
// - '\#' writes a literal '#';
// - 'C#', 'a#b', '#work,', a lone '#' and a tag longer than the category limit
//   are plain text.
// The recognised tag leaves the title, so title + tag account for every
// character typed.

const TAG_BODY = /^[\p{L}\p{M}\p{N}_-]+$/u
const PARTIAL_BODY = /^[\p{L}\p{M}\p{N}_-]*$/u

export interface ParsedHashtag {
  /** The title to save: the input without its recognised tag, '\#' as '#'. */
  text: string
  /** The category name the tag asks for, or null when there is no tag. */
  tag: string | null
}

/** A tag body as a category name: '_' as a space, spaces trimmed and collapsed. */
export const tagName = (body: string): string => body.replace(/_/g, ' ').trim().replace(/\s+/g, ' ')

/** The tag form of a category name, or null when the grammar cannot express it. */
export function tagFor(name: string): string | null {
  if (name.includes('_')) return null
  const body = name.trim().replace(/\s+/g, '_')
  return body && TAG_BODY.test(body) ? body : null
}

function tagOf(word: string, maxLength: number): string | null {
  if (!word.startsWith('#') || !TAG_BODY.test(word.slice(1))) return null
  const name = tagName(word.slice(1))
  return name && name.length <= maxLength ? name : null
}

const unescape = (text: string) => text.replace(/\\#/g, '#')

export function parseHashtag(input: string, maxLength: number): ParsedHashtag {
  // Words and the runs of space between them, so untagged text keeps its spacing.
  const parts = input.split(/(\s+)/)
  let last = -1
  for (let index = 0; index < parts.length; index += 2) {
    if (tagOf(parts[index], maxLength) !== null) last = index
  }
  if (last < 0) return { text: unescape(input), tag: null }
  // Drop the tag with the space before it (after it, when it opens the text), so 'a #x b' reads 'a b'.
  const from = last === 0 ? 0 : last - 1
  const rest = [...parts.slice(0, from), ...parts.slice(from + 2)]
  return { text: unescape(rest.join('')).trim(), tag: tagOf(parts[last], maxLength) }
}

export interface TagQuery {
  /** Where the tag word starts and ends in the input. */
  start: number
  end: number
  /** What has been typed after '#' up to the caret, as a category name. */
  query: string
}

/** The tag being typed at the caret, if the caret sits in a word that starts with '#'. */
export function tagAtCaret(value: string, caret: number): TagQuery | null {
  const start = value.slice(0, caret).search(/\S*$/)
  const rest = value.slice(start).search(/\s/)
  const end = rest < 0 ? value.length : start + rest
  if (value[start] !== '#' || !PARTIAL_BODY.test(value.slice(start + 1, end))) return null
  return { start, end, query: tagName(value.slice(start + 1, caret)) }
}

const keyOf = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

/** Categories in use that complete the query and that a tag can express. */
export function tagSuggestions(categories: readonly string[], query: string, maxLength: number): string[] {
  const key = keyOf(query)
  const seen = new Set<string>()
  return categories.filter((name) => {
    const nameKey = keyOf(name)
    if (seen.has(nameKey) || name.length > maxLength || tagFor(name) === null || !nameKey.startsWith(key)) return false
    seen.add(nameKey)
    return true
  })
}

/** The input with the tag at `at` replaced by `name`'s tag and a space after it. */
export function applyTag(value: string, at: TagQuery, name: string): { value: string; caret: number } {
  const tag = `#${tagFor(name) ?? ''}`
  const after = value.slice(at.end)
  const spaced = after.startsWith(' ') ? after : ` ${after}`
  return { value: value.slice(0, at.start) + tag + spaced, caret: at.start + tag.length + 1 }
}
