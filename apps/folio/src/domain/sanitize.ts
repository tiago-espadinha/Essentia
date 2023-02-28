import DOMPurify from 'dompurify'

// The only markup a note body may hold: what the toolbar makes, plus the
// paragraphs and line breaks the editor writes. No attributes at all, so no
// event handlers, styles, links or sources survive. `div` keeps pasted lines apart.
const ALLOWED_TAGS = ['p', 'div', 'br', 'h1', 'h2', 'blockquote', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u']

/** Cleans untrusted HTML (a paste, a drop, saved data) down to note formatting. */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] })
}
