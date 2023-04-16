import { describe, expect, it } from 'vitest'
import { createNote, type Note } from '../domain/notes'
import {
  LIMITS,
  merge,
  mergeFolders,
  mergeNotes,
  NO_STAMPS,
  readRemote,
  readRemoteFolders,
  stampDeletions,
  stampFolders,
  syncable,
  type FolderRow,
  type NoteRow,
  type Push,
  type Stamps,
} from '../data/sync'

const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const T1 = '2023-04-15T10:00:00.000Z'
const T2 = '2023-04-15T11:00:00.000Z'
const T3 = '2023-04-15T12:00:00.000Z'
const T4 = '2023-04-15T13:00:00.000Z'

function note(changes: Partial<Note> = {}): Note {
  return { ...createNote(new Date(T1), ID), format: 'markdown', title: 'Plan', body: '# Plan', ...changes }
}

function row(changes: Partial<NoteRow> = {}): NoteRow {
  return {
    id: ID,
    format: 'markdown',
    title: 'Plan',
    content: '# Plan',
    folder: '',
    tags: [],
    pinned: false,
    created_at: T1,
    updated_at: T1,
    deleted_at: null,
    ...changes,
  }
}

const folderRow = (name: string, updated_at: string, deleted_at: string | null = null): FolderRow => ({ name, updated_at, deleted_at })

const stamps = (changes: Partial<Stamps> = {}): Stamps => ({ ...NO_STAMPS, owner: 'ana', ...changes })

