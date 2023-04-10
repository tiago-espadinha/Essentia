// Converting a note between rich text and markdown. Only what both formats can
// hold carries over: headings, lists, quotes, bold, italic and line breaks.
// Anything else is named in the result's losses, so the confirmation can say so.
import type { Note, NoteFormat } from './notes'
import { sanitizeHtml } from './sanitize'

/** What a conversion cannot carry over. */
export type Loss =
  | 'underline'
  | 'code'
  | 'links'
  | 'tables'
  | 'taskLists'
  | 'images'
  | 'strikethrough'
  | 'rules'
  | 'deepHeadings'

export interface Conversion {
  format: NoteFormat
  body: string
  /** In a fixed order, each once. */
  losses: Loss[]
}

const ORDER: Loss[] = ['underline', 'code', 'links', 'tables', 'taskLists', 'images', 'strikethrough', 'rules', 'deepHeadings']
const ordered = (losses: Set<Loss>) => ORDER.filter((loss) => losses.has(loss))

/** The note in the other format. */
export function convert(note: Pick<Note, 'format' | 'body'>): Conversion {
  return note.format === 'rich' ? richToMarkdown(note.body) : markdownToRich(note.body)
}

// Rich text to markdown

const BLOCKS = new Set(['P', 'DIV', 'H1', 'H2', 'BLOCKQUOTE', 'UL', 'OL'])

