import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { insertTransfer, placeCaretAt } from './editing'
import { countWords, formatDate, parseTags, plainText, type Note, type NoteChanges } from './notes'
import { sanitizeHtml } from './sanitize'
import { Toolbar } from './Toolbar'

interface EditorProps {
  note: Note
  /** Focus the title on mount (a note just created). */
  autoFocus: boolean
  onFocused: () => void
  onChange: (changes: NoteChanges) => void
  onDelete: () => void
}

/** One note. Remounted per note (keyed by id), so the body is written into the DOM once. */
export function Editor({ note, autoFocus, onFocused, onChange, onDelete }: EditorProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  // Text dragged within the body moves natively; anything from outside is cleaned first.
  const draggingInside = useRef(false)

  // Before paint, so switching notes never shows an empty body.
  useLayoutEffect(() => {
    bodyRef.current!.innerHTML = note.body
    // Only on mount: afterwards the DOM is the source and the note follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!autoFocus) return
    titleRef.current?.focus()
    onFocused()
  }, [autoFocus, onFocused])

  function saveBody() {
    onChange({ body: sanitizeHtml(bodyRef.current!.innerHTML) })
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    if (draggingInside.current) return
    event.preventDefault()
    placeCaretAt(event.clientX, event.clientY)
    insertTransfer(event.dataTransfer)
    saveBody()
  }

  // Enter in the title moves on to the body instead of breaking the title.
  function titleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    bodyRef.current?.focus()
  }

  const text = plainText(note.body)

  return (
    <>
      <div className="editor__bar">
        <Toolbar bodyRef={bodyRef} onFormat={saveBody} />
        <button type="button" className="button-ghost button-ghost--danger" onClick={onDelete}>
          Delete
        </button>
      </div>

      <div className="pane__body">
        <article className="editor">
          <label htmlFor="note-title" className="visually-hidden">
            Title
          </label>
          <textarea
            id="note-title"
            ref={titleRef}
            className="editor__title"
            rows={1}
            placeholder="Untitled"
            value={note.title}
            onChange={(event) => onChange({ title: event.target.value.replace(/\n/g, ' ') })}
            onKeyDown={titleKeyDown}
          />

          <div className="editor__meta">
            <span className="label">Updated {formatDate(note.updatedAt)}</span>
            <span className="label">
              {countWords(text)} words · {text.length} characters
            </span>
            <TagsField tags={note.tags} onChange={(tags) => onChange({ tags })} />
          </div>

          <div
            ref={bodyRef}
            className="editor__body"
            contentEditable
            role="textbox"
            aria-multiline="true"
            aria-label="Note"
            data-placeholder="Start writing"
            onFocus={() => document.execCommand?.('defaultParagraphSeparator', false, 'p')}
            onInput={saveBody}
            onPaste={(event) => {
              event.preventDefault()
              insertTransfer(event.clipboardData)
              saveBody()
            }}
            onDragStart={() => (draggingInside.current = true)}
            onDragEnd={() => (draggingInside.current = false)}
            onDrop={drop}
          />
        </article>
      </div>
    </>
  )
}

/**
 * Comma-separated tags, saved when the field is left or Enter is pressed. The
 * draft never re-syncs from props: the editor remounts per note.
 */
function TagsField({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState(tags.join(', '))

  function commit() {
    const next = parseTags(draft)
    setDraft(next.join(', '))
    if (next.join() !== tags.join()) onChange(next)
  }

  return (
    <label className="tags-field">
      <span className="label">Tags</span>
      <input
        className="tags-field__input"
        value={draft}
        placeholder="work, ideas"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
      />
    </label>
  )
}
