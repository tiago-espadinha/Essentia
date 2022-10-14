import { useRef, useState } from 'react'
import { applyChanges, createDoc, type Doc, type DocChanges } from './documents'
import { DOCS_KEY, loadDocs, loadVersions, save, VERSIONS_KEY } from './storage'
import { addVersion, type Version } from './versions'

interface Saved {
  docs: Doc[]
  versions: Version[]
}

function load(): Saved {
  const docs = loadDocs()
  return { docs, versions: loadVersions(docs.map((doc) => doc.id)) }
}

/** The documents and their versions, saved to this device on every change. */
export function useDocuments() {
  const [saved, setSaved] = useState<Saved>(load)
  // Whether the last write of each list failed; the alert shows while either did.
  const [failed, setFailed] = useState({ docs: false, versions: false })
  // Several changes can land in one event (a restore saves a version, then the text), so each builds on the last.
  const latest = useRef(saved)

  function commit(change: (current: Saved) => Saved) {
    const next = change(latest.current)
    // Only lists that changed are written, so only they update their flag.
    const docsFailed = next.docs === latest.current.docs ? null : !save(DOCS_KEY, next.docs)
    const versionsFailed = next.versions === latest.current.versions ? null : !save(VERSIONS_KEY, next.versions)
    latest.current = next
    setSaved(next)
    setFailed((current) => ({ docs: docsFailed ?? current.docs, versions: versionsFailed ?? current.versions }))
  }

  const updateDoc = (id: string, changes: DocChanges) =>
    commit((current) => ({
      ...current,
      docs: current.docs.map((doc) => (doc.id === id ? applyChanges(doc, changes) : doc)),
    }))

  const saveVersion = (id: string) =>
    commit((current) => {
      const doc = current.docs.find((d) => d.id === id)
      return doc ? { ...current, versions: addVersion(current.versions, doc) } : current
    })

  return {
    docs: saved.docs,
    versions: saved.versions,
    saveFailed: failed.docs || failed.versions,
    /** Adds a blank document in the folder and returns it. */
    add: (folder = '') => {
      const doc = createDoc(folder)
      commit((current) => ({ ...current, docs: [doc, ...current.docs] }))
      return doc
    },
    update: updateDoc,
    /** Saves the document as a version, unless its newest version is the same. */
    saveVersion,
    /** Saves the current text as a version first, so the restore can itself be undone. */
    restore: (id: string, version: Version) => {
      saveVersion(id)
      updateDoc(id, { title: version.title, content: version.content })
    },
    /** Removes the document and its versions, and returns them for an undo. */
    remove: (id: string): Saved => {
      const removed: Saved = {
        docs: latest.current.docs.filter((doc) => doc.id === id),
        versions: latest.current.versions.filter((version) => version.docId === id),
      }
      commit((current) => ({
        docs: current.docs.filter((doc) => doc.id !== id),
        versions: current.versions.filter((version) => version.docId !== id),
      }))
      return removed
    },
    /** Puts back what `remove` returned. */
    putBack: (removed: Saved) =>
      commit((current) => ({
        docs: [...removed.docs, ...current.docs],
        versions: [...removed.versions, ...current.versions],
      })),
  }
}
