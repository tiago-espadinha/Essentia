import { Fragment } from 'react'
import type { Task } from './tasks'

interface UndoNoticeProps {
  deleted: Task | null
  onUndo: () => void
}

/** Stays mounted so screen readers hear each deletion; it has no timer to beat. */
export function UndoNotice({ deleted, onUndo }: UndoNoticeProps) {
  return (
    <div className="undo" role="status">
      {/* Keyed by task, so two deletes of same-named tasks are both announced. */}
      {deleted && (
        <Fragment key={deleted.id}>
          <span className="undo__text">Deleted “{deleted.text}”.</span>
          <button type="button" className="undo__button" onClick={onUndo}>
            Undo
          </button>
        </Fragment>
      )}
    </div>
  )
}