describe('mergeNotes', () => {
  it('uploads notes the account does not have yet', () => {
    const local = note({ format: 'rich', body: '<p>Plan</p>', pinned: true, folder: 'Work', tags: ['draft'] })
    const result = mergeNotes([local], stamps(), [])
    expect(result.notes).toEqual([local])
    expect(result.push.notes).toEqual([row({ format: 'rich', content: '<p>Plan</p>', pinned: true, folder: 'Work', tags: ['draft'] })])
  })

  it('adds the account’s notes this device does not have', () => {
    const result = mergeNotes([], stamps(), [row({ title: 'From the laptop', pinned: true, updated_at: '2023-04-15T12:00:00+00:00' })])
    expect(result.notes).toEqual([note({ title: 'From the laptop', pinned: true, updatedAt: T3 })])
    expect(result.push).toEqual({ notes: [], deletions: [] })
  })

  it('keeps the newer side of a note changed on both', () => {
    const newerHere = mergeNotes([note({ body: 'here', updatedAt: T3 })], stamps(), [row({ content: 'there', updated_at: T2 })])
    expect(newerHere.notes[0].body).toBe('here')
    expect(newerHere.push.notes.map((r) => r.content)).toEqual(['here'])

    const newerThere = mergeNotes([note({ body: 'here', updatedAt: T2 })], stamps(), [row({ content: 'there', updated_at: T3 })])
    expect(newerThere.notes[0].body).toBe('there')
    expect(newerThere.push.notes).toEqual([])
  })

  it('takes the format whole from the newer side, never mixing it with the other body', () => {
    const rich = note({ format: 'rich', body: '<p><strong>Plan</strong></p>', pinned: true, updatedAt: T3 })
    const fromHere = mergeNotes([rich], stamps(), [row({ format: 'markdown', content: '**Plan**', updated_at: T2 })])
    expect(fromHere.notes).toEqual([rich])
    expect(fromHere.push.notes[0]).toMatchObject({ format: 'rich', content: '<p><strong>Plan</strong></p>', pinned: true })

    const fromThere = mergeNotes([note({ format: 'markdown', body: '**Plan**', updatedAt: T2 })], stamps(), [
      row({ format: 'rich', content: '<p><strong>Plan</strong></p>', pinned: true, updated_at: T3 }),
    ])
    expect(fromThere.notes[0]).toMatchObject({ format: 'rich', body: '<p><strong>Plan</strong></p>', pinned: true, updatedAt: T3 })
    expect(fromThere.push.notes).toEqual([])
  })

  it('changes nothing when both sides already match', () => {
    const local = note({ updatedAt: T2 })
    const result = mergeNotes([local], stamps(), [row({ updated_at: '2023-04-15T11:00:00+00:00' })])
    expect(result.notes[0]).toBe(local)
    expect(result.push).toEqual({ notes: [], deletions: [] })
  })

  it('drops a note deleted elsewhere after its last change here', () => {
    const result = mergeNotes([note({ updatedAt: T2 })], stamps(), [row({ updated_at: T3, deleted_at: T3 })])
    expect(result.notes).toEqual([])
    expect(result.push.notes).toEqual([])
  })

  it('brings a note back when it was edited here after a deletion elsewhere', () => {
    const result = mergeNotes([note({ updatedAt: T3 })], stamps(), [row({ updated_at: T2, deleted_at: T2 })])
    expect(result.notes).toHaveLength(1)
    expect(result.push.notes[0]).toMatchObject({ id: ID, deleted_at: null, updated_at: T3 })
  })

  it('pushes a deletion made here and keeps its stamp until the server has it', () => {
    const result = mergeNotes([], stamps({ deleted: { [ID]: T3 } }), [row({ updated_at: T2 })])
    expect(result.notes).toEqual([])
    expect(result.push.deletions).toEqual([{ id: ID, at: T3 }])
    expect(result.stamps.deleted).toEqual({ [ID]: T3 })

    const later = mergeNotes([], result.stamps, [row({ updated_at: T3, deleted_at: T3 })])
    expect(later.stamps.deleted).toEqual({})
    expect(later.push.deletions).toEqual([])
  })

  it('lets a newer edit elsewhere outrank a deletion here', () => {
    const result = mergeNotes([], stamps({ deleted: { [ID]: T2 } }), [row({ title: 'Kept', updated_at: T3 })])
    expect(result.notes.map((n) => n.title)).toEqual(['Kept'])
    expect(result.push.deletions).toEqual([])
    expect(result.stamps.deleted).toEqual({})
  })

  it('forgets a deletion stamp for a note the account never had', () => {
    const result = mergeNotes([], stamps({ deleted: { [OTHER]: T2 } }), [])
    expect(result.stamps.deleted).toEqual({})
    expect(result.push.deletions).toEqual([])
  })

  it('keeps notes the account cannot hold on this device, without pushing them', () => {
    const oldId = note({ id: '0123456789abcdef0123456789abcdef' })
    const long = note({ id: OTHER, body: 'x'.repeat(LIMITS.content + 1) })
    const result = mergeNotes([oldId, long], stamps(), [])
    expect(result.notes).toEqual([oldId, long])
    expect(result.push.notes).toEqual([])
  })
})

describe('syncable', () => {
  it('takes each limit itself and refuses one past it', () => {
    const at = { title: 'x'.repeat(LIMITS.title), body: 'x'.repeat(LIMITS.content), folder: 'x'.repeat(LIMITS.folder) }
    expect(syncable(note({ ...at, tags: Array.from({ length: LIMITS.tags }, (_, i) => `t${i}`) }))).toBe(true)
    expect(syncable(note({ title: 'x'.repeat(LIMITS.title + 1) }))).toBe(false)
    expect(syncable(note({ body: 'x'.repeat(LIMITS.content + 1) }))).toBe(false)
    expect(syncable(note({ folder: 'x'.repeat(LIMITS.folder + 1) }))).toBe(false)
    expect(syncable(note({ tags: Array.from({ length: LIMITS.tags + 1 }, (_, i) => `t${i}`) }))).toBe(false)
  })
})

describe('stampDeletions', () => {
  it('stamps removed notes and drops the stamp of a note put back', () => {
    const a = note()
    const b = note({ id: OTHER })
    const removed = stampDeletions([a, b], [a], stamps(), T2)
    expect(removed.deleted).toEqual({ [OTHER]: T2 })
    expect(stampDeletions([a], [a, b], removed, T3).deleted).toEqual({})
  })
})

