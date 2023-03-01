// Rich-text commands for the contentEditable body. They go through
// `document.execCommand`: deprecated, but supported by every browser and the
// only way to edit with native undo, without an editor library.
import { sanitizeHtml } from './sanitize'

export type Format = 'bold' | 'italic' | 'underline' | 'h1' | 'h2' | 'blockquote' | 'bulleted' | 'numbered'

const BLOCKS = new Set<Format>(['h1', 'h2', 'blockquote'])

const COMMANDS: Record<Exclude<Format, 'h1' | 'h2' | 'blockquote'>, string> = {
  bold: 'bold',
  italic: 'italic',
  underline: 'underline',
  bulleted: 'insertUnorderedList',
  numbered: 'insertOrderedList',
}

function run(command: string, value?: string): void {
  // Missing outside browsers (jsdom); a no-op there.
  document.execCommand?.(command, false, value)
}

/** The element the caret or selection sits in, if it is inside `root`. */
function selectedElement(root: HTMLElement): Element | null {
  const node = window.getSelection()?.focusNode ?? null
  const element = node instanceof Element ? node : (node?.parentElement ?? null)
  return element && root.contains(element) ? element : null
}

/** Applies a format; a heading or quote that is already applied turns back into a paragraph. */
export function applyFormat(root: HTMLElement, format: Format): void {
  if (BLOCKS.has(format)) {
    const inside = selectedElement(root)?.closest(format)
    run('formatBlock', inside && root.contains(inside) ? 'p' : format)
  } else {
    run(COMMANDS[format as keyof typeof COMMANDS])
  }
}

/** The formats active at the selection, for the toolbar's pressed states. */
export function activeFormats(root: HTMLElement): Set<Format> {
  const active = new Set<Format>()
  const element = selectedElement(root)
  if (!element) return active
  for (const format of Object.keys(COMMANDS) as (keyof typeof COMMANDS)[]) {
    if (document.queryCommandState?.(COMMANDS[format])) active.add(format)
  }
  for (const block of BLOCKS) {
    const inside = element.closest(block)
    if (inside && root.contains(inside)) active.add(block)
  }
  return active
}

/** Inserts pasted or dropped content at the caret, sanitized; plain text stays plain. */
export function insertTransfer(data: DataTransfer | null): void {
  if (!data) return
  const html = data.getData('text/html')
  if (html) run('insertHTML', sanitizeHtml(html))
  else run('insertText', data.getData('text/plain'))
}

/** Moves the caret to a point in the window, where something is being dropped. */
export function placeCaretAt(x: number, y: number): void {
  const range = document.caretPositionFromPoint
    ? rangeFromPosition(document.caretPositionFromPoint(x, y))
    : (document.caretRangeFromPoint?.(x, y) ?? null)
  if (!range) return
  const selection = window.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function rangeFromPosition(position: CaretPosition | null): Range | null {
  if (!position) return null
  const range = document.createRange()
  range.setStart(position.offsetNode, position.offset)
  return range
}
