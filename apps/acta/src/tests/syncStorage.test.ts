import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emptyAccount, readAccountState, writeAccountState, type AccountState } from '../data/syncStorage'

const TASK = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const state: AccountState = {
  ...emptyAccount('account-a'),
  tasks: { [TASK]: { version: 2, content: { text: 'Write', completed: false, category: 'Work', due: '' }, createdAt: '2023-04-01T00:00:00Z' } },
  order: [TASK],
  legacyIds: { 'old-id': TASK },
  operations: [{
    operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    taskId: TASK,
    expectedVersion: 2,
    content: { text: 'Write more', completed: false, category: 'Work', due: '' },
  }],
  conflicts: { [TASK]: { version: 3, content: null, createdAt: '2023-04-01T00:00:00Z' } },
}

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('account sync storage', () => {
  it('persists each account’s copy separately', () => {
    expect(writeAccountState(state)).toBe(true)
    expect(readAccountState('account-a')).toEqual({ status: 'ok', state })
    expect(readAccountState('account-b')).toEqual({ status: 'ok', state: emptyAccount('account-b') })
  })

  it('reports unreadable or malformed data without replacing pending work', () => {
    localStorage.setItem('essentia-acta-account:account-a', '{broken')
    expect(readAccountState('account-a')).toEqual({ status: 'error' })
    expect(localStorage.getItem('essentia-acta-account:account-a')).toBe('{broken')
    localStorage.setItem('essentia-acta-account:account-a', JSON.stringify({ ...state, owner: 'account-b' }))
    expect(readAccountState('account-a')).toEqual({ status: 'error' })
    localStorage.setItem('essentia-acta-account:account-a', JSON.stringify({ ...state, order: [TASK, TASK] }))
    expect(readAccountState('account-a')).toEqual({ status: 'error' })
  })

  it('rejects invalid operations and reports storage failures', () => {
    expect(writeAccountState({ ...state, operations: [...state.operations, state.operations[0]] })).toBe(false)
    const tooLong = { ...state.operations[0], operationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', content: { text: 'x'.repeat(501), completed: false, category: '', due: '' } }
    expect(writeAccountState({ ...state, operations: [tooLong] })).toBe(false)
    // The server trims only spaces, so padding beyond the limit is refused here too.
    const padded = { ...tooLong, content: { text: 'x' + '\t'.repeat(500), completed: false, category: '', due: '' } }
    expect(writeAccountState({ ...state, operations: [padded] })).toBe(false)
    expect(writeAccountState({ ...state, operations: [{ ...state.operations[0], expectedVersion: Number.MAX_SAFE_INTEGER }] })).toBe(false)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(writeAccountState(state)).toBe(false)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    expect(readAccountState('account-a')).toEqual({ status: 'error' })
  })
})
