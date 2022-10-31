import type { ReactNode } from 'react'
import { displayTitle, formatDate, type Doc } from './documents'
import { VIEW_KEYS } from './keys'

interface DocListProps {
  /** The documents that pass the filters. */
  docs: Doc[]
  /** How many documents exist at all. */
  total: number
  selectedId: string | null
  /** Search and filters, shown once there is something to filter. */
  filters: ReactNode
  onClearFilters: () => void
  /** The undo notice after a delete. */
  notice: ReactNode
  onSelect: (id: string) => void
  onNew: () => void
}

export function DocList({ docs, total, selectedId, filters, onClearFilters, notice, onSelect, onNew }: DocListProps) {
  return (
    <section className="pane list-pane" aria-labelledby="list-title">
      <div className="pane__head">
        <h2 id="list-title" className="label">
          Documents · {docs.length}
        </h2>
        {total > 0 && <NewDocButton onClick={onNew} />}
      </div>
      {total > 0 && filters}
      {notice}

      <div className="pane__body">
        {total === 0 ? (
          <div className="empty">
            <h3 className="empty__title">Nothing written yet.</h3>
            <p className="empty__text">Start a document and it stays on this device.</p>
            <NewDocButton onClick={onNew} />
          </div>
        ) : docs.length === 0 ? (
          <div className="empty">
            <h3 className="empty__title">Nothing matches.</h3>
            <p className="empty__text">No documents fit these filters.</p>
            <button type="button" className="button-ghost button-ghost--outlined" onClick={onClearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <ul className="docs">
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className="doc-row"
                  data-doc-id={doc.id}
                  aria-current={doc.id === selectedId ? 'true' : undefined}
                  onClick={() => onSelect(doc.id)}
                >
                  <span className="doc-row__title">{displayTitle(doc)}</span>
                  <span className="label">
                    {formatDate(doc.updatedAt)}
                    {doc.folder && ` · ${doc.folder}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function NewDocButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="button-primary"
      title={`New document (${VIEW_KEYS.newDoc.label})`}
      aria-keyshortcuts={VIEW_KEYS.newDoc.aria}
      onClick={onClick}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      New document
    </button>
  )
}
