import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { $, buttonNamed, click, renderApp, setupApp, taskTexts, type } from './testing'

setupApp()
HTMLDialogElement.prototype.close = function () { this.open = false }
HTMLDialogElement.prototype.showModal = function () { this.open = true }

function openSearch(query: string) {
  click($('.ui-search-trigger'))
  type($<HTMLInputElement>('dialog input'), query)
}

describe('task search', () => {
  it.each(['hidden task', 'ARCHIVE'])('finds %s outside status/category filters and opens its editor', (query) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'hidden', text: 'Hidden task', category: 'Archive', completed: true, due: '' },
      { id: 'shown', text: 'Visible task', category: 'Work', completed: false, due: '' },
    ]))
    renderApp()
    click(buttonNamed('Active'))
    click(buttonNamed('Work'))
    expect(taskTexts()).toEqual(['Visible task'])
    openSearch(query)
    click($('dialog button[role="option"]'))
    expect(document.querySelector('dialog')).toBeNull()
    expect(buttonNamed('All').getAttribute('aria-pressed')).toBe('true')
    expect($<HTMLInputElement>('#edit-hidden-text').value).toBe('Hidden task')
    expect(document.activeElement?.closest('.task')).toBe($<HTMLInputElement>('#edit-hidden-text').closest('.task'))
  })

  it('does not save an editor draft when opening or dismissing search', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'one', text: 'Saved text', category: 'Work', completed: false, due: '' }]))
    renderApp()
    click(buttonNamed('Edit “Saved text”'))
    const draft = $<HTMLInputElement>('#edit-one-text')
    type(draft, 'Unsaved draft')
    draft.focus()
    const before = localStorage.getItem(STORAGE_KEY)
    act(() => draft.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true })))
    type($<HTMLInputElement>('dialog input'), 'Unsaved draft')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    click($('dialog button[aria-label="Close"]'))
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
    expect(draft.value).toBe('Unsaved draft')
    expect(document.activeElement).toBe(draft)
    openSearch('Saved text')
    click($('dialog button[role="option"]'))
    expect(document.activeElement).toBe(draft)
    expect(draft.value).toBe('Unsaved draft')
    expect(localStorage.getItem(STORAGE_KEY)).toBe(before)
  })
})
