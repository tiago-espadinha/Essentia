import { Fragment } from 'react'
import type { Transaction } from './transactions'

interface UndoNoticeProps {
  deleted: Transaction | null
  onUndo: () => void
}

/** Stays mounted so screen readers hear each deletion; it has no timer to beat. */
export function UndoNotice({ deleted, onUndo }: UndoNoticeProps) {
  return (
    <div className="undo" role="status">
      {/* Keyed by transaction, so two deletes of same-named ones are both announced. */}
      {deleted && (
        <Fragment key={deleted.id}>
          <span className="undo__text">Deleted “{deleted.description}”.</span>
          <button type="button" className="undo__button" onClick={onUndo}>
            Undo
          </button>
        </Fragment>
      )}
    </div>
  )
}
