import { describe, expect, it } from 'vitest'
import { $, buttonNamed, click, newNote, renderApp, rowTitles, setupApp, type } from './testing'

setupApp()

function filterToggle() {
  return buttonNamed('Filter')
}

describe('the Filter bar (the Library below 1024 px)', () => {
  it('starts closed and opens on Filter', () => {
    renderApp()
    newNote('A')
    expect(filterToggle().getAttribute('aria-expanded')).toBe('false')
    expect($('#library').hasAttribute('data-open')).toBe(false)
    click(filterToggle())
    expect(filterToggle().getAttribute('aria-expanded')).toBe('true')
    expect($('#library').hasAttribute('data-open')).toBe(true)
  })

  it('stays open while a filter is active, and closing clears it', () => {
    renderApp()
    newNote('Apple')
    newNote('Pear')
    click(filterToggle())
    type($<HTMLInputElement>('#search'), 'app')
    expect(rowTitles()).toEqual(['Apple'])
    click(filterToggle())
    expect($('#library').hasAttribute('data-open')).toBe(false)
    expect($<HTMLInputElement>('#search').value).toBe('')
    expect(rowTitles()).toEqual(['Pear', 'Apple'])
  })

  it('is not offered before there are notes', () => {
    renderApp()
    expect(() => filterToggle()).toThrow()
  })
})
