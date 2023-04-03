import { describe, expect, it } from 'vitest'
import {
  applyResult, change, claim, conflictOf, isSettled, keepMine, mergeRemote, readResult, readRows, syncAccount,
  takeTheirs, visibleTasks, type SyncPort,
} from '../data/sync'
import { emptyAccount, type AccountState } from '../data/syncStorage'
import type { Task } from '../domain/tasks'
import { FakeAccount, ServerError } from './fakeAccount'

const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'

let counter = 0
/** Deterministic uuids, distinct across a test file. */
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`

const task = (id: string, text: string, extra: Partial<Task> = {}): Task =>
  ({ id, text, completed: false, category: 'General', due: '', ...extra })

/** One browser holding one account's copy. */
class Device {
  state: AccountState
  network: { down?: boolean; loseNextAnswer?: boolean } = {}
  session: string | null
  port: SyncPort
  readonly owner: string

  constructor(server: FakeAccount, owner = A) {
    this.owner = owner
    this.state = emptyAccount(owner)
    this.session = owner
    this.port = server.port(() => this.session, this.network)
  }

  get tasks() { return visibleTasks(this.state) }
  find(text: string) { return this.tasks.find((candidate) => candidate.text === text)! }
  add(text: string) { this.state = change(this.state, newId(), task('', text), newId()) }
  edit(text: string, edit: Partial<Task>) {
    const current = this.find(text)
    this.state = change(this.state, current.id, { ...current, ...edit }, newId())
  }
  remove(text: string) { this.state = change(this.state, this.find(text).id, null, newId()) }

  sync() {
    return syncAccount(this.owner, this.port, {
      get: () => this.state,
      update: (next) => { this.state = next(this.state); return true },
      current: () => this.session === this.owner,
    })
  }
}

describe('two devices on one account', () => {
  it('converge after create, edit, complete and delete', async () => {
    const server = new FakeAccount()
    const laptop = new Device(server)
    const phone = new Device(server)
    laptop.add('Write report')
    laptop.add('Call bank')
    expect(await laptop.sync()).toBe(true)
    expect(await phone.sync()).toBe(true)
    expect(phone.tasks.map((t) => t.text)).toEqual(['Call bank', 'Write report'])

    phone.edit('Write report', { completed: true, category: 'Work', due: '2023-04-03' })
    phone.remove('Call bank')
    phone.add('Buy milk')
    await phone.sync()
    await laptop.sync()

    expect(laptop.tasks).toEqual(phone.tasks)
    expect(laptop.tasks.map(({ text, completed, category, due }) => ({ text, completed, category, due }))).toEqual([
      { text: 'Buy milk', completed: false, category: 'General', due: '' },
      { text: 'Write report', completed: true, category: 'Work', due: '2023-04-03' },
    ])
    expect(isSettled(laptop.state) && isSettled(phone.state)).toBe(true)
  })

  it('sends offline edits in order once back online', async () => {
    const server = new FakeAccount()
    const device = new Device(server)
    device.network.down = true
    device.add('Draft')
    device.edit('Draft', { text: 'Final' })
    device.edit('Final', { completed: true })
    await expect(device.sync()).rejects.toThrow()
    expect(device.state.operations).toHaveLength(3)

    device.network.down = false
    expect(await device.sync()).toBe(true)
    expect(server.read(A)).toMatchObject([{ version: 3, content: { text: 'Final', completed: true } }])
  })

  it('applies a write once when its answer is lost and it is sent again', async () => {
    const server = new FakeAccount()
    const device = new Device(server)
    device.add('Once')
    device.network.loseNextAnswer = true
    await expect(device.sync()).rejects.toThrow()
    expect(device.state.operations).toHaveLength(1)

    expect(await device.sync()).toBe(true)
    expect(server.read(A)).toMatchObject([{ version: 1, content: { text: 'Once' } }])
    expect(device.tasks.map((t) => t.text)).toEqual(['Once'])
  })

  it('settles a retry older than the receipts as already done, not as a duplicate', async () => {
    const server = new FakeAccount()
    const device = new Device(server)
    device.add('Late')
    device.network.loseNextAnswer = true
    await expect(device.sync()).rejects.toThrow()
    server.now += 31 * 86_400_000

    expect(await device.sync()).toBe(true)
    expect(server.read(A)).toHaveLength(1)
    expect(server.read(A)[0]).toMatchObject({ version: 1 })
  })

  it('shows a concurrent edit as a conflict, keeping the unsent change', async () => {
    const server = new FakeAccount()
    const laptop = new Device(server)
    const phone = new Device(server)
    laptop.add('Plan trip')
    await laptop.sync()
    await phone.sync()

    laptop.edit('Plan trip', { text: 'Plan trip to Porto' })
    phone.edit('Plan trip', { text: 'Plan trip to Lisbon' })
    expect(await laptop.sync()).toBe(true)
    expect(await phone.sync()).toBe(false)

    const id = phone.tasks[0].id
    expect(conflictOf(phone.state, id)).toBe('changed')
    expect(phone.tasks[0].text).toBe('Plan trip to Lisbon')
    expect(phone.state.operations).toHaveLength(1)
    expect(server.read(A)).toMatchObject([{ version: 2, content: { text: 'Plan trip to Porto' } }])
  })

  it('Keep mine sends this device’s version over the newer one', async () => {
    const { server, phone, laptop, id } = await conflicted()
    phone.state = keepMine(phone.state, id, newId())
    expect(await phone.sync()).toBe(true)
    await laptop.sync()
    expect(laptop.tasks[0].text).toBe('Mine')
    expect(server.read(A)).toMatchObject([{ version: 3 }])
  })

  it('Use theirs drops this device’s unsent changes, chained ones included', async () => {
    const { server, phone, id } = await conflicted()
    phone.edit('Mine', { completed: true })
    phone.state = takeTheirs(phone.state, id)
    expect(await phone.sync()).toBe(true)
    expect(phone.tasks[0]).toMatchObject({ text: 'Theirs', completed: false })
    expect(server.read(A)).toMatchObject([{ version: 2 }])
  })

  it('shows a task deleted here but changed elsewhere, so it can come back', async () => {
    const server = new FakeAccount()
    const laptop = new Device(server)
    const phone = new Device(server)
    laptop.add('Shared')
    await laptop.sync()
    await phone.sync()
    laptop.edit('Shared', { text: 'Edited' })
    await laptop.sync()
    phone.remove('Shared')

    expect(await phone.sync()).toBe(false)
    const id = phone.tasks[0].id
    expect(phone.tasks[0].text).toBe('Edited')
    expect(conflictOf(phone.state, id)).toBe('deleted-here')
    phone.state = keepMine(phone.state, id, newId())
    await phone.sync()
    expect(phone.tasks).toEqual([])
    expect(server.read(A)).toMatchObject([{ content: null, version: 3 }])
  })

  it('settles a conflict by itself when both devices made the same change', async () => {
    const server = new FakeAccount()
    const laptop = new Device(server)
    const phone = new Device(server)
    laptop.add('Same')
    await laptop.sync()
    await phone.sync()
    laptop.edit('Same', { completed: true })
    phone.edit('Same', { completed: true })
    await laptop.sync()
    expect(await phone.sync()).toBe(true)
    expect(isSettled(phone.state)).toBe(true)
  })

  it('brings an undone delete back as a new version, in its old place', async () => {
    const server = new FakeAccount()
    const device = new Device(server)
    device.add('First')
    device.add('Second')
    await device.sync()
    const first = device.find('First')
    device.remove('First')
    await device.sync()
    expect(device.state.order).not.toContain(first.id)

    device.state = change(device.state, first.id, first, newId(), null)
    await device.sync()
    expect(server.read(A).find((row) => (row as { id: string }).id === first.id)).toMatchObject({ version: 3, content: { text: 'First' } })
  })
})

async function conflicted() {
  const server = new FakeAccount()
  const laptop = new Device(server)
  const phone = new Device(server)
  laptop.add('Start')
  await laptop.sync()
  await phone.sync()
  laptop.edit('Start', { text: 'Theirs' })
  phone.edit('Start', { text: 'Mine' })
  await laptop.sync()
  await phone.sync()
  return { server, laptop, phone, id: phone.tasks[0].id }
}

describe('accounts stay apart', () => {
  it('refuses a write queued for one account once another is signed in, and keeps it', async () => {
    const server = new FakeAccount()
    const device = new Device(server)
    device.add('A’s task')
    device.session = B
    // The guard stops the device first; the server refuses it too.
    expect(await device.sync()).toBe(false)
    await expect(device.port.write(A, device.state.operations[0])).rejects.toThrow(ServerError)
    expect(server.read(B)).toEqual([])
    expect(device.state.operations).toHaveLength(1)
  })

  it('drops an answer that arrives after the account changed', async () => {
    const server = new FakeAccount()
    const device = new Device(server)
    device.add('Pending')
    const write = device.port.write
    device.port = { ...device.port, write: async (owner, operation) => {
      const answer = await write(owner, operation)
      device.session = B
      return answer
    } }
    expect(await device.sync()).toBe(false)
    expect(device.state.operations).toHaveLength(1)
  })

  it('reads only the signed-in account’s tasks', async () => {
    const server = new FakeAccount()
    const a = new Device(server, A)
    const b = new Device(server, B)
    a.add('Private')
    await a.sync()
    await b.sync()
    expect(b.tasks).toEqual([])
  })
})

describe('first sign-in with tasks made while signed out', () => {
  const legacy = [task('old-1', 'Top'), task('aaaaaaaa-1111-4111-8111-111111111111', 'Middle'), task('old-3', 'Bottom')]

  it('adds them once, in order, under ids the account accepts', async () => {
    const server = new FakeAccount()
    const device = new Device(server)
    const first = claim(device.state, legacy, newId)
    expect(first.claimed).toEqual(['old-3', 'aaaaaaaa-1111-4111-8111-111111111111', 'old-1'])
    // A retry after a crash finds every mapping and adds nothing.
    const again = claim(first.state, legacy, newId)
    expect(again.state).toBe(first.state)
    device.state = again.state

    expect(await device.sync()).toBe(true)
    expect(device.tasks.map((t) => t.text)).toEqual(['Top', 'Middle', 'Bottom'])
    expect(device.state.legacyIds['aaaaaaaa-1111-4111-8111-111111111111']).toBe('aaaaaaaa-1111-4111-8111-111111111111')
    expect(server.read(A)).toHaveLength(3)
  })

  it('leaves a task the account can’t hold on the device', () => {
    const { claimed } = claim(emptyAccount(A), [task('long', 'x'.repeat(501)), task('ok', 'Fine')], newId)
    expect(claimed).toEqual(['ok'])
  })
})

describe('checking what the server sends', () => {
  it('skips malformed rows and keeps unsent changes on top of newer ones', () => {
    let state = change(emptyAccount(A), B, task(B, 'Mine'), newId())
    state = mergeRemote(state, readRows([
      null,
      { id: 'not-a-uuid', version: 1, content: null, created_at: '2023-04-01T00:00:00Z' },
      { id: A, version: 1, content: { text: '', completed: false, category: 'x', due: '' }, created_at: '2023-04-01T00:00:00Z' },
      { id: B, version: 4, content: { text: 'Server', completed: false, category: 'General', due: '' }, created_at: '2023-04-01T00:00:00Z' },
    ]))
    expect(Object.keys(state.tasks)).toEqual([B])
    expect(visibleTasks(state).map((t) => t.text)).toEqual(['Mine'])
  })

  it('never takes an older version over a newer one', () => {
    const row = (version: number, text: string) =>
      ({ id: B, version, content: { text, completed: false, category: 'General', due: '' }, createdAt: '2023-04-01T00:00:00Z' })
    const state = mergeRemote(mergeRemote(emptyAccount(A), [row(5, 'New')]), [row(3, 'Old')])
    expect(visibleTasks(state)[0].text).toBe('New')
  })

  it('orders tasks new to this device newest first', () => {
    const row = (id: string, text: string, at: string) =>
      ({ id, version: 1, content: { text, completed: false, category: 'General', due: '' }, createdAt: at })
    const state = mergeRemote(emptyAccount(A), [row(A, 'Older', '2023-03-01T00:00:00Z'), row(B, 'Newer', '2023-03-02T00:00:00Z')])
    expect(visibleTasks(state).map((t) => t.text)).toEqual(['Newer', 'Older'])
  })

  it('rejects an answer that isn’t the write function’s', () => {
    expect(readResult({ status: 'applied', version: 'x' })).toBeNull()
    expect(readResult({ status: 'ok', version: 1, content: null, created_at: '2023-04-01T00:00:00Z' })).toBeNull()
    expect(readResult({ status: 'conflict', version: 0, content: null, created_at: null })).toMatchObject({ version: 0 })
  })

  it('ignores an answer to a write another tab already took', () => {
    const state = change(emptyAccount(A), B, task(B, 'Once'), newId())
    const operation = state.operations[0]
    const result = { status: 'applied' as const, version: 1, content: operation.content, createdAt: '2023-04-01T00:00:00Z' }
    const taken = applyResult(state, operation, result)
    expect(applyResult(taken, operation, result)).toEqual(taken)
  })
})

describe('the fake follows the write function', () => {
  it('refuses a reused operation id with another request, and invalid tasks', () => {
    const server = new FakeAccount()
    const operation = { operationId: newId(), taskId: B, expectedVersion: 0, content: { text: 'A', completed: false, category: 'G', due: '' } }
    server.write(A, A, operation)
    expect(() => server.write(A, A, { ...operation, content: { ...operation.content, text: 'B' } })).toThrow('Operation ID already used')
    expect(() => server.write(A, A, { ...operation, operationId: newId(), content: { ...operation.content, text: ' ' } })).toThrow('Invalid task')
    expect(() => server.write(null, A, operation)).toThrow('Not signed in')
  })
})
