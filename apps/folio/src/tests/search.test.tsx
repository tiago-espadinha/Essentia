import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { $, buttonNamed, click, renderApp, rowTitles, setupApp, type } from './testing'

setupApp()
HTMLDialogElement.prototype.close = function () { this.open = false }
HTMLDialogElement.prototype.showModal = function () { this.open = true }

describe('note search', () => {
  it.each(['secret note', 'BODY SENTINEL', 'research'])('matches %s and opens a note hidden by library filters', (query) => {
    const stamp = '2022-07-01T09:00:00.000Z'
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'one', title: 'Secret note', body: '<p>Body sentinel</p>', tags: ['research'], pinned: false, createdAt: stamp, updatedAt: stamp },
      { id: 'two', title: 'Other note', body: '', tags: ['work'], pinned: false, createdAt: stamp, updatedAt: stamp },
    ]))
    localStorage.setItem('essentia-dictum-documents', JSON.stringify([{ title: 'Other app sentinel' }]))
    renderApp()
    click(buttonNamed('#work'))
    type($<HTMLInputElement>('#search'), 'Other')
    expect(rowTitles()).toEqual(['Other note'])
    click($('.ui-search-trigger'))
    type($<HTMLInputElement>('dialog input'), 'Other app sentinel')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    type($<HTMLInputElement>('dialog input'), query)
    click($('dialog button[role="option"]'))
    expect($<HTMLInputElement>('#search').value).toBe('')
    expect(rowTitles()).toContain('Secret note')
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('Secret note')
    expect(document.activeElement).toBe($('#note-title'))
  })
})

it('preserves an uncommitted tag draft while search takes focus', () => {
  const stamp = '2022-07-01T09:00:00.000Z'
  localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'one', title: 'Note', body: '', tags: ['saved'], pinned: false, createdAt: stamp, updatedAt: stamp }]))
  renderApp()
  const field = $<HTMLInputElement>('.tags-field input')
  type(field, 'draft tag')
  field.focus()
  const before = localStorage.getItem(STORAGE_KEY)
  act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })))
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  click($('dialog button[aria-label="Close"]'))
  expect(field.value).toBe('draft tag')
  expect(document.activeElement).toBe(field)
  act(() => $('.ui-search-trigger').focus())
  click($('.ui-search-trigger'))
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
})
