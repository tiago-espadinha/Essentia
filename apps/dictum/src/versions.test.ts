import { describe, expect, it } from 'vitest'
import { createDoc, type Doc } from './documents'
import { addVersion, excerpt, MAX_VERSIONS, versionsOf, type Version } from './versions'

const doc = (id: string, content: string, title = 'Essay'): Doc => ({ ...createDoc('', new Date(0), id), title, content })
const at = (minute: number) => new Date(Date.UTC(2022, 9, 10, 9, minute))

describe('addVersion', () => {
  it('saves the title and text with the time', () => {
    expect(addVersion([], doc('a', 'One'), at(0), 'v1')).toEqual([
      { id: 'v1', docId: 'a', title: 'Essay', content: 'One', savedAt: '2022-10-10T09:00:00.000Z' },
    ])
  })

  it('skips a version identical to the newest one', () => {
    const saved = addVersion([], doc('a', 'One'), at(0), 'v1')
    expect(addVersion(saved, doc('a', 'One'), at(1), 'v2')).toBe(saved)
  })

  it('saves again when only the title changed, or the text went back to an older version', () => {
    let saved = addVersion([], doc('a', 'One'), at(0), 'v1')
    saved = addVersion(saved, doc('a', 'One', 'Retitled'), at(1), 'v2')
    saved = addVersion(saved, doc('a', 'Two', 'Retitled'), at(2), 'v3')
    saved = addVersion(saved, doc('a', 'One', 'Retitled'), at(3), 'v4')
    expect(versionsOf(saved, 'a').map((v) => v.id)).toEqual(['v4', 'v3', 'v2', 'v1'])
  })

  it(`keeps the newest ${MAX_VERSIONS} per document and leaves other documents alone`, () => {
    let saved: Version[] = addVersion([], doc('b', 'Other'), at(0), 'other')
    for (let i = 1; i <= MAX_VERSIONS + 3; i++) saved = addVersion(saved, doc('a', `Text ${i}`), at(i), `v${i}`)
    const own = versionsOf(saved, 'a')
    expect(own).toHaveLength(MAX_VERSIONS)
    expect(own[0].id).toBe(`v${MAX_VERSIONS + 3}`)
    expect(own.at(-1)!.id).toBe('v4')
    expect(versionsOf(saved, 'b').map((v) => v.id)).toEqual(['other'])
  })
})

describe('versionsOf', () => {
  it("lists one document's versions, newest first", () => {
    const saved: Version[] = [
      { id: 'old', docId: 'a', title: '', content: '', savedAt: '2022-10-10T09:00:00.000Z' },
      { id: 'b1', docId: 'b', title: '', content: '', savedAt: '2022-10-10T09:30:00.000Z' },
      { id: 'new', docId: 'a', title: '', content: '', savedAt: '2022-10-11T09:00:00.000Z' },
    ]
    expect(versionsOf(saved, 'a').map((v) => v.id)).toEqual(['new', 'old'])
  })
})

describe('excerpt', () => {
  it('drops markdown markers and shortens long text', () => {
    expect(excerpt('# Title\n\n- **one** item')).toBe('Title one item')
    expect(excerpt('word '.repeat(40), 12)).toBe('word word wo…')
  })
})
