import { useState } from 'react'
import { cleanFolder, parseTags, type DocChanges } from './documents'
import { LIMITS } from './sync'

interface DocFieldsProps {
  folder: string
  tags: string[]
  /** Existing folders, offered as suggestions. */
  folders: string[]
  onChange: (changes: DocChanges) => void
}

/**
 * The document's folder and comma-separated tags, each saved when the field is
 * left or Enter is pressed. Drafts never re-sync from props: the editor remounts per document.
 */
export function DocFields({ folder, tags, folders, onChange }: DocFieldsProps) {
  const [folderDraft, setFolderDraft] = useState(folder)
  const [tagsDraft, setTagsDraft] = useState(tags.join(', '))

  function commitFolder() {
    const next = cleanFolder(folderDraft)
    setFolderDraft(next)
    if (next !== folder) onChange({ folder: next })
  }

  function commitTags() {
    // The account's table holds this many; more would keep the document off it.
    const next = parseTags(tagsDraft).slice(0, LIMITS.tags)
    setTagsDraft(next.join(', '))
    if (next.join() !== tags.join()) onChange({ tags: next })
  }

  const onEnter = (commit: () => void) => (event: { key: string }) => {
    if (event.key === 'Enter') commit()
  }

  return (
    <div className="doc-fields">
      <label className="doc-fields__field">
        <span className="label">Folder</span>
        <input
          className="field-input"
          list="folder-options"
          autoComplete="off"
          placeholder="Unfiled"
          maxLength={LIMITS.folder}
          value={folderDraft}
          onChange={(event) => setFolderDraft(event.target.value)}
          onBlur={commitFolder}
          onKeyDown={onEnter(commitFolder)}
        />
        <datalist id="folder-options">
          {folders.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="doc-fields__field doc-fields__field--wide">
        <span className="label">Tags</span>
        <input
          className="field-input"
          autoComplete="off"
          placeholder="essay, draft"
          value={tagsDraft}
          onChange={(event) => setTagsDraft(event.target.value)}
          onBlur={commitTags}
          onKeyDown={onEnter(commitTags)}
        />
      </label>
    </div>
  )
}
