import { t } from './locale'
import { ClaimDialog, getSupabase, useAuth } from '@essentia/supabase'
import { Search, useLocale, useRecordMotion } from '@essentia/ui'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AccountMenu } from './components/AccountMenu'
import { AppHeader } from './components/AppHeader'
import { Editor } from './components/Editor'
import { Library } from './components/Library'
import { NoteList } from './components/NoteList'
import { countByFolder, existingFolder, filterNotes, noteText, tagsOf, type Note } from './domain/notes'
import { DeleteAnnouncer } from './components/UndoNotice'
import { ConvertDialog } from './components/ConvertDialog'
import { DeleteFolderDialog } from './components/DeleteFolderDialog'
import { VersionsDialog } from './components/VersionsDialog'
import { versionsOf } from './domain/versions'
import { useAutoVersion } from './hooks/useAutoVersion'
import { exportAll } from './data/export'
import { SYNC_FAILED, useNotes } from './hooks/useNotes'
import { useSidebar } from './hooks/useSidebar'

/** Matches folio.css: one pane at a time below 768 px. */
const PHONE = '(width < 768px)'

// Null without the suite's account settings: Folio then stays on this device.
const client = getSupabase()

export default function App() {
  const locale = useLocale()
  useEffect(() => { document.title = `Folio · ${t('Your Notes')} · Essentia` }, [locale])
  const {
    notes, versions, folders, readOnly, saveFailed, syncState, sync, unclaimed, answer, add, update, saveVersion, restoreVersion,
    convert, remove, restore, createFolder, renameFolder, deleteFolder, moveNote,
  } = useNotes(client)
  const auth = useAuth(client)
  const autoVersion = useAutoVersion(saveVersion)
  const sidebar = useSidebar()
  // The open dialog, the note it is for and the control that opened it; it closes if the note goes.
  const [dialog, setDialog] = useState<{ kind: 'versions' | 'convert'; noteId: string; returnFocusId: string } | null>(null)
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
  // null is every folder, '' the unfiled notes.
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)
  // The folder whose deletion is being confirmed.
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null)
  // The latest folder change, announced to screen readers.
  const [folderNotice, setFolderNotice] = useState('')
  // Below 1024 px the search and tags fold into a Filter bar above the list.
  const [filtersOpen, setFiltersOpen] = useState(false)
  const clearTitleFocus = useCallback(() => setTitleFocusId(null), [])
  // A row to focus once the list has rendered; `id: null` means New note.
  const rowToFocus = useRef<{ id: string | null } | null>(null)
  // All notes takes focus once a deleted folder's dialog has closed.
  const allNotesToFocus = useRef(false)
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

  useEffect(() => {
    if (!allNotesToFocus.current) return
    allNotesToFocus.current = false
    document.getElementById('folder-all')?.focus()
  })

  const counts = countByFolder(notes)
  const tags = tagsOf(notes)
  // A tag filter lapses once no note carries the tag any more.
  const activeTag = selectedTag !== null && tags.includes(selectedTag) ? selectedTag : null
  if (activeTag === null && selectedTag !== null) setSelectedTag(null)
  // So does a folder filter once the folder is gone.
  const activeFolder = selectedFolder === '' || (selectedFolder !== null && folders.includes(selectedFolder)) ? selectedFolder : null
  if (activeFolder === null && selectedFolder !== null) setSelectedFolder(null)
  const visible = filterNotes(notes, query, activeTag, activeFolder)
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
  const libraryOpen = filtersOpen || query !== '' || activeTag !== null || activeFolder !== null

  function clearFilters() {
    setQuery('')
    setSelectedTag(null)
    setSelectedFolder(null)
  }

  // Closing the bar also clears what it filtered.
  function toggleFilters() {
    if (libraryOpen) clearFilters()
    setFiltersOpen(!libraryOpen)
  }

  // A name already in use, in any case, picks that folder instead of making another.
  function addFolder(name: string): string {
    const existing = existingFolder(folders, name)
    if (!existing) {
      createFolder(name)
      setFolderNotice(t('Added the folder “{name}”.', { name }))
    }
    setSelectedFolder(existing ?? name)
    return existing ?? name
  }

  // Submitting the name unchanged leaves the folder and its notes' dates alone.
  function renameShownFolder(from: string, to: string) {
    if (to === from) return
    renameFolder(from, to)
    setSelectedFolder(to)
    setFolderNotice(t('Renamed the folder to “{name}”.', { name: to }))
  }

  function confirmDeleteFolder(folder: string) {
    deleteFolder(folder)
    setSelectedFolder(null)
    setFolderToDelete(null)
    allNotesToFocus.current = true
    setFolderNotice(t('Deleted the folder “{name}”.', { name: folder }))
  }

  // The note stays open even when it leaves the folder shown, as it does while edited.
  function moveOpenNote(note: Note, name: string) {
    const folder = name && (existingFolder(folders, name) ?? name)
    if (folder === note.folder) return
    const id = note.id
    setSelectedId(id)
    moveNote(id, folder)
    setFolderNotice(folder ? t('Moved to “{name}”.', { name: folder }) : t('Moved to Unfiled.'))
  }

  // A new note is blank, so the search and tag are cleared to show it; it goes
  // into the folder being shown.
  function newNote() {
    if (readOnly) return
    setQuery('')
    setSelectedTag(null)
    const note = motion(() => add(activeFolder ?? ''))
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
    if (filterNotes([deleted], query, activeTag, activeFolder).length === 0) clearFilters()
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
        }} />} account={<AccountMenu auth={auth} client={client} syncState={syncState} onSync={sync} />} />
      <main
        className="folio"
        ref={mainRef}
        data-view={selected && view === 'editor' ? 'editor' : 'list'}
        data-sidebar={sidebar.hidden ? 'hidden' : undefined}
      >
        <h1 className="visually-hidden">{t("Folio notes")}</h1>
        <DeleteAnnouncer deleted={deleted} />
        <p className="visually-hidden" role="status">{folderNotice}</p>
        <Library
          query={query}
          folders={folders}
          counts={counts}
          total={notes.length}
          activeFolder={activeFolder}
          tags={tags}
          activeTag={activeTag}
          open={libraryOpen}
          readOnly={readOnly}
          onQueryChange={setQuery}
          onFolderChange={setSelectedFolder}
          onTagChange={setSelectedTag}
          onCreateFolder={addFolder}
          onRenameFolder={renameShownFolder}
          onDeleteFolder={setFolderToDelete}
        />
        <NoteList
          notes={visible}
          total={notes.length}
          canFilter={notes.length > 0 || folders.length > 0}
          emptyFolder={activeFolder !== null && query === '' && activeTag === null}
          selectedId={selected?.id ?? null}
          filtersOpen={libraryOpen}
          sidebarHidden={sidebar.hidden}
          deleted={deleted}
          readOnly={readOnly}
          onExport={() => exportAll(notes, versions)}
          onSelect={openNote}
          onToggleFilters={toggleFilters}
          onToggleSidebar={sidebar.toggle}
          onNew={newNote}
          onClearFilters={clearFilters}
          onUndo={undoDelete}
        />
        <section data-motion-detail className="pane editor-pane" aria-label={t("Editor")}>
          {syncState === 'failed' && (
            <p className="notice" role="status">
              {t(SYNC_FAILED)}{' '}
              <button type="button" className="undo__button" onClick={() => void sync()}>{t("Try again")}</button>
            </p>
          )}
          {saveFailed && (
            <p className="notice" role="alert">{t("Couldn’t save on this device. Your changes last until you close the page.")}</p>
          )}
          {selected ? (
            <Editor
              key={`${selected.id}:${selected.format}:${revision}`}
              note={selected}
              folders={folders}
              readOnly={readOnly}
              autoFocus={selected.id === titleFocusId}
              onFocused={clearTitleFocus}
              onChange={(changes) => {
                // Editing holds the note open, even if it moves in the list or drops out of it.
                setSelectedId(selected.id)
                update(selected.id, changes)
                if ('title' in changes || 'body' in changes) autoVersion.schedule(selected.id)
              }}
              onMove={(folder) => moveOpenNote(selected, folder)}
              onBack={() => backToList(selected.id)}
              onVersions={(returnFocusId) => setDialog({ kind: 'versions', noteId: selected.id, returnFocusId })}
              onConvert={(returnFocusId) => setDialog({ kind: 'convert', noteId: selected.id, returnFocusId })}
              onDelete={() => deleteNote(selected.id)}
            />
          ) : (
            <p className="editor-pane__idle">{t("Your note opens here.")}</p>
          )}
        </section>
      </main>
      {unclaimed > 0 && auth.status === 'signed-in' && (
        <ClaimDialog
          count={unclaimed}
          noun={[t('note'), t('notes')]}
          email={auth.email}
          decline="keep"
          note={t('Notes added to your account leave this device when you sign out.')}
          onAnswer={answer}
        />
      )}
      {dialog?.kind === 'versions' && dialogNote && (
        <VersionsDialog
          note={dialogNote}
          versions={versionsOf(versions, dialogNote.id)}
          returnFocusId={dialog.returnFocusId}
          onSave={() => saveVersion(dialogNote.id)}
          onRestore={(version) => replaceBody(dialogNote.id, () => restoreVersion(dialogNote.id, version))}
          onClose={() => setDialog(null)}
        />
      )}
      {folderToDelete !== null && (
        <DeleteFolderDialog
          folder={folderToDelete}
          count={counts.get(folderToDelete) ?? 0}
          onDelete={() => confirmDeleteFolder(folderToDelete)}
          onClose={() => setFolderToDelete(null)}
        />
      )}
      {dialog?.kind === 'convert' && dialogNote && (
        <ConvertDialog
          note={dialogNote}
          returnFocusId={dialog.returnFocusId}
          onConvert={() => replaceBody(dialogNote.id, () => convert(dialogNote.id))}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
