import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { $, buttonNamed, click, habitNames, renderApp, setupApp, type } from './testing'

setupApp()
HTMLDialogElement.prototype.close = function () { this.open = false }

describe('habit search', () => {
  it.each(['hidden habit', 'LEARNING'])('finds %s from a summary view and focuses its check-in', (query) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'hidden', name: 'Hidden habit', category: 'Learning', createdAt: '2022-08-01T08:00:00.000Z', days: [], unit: '', target: null, log: {} },
    ]))
    renderApp()
    click(buttonNamed('Week'))
    expect(document.querySelector('.habit__name')).toBeNull()
    click($('.ui-search-trigger'))
    type($<HTMLInputElement>('dialog input'), query)
    click($('dialog button[role="option"]'))
    expect(habitNames()).toContain('Hidden habit')
    expect(document.activeElement).toBe($('.habit__check'))
    expect(buttonNamed('Today').getAttribute('aria-current')).toBeTruthy()
  })
})
