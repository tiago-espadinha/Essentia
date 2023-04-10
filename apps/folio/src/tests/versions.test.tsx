import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NOTES_KEY, VERSIONS_KEY } from '../data/storage'
import { createNote, type Note, type NoteVersion } from '../domain/notes'
import { addVersion, MAX_VERSIONS, versionsOf } from '../domain/versions'
import { useNotes } from '../hooks/useNotes'
import './testing'

const at = (minute: number) => new Date(Date.UTC(2023, 3, 9, 9, minute))
const note = (id: string, changes: Partial<Note> = {}): Note => ({ ...createNote(at(0), id), title: 'T', body: '<p>a</p>', ...changes })

describe('addVersion', () => {
  it('skips a version identical to the newest, but not one whose format alone differs', () => {
    const once = addVersion([], note('n'), at(1), 'v1')
    expect(addVersion(once, note('n'), at(2), 'v2')).toBe(once)
    const converted = addVersion(once, note('n', { format: 'markdown' }), at(2), 'v2')
    expect(versionsOf(converted, 'n').map((v) => v.id)).toEqual(['v2', 'v1'])
  })

  it('keeps the newest 20 per note without touching other notes', () => {
    let versions = addVersion([], note('other'), at(0), 'keep')
    for (let n = 1; n <= 25; n += 1) versions = addVersion(versions, note('n', { body: `<p>${n}</p>` }), at(n), `v${n}`)
    const own = versionsOf(versions, 'n')
    expect(own).toHaveLength(MAX_VERSIONS)
    expect(own[0].id).toBe('v25')
    expect(own.at(-1)!.id).toBe('v6')
    expect(versionsOf(versions, 'other').map((v) => v.id)).toEqual(['keep'])
  })
})

describe('useNotes versions', () => {
  let hook: ReturnType<typeof useNotes>
  let root: ReturnType<typeof createRoot>

  function Probe() {
    hook = useNotes()
    return null
  }

  const original = note('11111111-1111-4111-8111-111111111111', {
    title: 'Plan',
    body: '<h1>Plan</h1><p>an <u>underlined</u> <strong>word</strong></p>',
  })
  const stored = () => ({
    notes: JSON.parse(localStorage.getItem(NOTES_KEY)!) as Note[],
    versions: JSON.parse(localStorage.getItem(VERSIONS_KEY) ?? '[]') as NoteVersion[],
  })

  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem(NOTES_KEY, JSON.stringify([original]))
    root = createRoot(document.body.appendChild(document.createElement('div')))
    act(() => root.render(<Probe />))
  })
  afterEach(() => act(() => root.unmount()))

  it('saves a version before converting, and restoring it brings the note back exactly', () => {
    act(() => hook.convert(original.id))
    const converted = stored()
    expect(converted.notes[0]).toMatchObject({ format: 'markdown', body: '# Plan\n\nan underlined **word**' })
    expect(converted.versions).toHaveLength(1)
    expect(converted.versions[0]).toMatchObject({ title: 'Plan', body: original.body, format: 'rich' })

    act(() => hook.restoreVersion(original.id, converted.versions[0]))
    const restored = stored()
    expect(restored.notes[0]).toMatchObject({ title: original.title, body: original.body, format: original.format })
    // The converted state was saved first, so the restore can be undone too.
    expect(versionsOf(restored.versions, original.id).map((v) => v.format)).toEqual(['markdown', 'rich'])
  })

  it('keeps versions through a delete and its undo, and drops them with the note', () => {
    act(() => hook.saveVersion(original.id))
    act(() => hook.remove(original.id))
    expect(stored()).toEqual({ notes: [], versions: [] })
    act(() => hook.restore(original))
    expect(stored().versions).toHaveLength(1)
  })
})
