import { ClaimDialog, getSupabase, useAuth } from '@essentia/supabase'
import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react'
import { AccountMenu } from './AccountMenu'
import { AppHeader } from './AppHeader'
import { DocActions } from './DocActions'
import { DocList } from './DocList'
import { Editor, type FocusTarget, type Mode } from './Editor'
import { Filters } from './Filters'
import { isViewKey } from './keys'
import { ShareDialog } from './ShareDialog'
import { UndoNotice } from './UndoNotice'
import { VersionsDialog } from './VersionsDialog'
import { displayTitle, filterDocs, foldersOf, tagsOf, type Doc, type DocFilter } from './documents'
import { useAutoVersion } from './useAutoVersion'
import { SYNC_FAILED, useDocuments } from './useDocuments'
import { versionsOf } from './versions'

/** Matches dictum.css: one pane at a time below 768 px. */
const PHONE = '(width < 768px)'
/** Matches dictum.css: Write and Preview take turns below 1280 px. */
const NARROW = '(width < 1280px)'

const NO_FILTER: DocFilter = { query: '', folder: null, tag: null }

const client = getSupabase()

export default function App() {
  const auth = useAuth(client)
  const { docs, unclaimed, answer, versions, saveFailed, syncState, sync, add, update, saveVersion, restore, remove, putBack } = useDocuments(client)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // What in which document takes focus when its editor mounts or shows.
  const [focusRequest, setFocusRequest] = useState<{ docId: string; target: FocusTarget } | null>(null)
  // Below 768 px one pane shows at a time: the list, or the open document.
  const [view, setView] = useState<'list' | 'doc'>('list')
  const [mode, setMode] = useState<Mode>('write')
  const [filter, setFilter] = useState<DocFilter>(NO_FILTER)
  // The open dialog and the document it was opened for: a sync can remove that
  // document, and the dialog then closes rather than turn to another one.
  const [dialog, setDialog] = useState<{ kind: 'share' | 'versions'; docId: string } | null>(null)
  // The last deleted document and what its removal took, for the undo.
  const [deleted, setDeleted] = useState<{ doc: Doc; removed: ReturnType<typeof remove> } | null>(null)
  const autoVersion = useAutoVersion(saveVersion)
  const clearFocusRequest = useCallback(() => setFocusRequest(null), [])
  // A row to focus once the list has rendered; an id no row has falls back to New document.
  const rowToFocus = useRef<string | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const id = rowToFocus.current
    if (id === null) return
    rowToFocus.current = null
    const main = mainRef.current!
    const row = [...main.querySelectorAll<HTMLElement>('.doc-row')].find((r) => r.dataset.docId === id)
    ;(row ?? main.querySelector<HTMLElement>('.list-pane .button-primary'))?.focus()
  })

  const folders = foldersOf(docs)
  const tags = tagsOf(docs)
  // A folder or tag filter lapses once no document carries it any more.
  const activeFilter: DocFilter = {
    query: filter.query,
    folder: filter.folder === null || filter.folder === '' || folders.includes(filter.folder) ? filter.folder : null,
    tag: filter.tag !== null && tags.includes(filter.tag) ? filter.tag : null,
  }
  const visible = filterDocs(docs, activeFilter)
  // With nothing chosen yet, or the chosen document gone, the first in the list is open.
  const selected = docs.find((doc) => doc.id === selectedId) ?? visible[0] ?? null
  const dialogDoc = dialog && docs.find((doc) => doc.id === dialog.docId)
  if (dialog && !dialogDoc) setDialog(null)
  // Sharing reads from the account, so it needs a project and a known session.
  const canShare = client !== null && (auth.status === 'signed-in' || auth.status === 'signed-out')

  // A new document is blank, so the search and tag are cleared to show it; it joins the folder in view.
  function newDoc() {
    const doc = add(activeFilter.folder ?? '')
    setFilter({ ...NO_FILTER, folder: activeFilter.folder })
    setSelectedId(doc.id)
    setFocusRequest({ docId: doc.id, target: 'title' })
    setView('doc')
    setMode('write')
  }

  // On a phone the list gives way to the document, so focus follows into it.
  function openDoc(id: string) {
    setSelectedId(id)
    setView('doc')
    if (window.matchMedia(PHONE).matches) setFocusRequest({ docId: id, target: 'title' })
  }

  // Focus follows into the side that shows, since the other one hides.
  function switchMode(doc: Doc) {
    const next = mode === 'write' ? 'preview' : 'write'
    setMode(next)
    setFocusRequest({ docId: doc.id, target: next })
  }

  const onViewKey = useEffectEvent((event: KeyboardEvent) => {
    if (isViewKey(event, 'n')) {
      event.preventDefault()
      newDoc()
    } else if (isViewKey(event, 'p') && selected && window.matchMedia(NARROW).matches) {
      // A phone showing the list has no document in view to switch.
      if (view === 'list' && window.matchMedia(PHONE).matches) return
      event.preventDefault()
      switchMode(selected)
    }
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onViewKey(event)
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  function backToList(id: string) {
    setView('list')
    rowToFocus.current = id
  }

  // The next document in the list opens (or the previous one at the end), and focus goes to its row.
  function deleteDoc(doc: Doc) {
    autoVersion.cancel(doc.id)
    const position = visible.findIndex((d) => d.id === doc.id)
    const next = (visible[position + 1] ?? visible[position - 1])?.id ?? null
    setDeleted({ doc, removed: remove(doc.id) })
    setSelectedId(next)
    setView('list')
    rowToFocus.current = next ?? ''
  }

  function undoDelete() {
    if (!deleted) return
    putBack(deleted.removed)
    setDeleted(null)
    setSelectedId(deleted.doc.id)
    rowToFocus.current = deleted.doc.id
  }

  return (
    <>
      <AppHeader account={<AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} />} />
      <main className="dictum" ref={mainRef} data-view={selected && view === 'doc' ? 'doc' : 'list'}>
        <h1 className="visually-hidden">Dictum documents</h1>
        <DocList
          notice={
            <>
              <UndoNotice
                deleted={deleted && { id: deleted.doc.id, title: displayTitle(deleted.doc) }}
                onUndo={undoDelete}
              />
              {syncState === 'failed' && (
                <div className="sync-notice" role="status">
                  <span className="sync-notice__text">{SYNC_FAILED}</span>
                  <button type="button" className="undo__button" onClick={() => void sync()}>
                    Try again
                  </button>
                </div>
              )}
            </>
          }
          docs={visible}
          total={docs.length}
          selectedId={selected?.id ?? null}
          filters={<Filters filter={activeFilter} folders={folders} tags={tags} onChange={setFilter} />}
          onClearFilters={() => setFilter(NO_FILTER)}
          onSelect={openDoc}
          onNew={newDoc}
        />
        <section className="pane doc-pane" aria-label="Document">
          {saveFailed && (
            <p className="notice" role="alert">
              Couldn’t save on this device. Your changes last until you close the page.
            </p>
          )}
          {selected ? (
            <Editor
              key={selected.id}
              doc={selected}
              folders={folders}
              mode={mode}
              focus={focusRequest?.docId === selected.id ? focusRequest.target : null}
              onFocused={clearFocusRequest}
              onModeChange={setMode}
              onChange={(changes) => {
                // Editing holds the document open, even as it moves to the top of the list.
                setSelectedId(selected.id)
                update(selected.id, changes)
                autoVersion.schedule(selected.id)
              }}
              onBack={() => backToList(selected.id)}
              actions={
                <DocActions
                  doc={selected}
                  onShare={canShare ? () => setDialog({ kind: 'share', docId: selected.id }) : undefined}
                  onVersions={() => setDialog({ kind: 'versions', docId: selected.id })}
                  onDelete={() => deleteDoc(selected)}
                />
              }
            />
          ) : (
            <p className="doc-pane__idle">Your document opens here.</p>
          )}
        </section>
      </main>
      {unclaimed > 0 && auth.status === 'signed-in' && (
        <ClaimDialog count={unclaimed} noun={['document', 'documents']} email={auth.email} onAnswer={answer} />
      )}
      {dialog?.kind === 'share' && dialogDoc && client && (
        <ShareDialog doc={dialogDoc} auth={auth} client={client} onSync={sync} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === 'versions' && dialogDoc && (
        <VersionsDialog
          doc={dialogDoc}
          versions={versionsOf(versions, dialogDoc.id)}
          onSave={() => saveVersion(dialogDoc.id)}
          onRestore={(version) => {
            restore(dialogDoc.id, version)
            setDialog(null)
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
