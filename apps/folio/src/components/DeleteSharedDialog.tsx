import { Dialog } from '@essentia/ui'
import { t } from '../locale'
import type { Note } from '../domain/notes'

interface DeleteSharedDialogProps {
  note: Note
  returnFocusId: string
  onDelete: () => void
  onClose: () => void
}

/** Asks before a shared note goes: its link stops working while it is deleted. */
export function DeleteSharedDialog({ note, returnFocusId, onDelete, onClose }: DeleteSharedDialogProps) {
  return (
    <Dialog title={t('Delete “{name}”?', { name: note.title.trim() || t('Untitled') })} titleId="delete-shared-title" returnFocusId={returnFocusId} onClose={onClose}>
      <div className="dialog__text">
        <p>{t('This note is shared. Anyone with the link will lose access.')}</p>
      </div>
      <div className="dialog__actions">
        <button type="button" className="button-ghost button-ghost--outlined" data-autofocus onClick={onClose}>{t('Cancel')}</button>
        <button type="button" className="button-primary" onClick={onDelete}>{t('Delete note')}</button>
      </div>
    </Dialog>
  )
}