describe('mergeFolders', () => {
  it('uploads folders kept before the account, dated now', () => {
    const result = mergeFolders(['Work'], stamps(), [], T4)
    expect(result.folders).toEqual(['Work'])
    expect(result.push.folders).toEqual([folderRow('Work', T4)])
  })

  it('adds the account’s folders and skips deleted ones', () => {
    const result = mergeFolders([], stamps(), [folderRow('Work', T1), folderRow('Old', T2, T2)], T4)
    expect(result.folders).toEqual(['Work'])
    expect(result.push).toEqual({ folders: [], folderDeletions: [] })
  })

  it('clears an addition stamp once the server has the folder', () => {
    const result = mergeFolders(['Work'], stamps({ folders: { Work: T2 } }), [folderRow('Work', T2)], T4)
    expect(result.stamps.folders).toEqual({})
    expect(result.push.folders).toEqual([])
  })

  it('adds a folder again when it was re-added here after a deletion elsewhere', () => {
    const result = mergeFolders(['Work'], stamps({ folders: { Work: T3 } }), [folderRow('Work', T2, T2)], T4)
    expect(result.folders).toEqual(['Work'])
    expect(result.push.folders).toEqual([folderRow('Work', T3)])
    expect(result.stamps.folders).toEqual({ Work: T3 })
  })

  it('drops a folder deleted elsewhere after this device changed it', () => {
    expect(mergeFolders(['Work'], stamps({ folders: { Work: T2 } }), [folderRow('Work', T3, T3)], T4).folders).toEqual([])
    expect(mergeFolders(['Work'], stamps(), [folderRow('Work', T3, T3)], T4).folders).toEqual([])
  })

  it('pushes a deletion made here, and lets a newer keep elsewhere outrank it', () => {
    const deleted = mergeFolders([], stamps({ folders: { Work: T3 } }), [folderRow('Work', T2)], T4)
    expect(deleted.folders).toEqual([])
    expect(deleted.push.folderDeletions).toEqual([{ name: 'Work', at: T3 }])
    expect(deleted.stamps.folders).toEqual({ Work: T3 })

    const kept = mergeFolders([], stamps({ folders: { Work: T2 } }), [folderRow('Work', T3)], T4)
    expect(kept.folders).toEqual(['Work'])
    expect(kept.push.folderDeletions).toEqual([])
    expect(kept.stamps.folders).toEqual({})
  })

  it('keeps folders made while signed out over an old deletion in the account, once stamped on joining', () => {
    const joined = stampFolders([], ['Archive'], stamps(), T4)
    const result = mergeFolders(['Archive'], joined, [folderRow('Archive', T1, T1)], T4)
    expect(result.folders).toEqual(['Archive'])
    expect(result.push.folders).toEqual([folderRow('Archive', T4)])
  })

  it('treats a rename as a deletion of the old name and an addition of the new one', () => {
    const renamed = stampFolders(['Work'], ['Jobs'], stamps(), T3)
    expect(renamed.folders).toEqual({ Work: T3, Jobs: T3 })
    const result = mergeFolders(['Jobs'], renamed, [folderRow('Work', T1)], T4)
    expect(result.folders).toEqual(['Jobs'])
    expect(result.push.folders).toEqual([folderRow('Jobs', T3)])
    expect(result.push.folderDeletions).toEqual([{ name: 'Work', at: T3 }])
  })

  it('keeps folder names like __proto__ as plain names', () => {
    const stamped = stampFolders([], ['__proto__', 'constructor'], stamps(), T2)
    expect(Object.keys(stamped.folders).sort()).toEqual(['__proto__', 'constructor'])
    expect(Object.getPrototypeOf(stamped.folders)).toBe(Object.prototype)
    const result = mergeFolders(['__proto__', 'constructor'], stamped, [], T4)
    expect(result.push.folders.map((f) => f.name)).toEqual(['__proto__', 'constructor'])
    expect(mergeFolders([], stamps(), [folderRow('constructor', T1)], T4).folders).toEqual(['constructor'])
  })

  it('keeps folders the account cannot hold on this device, without pushing them', () => {
    const long = 'x'.repeat(LIMITS.folder + 1)
    const result = mergeFolders([long], stamps({ folders: { [long]: T2 } }), [], T4)
    expect(result.folders).toEqual([long])
    expect(result.push.folders).toEqual([])
    expect(result.stamps.folders).toEqual({})
  })
})

