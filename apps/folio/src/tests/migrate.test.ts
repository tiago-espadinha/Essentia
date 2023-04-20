import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEDGER_KEY, openNotes } from '../data/migrate'
import { NOTES_KEY, SYNC_KEY, UNREADABLE_KEY, VERSIONS_KEY } from '../data/storage'

// Synthetic before/after pictures of a device's storage. `input` is the raw
// localStorage; `expected` is what the notes store holds after one load, and
// `expectedSecondRun` after another.
interface Picture {
  notes: unknown[]
  versions: unknown[]
  ledger: { imported: unknown; moved: unknown; accounts?: unknown; skipped: unknown } | null
  /** The sync stamps, for devices that hold them. */
  stamps?: unknown
}

interface Fixture {
  name: string
  input: Record<string, string>
  expected: Picture
  expectedSecondRun?: Picture
  simulate?: { setItemThrowsFor: string[] }
}

const fixtures = Object.values(
  import.meta.glob<Fixture>('./fixtures/consolidation/*.json', { eager: true, import: 'default' }),
)

const read = (key: string) => JSON.parse(localStorage.getItem(key) ?? 'null')

function picture(): Picture {
  const ledger = read(LEDGER_KEY)
  const stamps = read(SYNC_KEY)
  return {
    notes: read(NOTES_KEY) ?? [],
    versions: read(VERSIONS_KEY) ?? [],
    ledger: ledger && { imported: ledger.imported, moved: ledger.moved, ...(ledger.accounts && { accounts: ledger.accounts }), skipped: ledger.skipped },
    ...(stamps && { stamps }),
  }
}

function seed(input: Record<string, string>) {
  for (const [key, value] of Object.entries(input)) localStorage.setItem(key, value)
}

