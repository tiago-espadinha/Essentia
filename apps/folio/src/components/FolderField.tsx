import { useEffect, useId, useRef, useState } from 'react'
import { t } from '../locale'
import { FolderForm } from './FolderForm'

// The option that opens a field for a new folder's name; no folder can be named this.
const NEW = '\u0000new'

interface FolderFieldProps {
  folder: string
  folders: string[]
  readOnly: boolean
  /** Moves the note to a folder, new or existing, or to '' for unfiled. */
  onMove: (folder: string) => void
}

/** The note's folder: Unfiled, an existing folder, or a new one named on the spot. */
export function FolderField({ folder, folders, readOnly, onMove }: FolderFieldProps) {
  const id = useId()
  const [naming, setNaming] = useState(false)
  const selectRef = useRef<HTMLSelectElement>(null)
  const focusSelect = useRef(false)

  useEffect(() => {
    if (!focusSelect.current) return
    focusSelect.current = false
    selectRef.current?.focus()
  })

  // Back to the picker once the name is given or abandoned, with focus on it.
  function closeForm() {
    focusSelect.current = true
    setNaming(false)
  }

  if (naming) {
    return (
      <div className="folder-field folder-field--naming">
        <span className="label" aria-hidden="true">{t('Folder')}</span>
        <FolderForm
          label={t('New folder name')}
          folders={folders}
          onSubmit={(name) => {
            onMove(name)
            closeForm()
          }}
          onCancel={closeForm}
        />
      </div>
    )
  }

  return (
    <div className="folder-field">
      <label className="label" htmlFor={id}>{t('Folder')}</label>
      <select
        id={id}
        ref={selectRef}
        className="folder-field__select"
        value={folder}
        disabled={readOnly}
        onChange={(event) => {
          if (event.target.value === NEW) setNaming(true)
          else onMove(event.target.value)
        }}
      >
        <option value="">{t('Unfiled')}</option>
        {folders.map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
        <option value={NEW}>{t('New folder…')}</option>
      </select>
    </div>
  )
}