/** One device: what it holds and remembers. The server applies each push as the tables would. */
interface Device {
  notes: Note[]
  folders: string[]
  stamps: Stamps
}

class Server {
  notes = new Map<string, NoteRow>()
  folders = new Map<string, FolderRow>()

  apply(push: Push) {
    for (const r of push.notes) this.notes.set(r.id, r)
    for (const f of push.folders) this.folders.set(f.name, f)
    // Deletions only stamp a row older than the deletion, as remote.ts asks.
    for (const { id, at } of push.deletions) {
      const r = this.notes.get(id)
      if (r && Date.parse(r.updated_at) < Date.parse(at)) this.notes.set(id, { ...r, deleted_at: at, updated_at: at })
    }
    for (const { name, at } of push.folderDeletions) {
      const f = this.folders.get(name)
      if (f && Date.parse(f.updated_at) < Date.parse(at)) this.folders.set(name, { ...f, deleted_at: at, updated_at: at })
    }
  }

  sync(device: Device, now = T4): Device {
    const result = merge({ notes: device.notes, folders: device.folders }, device.stamps, { notes: [...this.notes.values()], folders: [...this.folders.values()] }, now)
    this.apply(result.push)
    return { notes: result.notes, folders: result.folders, stamps: result.stamps }
  }
}

const byId = (notes: Note[]) => [...notes].sort((a, b) => a.id.localeCompare(b.id))

describe('two devices', () => {
  function start(): { server: Server; a: Device; b: Device } {
    const server = new Server()
    const a = server.sync({ notes: [note({ updatedAt: T1 })], folders: ['Work'], stamps: stamps() }, T1)
    const b = server.sync({ notes: [], folders: [], stamps: stamps() }, T1)
    return { server, a, b }
  }

  it('converge after edits on both, whichever syncs first', () => {
    for (const order of ['ab', 'ba']) {
      const { server, a: a0, b: b0 } = start()
      let a: Device = { ...a0, notes: [{ ...a0.notes[0], title: 'From A', updatedAt: T2 }] }
      let b: Device = { ...b0, notes: [...b0.notes, note({ id: OTHER, format: 'rich', body: '<p>New</p>', updatedAt: T3 })] }
      for (const turn of order + order) {
        if (turn === 'a') a = server.sync(a)
        else b = server.sync(b)
      }
      expect(byId(a.notes)).toEqual(byId(b.notes))
      expect(byId(a.notes).map((n) => n.title)).toEqual(['From A', 'Plan'])
      expect(b.notes.find((n) => n.id === OTHER)?.format).toBe('rich')
    }
  })

  it('converge after a delete on one and an edit on the other, the later change winning', () => {
    // A deletes at T2, B edits at T3: the edit wins and the note comes back on A.
    {
      const { server, a: a0, b: b0 } = start()
      let a: Device = { ...a0, notes: [], stamps: stampDeletions(a0.notes, [], a0.stamps, T2) }
      let b: Device = { ...b0, notes: [{ ...b0.notes[0], title: 'Edited', updatedAt: T3 }] }
      a = server.sync(a)
      b = server.sync(b)
      a = server.sync(a)
      expect(a.notes.map((n) => n.title)).toEqual(['Edited'])
      expect(b.notes).toEqual(a.notes)
      expect(a.stamps.deleted).toEqual({})
    }
    // B edits at T2, A deletes at T3: the note is gone on both.
    {
      const { server, a: a0, b: b0 } = start()
      let a: Device = { ...a0, notes: [], stamps: stampDeletions(a0.notes, [], a0.stamps, T3) }
      let b: Device = { ...b0, notes: [{ ...b0.notes[0], title: 'Edited', updatedAt: T2 }] }
      b = server.sync(b)
      a = server.sync(a)
      b = server.sync(b)
      a = server.sync(a)
      expect(a.notes).toEqual([])
      expect(b.notes).toEqual([])
      expect(a.stamps.deleted).toEqual({})
    }
  })

  it('send an offline change on a later sync', () => {
    const { server, a: a0, b: b0 } = start()
    // A edits while offline: its sync fails, so nothing reaches the server and its state is unchanged.
    let a: Device = { ...a0, notes: [{ ...a0.notes[0], body: 'offline edit', updatedAt: T2 }], stamps: stampDeletions(a0.notes, a0.notes, a0.stamps, T2) }
    let b = server.sync(b0)
    expect(b.notes[0].body).toBe('# Plan')
    a = server.sync(a)
    b = server.sync(b)
    expect(b.notes[0].body).toBe('offline edit')
    expect(a.notes).toEqual(b.notes)
  })

  it('converge on folder additions, renames and deletes', () => {
    const { server, a: a0, b: b0 } = start()
    expect(b0.folders).toEqual(['Work'])
    let a: Device = { ...a0, folders: ['Jobs'], stamps: stampFolders(a0.folders, ['Jobs'], a0.stamps, T2) }
    let b: Device = { ...b0, folders: ['Work', 'Ideas'], stamps: stampFolders(b0.folders, ['Work', 'Ideas'], b0.stamps, T3) }
    a = server.sync(a)
    b = server.sync(b)
    a = server.sync(a)
    expect([...a.folders].sort()).toEqual(['Ideas', 'Jobs'])
    expect([...b.folders].sort()).toEqual(['Ideas', 'Jobs'])

    a = { ...a, folders: ['Jobs'], stamps: stampFolders(a.folders, ['Jobs'], a.stamps, T4) }
    a = server.sync(a)
    b = server.sync(b)
    expect(b.folders).toEqual(['Jobs'])
    // The deletion stamp stays until a later sync sees the deletion on the server.
    expect(a.stamps.folders).toEqual({ Ideas: T4 })
    a = server.sync(a)
    expect(a.stamps.folders).toEqual({})
  })
})

