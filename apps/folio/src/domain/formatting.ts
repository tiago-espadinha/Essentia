// Markdown formatting as plain text edits on the source, so the editor can
// apply them through the browser's own undo history.

export type Format = 'heading' | 'bold' | 'italic' | 'code' | 'link' | 'quote' | 'bulleted' | 'numbered' | 'codeblock'

/** Replace `start`..`end` with `text`, then select `selectStart`..`selectEnd`. */
export interface TextEdit {
  start: number
  end: number
  text: string
  selectStart: number
  selectEnd: number
}

const INLINE: Partial<Record<Format, [string, string, string]>> = {
  bold: ['**', '**', 'bold text'],
  italic: ['_', '_', 'italic text'],
  code: ['`', '`', 'code'],
}

const LINE_PREFIX: Partial<Record<Format, (index: number) => string>> = {
  heading: () => '## ',
  quote: () => '> ',
  bulleted: () => '- ',
  numbered: (index) => `${index + 1}. `,
}

const PREFIX_PATTERN: Partial<Record<Format, RegExp>> = {
  heading: /^#{1,6} /,
  quote: /^> /,
  bulleted: /^- /,
  numbered: /^\d+\. /,
}

export function formatEdit(value: string, start: number, end: number, format: Format): TextEdit {
  const selected = value.slice(start, end)

  const inline = INLINE[format]
  if (inline) {
    const [open, close, placeholder] = inline
    const inner = selected || placeholder
    const selectStart = start + open.length
    return { start, end, text: open + inner + close, selectStart, selectEnd: selectStart + inner.length }
  }

  if (format === 'link') {
    const text = selected || 'link text'
    const urlStart = start + text.length + 3
    return { start, end, text: `[${text}](url)`, selectStart: urlStart, selectEnd: urlStart + 3 }
  }

  // Line formats work on whole lines.
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const nextBreak = value.indexOf('\n', end > start && value[end - 1] === '\n' ? end - 1 : end)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  const lines = value.slice(lineStart, lineEnd).split('\n')

  if (format === 'codeblock') {
    const text = `\`\`\`\n${lines.join('\n')}\n\`\`\``
    return { start: lineStart, end: lineEnd, text, selectStart: lineStart + 4, selectEnd: lineEnd + 4 }
  }

  const prefix = LINE_PREFIX[format]!
  const pattern = PREFIX_PATTERN[format]!
  // Applied to lines that all have it already (a heading of any level), the format comes off again.
  const removing = lines.every((line) => pattern.test(line))
  const text = lines.map((line, index) => (removing ? line.replace(pattern, '') : prefix(index) + line)).join('\n')
  return { start: lineStart, end: lineEnd, text, selectStart: lineStart, selectEnd: lineStart + text.length }
}

/** The format for a Ctrl or Cmd shortcut in the editor. */
export const SHORTCUTS: Record<string, Format> = { b: 'bold', i: 'italic', k: 'link' }
