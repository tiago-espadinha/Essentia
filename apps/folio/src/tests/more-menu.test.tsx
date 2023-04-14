import axe from 'axe-core'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { $, buttonNamed, click, newNote, press, renderApp, savedNotes, setupApp, writeBody } from './testing'

// jsdom applies no media queries, so the More menu and the bar buttons are both
// present here; which one shows at a width is checked in the browser.
const trigger = () => $<HTMLButtonElement>('#more-button')
const menu = () => document.querySelector<HTMLElement>('[role="menu"]')
const items = () => [...document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
const item = (name: string) => items().find((element) => element.textContent === name)!
const focused = () => document.activeElement?.textContent

describe('the More menu in the Folio editor bar', () => {
  setupApp()

  it('is a named menu button that opens on its first item and closes back to itself', () => {
    renderApp()
    newNote('Plan')
    expect(trigger().getAttribute('aria-label')).toBe('More actions')
    expect(trigger().getAttribute('aria-haspopup')).toBe('menu')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(menu()).toBeNull()

    click(trigger())
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    expect(trigger().getAttribute('aria-controls')).toBe(menu()!.id)
    expect(menu()!.getAttribute('aria-labelledby')).toBe('more-button')
    expect(items().map((element) => element.textContent)).toEqual(['Convert to markdown', 'Versions', 'Delete'])
    expect(items().every((element) => element.tabIndex === -1)).toBe(true)
    expect(focused()).toBe('Convert to markdown')

    click(trigger())
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('moves with the arrow keys, Home and End, and Escape returns focus to the trigger', () => {
    renderApp()
    newNote('Plan')
    press(trigger(), 'ArrowDown')
    expect(focused()).toBe('Convert to markdown')
    press(menu()!, 'ArrowDown')
    expect(focused()).toBe('Versions')
    press(menu()!, 'ArrowDown')
    press(menu()!, 'ArrowDown')
    expect(focused()).toBe('Convert to markdown')
    press(menu()!, 'ArrowUp')
    expect(focused()).toBe('Delete')
    press(menu()!, 'Home')
    expect(focused()).toBe('Convert to markdown')
    press(menu()!, 'End')
    expect(focused()).toBe('Delete')

    press(menu()!, 'Escape')
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger())

    press(trigger(), 'ArrowUp')
    expect(focused()).toBe('Delete')
  })

  it('closes on Tab and on a click outside it', () => {
    renderApp()
    newNote('Plan')
    click(trigger())
    press(menu()!, 'Tab')
    expect(menu()).toBeNull()

    click(trigger())
    act(() => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })))
    expect(menu()).toBeNull()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })

  it('opens Versions, whose dialog returns focus to More', () => {
    renderApp()
    newNote('Plan')
    click(trigger())
    click(item('Versions'))
    expect(menu()).toBeNull()
    expect(document.querySelector('#versions-title')?.textContent).toBe('Versions')
    click(buttonNamed('Close'))
    expect(document.querySelector('dialog[open]')).toBeNull()
    expect(document.activeElement).toBe(trigger())
  })

  it('converts as the bar button does, and Cancel returns focus to More', () => {
    renderApp()
    newNote('Plan')
    writeBody('<p>a <strong>word</strong></p>')
    click(trigger())
    click(item('Convert to markdown'))
    expect(document.querySelector('#convert-title')?.textContent).toBe('Convert to markdown?')
    click(buttonNamed('Cancel'))
    expect(document.activeElement).toBe(trigger())
    expect(savedNotes()[0]).toMatchObject({ format: 'rich' })

    click(trigger())
    click(item('Convert to markdown'))
    click(buttonNamed('Convert'))
    expect(savedNotes()[0]).toMatchObject({ format: 'markdown', body: 'a **word**' })
    click(trigger())
    expect(items()[0].textContent).toBe('Convert to rich text')
  })

  it('deletes the note as the bar button does, with the same undo', () => {
    renderApp()
    newNote('Plan')
    click(trigger())
    click(item('Delete'))
    expect(savedNotes()).toEqual([])
    expect(document.body.textContent).toContain('Deleted “Plan”.')
    click(buttonNamed('Undo'))
    expect(savedNotes()).toMatchObject([{ title: 'Plan' }])
  })

  it('has no serious accessibility violations while open', async () => {
    const container = renderApp()
    newNote('Plan')
    click(trigger())
    const { violations } = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
    expect(violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([])
  })
})
