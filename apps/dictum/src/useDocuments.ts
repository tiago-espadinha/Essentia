import { useRef, useState } from 'react'
import { applyChanges, createDoc, type Doc, type DocChanges } from './documents'
import { DOCS_KEY, loadDocs, save } from './storage'

/** The documents, saved to this device on every change. */
export function useDocuments() {
  const [docs, setDocs] = useState<Doc[]>(loadDocs)
  const [saveFailed, setSaveFailed] = useState(false)
  // Several changes can land in one event, so each builds on the last one.
  const latest = useRef(docs)

  function commit(change: (current: Doc[]) => Doc[]) {
    const next = change(latest.current)
    latest.current = next
    setDocs(next)
    setSaveFailed(!save(DOCS_KEY, next))
  }

  return {
    docs,
    saveFailed,
    /** Adds a blank document in the folder and returns it. */
    add: (folder = '') => {
      const doc = createDoc(folder)
      commit((current) => [doc, ...current])
      return doc
    },
    update: (id: string, changes: DocChanges) =>
      commit((current) => current.map((doc) => (doc.id === id ? applyChanges(doc, changes) : doc))),
  }
}
