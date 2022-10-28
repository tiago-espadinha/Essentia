import { Dialog } from '@essentia/ui'
import { displayTitle, type Doc } from './documents'
import { excerpt, MAX_VERSIONS, type Version } from './versions'

interface VersionsDialogProps {
  doc: Doc
  /** This document's versions, newest first. */
  versions: Version[]
  onSave: () => void
  onRestore: (version: Version) => void
  onClose: () => void
}

const time = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/** Saved versions of the open document, to look back at and restore. */
export function VersionsDialog({ doc, versions, onSave, onRestore, onClose }: VersionsDialogProps) {
  const newest = versions[0]
  const unchanged = newest !== undefined && newest.content === doc.content && newest.title === doc.title

  return (
    <Dialog title="Versions" titleId="versions-title" returnFocusId="versions-button" onClose={onClose}>
      <p className="dialog__text">
        A version is saved after 30 seconds without typing. The newest {MAX_VERSIONS} are kept.
      </p>
      <button type="button" className="button-primary versions__save" disabled={unchanged} onClick={onSave}>
        {unchanged ? 'This version is saved' : 'Save this version'}
      </button>
      {versions.length === 0 ? (
        <p className="versions__empty">No versions yet.</p>
      ) : (
        <ol className="versions">
          {versions.map((version) => (
            <li key={version.id} className="version">
              <div className="version__text">
                <span className="label">{time(version.savedAt)}</span>
                <span className="version__title">{displayTitle({ ...doc, title: version.title })}</span>
                <span className="version__excerpt">{excerpt(version.content) || 'Empty'}</span>
              </div>
              <button
                type="button"
                className="button-ghost button-ghost--outlined"
                aria-label={`Restore the version from ${time(version.savedAt)}`}
                onClick={() => onRestore(version)}
              >
                Restore
              </button>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  )
}
