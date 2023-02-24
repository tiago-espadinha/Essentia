import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from './AppHeader'
import { Editor } from './Editor'
import { Library } from './Library'
import { NoteList } from './NoteList'
import { filterNotes, tagsOf, type Note } from './notes'
import { DeleteAnnouncer } from './UndoNotice'
import { useNotes } from './useNotes'

/** Matches folio.css: one pane at a time below 768 px. */
const PHONE = '(width < 768px)'

export default function App() {
  const { notes, saveFailed, add, update, remove, restore } = useNotes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The latest deleted note, until it is restored or another one is deleted.
  const [deleted, setDeleted] = useState<Note | null>(null)
  // The note whose title takes focus when its editor mounts or shows.
  const [titleFocusId, setTitleFocusId] = useState<string | null>(null)
  // Below 768 px one pane shows at a time: the list, or the open note's editor.
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [query, setQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  // Below 1024 px the search and tags fold into a Filter bar above the list.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const clearTitleFocus = useCallback(() => setTitleFocusId(null), [])
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

  // An active filter keeps the bar open, so the list is never narrowed out of sight.
  const libraryOpen = filtersOpen || query !== '' || activeTag !== null

  function clearFilters() {
    setQuery('')
    setSelectedTag(null)
  }

  // Closing the bar also clears what it filtered.
  function toggleFilters() {
    if (libraryOpen) clearFilters()
    setFiltersOpen(!libraryOpen)
  }

  // A new note is blank, so the filters are cleared to show it in the list.
  function newNote() {
    clearFilters()
    const note = add()
    setSelectedId(note.id)
    setTitleFocusId(note.id)
    setView('editor')
  }

  // On a phone the list gives way to the editor, so focus follows into it.
  function openNote(id: string) {
    setSelectedId(id)
    setView('editor')
    if (window.matchMedia(PHONE).matches) setTitleFocusId(id)
  }

  function backToList(id: string) {
    setView('list')
    rowToFocus.current = { id }
  }

  // The next note in the list opens (or the previous one at the end), and focus goes to its row.
  function deleteNote(id: string) {
    const position = visible.findIndex((note) => note.id === id)
    const next = (visible[position + 1] ?? visible[position - 1])?.id ?? null
    setDeleted(notes.find((note) => note.id === id)!)
    remove(id)
    setSelectedId(next)
    setView('list')
    rowToFocus.current = { id: next }
  }

  // The note comes back as it was and reopens, with focus on its title. As for
  // a new note, filters that would hide it are cleared.
  function undoDelete() {
    if (!deleted) return
    if (filterNotes([deleted], query, activeTag).length === 0) clearFilters()
    restore(deleted)
    setDeleted(null)
    setSelectedId(deleted.id)
    setTitleFocusId(deleted.id)
    setView('editor')
  }

  return (
    <>
      <AppHeader />
      <main className="folio" ref={mainRef} data-view={selected && view === 'editor' ? 'editor' : 'list'}>
        <h1 className="visually-hidden">Folio notes</h1>
        <DeleteAnnouncer deleted={deleted} />
        <Library
          query={query}
          tags={tags}
          activeTag={activeTag}
          open={libraryOpen}
          onQueryChange={setQuery}
          onTagChange={setSelectedTag}
        />
        <NoteList
          notes={visible}
          total={notes.length}
          selectedId={selected?.id ?? null}
          filtersOpen={libraryOpen}
          deleted={deleted}
          onSelect={openNote}
          onToggleFilters={toggleFilters}
          onNew={newNote}
          onClearFilters={clearFilters}
          onUndo={undoDelete}
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
              autoFocus={selected.id === titleFocusId}
              onFocused={clearTitleFocus}
              onChange={(changes) => {
                // Editing holds the note open, even if it moves in the list or drops out of it.
                setSelectedId(selected.id)
                update(selected.id, changes)
              }}
              onBack={() => backToList(selected.id)}
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
