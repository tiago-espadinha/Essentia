import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { activeFormats, applyFormat, insertTransfer } from './editing'

let root: HTMLElement
const execCommand = vi.fn()

beforeEach(() => {
  root = document.body.appendChild(document.createElement('div'))
  Object.assign(document, { execCommand, queryCommandState: (command: string) => command === 'bold' })
})

afterEach(() => {
  root.remove()
  execCommand.mockReset()
  delete (document as Partial<Document>).execCommand
  delete (document as Partial<Document>).queryCommandState
})

function caretIn(selector: string) {
  const range = document.createRange()
  range.selectNodeContents(root.querySelector(selector)!)
  range.collapse(true)
  window.getSelection()!.removeAllRanges()
  window.getSelection()!.addRange(range)
}

function transfer(data: Record<string, string>): DataTransfer {
  return { getData: (kind: string) => data[kind] ?? '' } as DataTransfer
}

describe('applyFormat', () => {
  it('runs the inline and list commands', () => {
    applyFormat(root, 'bold')
    applyFormat(root, 'numbered')
    expect(execCommand.mock.calls).toEqual([
      ['bold', false, undefined],
      ['insertOrderedList', false, undefined],
    ])
  })

  it('turns a paragraph into a heading, and a heading back into a paragraph', () => {
    root.innerHTML = '<p>text</p><h2>title</h2>'
    caretIn('p')
    applyFormat(root, 'h2')
    caretIn('h2')
    applyFormat(root, 'h2')
    expect(execCommand.mock.calls).toEqual([
      ['formatBlock', false, 'h2'],
      ['formatBlock', false, 'p'],
    ])
  })

  it('does not count a block outside the body as applied', () => {
    // root sits inside the quote; afterEach removes root, then the quote.
    const outside = document.body.appendChild(document.createElement('blockquote'))
    outside.appendChild(root)
    onTestFinished(() => outside.remove())
    root.innerHTML = '<p>text</p>'
    caretIn('p')
    applyFormat(root, 'blockquote')
    expect(execCommand).toHaveBeenCalledWith('formatBlock', false, 'blockquote')
  })
})

describe('activeFormats', () => {
  it('reports command states and enclosing blocks at the caret', () => {
    root.innerHTML = '<blockquote><p>quoted</p></blockquote>'
    caretIn('p')
    expect(activeFormats(root)).toEqual(new Set(['bold', 'blockquote']))
  })

  it('is empty when the selection is elsewhere', () => {
    root.innerHTML = '<h1>title</h1>'
    window.getSelection()!.removeAllRanges()
    expect(activeFormats(root)).toEqual(new Set())
  })
})

describe('insertTransfer', () => {
  it('inserts pasted HTML only after sanitizing it', () => {
    insertTransfer(transfer({ 'text/html': '<p onmouseover="steal()">hi</p><script>steal()</script>', 'text/plain': 'hi' }))
    expect(execCommand).toHaveBeenCalledWith('insertHTML', false, '<p>hi</p>')
  })

  it('inserts plain text as text', () => {
    insertTransfer(transfer({ 'text/plain': '<b>not markup</b>' }))
    expect(execCommand).toHaveBeenCalledWith('insertText', false, '<b>not markup</b>')
  })

  it('ignores a missing transfer', () => {
    insertTransfer(null)
    expect(execCommand).not.toHaveBeenCalled()
  })
})