function refuse(keys: string[]) {
  const setItem = Storage.prototype.setItem
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key, value) {
    if (keys.includes(key)) throw new DOMException('Quota exceeded', 'QuotaExceededError')
    setItem.call(this, key, value)
  })
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('moving notes into one store', () => {
  it('covers every fixture', () => {
    expect(fixtures).toHaveLength(16)
  })

  describe.each(fixtures.filter((fixture) => !fixture.simulate).map((fixture) => [fixture.name, fixture] as const))(
    '%s',
    (_name, fixture) => {
      it('matches the expected store and leaves the old stores as they were', () => {
        seed(fixture.input)
        expect(openNotes('2023-04-06T09:00:00.000Z')).toMatchObject({ failed: false, notes: fixture.expected.notes })
        expect(picture()).toEqual(fixture.expected)
        for (const [key, value] of Object.entries(fixture.input)) {
          if (!key.startsWith('essentia-notes')) expect(localStorage.getItem(key)).toBe(value)
        }
      })

      it('changes nothing on the next load', () => {
        seed(fixture.input)
        openNotes('2023-04-06T09:00:00.000Z')
        const ledger = localStorage.getItem(LEDGER_KEY)
        openNotes('2023-04-06T10:00:00.000Z')
        expect(picture()).toEqual(fixture.expectedSecondRun)
        expect(localStorage.getItem(LEDGER_KEY)).toBe(ledger)
      })
    },
  )

  it('writes nothing when the notes are refused, shows them, and finishes on a later load', () => {
    const fixture = fixtures.find((candidate) => candidate.simulate)!
    seed(fixture.input)
    const refused = refuse(fixture.simulate!.setItemThrowsFor)
    const opened = openNotes()
    expect(opened.failed).toBe(true)
    expect(opened.notes.map((note) => note.title)).toEqual(['Groceries'])
    expect(picture()).toEqual(fixture.expected)
    for (const [key, value] of Object.entries(fixture.input)) expect(localStorage.getItem(key)).toBe(value)

    refused.mockRestore()
    expect(openNotes().failed).toBe(false)
    expect(picture().notes).toHaveLength(1)
  })

  it('writes no ledger when the versions are refused', () => {
    seed(fixtures.find((fixture) => fixture.name === '03-dictum-unowned')!.input)
    refuse([VERSIONS_KEY])
    expect(openNotes().failed).toBe(true)
    expect(read(LEDGER_KEY)).toBeNull()
  })

  it('writes no ledger when an account’s pending deletions cannot be stamped, so they are not lost', () => {
    seed(fixtures.find((fixture) => fixture.name === '15-dictum-owned-same-account')!.input)
    const refused = refuse([SYNC_KEY])
    expect(openNotes().failed).toBe(true)
    expect(read(LEDGER_KEY)).toBeNull()

    refused.mockRestore()
    expect(openNotes().failed).toBe(false)
    expect(Object.keys(read(SYNC_KEY).deleted)).toEqual(['886313e1-3b8a-4372-9b90-0c9aee199e5d'])
  })

  it('treats a refused ledger as a failure once something was taken in', () => {
    seed(fixtures.find((fixture) => fixture.name === '03-dictum-unowned')!.input)
    refuse([LEDGER_KEY])
    expect(openNotes().failed).toBe(true)
  })

  it('keeps a second, different unreadable notes list beside the first', () => {
    seed(fixtures.find((fixture) => fixture.name === '02-folio-only')!.input)
    localStorage.setItem(UNREADABLE_KEY, JSON.stringify('first'))
    localStorage.setItem(NOTES_KEY, '{second')
    expect(openNotes().failed).toBe(false)
    expect(read(UNREADABLE_KEY)).toBe('first')
    const copies = () => Object.keys(localStorage).filter((key) => key.startsWith(`${UNREADABLE_KEY}:`))
    expect(copies().map(read)).toEqual(['{second'])

    localStorage.setItem(NOTES_KEY, '{second')
    localStorage.removeItem(LEDGER_KEY)
    refuse([NOTES_KEY, LEDGER_KEY])
    openNotes('2023-04-06T10:00:00.000Z')
    openNotes('2023-04-06T11:00:00.000Z')
    expect(copies()).toHaveLength(1)
  })

  it('keeps an unreadable notes list once the move has already run', () => {
    seed(fixtures.find((fixture) => fixture.name === '02-folio-only')!.input)
    openNotes()
    localStorage.setItem(NOTES_KEY, '{garbled')
    expect(openNotes().failed).toBe(false)
    expect(read(UNREADABLE_KEY)).toBe('{garbled')
  })

  it('keeps an unreadable notes list before writing over it', () => {
    seed(fixtures.find((fixture) => fixture.name === '02-folio-only')!.input)
    localStorage.setItem(NOTES_KEY, '{not json')
    expect(openNotes().failed).toBe(false)
    expect(read(UNREADABLE_KEY)).toBe('{not json')
    expect(picture().notes).toHaveLength(2)
  })

  it('does not bring back a moved note deleted here', () => {
    seed(fixtures.find((fixture) => fixture.name === '03-dictum-unowned')!.input)
    openNotes()
    localStorage.setItem(NOTES_KEY, '[]')
    expect(openNotes().notes).toEqual([])
    expect(picture().versions).toEqual([])
  })

  describe('when an id is already held by another note', () => {
    const id = '16fd2706-8baf-433b-82eb-8c7fada847da'
    const stamp = '2023-01-12T10:30:00.000Z'
    const folio = [{ id, title: 'Folio side', body: '<p>Folio</p>', tags: [], pinned: false, createdAt: stamp, updatedAt: stamp }]
    const dictum = [{ id, title: 'Dictum side', content: '# Dictum', folder: '', tags: [], createdAt: stamp, updatedAt: stamp }]
    const dictumVersions = [{ id: 'v1', docId: id, title: 'Dictum side', content: '# Old', savedAt: stamp }]

    it('leaves a Dictum document in Dictum when a Folio note took its id earlier', () => {
      localStorage.setItem('essentia-folio-notes', JSON.stringify(folio))
      openNotes()
      localStorage.setItem('essentia-dictum-documents', JSON.stringify(dictum))
      localStorage.setItem('essentia-dictum-versions', JSON.stringify(dictumVersions))
      expect(openNotes().notes.map((note) => note.title)).toEqual(['Folio side'])
      expect(picture().versions).toEqual([])
      expect(picture().ledger).toMatchObject({ moved: [], skipped: { folio: 0, dictum: 1 } })
    })

    it('gives a Folio note a derived id when a Dictum document took its id earlier', () => {
      localStorage.setItem('essentia-dictum-documents', JSON.stringify(dictum))
      openNotes()
      localStorage.setItem('essentia-folio-notes', JSON.stringify(folio))
      const notes = openNotes().notes
      expect(notes.map((note) => note.title)).toEqual(['Dictum side', 'Folio side'])
      expect(notes[1].id).not.toBe(id)
    })
  })

  it('sanitizes rich bodies from the old store but keeps markdown as written', () => {
    const stamp = '2023-01-10T09:00:00.000Z'
    localStorage.setItem('essentia-folio-notes', JSON.stringify([
      { id: 'x', title: 'Rich', body: '<p onclick="alert(1)">Hi</p><script>alert(1)</script>', tags: [], pinned: false, createdAt: stamp, updatedAt: stamp },
    ]))
    localStorage.setItem('essentia-dictum-documents', JSON.stringify([
      { id: '16fd2706-8baf-433b-82eb-8c7fada847da', title: 'Md', content: 'a <b>b</b> `<script>`', folder: '', tags: [], createdAt: stamp, updatedAt: stamp },
    ]))
    const bodies = openNotes().notes.map((note) => note.body)
    expect(bodies).toEqual(['<p>Hi</p>', 'a <b>b</b> `<script>`'])
  })
})

