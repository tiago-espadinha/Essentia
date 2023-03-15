import { t } from '../locale'
import { Fragment } from 'react'
import type { Habit } from '../domain/habits'

interface UndoNoticeProps {
  deleted: Habit | null
  onUndo: () => void
}

/** Stays mounted so screen readers hear each deletion; it has no timer to beat. */
export function UndoNotice({ deleted, onUndo }: UndoNoticeProps) {
  return (
    <div className="undo" role="status">
      {/* Keyed by habit, so two deletes of same-named habits are both announced. */}
      {deleted && (
        <Fragment key={deleted.id}>
          <span className="undo__text">{t('Deleted “{name}” and its history.', { name: deleted.name })}</span>
          <button type="button" className="undo__button" onClick={onUndo}>{t("Undo")}</button>
        </Fragment>
      )}
    </div>
  )
}
