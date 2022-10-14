import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from './AppHeader'
import { DocList } from './DocList'
import { Editor, type Mode } from './Editor'
import { Filters } from './Filters'
import { filterDocs, foldersOf, tagsOf, type DocFilter } from './documents'
import { useDocuments } from './useDocuments'

/** Matches dictum.css: one pane at a time below 768 px. */
const PHONE = '(width < 768px)'

const NO_FILTER: DocFilter = { query: '', folder: null, tag: null }

export default function App() {
  const { docs, saveFailed, add, update } = useDocuments()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The document whose title takes focus when its editor mounts or shows.
  const [titleFocusId, setTitleFocusId] = useState<string | null>(null)
  // Below 768 px one pane shows at a time: the list, or the open document.
  const [view, setView] = useState<'list' | 'doc'>('list')
  const [mode, setMode] = useState<Mode>('write')
  const [filter, setFilter] = useState<DocFilter>(NO_FILTER)
  const clearTitleFocus = useCallback(() => setTitleFocusId(null), [])
  // A row to focus once the list has rendered.
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

  return (
    <>
      <AppHeader />
      <main className="dictum" ref={mainRef} data-view={selected && view === 'doc' ? 'doc' : 'list'}>
        <h1 className="visually-hidden">Dictum documents</h1>
        <DocList
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
              }}
              onBack={() => backToList(selected.id)}
            />
          ) : (
            <p className="doc-pane__idle">Your document opens here.</p>
          )}
        </section>
      </main>
    </>
  )
}
