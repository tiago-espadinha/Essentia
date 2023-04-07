import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEDGER_KEY, openNotes } from '../data/migrate'
import { NOTES_KEY, UNREADABLE_KEY, VERSIONS_KEY } from '../data/storage'

// Synthetic before/after pictures of a device's storage. `input` is the raw
// localStorage; `expected` is what the notes store holds after one load, and
// `expectedSecondRun` after another.
interface Picture {
  notes: unknown[]
  versions: unknown[]
  ledger: { imported: unknown; moved: unknown; skipped: unknown } | null
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
  return {
    notes: read(NOTES_KEY) ?? [],
    versions: read(VERSIONS_KEY) ?? [],
    ledger: ledger && { imported: ledger.imported, moved: ledger.moved, skipped: ledger.skipped },
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
    expect(fixtures).toHaveLength(14)
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

  it('treats a refused ledger as a failure once something was taken in', () => {
    seed(fixtures.find((fixture) => fixture.name === '03-dictum-unowned')!.input)
    refuse([LEDGER_KEY])
    expect(openNotes().failed).toBe(true)
  })

  it('keeps a second, different unreadable notes list beside the first', () => {
    seed(fixtures.find((fixture) => fixture.name === '02-folio-only')!.input)
    localStorage.setItem(UNREADABLE_KEY, JSON.stringify('first'))
    localStorage.setItem(NOTES_KEY, '{second')
    expect(openNotes('2023-04-06T09:00:00.000Z').failed).toBe(false)
    expect(read(UNREADABLE_KEY)).toBe('first')
    expect(read(`${UNREADABLE_KEY}:2023-04-06T09:00:00.000Z`)).toBe('{second')
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
