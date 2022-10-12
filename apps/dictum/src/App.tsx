import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from './AppHeader'
import { DocList } from './DocList'
import { Editor, type Mode } from './Editor'
import { filterDocs } from './documents'
import { useDocuments } from './useDocuments'

/** Matches dictum.css: one pane at a time below 768 px. */
const PHONE = '(width < 768px)'

export default function App() {
  const { docs, saveFailed, add, update } = useDocuments()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The document whose title takes focus when its editor mounts or shows.
  const [titleFocusId, setTitleFocusId] = useState<string | null>(null)
  // Below 768 px one pane shows at a time: the list, or the open document.
  const [view, setView] = useState<'list' | 'doc'>('list')
  const [mode, setMode] = useState<Mode>('write')
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

  const visible = filterDocs(docs, { query: '', folder: null, tag: null })
  // With nothing chosen yet, or the chosen document gone, the first in the list is open.
  const selected = docs.find((doc) => doc.id === selectedId) ?? visible[0] ?? null

  function newDoc() {
    const doc = add()
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
        <DocList docs={visible} selectedId={selected?.id ?? null} onSelect={openDoc} onNew={newDoc} />
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
