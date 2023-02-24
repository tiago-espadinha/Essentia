import { Fragment } from 'react'
import type { Note } from './notes'

const message = (note: Note) => `Deleted “${note.title.trim() || 'Untitled'}”.`

/** The strip under the list head while the latest deleted note can come back. */
export function UndoNotice({ deleted, onUndo }: { deleted: Note | null; onUndo: () => void }) {
  if (!deleted) return null
  return (
    <div className="undo">
      <span className="undo__text">{message(deleted)}</span>
      <button type="button" className="undo__button" onClick={onUndo}>
        Undo
      </button>
    </div>
  )
}

/**
 * Announces each deletion. It sits outside the panes, which hide below 768 px,
 * and stays mounted, so screen readers hear it from either view.
 */
export function DeleteAnnouncer({ deleted }: { deleted: Note | null }) {
  return (
    <p className="visually-hidden" role="status">
      {/* Keyed by note, so two deletes of same-named notes are both announced. */}
      {deleted && <Fragment key={deleted.id}>{message(deleted)}</Fragment>}
    </p>
  )
}