/** Text that markdown would otherwise read as markup. */
function escapeText(text: string): string {
  return text.replace(/[\\*_`[\]<>~]|&(?=#?\w+;)/g, '\\$&')
}

/**
 * A (trimmed) line start that markdown would read as a heading, list item, rule
 * or setext underline; a lone "-" or "=" under a line would make it a heading.
 */
function escapeLineStart(line: string): string {
  return line.replace(/^[-+=#]/, '\\$&').replace(/^(\d+)([.)])/, '$1\\$2')
}

/** Lines after the first indented by `width`, to sit under a list marker. */
function hang(text: string, width: number): string {
  return text.split('\n').map((line, n) => (n === 0 || !line ? line : ' '.repeat(width) + line)).join('\n')
}

function inlineMarkdown(nodes: Iterable<ChildNode>, losses: Set<Loss>): string {
  let out = ''
  for (const node of nodes) {
    if (node.nodeType === Node.TEXT_NODE) out += escapeText((node.textContent ?? '').replace(/\s+/g, ' '))
    if (!(node instanceof Element)) continue
    const inner = () => inlineMarkdown(node.childNodes, losses)
    if (node.tagName === 'BR') out += '\\\n'
    else if (node.tagName === 'STRONG' || node.tagName === 'B') out += wrap('**', inner())
    // "*", not "_": an underscore does not mark emphasis inside a word.
    else if (node.tagName === 'EM' || node.tagName === 'I') out += wrap('*', inner())
    else {
      if (node.tagName === 'U') losses.add('underline')
      out += inner()
    }
  }
  return out
}

/** Emphasis markers hug the text, so spaces at either end move outside them. */
function wrap(marker: string, text: string): string {
  const [, before, core, after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)!
  return core ? `${before}${marker}${core}${marker}${after}` : text
}

/** A paragraph's lines: a trailing break adds nothing, and each line start is escaped. */
function paragraph(nodes: Iterable<ChildNode>, losses: Set<Loss>): string {
  const text = inlineMarkdown(nodes, losses).replace(/(\\\n)+$/, '').trim()
  return text.split('\n').map((line) => escapeLineStart(line.trim())).join('\n')
}

/** Block-level markdown for a container's children; loose inline runs become paragraphs. */
function blocksMarkdown(parent: Node, losses: Set<Loss>): string[] {
  const blocks: string[] = []
  let run: ChildNode[] = []
  const flush = () => {
    const text = paragraph(run, losses)
    if (text) blocks.push(text)
    run = []
  }
  for (const node of parent.childNodes) {
    if (!(node instanceof Element) || !BLOCKS.has(node.tagName)) {
      run.push(node)
      continue
    }
    flush()
    blocks.push(...blockMarkdown(node, losses))
  }
  flush()
  return blocks
}

function blockMarkdown(element: Element, losses: Set<Loss>): string[] {
  const { tagName } = element
  if (tagName === 'H1' || tagName === 'H2') {
    // A trailing run of # would read as the heading's closing sequence.
    const text = inlineMarkdown(element.childNodes, losses).replace(/\\\n/g, ' ').trim().replace(/#+$/, '\\$&')
    return text ? [`${tagName === 'H1' ? '#' : '##'} ${text}`] : []
  }
  if (tagName === 'BLOCKQUOTE') {
    const inner = blocksMarkdown(element, losses).join('\n\n')
    return inner ? [inner.split('\n').map((line) => (line ? `> ${line}` : '>')).join('\n')] : []
  }
  if (tagName === 'UL' || tagName === 'OL') {
    // Numbering starts at 1: the rich editor keeps no start number.
    const marker = (index: number) => (tagName === 'UL' ? '- ' : `${index + 1}. `)
    const items: string[] = []
    for (const child of element.children) {
      const nested = child.tagName === 'UL' || child.tagName === 'OL'
      const body = (nested ? blockMarkdown(child, losses) : blocksMarkdown(child, losses)).join('\n')
      // Anything else with text pasted straight into a list (a paragraph, say) becomes an item.
      if (!body && child.tagName !== 'LI') continue
      // A list straight inside a list, as some editors indent, belongs to the item before it.
      if (nested && items.length) {
        const width = marker(items.length - 1).length
        items[items.length - 1] += `\n${' '.repeat(width)}${hang(body, width)}`
      } else items.push(marker(items.length) + hang(body, marker(items.length).length))
    }
    return items.length ? [items.join('\n')] : []
  }
  // P, or a DIV, which holds blocks of its own when the editor nests them.
  return element.tagName === 'DIV' ? blocksMarkdown(element, losses) : [paragraph(element.childNodes, losses)].filter(Boolean)
}

export function richToMarkdown(html: string): Conversion {
  const losses = new Set<Loss>()
  const body = new DOMParser().parseFromString(sanitizeHtml(html), 'text/html').body
  return { format: 'markdown', body: blocksMarkdown(body, losses).join('\n\n'), losses: ordered(losses) }
}

// Markdown to rich text

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const QUOTE = /^ {0,3}> ?/
const ITEM = /^( {0,3})([-*+]|\d{1,9}[.)])([ \t]+|$)/
const RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const TABLE_DELIMITER = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/
const TASK = /^\[[ xX]\][ \t]/

class RichBuilder {
  readonly losses = new Set<Loss>()
  readonly doc = document.implementation.createHTMLDocument('')

  element(tag: string, children: Node[]): HTMLElement {
    const element = this.doc.createElement(tag)
    element.append(...children)
    return element
  }

  /** Lines kept as written, one paragraph with a break between lines. */
  literal(lines: string[]): HTMLElement {
    const children: Node[] = []
    lines.forEach((line, index) => {
      if (index > 0) children.push(this.doc.createElement('br'))
      children.push(this.doc.createTextNode(line))
    })
    return this.element('p', children)
  }

  blocks(lines: string[]): HTMLElement[] {
    const out: HTMLElement[] = []
    let index = 0
    while (index < lines.length) {
      const line = lines[index]
      if (!line.trim()) {
        index += 1
        continue
      }
      const fence = FENCE.exec(line)
      if (fence) {
        const end = lines.findIndex((next, n) => n > index && next.trim().startsWith(fence[1]))
        const stop = end === -1 ? lines.length : end + 1
        this.losses.add('code')
        out.push(this.literal(lines.slice(index, stop)))
        index = stop
        continue
      }
      const heading = HEADING.exec(line)
      if (heading) {
        if (heading[1].length > 2) this.losses.add('deepHeadings')
        out.push(this.element(heading[1].length === 1 ? 'h1' : 'h2', this.inline(heading[2] ?? '')))
        index += 1
        continue
      }
      if (RULE.test(line)) {
        this.losses.add('rules')
        out.push(this.literal([line.trim()]))
        index += 1
        continue
      }
      if (QUOTE.test(line)) {
        const end = this.until(lines, index, (next) => !QUOTE.test(next))
        const inner = this.blocks(lines.slice(index, end).map((next) => next.replace(QUOTE, '')))
        out.push(this.element('blockquote', inner.length === 1 ? unwrapFirst(inner) : inner))
        index = end
        continue
      }
      if (ITEM.test(line)) {
        index = this.list(lines, index, out)
        continue
      }
      if (line.includes('|') && TABLE_DELIMITER.test(lines[index + 1] ?? '')) {
        const end = this.until(lines, index, (next) => !next.trim())
        this.losses.add('tables')
        out.push(this.literal(lines.slice(index, end).map((next) => next.trim())))
        index = end
        continue
      }
      index = this.paragraph(lines, index, out)
    }
    return out
  }

  /** The first line after `start` that matches `stop`. */
  until(lines: string[], start: number, stop: (line: string) => boolean): number {
    let end = start + 1
    while (end < lines.length && !stop(lines[end])) end += 1
    return end
  }

  paragraph(lines: string[], start: number, out: HTMLElement[]): number {
    const end = this.until(lines, start, (line) => !line.trim() || isBlockStart(line) || ITEM.test(line) || SETEXT.test(line))
    const text = lines.slice(start, end).map((line) => line.trim())
    // A line of = or - under a paragraph makes it a heading.
    const underline = SETEXT.exec(lines[end] ?? '')
    if (underline) {
      out.push(this.element(underline[1][0] === '=' ? 'h1' : 'h2', this.inline(text.join(' '))))
      return end + 1
    }
    out.push(this.element('p', this.inline(text.join('\n'))))
    return end
  }

  /** A list and the lists nested in its items; returns the line after it. */
  // Rich text has no start number, so "3." becomes the first item of a list from 1.
  list(lines: string[], start: number, out: HTMLElement[]): number {
    const first = ITEM.exec(lines[start])!
    const ordered = /\d/.test(first[2])
    const items: HTMLElement[] = []
    let index = start
    while (index < lines.length) {
      const item = ITEM.exec(lines[index])
      if (!item || /\d/.test(item[2]) !== ordered || item[1].length !== first[1].length) break
      const contentIndent = item[1].length + item[2].length + Math.max(1, item[3].length)
      const end = this.itemEnd(lines, index, contentIndent)
      const body = [lines[index].slice(item[0].length), ...lines.slice(index + 1, end).map((line) => line.slice(Math.min(contentIndent, indentOf(line))))]
      items.push(this.item(body))
      index = end
      // A blank line between items keeps the list going.
      if (!lines[index]?.trim() && ITEM.exec(lines[index + 1] ?? '')?.[1].length === first[1].length) index += 1
    }
    out.push(this.element(ordered ? 'ol' : 'ul', items))
    return index
  }

  /** An item runs on through indented lines, unindented continuations of its text, and blank lines before more indented ones. */
  itemEnd(lines: string[], start: number, contentIndent: number): number {
    let end = start + 1
    while (end < lines.length) {
      const line = lines[end]
      const next = lines[end + 1] ?? ''
      const continues = line.trim()
        ? indentOf(line) >= contentIndent || (lines[end - 1].trim() !== '' && !ITEM.test(line) && !isBlockStart(line))
        : next.trim() !== '' && indentOf(next) >= contentIndent
      if (!continues) break
      end += 1
    }
    return end
  }

  item(body: string[]): HTMLElement {
    if (TASK.test(body[0])) this.losses.add('taskLists')
    return this.element('li', unwrapFirst(this.blocks(body)))
  }

  inline(text: string): Node[] {
    const nodes: Node[] = []
    const pattern =
      /(`+)[\s\S]*?\1|!\[[^\]]*\]\([^)]*\)|\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\[[^\]]*\]|<(?:https?:|mailto:)[^>\s]+>|https?:\/\/[^\s<]+|~~[\s\S]+?~~|\*\*\*([\s\S]+?)\*\*\*|\*\*([\s\S]+?)\*\*|(?<![\w\\])__([\s\S]+?)__(?!\w)|(?<!\\)\*([^*\s](?:[\s\S]*?[^*\s])?)(?<!\\)\*|(?<![\w\\])_([^_\s](?:[\s\S]*?[^_\s])?)_(?!\w)|\\\n|\\([!-/:-@[-`{-~])|\n/g
    let last = 0
    for (const match of text.matchAll(pattern)) {
      if (match.index > last) nodes.push(this.doc.createTextNode(text.slice(last, match.index)))
      last = match.index + match[0].length
      nodes.push(...this.token(match))
    }
    if (last < text.length) nodes.push(this.doc.createTextNode(text.slice(last)))
    return nodes
  }

  token(match: RegExpMatchArray): Node[] {
    const [whole, ticks, strongEm, strong, strongUnder, em, emUnder, escaped] = match
    if (strongEm !== undefined) return [this.element('strong', [this.element('em', this.inline(strongEm))])]
    if (strong ?? strongUnder) return [this.element('strong', this.inline((strong ?? strongUnder)!))]
    if (em ?? emUnder) return [this.element('em', this.inline((em ?? emUnder)!))]
    if (escaped !== undefined) return [this.doc.createTextNode(escaped)]
    if (whole === '\n' || whole === '\\\n') return [this.doc.createElement('br')]
    if (ticks) this.losses.add('code')
    else if (whole.startsWith('!')) this.losses.add('images')
    else if (whole.startsWith('~~')) this.losses.add('strikethrough')
    else this.losses.add('links')
    return [this.doc.createTextNode(whole)]
  }
}

/** A leading paragraph gives up its wrapper: the rich editor writes list items and quotes as bare text. */
function unwrapFirst(blocks: HTMLElement[]): Node[] {
  const [first, ...rest] = blocks
  return first?.tagName === 'P' ? [...first.childNodes, ...rest] : blocks
}

function indentOf(line: string): number {
  return /^ */.exec(line)![0].length
}

/** Leading tabs become spaces up to the next stop of 4, so indents count and cut in the same columns. */
function expandIndent(line: string): string {
  return line.replace(/^[ \t]+/, (space) => {
    let column = 0
    for (const char of space) column = char === '\t' ? column + 4 - (column % 4) : column + 1
    return ' '.repeat(column)
  })
}

function isBlockStart(line: string): boolean {
  return FENCE.test(line) || HEADING.test(line) || QUOTE.test(line) || RULE.test(line)
}

export function markdownToRich(markdown: string): Conversion {
  const builder = new RichBuilder()
  const container = builder.doc.createElement('div')
  container.append(...builder.blocks(markdown.replace(/\r\n?/g, '\n').split('\n').map(expandIndent)))
  return { format: 'rich', body: sanitizeHtml(container.innerHTML), losses: ordered(builder.losses) }
}
