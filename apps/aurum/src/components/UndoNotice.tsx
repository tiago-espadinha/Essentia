import { t } from '../locale'
import { Fragment } from 'react'
import type { Transaction } from '../domain/transactions'

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
          <span className="undo__text">{t("Deleted “{description}”.", { description: deleted.description })}</span>
          <button type="button" className="undo__button" onClick={onUndo}>
            {t("Undo")}</button>
        </Fragment>
      )}
    </div>
  )
}
