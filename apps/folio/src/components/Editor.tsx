import { formatNumber, isSearchFocus } from '@essentia/ui'
import { t } from '../locale'
import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { insertTransfer, placeCaretAt } from '../domain/editing'
import { countWords, formatDate, noteText, parseTags, type Note, type NoteChanges } from '../domain/notes'
import { sanitizeHtml } from '../domain/sanitize'
import { useMarkdownFormat } from '../hooks/useMarkdownFormat'
import { MarkdownBody, ModeSwitch, type Mode } from './MarkdownBody'
import { MarkdownToolbar } from './MarkdownToolbar'
import { FolderField } from './FolderField'
import { MORE_BUTTON_ID, MoreMenu } from './MoreMenu'
import { Toolbar } from './Toolbar'

interface EditorProps {
  note: Note
  /** Every folder, for the folder picker. */
  folders: string[]
  /** Shown for reading only: no formatting, pinning or deleting, and every field is read-only. */
  readOnly: boolean
  /** Focus the title (a note just created, or opened on a phone). */
  autoFocus: boolean
  onFocused: () => void
  onChange: (changes: NoteChanges) => void
  onMove: (folder: string) => void
  /** Back to the note list, shown below 768 px. */
  onBack: () => void
  /** Opens Versions; its dialog returns focus to the control with this id. */
  onVersions: (returnFocusId: string) => void
  /** Opens Convert; its dialog returns focus to the control with this id. */
  onConvert: (returnFocusId: string) => void
  /** Opens Share; left out when the suite has no account service. */
  onShare?: (returnFocusId: string) => void
  /** Deletes, or asks first; a dialog returns focus to the control with this id. */
  onDelete: (returnFocusId: string) => void
}

const CONVERT_BUTTON_ID = 'convert-button'
const VERSIONS_BUTTON_ID = 'versions-button'
const SHARE_BUTTON_ID = 'share-button'
const DELETE_BUTTON_ID = 'delete-button'

/**
 * One note. Remounted per note (keyed by id), so the body is written into the DOM once.
 * A markdown note is edited as its source text, with a preview beside it: the
 * rich editor would turn it into HTML.
 */
