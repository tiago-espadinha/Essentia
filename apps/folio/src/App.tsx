import { useCallback, useState } from 'react'
import { AppHeader } from './AppHeader'
import { Editor } from './Editor'
import { NoteList } from './NoteList'
import { filterNotes } from './notes'
import { useNotes } from './useNotes'

export default function App() {
  const { notes, saveFailed, add, update, remove } = useNotes()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [freshId, setFreshId] = useState<string | null>(null)
  const clearFresh = useCallback(() => setFreshId(null), [])

  const visible = filterNotes(notes, '', null)
  // With nothing chosen yet, or the chosen note gone, the first note in the list is open.
  const selected = notes.find((note) => note.id === selectedId) ?? visible[0] ?? null

  function newNote() {
    const note = add()
    setSelectedId(note.id)
    setFreshId(note.id)
  }

  // The next note in the list opens (or the previous one at the end).
  function deleteNote(id: string) {
    const position = visible.findIndex((note) => note.id === id)
    remove(id)
    setSelectedId((visible[position + 1] ?? visible[position - 1])?.id ?? null)
  }

  return (
    <>
      <AppHeader />
      <main className="folio">
        <h1 className="visually-hidden">Folio notes</h1>
        <NoteList notes={visible} selectedId={selected?.id ?? null} onSelect={setSelectedId} onNew={newNote} />
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
