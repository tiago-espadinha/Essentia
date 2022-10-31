import { lazy, Suspense, useDeferredValue, useEffect, useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { DocFields } from './DocFields'
import { countWords, readingMinutes, type Doc, type DocChanges } from './documents'
import { formatEdit, SHORTCUTS, type Format } from './formatting'
import { VIEW_KEYS } from './keys'
import { LIMITS } from './sync'
import { Toolbar } from './Toolbar'

const Preview = lazy(() => import('./Preview'))

/** Below 1280 px one of the two shows at a time; from 1280 px both do. */
export type Mode = 'write' | 'preview'

/** The title, or the writing or preview side. */
export type FocusTarget = 'title' | Mode

interface EditorProps {
  doc: Doc
  /** Existing folders, offered when filing the document. */
  folders: string[]
  mode: Mode
  /** Where focus goes (the title of a document just created or opened on a phone, or the side just shown). */
  focus: FocusTarget | null
  onFocused: () => void
  onModeChange: (mode: Mode) => void
  onChange: (changes: DocChanges) => void
  /** Back to the document list, shown below 768 px. */
  onBack: () => void
  /** Extra actions for the bar (versions, export, delete). */
  actions?: ReactNode
}

export function Editor({ doc, folders, mode, focus, onFocused, onModeChange, onChange, onBack, actions }: EditorProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const previewRef = useRef<HTMLElement>(null)
  // The selection to restore once a formatting change has rendered.
  const pendingSelection = useRef<[number, number] | null>(null)
  const words = countWords(doc.content)
  // Typing stays responsive in a long document: the preview catches up between keystrokes.
  const previewContent = useDeferredValue(doc.content)

  useLayoutEffect(() => {
    if (!pendingSelection.current) return
    textRef.current!.setSelectionRange(...pendingSelection.current)
    pendingSelection.current = null
  })

  useEffect(() => {
    if (!focus) return
    const targets = { title: titleRef, write: textRef, preview: previewRef }
    targets[focus].current?.focus()
    onFocused()
  }, [focus, onFocused])

  // Through insertText where the browser has it, so Ctrl+Z undoes the format.
  function applyFormat(format: Format) {
    const text = textRef.current!
    const edit = formatEdit(text.value, text.selectionStart, text.selectionEnd, format)
    text.focus()
    text.setSelectionRange(edit.start, edit.end)
    if (!document.execCommand?.('insertText', false, edit.text)) {
      onChange({ content: text.value.slice(0, edit.start) + edit.text + text.value.slice(edit.end) })
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

  return (
    <>
      <div className="doc-bar">
        <button type="button" className="button-ghost back-button" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="action-text">Documents</span>
        </button>
        <div className="mode-switch" role="group" aria-label="Show">
          {(['write', 'preview'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="mode-switch__button"
              aria-pressed={mode === value}
              // The key switches to the side not showing.
              title={mode === value ? undefined : `${value === 'write' ? 'Write' : 'Preview'} (${VIEW_KEYS.preview.label})`}
              aria-keyshortcuts={mode === value ? undefined : VIEW_KEYS.preview.aria}
              onClick={() => onModeChange(value)}
            >
              {value === 'write' ? 'Write' : 'Preview'}
            </button>
          ))}
        </div>
        {actions}
      </div>

      <div className="doc-head">
        <label htmlFor="doc-title" className="visually-hidden">
          Title
        </label>
        <input
          id="doc-title"
          ref={titleRef}
          className="doc-head__title"
          placeholder="Untitled"
          autoComplete="off"
          maxLength={LIMITS.title}
          value={doc.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <p className="label doc-head__stats">
          {words} {words === 1 ? 'word' : 'words'} · {readingMinutes(words)} min read
        </p>
        <DocFields folder={doc.folder} tags={doc.tags} folders={folders} onChange={onChange} />
      </div>

      <div className="panes" data-mode={mode}>
        <div className="write-pane">
          <Toolbar onFormat={applyFormat} />
          <label htmlFor="doc-content" className="visually-hidden">
            Markdown
          </label>
          <textarea
            id="doc-content"
            ref={textRef}
            className="write-pane__text"
            placeholder="Write in markdown: # for a heading, ** for bold, - for a list"
            spellCheck
            maxLength={LIMITS.content}
            value={doc.content}
            onChange={(event) => onChange({ content: event.target.value })}
            onKeyDown={shortcut}
          />
        </div>
        {/* Focusable for the shortcut that shows it; focused, the arrow keys scroll it. */}
        <section ref={previewRef} className="preview-pane" aria-label="Preview" tabIndex={-1}>
          <Suspense fallback={<p className="preview__idle">Loading the preview…</p>}>
            <Preview content={previewContent} />
          </Suspense>
        </section>
      </div>
    </>
  )
}