describe('when storage refuses every write', () => {
  afterEach(() => vi.restoreAllMocks())

  it('still opens for editing when there was nothing to move', () => {
    refuse([NOTES_KEY, VERSIONS_KEY, LEDGER_KEY])
    expect(openNotes()).toEqual({ notes: [], versions: [], failed: false })
  })
})

describe('Dictum documents and an account', () => {
  const X = '9b2e6f1a-3c4d-4e5f-8a9b-0c1d2e3f4a5b'
  const Z = '16fd2706-8baf-433b-82eb-8c7fada847da'
  const doc = (updatedAt: string, title = 'Essay') => ({ id: Z, title, content: '# Essay', folder: '', tags: [], createdAt: '2023-01-01T00:00:00.000Z', updatedAt })
  const note = (updatedAt: string, title = 'Essay') => ({ id: Z, format: 'markdown', title, body: '# Essay', folder: '', tags: [], pinned: false, createdAt: '2023-01-01T00:00:00.000Z', updatedAt })
  const owned = (owner: string | null, deleted: Record<string, string> = {}) => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ owner, deleted: {}, folders: {} }))
    localStorage.setItem('essentia-dictum-sync', JSON.stringify({ owner, deleted }))
  }
  const titles = () => (read(NOTES_KEY) as { title: string }[]).map((n) => n.title)

  it('keeps signed-out Dictum documents out of notes that belong to an account', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ owner: X, deleted: {}, folders: {} }))
    localStorage.setItem('essentia-dictum-documents', JSON.stringify([doc('2023-02-01T00:00:00.000Z')]))
    openNotes()
    expect(read(NOTES_KEY) ?? []).toEqual([])
  })

  it('takes the newer side of a document both copies hold, with no earlier copy', () => {
    owned(X)
    localStorage.setItem(NOTES_KEY, JSON.stringify([note('2023-03-01T00:00:00.000Z', 'Edited in Folio')]))
    localStorage.setItem('essentia-dictum-documents', JSON.stringify([doc('2023-02-01T00:00:00.000Z')]))
    openNotes()
    expect(titles()).toEqual(['Edited in Folio'])

    localStorage.setItem('essentia-dictum-documents', JSON.stringify([doc('2023-04-01T00:00:00.000Z', 'Edited in Dictum')]))
    openNotes()
    expect(titles()).toEqual(['Edited in Dictum'])
  })

  it('does not bring back a note deleted here that the account has not heard of', () => {
    localStorage.setItem(SYNC_KEY, JSON.stringify({ owner: X, deleted: { [Z]: '2023-03-01T00:00:00.000Z' }, folders: {} }))
    localStorage.setItem('essentia-dictum-sync', JSON.stringify({ owner: X, deleted: {} }))
    localStorage.setItem('essentia-dictum-documents', JSON.stringify([doc('2023-02-01T00:00:00.000Z')]))
    openNotes()
    expect(read(NOTES_KEY) ?? []).toEqual([])
  })

  it('carries a Dictum deletion newer than the note, and drops the note with it', () => {
    owned(X, { [Z]: '2023-03-01T00:00:00.000Z' })
    localStorage.setItem(NOTES_KEY, JSON.stringify([note('2023-02-01T00:00:00.000Z')]))
    openNotes()
    expect(read(NOTES_KEY)).toEqual([])
    expect(read(SYNC_KEY).deleted).toEqual({ [Z]: '2023-03-01T00:00:00.000Z' })
  })

  it('lets a note edited after a Dictum deletion outrank it', () => {
    owned(X, { [Z]: '2023-02-01T00:00:00.000Z' })
    localStorage.setItem(NOTES_KEY, JSON.stringify([note('2023-03-01T00:00:00.000Z')]))
    openNotes()
    expect(titles()).toEqual(['Essay'])
    expect(read(SYNC_KEY).deleted).toEqual({})
  })

  it('takes in an account’s copy only while that account is signed in', () => {
    owned(X)
    localStorage.setItem('essentia-dictum-documents', JSON.stringify([doc('2023-02-01T00:00:00.000Z')]))
    openNotes(undefined, 'someone-else')
    expect(read(NOTES_KEY) ?? []).toEqual([])
    expect(read(LEDGER_KEY).accounts).toBeUndefined()
    openNotes(undefined, X)
    expect(titles()).toEqual(['Essay'])
  })
})
