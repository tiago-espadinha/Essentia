import { formatNumber, currentLocale } from '@essentia/ui'
import { t } from '../locale'
import { Dialog } from '@essentia/ui'
import { displayTitle, type Doc } from '../domain/documents'
import { excerpt, MAX_VERSIONS, type Version } from '../domain/versions'

interface VersionsDialogProps {
  doc: Doc
  /** This document's versions, newest first. */
  versions: Version[]
  onSave: () => void
  onRestore: (version: Version) => void
  onClose: () => void
}

const time = (iso: string) =>
  new Date(iso).toLocaleString(currentLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Saved versions of the open document, to look back at and restore. */
export function VersionsDialog({ doc, versions, onSave, onRestore, onClose }: VersionsDialogProps) {
  const newest = versions[0]
  const unchanged = newest !== undefined && newest.content === doc.content && newest.title === doc.title

  return (
    <Dialog title={t("Versions")} titleId="versions-title" returnFocusId="versions-button" onClose={onClose}>
      <p className="dialog__text">
        {t('A version is saved after 30 seconds without typing. The newest {count} are kept.', { count: formatNumber(MAX_VERSIONS) })}
      </p>
      <button type="button" className="button-primary versions__save" disabled={unchanged} onClick={onSave}>
        {t(unchanged ? 'This version is saved' : 'Save this version')}
      </button>
      {versions.length === 0 ? (
        <p className="versions__empty">{t("No versions yet.")}</p>
      ) : (
        <ol className="versions">
          {versions.map((version) => (
            <li key={version.id} className="version">
              <div className="version__text">
                <span className="label">{time(version.savedAt)}</span>
                <span className="version__title">{displayTitle({ ...doc, title: version.title })}</span>
                <span className="version__excerpt">{excerpt(version.content) || t('Empty')}</span>
              </div>
              <button
                type="button"
                className="button-ghost button-ghost--outlined"
                aria-label={t('Restore the version from {date}', { date: time(version.savedAt) })}
                onClick={() => onRestore(version)}
              >{t("Restore")}</button>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  )
}
