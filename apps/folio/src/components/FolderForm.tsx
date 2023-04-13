import { useId, useState, type FormEvent } from 'react'
import { t } from '../locale'
import { checkFolderName, FOLDER_LIMIT, type FolderError } from '../domain/notes'

const MESSAGES: Record<FolderError, string> = {
  blank: 'Give the folder a name.',
  long: 'Use {count} characters or fewer.',
  taken: 'Another folder has this name.',
}

interface FolderFormProps {
  /** The field's label, read by screen readers. */
  label: string
  /** The folder being renamed; without it a folder is being created. */
  renaming?: string
  folders: string[]
  onSubmit: (name: string) => void
  onCancel: () => void
}

/** A folder name to create or rename, checked when submitted; Escape cancels. */
export function FolderForm({ label, renaming, folders, onSubmit, onCancel }: FolderFormProps) {
  const id = useId()
  const [draft, setDraft] = useState(renaming ?? '')
  const [error, setError] = useState<FolderError | null>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const checked = checkFolderName(draft, folders, renaming)
    if (checked.error) setError(checked.error)
    else onSubmit(checked.name)
  }

  return (
    <form className="folder-form" onSubmit={submit}>
      <label htmlFor={id} className="visually-hidden">{label}</label>
      <input
        id={id}
        className="search folder-form__input"
        autoComplete="off"
        autoFocus
        placeholder={t('Folder name')}
        value={draft}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onChange={(event) => {
          setDraft(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          event.preventDefault()
          onCancel()
        }}
      />
      {error && (
        <p id={`${id}-error`} className="field-error" role="alert">
          {t(MESSAGES[error], { count: FOLDER_LIMIT })}
        </p>
      )}
      <div className="folder-form__actions">
        <button type="button" className="button-ghost" onClick={onCancel}>{t('Cancel')}</button>
        <button type="submit" className="button-ghost button-ghost--outlined">{t(renaming === undefined ? 'Add' : 'Rename')}</button>
      </div>
    </form>
  )
}
