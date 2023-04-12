import { formatNumber } from '@essentia/ui'
import { t } from '../locale'

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
  onQueryChange: (query: string) => void
  onFolderChange: (folder: string | null) => void
  onTagChange: (tag: string | null) => void
}

/** Search, the folders and the tag filter. */
export function Library({ query, folders, counts, total, activeFolder, tags, activeTag, open, onQueryChange, onFolderChange, onTagChange }: LibraryProps) {
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
          <h2 id="folders-title" className="label">{t("Folders")}</h2>
          <ul className="tag-list">
            <FolderItem name={t('All notes')} count={total} pressed={activeFolder === null} onClick={() => onFolderChange(null)} />
            <FolderItem name={t('Unfiled')} count={counts.get('') ?? 0} pressed={activeFolder === ''} onClick={() => onFolderChange('')} />
            {folders.map((folder) => (
              <FolderItem
                key={folder}
                name={folder}
                count={counts.get(folder) ?? 0}
                pressed={activeFolder === folder}
                onClick={() => onFolderChange(folder)}
              />
            ))}
          </ul>
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

function FolderItem({ name, count, pressed, onClick }: { name: string; count: number; pressed: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
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
