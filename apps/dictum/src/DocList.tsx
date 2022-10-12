import { displayTitle, formatDate, type Doc } from './documents'

interface DocListProps {
  docs: Doc[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}

export function DocList({ docs, selectedId, onSelect, onNew }: DocListProps) {
  return (
    <section className="pane list-pane" aria-labelledby="list-title">
      <div className="pane__head">
        <h2 id="list-title" className="label">
          Documents · {docs.length}
        </h2>
        {docs.length > 0 && <NewDocButton onClick={onNew} />}
      </div>

      <div className="pane__body">
        {docs.length === 0 ? (
          <div className="empty">
            <h3 className="empty__title">Nothing written yet.</h3>
            <p className="empty__text">Start a document and it stays on this device.</p>
            <NewDocButton onClick={onNew} />
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
                  <span className="label">{formatDate(doc.updatedAt)}</span>
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
    <button type="button" className="button-primary" onClick={onClick}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      New document
    </button>
  )
}
