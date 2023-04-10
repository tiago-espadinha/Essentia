import { t } from '../locale'
import { lazy, Suspense, useDeferredValue, type KeyboardEvent, type RefObject } from 'react'

const Preview = lazy(() => import('./Preview'))

/** Below 1280 px one of the two shows at a time; from 1280 px both do. */
export type Mode = 'write' | 'preview'

export function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div className="mode-switch" role="group" aria-label={t('Write or preview')}>
      {(['write', 'preview'] as const).map((value) => (
        <button
          key={value}
          type="button"
          className="mode-switch__button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          {t(value === 'write' ? 'Write' : 'Preview')}
        </button>
      ))}
    </div>
  )
}

interface MarkdownBodyProps {
  body: string
  mode: Mode
  readOnly: boolean
  textRef: RefObject<HTMLTextAreaElement | null>
  onChange: (body: string) => void
  onShortcut: (event: KeyboardEvent<HTMLTextAreaElement>) => void
}

/** A markdown note's source and its rendered preview. */
export function MarkdownBody({ body, mode, readOnly, textRef, onChange, onShortcut }: MarkdownBodyProps) {
  // Typing stays responsive in a long note: the preview catches up between keystrokes.
  const previewBody = useDeferredValue(body)
  return (
    <div className="md-panes" data-mode={mode}>
      <div className="md-write">
        <label htmlFor="note-source" className="visually-hidden">{t('Note')}</label>
        <textarea
          id="note-source"
          ref={textRef}
          className="editor__body editor__source"
          placeholder={t('Write in markdown: # for a heading, ** for bold, - for a list')}
          spellCheck
          readOnly={readOnly}
          value={body}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={onShortcut}
        />
      </div>
      <section className="md-preview" aria-label={t('Preview')}>
        <Suspense fallback={<p className="preview__idle">{t('Loading the preview…')}</p>}>
          <Preview content={previewBody} />
        </Suspense>
      </section>
    </div>
  )
}
