import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject } from 'react'
import { formatEdit, SHORTCUTS, type Format } from '../domain/formatting'

/**
 * Markdown formatting applied to the source through insertText where the
 * browser has it, so Ctrl+Z undoes it.
 */
export function useMarkdownFormat(textRef: RefObject<HTMLTextAreaElement | null>, onBody: (body: string) => void) {
  // The selection to restore once a formatting change has rendered.
  const pendingSelection = useRef<[number, number] | null>(null)

  useLayoutEffect(() => {
    if (!pendingSelection.current || !textRef.current) return
    textRef.current.setSelectionRange(...pendingSelection.current)
    pendingSelection.current = null
  })

  function applyFormat(format: Format) {
    const text = textRef.current
    if (!text) return
    const edit = formatEdit(text.value, text.selectionStart, text.selectionEnd, format)
    text.focus()
    text.setSelectionRange(edit.start, edit.end)
    if (!document.execCommand?.('insertText', false, edit.text)) {
      onBody(text.value.slice(0, edit.start) + edit.text + text.value.slice(edit.end))
    }
    pendingSelection.current = [edit.selectStart, edit.selectEnd]
    text.setSelectionRange(edit.selectStart, edit.selectEnd)
  }

  function shortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
    const format = SHORTCUTS[event.key.toLowerCase()]
    if (!format || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return
    event.preventDefault()
    applyFormat(format)
  }

  return { applyFormat, shortcut }
}
