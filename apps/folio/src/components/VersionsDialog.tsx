import { currentLocale, Dialog, formatNumber } from '@essentia/ui'
import { t } from '../locale'
import { excerptText, type Note, type NoteVersion } from '../domain/notes'
import { holds, MAX_VERSIONS } from '../domain/versions'

interface VersionsDialogProps {
  note: Note
  /** This note's versions, newest first. */
  versions: NoteVersion[]
  onSave: () => void
  onRestore: (version: NoteVersion) => void
  onClose: () => void
}

const time = (iso: string) =>
  new Date(iso).toLocaleString(currentLocale(), { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** A short plain preview of a version's text. */
function excerpt(version: NoteVersion, length = 80): string {
  const text = excerptText(version)
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text
}

/** Saved versions of the open note, to look back at and restore. */
export function VersionsDialog({ note, versions, onSave, onRestore, onClose }: VersionsDialogProps) {
  const unchanged = holds(versions[0], note)

  return (
    <Dialog title={t('Versions')} titleId="versions-title" returnFocusId="versions-button" onClose={onClose}>
      <p className="dialog__text">
        {t('A version is saved after 30 seconds without typing, and before a conversion or restore. The newest {count} are kept on this device.', { count: formatNumber(MAX_VERSIONS) })}
      </p>
      <button type="button" className="button-primary versions__save" disabled={unchanged} onClick={onSave}>
        {t(unchanged ? 'This version is saved' : 'Save this version')}
      </button>
      {versions.length === 0 ? (
        <p className="versions__empty">{t('No versions yet.')}</p>
      ) : (
        <ol className="versions">
          {versions.map((version) => (
            <li key={version.id} className="version">
              <div className="version__text">
                <span className="label">
                  {time(version.savedAt)}
                  {version.format !== note.format && ` · ${t(version.format === 'markdown' ? 'Markdown' : 'Rich text')}`}
                </span>
                <span className="version__title">{version.title.trim() || t('Untitled')}</span>
                <span className="version__excerpt">{excerpt(version) || t('Empty')}</span>
              </div>
              <button
                type="button"
                className="button-ghost button-ghost--outlined"
                aria-label={t('Restore the version from {date}', { date: time(version.savedAt) })}
                onClick={() => onRestore(version)}
              >{t('Restore')}</button>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  )
}
