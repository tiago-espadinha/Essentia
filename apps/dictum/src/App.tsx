import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from './AppHeader'
import { DocActions } from './DocActions'
import { DocList } from './DocList'
import { Editor, type Mode } from './Editor'
import { Filters } from './Filters'
import { UndoNotice } from './UndoNotice'
import { VersionsDialog } from './VersionsDialog'
import { displayTitle, filterDocs, foldersOf, tagsOf, type Doc, type DocFilter } from './documents'
import { useAutoVersion } from './useAutoVersion'
import { useDocuments } from './useDocuments'
import { versionsOf } from './versions'

/** Matches dictum.css: one pane at a time below 768 px. */
const PHONE = '(width < 768px)'

const NO_FILTER: DocFilter = { query: '', folder: null, tag: null }

export default function App() {
  const { docs, versions, saveFailed, add, update, saveVersion, restore, remove, putBack } = useDocuments()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The document whose title takes focus when its editor mounts or shows.
  const [titleFocusId, setTitleFocusId] = useState<string | null>(null)
  // Below 768 px one pane shows at a time: the list, or the open document.
  const [view, setView] = useState<'list' | 'doc'>('list')
  const [mode, setMode] = useState<Mode>('write')
  const [filter, setFilter] = useState<DocFilter>(NO_FILTER)
  const [versionsOpen, setVersionsOpen] = useState(false)
  // The last deleted document and what its removal took, for the undo.
  const [deleted, setDeleted] = useState<{ doc: Doc; removed: ReturnType<typeof remove> } | null>(null)
  const autoVersion = useAutoVersion(saveVersion)
  const clearTitleFocus = useCallback(() => setTitleFocusId(null), [])
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

  // A new document is blank, so the search and tag are cleared to show it; it joins the folder in view.
  function newDoc() {
    const doc = add(activeFilter.folder ?? '')
    setFilter({ ...NO_FILTER, folder: activeFilter.folder })
    setSelectedId(doc.id)
    setTitleFocusId(doc.id)
    setView('doc')
    setMode('write')
  }

  // On a phone the list gives way to the document, so focus follows into it.
  function openDoc(id: string) {
    setSelectedId(id)
    setView('doc')
    if (window.matchMedia(PHONE).matches) setTitleFocusId(id)
  }

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
      <AppHeader />
      <main className="dictum" ref={mainRef} data-view={selected && view === 'doc' ? 'doc' : 'list'}>
        <h1 className="visually-hidden">Dictum documents</h1>
        <DocList
          notice={
            <UndoNotice
              deleted={deleted && { id: deleted.doc.id, title: displayTitle(deleted.doc) }}
              onUndo={undoDelete}
            />
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
              autoFocus={selected.id === titleFocusId}
              onFocused={clearTitleFocus}
              onModeChange={setMode}
              onChange={(changes) => {
                // Editing holds the document open, even as it moves to the top of the list.
                setSelectedId(selected.id)
                update(selected.id, changes)
                autoVersion.schedule(selected.id)
              }}
              onBack={() => backToList(selected.id)}
              actions={<DocActions doc={selected} onVersions={() => setVersionsOpen(true)} onDelete={() => deleteDoc(selected)} />}
            />
          ) : (
            <p className="doc-pane__idle">Your document opens here.</p>
          )}
        </section>
      </main>
      {versionsOpen && selected && (
        <VersionsDialog
          doc={selected}
          versions={versionsOf(versions, selected.id)}
          onSave={() => saveVersion(selected.id)}
          onRestore={(version) => {
            restore(selected.id, version)
            setVersionsOpen(false)
          }}
          onClose={() => setVersionsOpen(false)}
        />
      )}
    </>
  )
}
