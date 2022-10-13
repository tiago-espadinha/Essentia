import { describe, expect, it } from 'vitest'
import { formatEdit, type Format } from './formatting'

/** Applies the edit; `[` and `]` in the input mark the selection, and in the output the new one. */
function format(marked: string, kind: Format): string {
  const start = marked.indexOf('[')
  const end = marked.indexOf(']') - 1
  const value = marked.replace('[', '').replace(']', '')
  const edit = formatEdit(value, start, end, kind)
  const next = value.slice(0, edit.start) + edit.text + value.slice(edit.end)
  return next.slice(0, edit.selectStart) + '[' + next.slice(edit.selectStart, edit.selectEnd) + ']' + next.slice(edit.selectEnd)
}

describe('inline formats', () => {
  it('wraps the selection and keeps it selected', () => {
    expect(format('a [word] here', 'bold')).toBe('a **[word]** here')
    expect(format('a [word] here', 'italic')).toBe('a _[word]_ here')
    expect(format('a [word] here', 'code')).toBe('a `[word]` here')
  })

  it('inserts a selected placeholder when nothing is selected', () => {
    expect(format('a []', 'bold')).toBe('a **[bold text]**')
  })

  it('makes a link from the selection and selects the url to type over', () => {
    expect(format('see [docs]', 'link')).toBe('see [docs]([url])')
    expect(format('[]', 'link')).toBe('[link text]([url])')
  })
})

describe('line formats', () => {
  it('prefixes the whole line the caret is on', () => {
    expect(format('one\ntw[]o\nthree', 'heading')).toBe('one\n[## two]\nthree')
    expect(format('a [quote]', 'quote')).toBe('[> a quote]')
  })

  it('prefixes every selected line, numbering a numbered list', () => {
    expect(format('[a\nb]', 'bulleted')).toBe('[- a\n- b]')
    expect(format('[a\nb\nc]', 'numbered')).toBe('[1. a\n2. b\n3. c]')
  })

  it('does not take in the next line when the selection ends at a line break', () => {
    expect(format('[a\n]b', 'bulleted')).toBe('[- a]\nb')
  })

  it('takes the format off lines that all have it', () => {
    expect(format('[- a\n- b]', 'bulleted')).toBe('[a\nb]')
    expect(format('[## Title]', 'heading')).toBe('[Title]')
    expect(format('[1. a\n2. b]', 'numbered')).toBe('[a\nb]')
  })

  it('fences the selected lines as a code block', () => {
    expect(format('x\n[let a = 1]\ny', 'codeblock')).toBe('x\n```\n[let a = 1]\n```\ny')
  })
})

describe('headings', () => {
  it('takes a heading of any level off instead of stacking another', () => {
    expect(format('[### Deep]', 'heading')).toBe('[Deep]')
  })
})
