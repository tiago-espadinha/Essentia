import { Dialog, formatNumber } from '@essentia/ui'
import { t } from '../locale'

interface DeleteFolderDialogProps {
  folder: string
  /** How many notes the folder holds. */
  count: number
  onDelete: () => void
  onClose: () => void
}

/** Asks before a folder goes, saying where its notes end up. */
export function DeleteFolderDialog({ folder, count, onDelete, onClose }: DeleteFolderDialogProps) {
  const moves =
    count === 0
      ? t('It holds no notes.')
      : count === 1
        ? t('Its one note moves to Unfiled.')
        : t('Its {count} notes move to Unfiled.', { count: formatNumber(count) })
  return (
    <Dialog title={t('Delete “{name}”?', { name: folder })} titleId="delete-folder-title" returnFocusId="delete-folder" onClose={onClose}>
      <div className="dialog__text">
        <p>{moves} {t('No note is deleted.')}</p>
      </div>
      <div className="dialog__actions">
        <button type="button" className="button-ghost button-ghost--outlined" data-autofocus onClick={onClose}>{t('Cancel')}</button>
        <button type="button" className="button-primary" onClick={onDelete}>{t('Delete folder')}</button>
      </div>
    </Dialog>
  )
}
