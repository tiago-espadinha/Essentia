import { lazy, Suspense, useEffect, useRef, type ReactNode } from 'react'
import { countWords, readingMinutes, type Doc, type DocChanges } from './documents'

const Preview = lazy(() => import('./Preview'))

/** Below 1280 px one of the two shows at a time; from 1280 px both do. */
export type Mode = 'write' | 'preview'

interface EditorProps {
  doc: Doc
  mode: Mode
  /** Focus the title (a document just created, or opened on a phone). */
  autoFocus: boolean
  onFocused: () => void
  onModeChange: (mode: Mode) => void
  onChange: (changes: DocChanges) => void
  /** Back to the document list, shown below 768 px. */
  onBack: () => void
  /** Extra actions for the bar (versions, export, delete). */
  actions?: ReactNode
}

export function Editor({ doc, mode, autoFocus, onFocused, onModeChange, onChange, onBack, actions }: EditorProps) {
  const titleRef = useRef<HTMLInputElement>(null)
  const words = countWords(doc.content)

  useEffect(() => {
    if (!autoFocus) return
    titleRef.current?.focus()
    onFocused()
  }, [autoFocus, onFocused])

  return (
    <>
      <div className="doc-bar">
        <button type="button" className="button-ghost back-button" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Documents
        </button>
        <div className="mode-switch" role="group" aria-label="Show">
          {(['write', 'preview'] as const).map((value) => (
            <button
              key={value}
              type="button"
              className="mode-switch__button"
              aria-pressed={mode === value}
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
          value={doc.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
        <p className="label doc-head__stats">
          {words} {words === 1 ? 'word' : 'words'} · {readingMinutes(words)} min read
        </p>
      </div>

      <div className="panes" data-mode={mode}>
        <div className="write-pane">
          <label htmlFor="doc-content" className="visually-hidden">
            Markdown
          </label>
          <textarea
            id="doc-content"
            className="write-pane__text"
            placeholder="Write in markdown: # for a heading, ** for bold, - for a list"
            spellCheck
            value={doc.content}
            onChange={(event) => onChange({ content: event.target.value })}
          />
        </div>
        <section className="preview-pane" aria-label="Preview">
          <Suspense fallback={<p className="preview__idle">Loading the preview…</p>}>
            <Preview content={doc.content} />
          </Suspense>
        </section>
      </div>
    </>
  )
}
