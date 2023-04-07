import { formatNumber } from '@essentia/ui'
import { t } from '../locale'
import type { ReactNode } from 'react'
import { displayTitle, formatDate, type Doc } from '../domain/documents'
import { VIEW_KEYS } from '../domain/keys'

interface DocListProps {
  /** The documents that pass the filters. */
  docs: Doc[]
  /** How many documents exist at all. */
  total: number
  /** Documents Folio now keeps, listed as links to it. */
  moved: Doc[]
  selectedId: string | null
  /** Search and filters, shown once there is something to filter. */
  filters: ReactNode
  onClearFilters: () => void
  /** The undo notice after a delete. */
  notice: ReactNode
  onSelect: (id: string) => void
  onNew: () => void
}

export function DocList({ docs, total, moved, selectedId, filters, onClearFilters, notice, onSelect, onNew }: DocListProps) {
  return (
    <section className="pane list-pane" aria-labelledby="list-title">
      <div className="pane__head">
        <h2 id="list-title" className="label">
          {t('Documents · {count}', { count: formatNumber(docs.length) })}
        </h2>
        {total > 0 && <NewDocButton onClick={onNew} />}
      </div>
      {total > 0 && filters}
      {notice}

      <div className="pane__body">
        {total === 0 ? (
          <div className="empty">
            <h3 className="empty__title">{t("Nothing written yet.")}</h3>
            <p className="empty__text">{t("Start a document and it stays on this device.")}</p>
            <NewDocButton onClick={onNew} />
          </div>
        ) : docs.length === 0 ? (
          <div className="empty">
            <h3 className="empty__title">{t("Nothing matches.")}</h3>
            <p className="empty__text">{t("No documents fit these filters.")}</p>
            <button type="button" className="button-ghost button-ghost--outlined" onClick={onClearFilters}>{t("Clear filters")}</button>
          </div>
        ) : (
          <ul className="docs">
            {docs.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  className="doc-row"
                  data-doc-id={doc.id}
                  data-motion-item={doc.id}
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
        {moved.length > 0 && <MovedDocs docs={moved} />}
      </div>
    </section>
  )
}

/** Folio is served beside Dictum on the same site. */
const FOLIO_PATH = '/folio/'

function MovedDocs({ docs }: { docs: Doc[] }) {
  return (
    <section className="moved" aria-labelledby="moved-title">
      <h3 id="moved-title" className="label moved__title">{t('Moved to Folio')}</h3>
      <p className="moved__note">{t('Folio keeps these now; edit them there.')}</p>
      <ul className="docs">
        {docs.map((doc) => (
          <li key={doc.id}>
            <a className="doc-row" href={FOLIO_PATH}>
              <span className="doc-row__title">{displayTitle(doc)}</span>
              <span className="moved__open">
                {t('Open in Folio')} <span aria-hidden="true">→</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function NewDocButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="button-primary"
      title={`${t('New document')} (${VIEW_KEYS.newDoc.label})`}
      aria-keyshortcuts={VIEW_KEYS.newDoc.aria}
      onClick={onClick}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>{t("New document")}</button>
  )
}
