import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from './AppHeader'
import { Editor } from './Editor'
import { Library } from './Library'
import { NoteList } from './NoteList'
import { filterNotes, tagsOf } from './notes'
import { useNotes } from './useNotes'

export default function App() {
  const { notes, saveFailed, add, update, remove } = useNotes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const clearFresh = useCallback(() => setFreshId(null), [])
  // A row to focus once the list has rendered; `id: null` means New note.
  const rowToFocus = useRef<{ id: string | null } | null>(null)
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const target = rowToFocus.current
    if (!target) return
    rowToFocus.current = null
    const main = mainRef.current!
    const row = [...main.querySelectorAll<HTMLElement>('.note-row')].find((r) => r.dataset.noteId === target.id)
    ;(row ?? main.querySelector<HTMLElement>('.list-pane .button-primary'))?.focus()
  })

  const tags = tagsOf(notes)
  // A tag filter lapses once no note carries the tag any more.
  const activeTag = selectedTag !== null && tags.includes(selectedTag) ? selectedTag : null
  if (activeTag === null && selectedTag !== null) setSelectedTag(null)
  const visible = filterNotes(notes, query, activeTag)
  // With nothing chosen yet, or the chosen note gone, the first note in the list is open.
  const selected = notes.find((note) => note.id === selectedId) ?? visible[0] ?? null

  function clearFilters() {
    setQuery('')
    setSelectedTag(null)
  }

  // A new note is blank, so the filters are cleared to show it in the list.
  function newNote() {
    clearFilters()
    const note = add()
    setSelectedId(note.id)
    setFreshId(note.id)
  }

  // The next note in the list opens (or the previous one at the end), and focus goes to its row.
  function deleteNote(id: string) {
    const position = visible.findIndex((note) => note.id === id)
    const next = (visible[position + 1] ?? visible[position - 1])?.id ?? null
    remove(id)
    setSelectedId(next)
    rowToFocus.current = { id: next }
  }

  return (
    <>
      <AppHeader />
      <main className="folio" ref={mainRef}>
        <h1 className="visually-hidden">Folio notes</h1>
        <Library
          query={query}
          tags={tags}
          activeTag={activeTag}
          onQueryChange={setQuery}
          onTagChange={setSelectedTag}
        />
        <NoteList
          notes={visible}
          total={notes.length}
          selectedId={selected?.id ?? null}
          onSelect={setSelectedId}
          onNew={newNote}
          onClearFilters={clearFilters}
        />
        <section className="pane editor-pane" aria-label="Editor">
          {saveFailed && (
            <p className="notice" role="alert">
              Couldn’t save on this device. Your changes last until you close the page.
            </p>
          )}
          {selected ? (
            <Editor
              key={selected.id}
              note={selected}
              autoFocus={selected.id === freshId}
              onFocused={clearFresh}
              onChange={(changes) => {
                // Editing holds the note open, even if it moves in the list or drops out of it.
                setSelectedId(selected.id)
                update(selected.id, changes)
              }}
              onDelete={() => deleteNote(selected.id)}
            />
          ) : (
            <p className="editor-pane__idle">Your note opens here.</p>
          )}
        </section>
      </main>
    </>
  )
}
