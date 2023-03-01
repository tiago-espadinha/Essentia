import { Fragment } from 'react'

interface UndoNoticeProps {
  /** The deleted document: its id keys the notice, its title names it. */
  deleted: { id: string; title: string } | null
  onUndo: () => void
}

/** Stays mounted so screen readers hear each deletion; it has no timer to beat. */
export function UndoNotice({ deleted, onUndo }: UndoNoticeProps) {
  return (
    <div className="undo" role="status">
      {deleted && (
        <Fragment key={deleted.id}>
          <span className="undo__text">Deleted “{deleted.title}” and its versions.</span>
          <button type="button" className="undo__button" onClick={onUndo}>
            Undo
          </button>
        </Fragment>
      )}
    </div>
  )
}
