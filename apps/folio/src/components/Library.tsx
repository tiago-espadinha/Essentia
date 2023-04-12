import { formatNumber } from '@essentia/ui'
import { useEffect, useRef, useState } from 'react'
import { t } from '../locale'
import { FolderForm } from './FolderForm'

interface LibraryProps {
  query: string
  /** Every folder, sorted. */
  folders: string[]
  /** Notes per folder; '' counts the unfiled ones. */
  counts: Map<string, number>
  total: number
  /** null is every folder, '' is unfiled. */
  activeFolder: string | null
  tags: string[]
  activeTag: string | null
  /** Shown below 1024 px, where the Library folds into the Filter bar. */
  open: boolean
  /** Folders cannot be created, renamed or deleted. */
  readOnly: boolean
  onQueryChange: (query: string) => void
  onFolderChange: (folder: string | null) => void
  onTagChange: (tag: string | null) => void
  /** Creates the folder, or picks the existing one with that name; returns the folder shown. */
  onCreateFolder: (name: string) => string
  onRenameFolder: (from: string, to: string) => void
  onDeleteFolder: (folder: string) => void
}

/** Search, the folders with their actions, and the tag filter. */
export function Library({
  query,
  folders,
  counts,
  total,
  activeFolder,
  tags,
  activeTag,
  open,
  readOnly,
  onQueryChange,
  onFolderChange,
  onTagChange,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}: LibraryProps) {
  const [form, setForm] = useState<'create' | 'rename' | null>(null)
  // What takes focus once the form has closed: a control's id, or a folder's button.
  const focusNext = useRef<{ id: string } | { folder: string } | null>(null)
  const listRef = useRef<HTMLUListElement>(null)
  // A named folder, shown, can be renamed or deleted; All notes and Unfiled cannot.
  const named = activeFolder !== null && activeFolder !== '' && !readOnly ? activeFolder : null
  const renaming = form === 'rename' && named !== null

  useEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    const element = 'id' in target
      ? document.getElementById(target.id)
      : [...listRef.current!.querySelectorAll<HTMLElement>('[data-folder]')].find((button) => button.dataset.folder === target.folder)
    element?.focus()
  })

  function close(next: { id: string } | { folder: string }) {
    focusNext.current = next
    setForm(null)
  }

  return (
    <section id="library" className="pane library-pane" aria-label={t("Library")} data-open={open || undefined}>
      <div className="pane__head" role="search">
        <label htmlFor="search" className="visually-hidden">{t("Search notes")}</label>
        <input
          id="search"
          className="search"
          type="search"
          placeholder={t("Search notes")}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="pane__body library">
        <nav aria-labelledby="folders-title">
          <div className="library__head">
            <h2 id="folders-title" className="label">{t("Folders")}</h2>
            {!readOnly && (
              <button
                type="button"
                id="new-folder"
                className="button-ghost library__add"
                aria-expanded={form === 'create'}
                onClick={() => setForm(form === 'create' ? null : 'create')}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>{t("New folder")}</button>
            )}
          </div>
          {form === 'create' && !readOnly && (
            <FolderForm
              label={t('New folder name')}
              folders={folders}
              onSubmit={(name) => close({ folder: onCreateFolder(name) })}
              onCancel={() => close({ id: 'new-folder' })}
            />
          )}
          <ul className="tag-list" ref={listRef}>
            <FolderItem id="folder-all" name={t('All notes')} count={total} pressed={activeFolder === null} onClick={() => onFolderChange(null)} />
            <FolderItem name={t('Unfiled')} count={counts.get('') ?? 0} pressed={activeFolder === ''} onClick={() => onFolderChange('')} />
            {folders.map((folder) =>
              renaming && folder === named ? (
                <li key={folder}>
                  <FolderForm
                    label={t('Rename “{name}”', { name: folder })}
                    renaming={folder}
                    folders={folders}
                    onSubmit={(name) => {
                      onRenameFolder(folder, name)
                      close({ folder: name })
                    }}
                    onCancel={() => close({ id: 'rename-folder' })}
                  />
                </li>
              ) : (
                <FolderItem
                  key={folder}
                  folder={folder}
                  name={folder}
                  count={counts.get(folder) ?? 0}
                  pressed={activeFolder === folder}
                  onClick={() => onFolderChange(folder)}
                />
              ),
            )}
          </ul>
          {named !== null && !renaming && (
            <div className="folder-actions">
              <button type="button" id="rename-folder" className="button-ghost" onClick={() => setForm('rename')}>{t("Rename folder")}</button>
              <button type="button" id="delete-folder" className="button-ghost button-ghost--danger" onClick={() => onDeleteFolder(named)}>{t("Delete folder")}</button>
            </div>
          )}
        </nav>

        {tags.length > 0 && (
          <nav aria-labelledby="tags-title" className="library__section">
            <h2 id="tags-title" className="label">{t("Tags")}</h2>
            <ul className="tag-list">
              <li>
                <button
                  type="button"
                  className="tag-button"
                  aria-pressed={activeTag === null}
                  onClick={() => onTagChange(null)}
                >{t("Any tag")}</button>
              </li>
              {tags.map((tag) => (
                <li key={tag}>
                  <button
                    type="button"
                    className="tag-button"
                    aria-pressed={activeTag === tag}
                    onClick={() => onTagChange(activeTag === tag ? null : tag)}
                  >
                    #{tag}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </section>
  )
}

interface FolderItemProps {
  id?: string
  /** The folder's stored name, to find its button again. */
  folder?: string
  name: string
  count: number
  pressed: boolean
  onClick: () => void
}

function FolderItem({ id, folder, name, count, pressed, onClick }: FolderItemProps) {
  return (
    <li>
      <button
        type="button"
        id={id}
        data-folder={folder}
        className="tag-button folder-button"
        aria-pressed={pressed}
        aria-label={t(count === 1 ? '{name}, {count} note' : '{name}, {count} notes', { name, count: formatNumber(count) })}
        onClick={onClick}
      >
        <span className="folder-button__name">{name}</span>
        <span className="folder-button__count">{formatNumber(count)}</span>
      </button>
    </li>
  )
}
