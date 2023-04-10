import { t } from './locale'
import { Search, useLocale, useRecordMotion } from '@essentia/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { Editor } from './components/Editor'
import { Library } from './components/Library'
import { NoteList } from './components/NoteList'
import { filterNotes, noteText, tagsOf, type Note } from './domain/notes'
import { DeleteAnnouncer } from './components/UndoNotice'
import { ConvertDialog } from './components/ConvertDialog'
import { VersionsDialog } from './components/VersionsDialog'
import { versionsOf } from './domain/versions'
import { useAutoVersion } from './hooks/useAutoVersion'
import { exportAll } from './data/export'
import { useNotes } from './hooks/useNotes'

/** Matches folio.css: one pane at a time below 768 px. */
const PHONE = '(width < 768px)'

export default function App() {
  const locale = useLocale()
  useEffect(() => { document.title = `Folio · ${t('Your Notes')} · Essentia` }, [locale])
  const { notes, versions, readOnly, saveFailed, add, update, saveVersion, restoreVersion, convert, remove, restore } = useNotes()
  const autoVersion = useAutoVersion(saveVersion)
  // The open dialog and the note it is for; it closes if the note goes.
  const [dialog, setDialog] = useState<{ kind: 'versions' | 'convert'; noteId: string } | null>(null)
  // Bumped when a restore or conversion replaces the open note's body, which the editor writes into the DOM only on mount.
  // The editor's key also holds the note's format, so a conversion made in another tab remounts it too.
  const [revision, setRevision] = useState(0)
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
  const motion = useRecordMotion(mainRef)

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
  const dialogNote = dialog && notes.find((note) => note.id === dialog.noteId)
  if (dialog && !dialogNote) setDialog(null)

  // A restore or conversion saves the note first, so an autosave pending for it would only repeat that.
  function replaceBody(id: string, change: () => void) {
    autoVersion.cancel(id)
    change()
    setRevision(revision + 1)
    setDialog(null)
  }

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
    if (readOnly) return
    clearFilters()
    const note = motion(() => add())
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
    autoVersion.cancel(id)
    setDeleted(notes.find((note) => note.id === id)!)
    motion(() => remove(id))
    setSelectedId(next)
    setView('list')
    rowToFocus.current = { id: next }
  }

  // The note comes back as it was and reopens, with focus on its title. As for
  // a new note, filters that would hide it are cleared.
  function undoDelete() {
    if (!deleted) return
    if (filterNotes([deleted], query, activeTag).length === 0) clearFilters()
    motion(() => restore(deleted))
    setDeleted(null)
    setSelectedId(deleted.id)
    setTitleFocusId(deleted.id)
    setView('editor')
  }

  return (
    <>
      <AppHeader search={<Search sourceLabel={t('Your Notes')}
        records={notes.map((note) => ({ id: note.id, title: note.title || t('Untitled'), text: `${noteText(note)} ${note.tags.join(' ')}` }))}
        onSelect={(id) => {
          clearFilters()
          openNote(id)
          setTitleFocusId(id)
        }} />} />
      <main className="folio" ref={mainRef} data-view={selected && view === 'editor' ? 'editor' : 'list'}>
        <h1 className="visually-hidden">{t("Folio notes")}</h1>
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
          readOnly={readOnly}
          onExport={() => exportAll(notes, versions)}
          onSelect={openNote}
          onToggleFilters={toggleFilters}
          onNew={newNote}
          onClearFilters={clearFilters}
          onUndo={undoDelete}
        />
        <section data-motion-detail className="pane editor-pane" aria-label={t("Editor")}>
          {saveFailed && (
            <p className="notice" role="alert">{t("Couldn’t save on this device. Your changes last until you close the page.")}</p>
          )}
          {selected ? (
            <Editor
              key={`${selected.id}:${selected.format}:${revision}`}
              note={selected}
              readOnly={readOnly}
              autoFocus={selected.id === titleFocusId}
              onFocused={clearTitleFocus}
              onChange={(changes) => {
                // Editing holds the note open, even if it moves in the list or drops out of it.
                setSelectedId(selected.id)
                update(selected.id, changes)
                if ('title' in changes || 'body' in changes) autoVersion.schedule(selected.id)
              }}
              onBack={() => backToList(selected.id)}
              onVersions={() => setDialog({ kind: 'versions', noteId: selected.id })}
              onConvert={() => setDialog({ kind: 'convert', noteId: selected.id })}
              onDelete={() => deleteNote(selected.id)}
            />
          ) : (
            <p className="editor-pane__idle">{t("Your note opens here.")}</p>
          )}
        </section>
      </main>
      {dialog?.kind === 'versions' && dialogNote && (
        <VersionsDialog
          note={dialogNote}
          versions={versionsOf(versions, dialogNote.id)}
          onSave={() => saveVersion(dialogNote.id)}
          onRestore={(version) => replaceBody(dialogNote.id, () => restoreVersion(dialogNote.id, version))}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === 'convert' && dialogNote && (
        <ConvertDialog
          note={dialogNote}
          onConvert={() => replaceBody(dialogNote.id, () => convert(dialogNote.id))}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