describe('readRemote', () => {
  it('skips rows the app cannot trust', () => {
    const bad = [
      null,
      'row',
      row({ id: 'not-a-uuid' }),
      { ...row(), format: 'html' },
      { ...row(), pinned: 'yes' },
      { ...row(), content: 42 },
      { ...row(), tags: 'a,b' },
      { ...row(), updated_at: 'yesterday' },
      { ...row(), deleted_at: 'never' },
    ]
    expect(readRemote([...bad, row({ id: OTHER })]).map((r) => r.id)).toEqual([OTHER])
  })

  it('sanitizes rich bodies and leaves markdown as written', () => {
    const rows = readRemote([
      row({ format: 'rich', content: '<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror="alert(1)"><a href="javascript:alert(1)">link</a></p>' }),
      row({ id: OTHER, content: '<script>stays text</script>' }),
    ])
    expect(rows[0].content).toBe('<p>Hilink</p>')
    expect(rows[1].content).toBe('<script>stays text</script>')
  })

  it('tidies folder and tags, and keeps the first row of an id', () => {
    const rows = readRemote([row({ folder: '  Work  ', tags: ['#Draft', 'draft'] }), row({ title: 'Second' })])
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ folder: 'Work', tags: ['draft'], title: 'Plan' })
  })
})

describe('readRemoteFolders', () => {
  it('skips blank, untidy, overlong and malformed names', () => {
    const rows = readRemoteFolders([
      folderRow('', T1),
      folderRow(' Work', T1),
      folderRow('x'.repeat(LIMITS.folder + 1), T1),
      { name: 7, updated_at: T1, deleted_at: null },
      folderRow('Bad date', 'soon'),
      folderRow('Work', T1),
      folderRow('Work', T2),
    ])
    expect(rows).toEqual([folderRow('Work', T1)])
  })
})
