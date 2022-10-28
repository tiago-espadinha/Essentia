import { fileName, type Doc } from './documents'
import { SHARE_BUTTON_ID } from './ShareDialog'

interface DocActionsProps {
  doc: Doc
  /** Absent when this build has no account to share from. */
  onShare?: () => void
  onVersions: () => void
  onDelete: () => void
}

/** Downloads the document's markdown as a .md file. */
function download(doc: Doc) {
  const url = URL.createObjectURL(new Blob([doc.content], { type: 'text/markdown' }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName(doc)
  link.click()
  // Some browsers cancel a download whose URL is revoked in the same task.
  setTimeout(() => URL.revokeObjectURL(url))
}

/** Share, versions, export and delete; below 768 px they show as icons with hidden labels. */
export function DocActions({ doc, onShare, onVersions, onDelete }: DocActionsProps) {
  return (
    <>
      {onShare && (
        <button type="button" id={SHARE_BUTTON_ID} className="button-ghost" aria-haspopup="dialog" onClick={onShare}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.83 2.83 0 0 1 4 4l-1 1M9 11.5l-1 1a2.83 2.83 0 0 1-4-4l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="action-text">Share</span>
        </button>
      )}
      <button type="button" id="versions-button" className="button-ghost" onClick={onVersions}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2.5 8a5.5 5.5 0 1 0 1.6-3.9M2.5 2.5v2.5H5M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="action-text">Versions</span>
      </button>
      <button type="button" className="button-ghost" onClick={() => download(doc)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="action-text">Export</span>
      </button>
      <button type="button" className="button-ghost button-ghost--danger" onClick={onDelete}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.5 9h6l.5-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="action-text">Delete</span>
      </button>
    </>
  )
}
