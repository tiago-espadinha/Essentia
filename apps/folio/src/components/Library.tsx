interface LibraryProps {
  query: string
  tags: string[]
  activeTag: string | null
  /** Shown below 1024 px, where the Library folds into the Filter bar. */
  open: boolean
  onQueryChange: (query: string) => void
  onTagChange: (tag: string | null) => void
}

/** Search and the tag filter. */
export function Library({ query, tags, activeTag, open, onQueryChange, onTagChange }: LibraryProps) {
  return (
    <section id="library" className="pane library-pane" aria-label="Library" data-open={open || undefined}>
      <div className="pane__head" role="search">
        <label htmlFor="search" className="visually-hidden">
          Search notes
        </label>
        <input
          id="search"
          className="search"
          type="search"
          placeholder="Search notes"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </div>

      <div className="pane__body library">
        {tags.length > 0 && (
          <nav aria-labelledby="tags-title">
            <h2 id="tags-title" className="label">
              Tags
            </h2>
            <ul className="tag-list">
              <li>
                <button
                  type="button"
                  className="tag-button"
                  aria-pressed={activeTag === null}
                  onClick={() => onTagChange(null)}
                >
                  All notes
                </button>
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
