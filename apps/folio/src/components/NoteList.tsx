import { formatNumber } from '@essentia/ui'
import { t } from '../locale'
import { formatDate, noteText, type Note } from '../domain/notes'
import { ReadOnlyNotice } from './ReadOnlyNotice'
import { UndoNotice } from './UndoNotice'

interface NoteListProps {
  /** The notes that pass the filters, pinned first. */
  notes: Note[]
  /** How many notes exist at all. */
  total: number
  selectedId: string | null
  /** Whether the Filter bar (the Library, below 1024 px) is open. */
  filtersOpen: boolean
  /** The latest deleted note, offered for undo. */
  deleted: Note | null
  /** The notes could not be stored here: they show with a notice and an export, and nothing adds to them. */
  readOnly: boolean
  onExport: () => void
  onSelect: (id: string) => void
  onToggleFilters: () => void
  onNew: () => void
  onClearFilters: () => void
  onUndo: () => void
}

export function NoteList({
  notes,
  total,
  selectedId,
  filtersOpen,
  deleted,
  readOnly,
  onExport,
  onSelect,
  onToggleFilters,
  onNew,
  onClearFilters,
  onUndo,
}: NoteListProps) {
  const pinned = notes.filter((note) => note.pinned)
  const others = notes.filter((note) => !note.pinned)
  const rows = (group: Note[]) => (
    <ul className="notes">
      {group.map((note) => (
        <li key={note.id}>
          <NoteRow note={note} selected={note.id === selectedId} onSelect={onSelect} />
        </li>
      ))}
    </ul>
  )

  return (
    <section className="pane list-pane" aria-labelledby="list-title">
      <div className="pane__head">
        <h2 id="list-title" className="label">
          {t('Notes · {count}', { count: formatNumber(notes.length) })}
        </h2>
        {total > 0 && (
          <div className="pane__actions">
            <button
              type="button"
              className="button-ghost filter-toggle"
              aria-expanded={filtersOpen}
              aria-controls="library"
              onClick={onToggleFilters}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2.5 4h11M4.5 8h7M6.5 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>{t("Filter")}</button>
            {!readOnly && <NewNoteButton onClick={onNew} />}
          </div>
        )}
      </div>

      {readOnly && <ReadOnlyNotice onExport={onExport} />}
      <UndoNotice deleted={deleted} onUndo={onUndo} />

      <div className="pane__body">
        {total === 0 ? (
          <div className="empty">
            <h3 className="empty__title">{t("No notes yet.")}</h3>
            {!readOnly && (
              <>
                <p className="empty__text">{t("Start one and it stays on this device.")}</p>
                <NewNoteButton onClick={onNew} />
              </>
            )}
          </div>
        ) : notes.length === 0 ? (
          <div className="empty">
            <h3 className="empty__title">{t("Nothing matches.")}</h3>
            <p className="empty__text">{t("No notes fit this search.")}</p>
            <button type="button" className="button-ghost button-ghost--outlined" onClick={onClearFilters}>{t("Clear search")}</button>
          </div>
        ) : pinned.length === 0 ? (
          rows(others)
        ) : (
          <>
            <h3 className="label group-label">{t("Pinned")}</h3>
            {rows(pinned)}
            {others.length > 0 && (
              <>
                <h3 className="label group-label">{t("Notes")}</h3>
                {rows(others)}
              </>
            )}
          </>
        )}
      </div>
    </section>
  )
}

function NewNoteButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="button-primary" onClick={onClick}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>{t("New note")}</button>
  )
}

function NoteRow({ note, selected, onSelect }: { note: Note; selected: boolean; onSelect: (id: string) => void }) {
  const preview = noteText(note)
  return (
    <button
      type="button"
      className="note-row"
      data-note-id={note.id}
      data-motion-item={note.id}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(note.id)}
    >
      <span className="note-row__title">{note.title.trim() || t('Untitled')}</span>
      {preview && <span className="note-row__preview">{preview}</span>}
      <span className="label note-row__date">{formatDate(note.updatedAt)}</span>
    </button>
  )
}
