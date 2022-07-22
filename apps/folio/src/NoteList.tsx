import { formatDate, plainText, type Note } from './notes'

interface NoteListProps {
  notes: Note[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function NoteList({ notes, selectedId, onSelect, onNew }: NoteListProps) {
  return (
    <section className="pane list-pane" aria-labelledby="list-title">
      <div className="pane__head">
        <h2 id="list-title" className="label">
          Notes
        </h2>
        {notes.length > 0 && <NewNoteButton onClick={onNew} />}
      </div>

      <div className="pane__body">
        {notes.length === 0 ? (
          <div className="empty">
            <h3 className="empty__title">No notes yet.</h3>
            <p className="empty__text">Start one and it stays on this device.</p>
            <NewNoteButton onClick={onNew} />
          </div>
        ) : (
          <ul className="notes">
            {notes.map((note) => (
              <li key={note.id}>
                <NoteRow note={note} selected={note.id === selectedId} onSelect={onSelect} />
              </li>
            ))}
          </ul>
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
      </svg>
      New note
    </button>
  )
}

function NoteRow({ note, selected, onSelect }: { note: Note; selected: boolean; onSelect: (id: string) => void }) {
  const preview = plainText(note.body)
  return (
    <button
      type="button"
      className="note-row"
      aria-current={selected ? 'true' : undefined}
      onClick={() => onSelect(note.id)}
    >
      <span className="note-row__title">{note.title.trim() || 'Untitled'}</span>
      {preview && <span className="note-row__preview">{preview}</span>}
      <span className="label note-row__date">{formatDate(note.updatedAt)}</span>
    </button>
  )
}
