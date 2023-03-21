import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { DOCS_KEY } from '../data/storage'
import { $, choose, click, fieldLabelled, renderApp, rowTitles, setupApp, titleField, type } from './testing'

setupApp()
HTMLDialogElement.prototype.close = function () { this.open = false }

describe('document search', () => {
  it.each(['hidden document', 'BODY SENTINEL', 'Archive', 'research'])('matches %s and opens a document outside the current filters', (query) => {
    const stamp = '2022-10-01T09:00:00.000Z'
    localStorage.setItem(DOCS_KEY, JSON.stringify([
      { id: 'hidden', title: 'Hidden document', content: '# Body sentinel', folder: 'Archive', tags: ['research'], createdAt: stamp, updatedAt: stamp },
      { id: 'shown', title: 'Visible document', content: '', folder: 'Work', tags: [], createdAt: stamp, updatedAt: stamp },
    ]))
    renderApp()
    choose(fieldLabelled<HTMLSelectElement>('.filters', 'Folder'), 'Work')
    type($<HTMLInputElement>('#search'), 'Visible')
    expect(rowTitles()).toEqual(['Visible document'])
    click($('.ui-search-trigger'))
    type($<HTMLInputElement>('dialog input'), query)
    click($('dialog button[role="option"]'))
    expect($<HTMLInputElement>('#search').value).toBe('')
    expect(rowTitles()).toContain('Hidden document')
    expect(titleField().value).toBe('Hidden document')
    expect(document.activeElement).toBe(titleField())
  })
})

it.each(['Folder', 'Tags'])('preserves uncommitted %s while opening search', (label) => {
  const stamp = '2022-10-01T09:00:00.000Z'
  localStorage.setItem(DOCS_KEY, JSON.stringify([{ id: 'one', title: 'Doc', content: '', folder: '', tags: [], createdAt: stamp, updatedAt: stamp }]))
  renderApp()
  const field = fieldLabelled<HTMLInputElement>('.doc-fields', label)
  type(field, 'draft metadata')
  field.focus()
  const before = localStorage.getItem(DOCS_KEY)
  act(() => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })))
  expect(localStorage.getItem(DOCS_KEY)).toBe(before)
  click($('dialog button[aria-label="Close"]'))
  expect(field.value).toBe('draft metadata')
  expect(document.activeElement).toBe(field)
  act(() => $('.ui-search-trigger').focus())
  click($('.ui-search-trigger'))
  expect(localStorage.getItem(DOCS_KEY)).toBe(before)
})

it('preserves the markdown link shortcut while search remains available in the header', () => {
  const stamp = '2022-10-01T09:00:00.000Z'
  localStorage.setItem(DOCS_KEY, JSON.stringify([{ id: 'one', title: 'Doc', content: 'link text', folder: '', tags: [], createdAt: stamp, updatedAt: stamp }]))
  renderApp()
  const body = $<HTMLTextAreaElement>('#doc-content')
  body.focus()
  body.setSelectionRange(0, 9)
  act(() => body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })))
  expect(document.querySelector('dialog')).toBeNull()
  expect(body.value).toContain('[link text](')
  click($('.ui-search-trigger'))
  expect(document.querySelector('dialog[open]')).not.toBeNull()
})