export function Editor({ note, folders, readOnly, autoFocus, onFocused, onChange, onMove, onBack, onVersions, onConvert, onShare, onDelete }: EditorProps) {
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const sourceRef = useRef<HTMLTextAreaElement>(null)
  const markdown = note.format === 'markdown'
  // Text dragged within the body moves natively; anything from outside is cleaned first.
  const draggingInside = useRef(false)
  const [mode, setMode] = useState<Mode>('write')
  const markdownFormat = useMarkdownFormat(sourceRef, (body) => onChange({ body }))

  // Before paint, so switching notes never shows an empty body.
  useLayoutEffect(() => {
    if (bodyRef.current) bodyRef.current.innerHTML = note.body
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
    ;(bodyRef.current ?? sourceRef.current)?.focus()
  }

  const text = noteText(note)
  const convertLabel = t(markdown ? 'Convert to rich text' : 'Convert to markdown')

  return (
    <>
      <div className="editor__bar" data-mode={markdown ? mode : undefined}>
        <button type="button" className="button-ghost back-button" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M10 3.5 5.5 8l4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>{t("Notes")}</button>
        {readOnly ? (
          <span className="editor__format">
            {[markdown && t('Markdown'), t('Read-only')].filter(Boolean).join(' · ')}
          </span>
        ) : markdown ? (
          <MarkdownToolbar onFormat={markdownFormat.applyFormat} />
        ) : (
          <Toolbar bodyRef={bodyRef} onFormat={saveBody} />
        )}
        {markdown && <ModeSwitch mode={mode} onChange={setMode} />}
        {!readOnly && (
          <>
            <button
              type="button"
              className="button-ghost pin-button"
              aria-pressed={note.pinned}
              onClick={() => onChange({ pinned: !note.pinned })}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path
                  d="M6 2.5h4M7 2.5v4L4.5 9.5h7L9 6.5v-4M8 9.5v4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="pin-button__label">{t("Pin")}</span>
            </button>
            {/* From 1024 px the actions sit in the bar; below, they fold into More. */}
            <button type="button" id={CONVERT_BUTTON_ID} className="button-ghost note-action" onClick={() => onConvert(CONVERT_BUTTON_ID)}>
              {convertLabel}
            </button>
            <button type="button" id={VERSIONS_BUTTON_ID} className="button-ghost note-action" onClick={() => onVersions(VERSIONS_BUTTON_ID)}>{t("Versions")}</button>
            {onShare && (
              <button type="button" id={SHARE_BUTTON_ID} className="button-ghost note-action" onClick={() => onShare(SHARE_BUTTON_ID)}>{t("Share")}</button>
            )}
            <button type="button" id={DELETE_BUTTON_ID} className="button-ghost button-ghost--danger note-action" onClick={() => onDelete(DELETE_BUTTON_ID)}>{t("Delete")}</button>
            <MoreMenu
              items={[
                { label: convertLabel, onSelect: () => onConvert(MORE_BUTTON_ID) },
                { label: t('Versions'), onSelect: () => onVersions(MORE_BUTTON_ID) },
                ...(onShare ? [{ label: t('Share'), onSelect: () => onShare(MORE_BUTTON_ID) }] : []),
                { label: t('Delete'), onSelect: () => onDelete(MORE_BUTTON_ID), danger: true },
              ]}
            />
          </>
        )}
      </div>

      <div className="pane__body">
        <article className={markdown ? 'editor editor--markdown' : 'editor'}>
          <label htmlFor="note-title" className="visually-hidden">{t("Title")}</label>
          <textarea
            id="note-title"
            ref={titleRef}
            className="editor__title"
            rows={1}
            placeholder={t("Untitled")}
            readOnly={readOnly}
            value={note.title}
            onChange={(event) => onChange({ title: event.target.value.replace(/\n/g, ' ') })}
            onKeyDown={titleKeyDown}
          />

          <div className="editor__meta">
            <span className="label">{t('Updated {date}', { date: formatDate(note.updatedAt) })}</span>
            <span className="label">
              {t(countWords(text) === 1 ? '{count} word' : '{count} words', { count: formatNumber(countWords(text)) })} · {t(text.length === 1 ? '{count} character' : '{count} characters', { count: formatNumber(text.length) })}
            </span>
            <FolderField folder={note.folder} folders={folders} readOnly={readOnly} onMove={onMove} />
            <TagsField tags={note.tags} readOnly={readOnly} onChange={(tags) => onChange({ tags })} />
          </div>

          {markdown ? (
            <MarkdownBody
              body={note.body}
              mode={mode}
              readOnly={readOnly}
              textRef={sourceRef}
              onChange={(body) => onChange({ body })}
              onShortcut={markdownFormat.shortcut}
            />
          ) : (
            <div
              ref={bodyRef}
              className="editor__body"
              contentEditable={!readOnly}
              role="textbox"
              aria-multiline="true"
              aria-readonly={readOnly || undefined}
              aria-label={t("Note")}
              data-placeholder={t("Start writing")}
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
          )}
        </article>
      </div>
    </>
  )
}

/**
 * Comma-separated tags, saved when the field is left or Enter is pressed. The
 * draft never re-syncs from props: the editor remounts per note.
 */
function TagsField({ tags, readOnly, onChange }: { tags: string[]; readOnly: boolean; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState(tags.join(', '))

  function commit() {
    const next = parseTags(draft)
    setDraft(next.join(', '))
    if (next.join() !== tags.join()) onChange(next)
  }

  return (
    <label className="tags-field">
      <span className="label">{t("Tags")}</span>
      <input
        className="tags-field__input"
        value={draft}
        readOnly={readOnly}
        placeholder={t("work, ideas")}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => { if (!isSearchFocus(event.relatedTarget)) commit() }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
      />
    </label>
  )
}
