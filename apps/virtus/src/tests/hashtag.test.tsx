import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { $, addHabit, habitNames, renderApp, setupApp, submit, type, unmount } from './testing'

setupApp()

const input = () => $<HTMLInputElement>('#add-habit')
const chip = () => document.querySelector('.ui-hashtag-chip')!
const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as { name: string; category: string }[]

describe('a #tag in the add field', () => {
  it('files the habit under the tag, reusing a spelling in use, and keeps it after reload', () => {
    renderApp()
    type($<HTMLInputElement>('#add-category'), 'Morning routine')
    addHabit('Stretch')
    type(input(), 'Meditate #MORNING_routine')
    expect(chip().textContent).toBe('Category: Morning routine')
    submit($<HTMLFormElement>('form.add'))
    expect(input().value).toBe('')
    expect(chip().textContent).toBe('')
    expect(stored().map(({ name, category }) => [name, category])).toEqual([
      ['Meditate', 'Morning routine'], ['Stretch', 'Morning routine'],
    ])

    unmount()
    renderApp()
    expect(habitNames()).toEqual(['Meditate', 'Stretch'])
  })

  it('wins over the Category field, and the last tag wins over earlier ones', () => {
    renderApp()
    type($<HTMLInputElement>('#add-category'), 'Health')
    addHabit('Walk #x to #fitness')
    expect(stored()[0]).toMatchObject({ name: 'Walk #x to', category: 'fitness' })
  })

  it('keeps an escaped or over-limit # word as text', () => {
    renderApp()
    addHabit(`Read \\#1 #${'a'.repeat(51)}`)
    expect(stored()[0]).toMatchObject({ name: `Read #1 #${'a'.repeat(51)}`, category: 'General' })
  })

  it('refuses a name that is only a tag', () => {
    renderApp()
    type(input(), '#health')
    submit($<HTMLFormElement>('form.add'))
    expect($('#add-habit-error').textContent).toBe('Name the habit first.')
    expect(stored()).toEqual([])
  })

  it('suggests categories in use while a tag is typed and picks one with the arrows and Enter', () => {
    renderApp()
    type($<HTMLInputElement>('#add-category'), 'Health')
    addHabit('Walk')
    act(() => input().focus())
    type(input(), 'Run #he')
    const key = (name: string) => act(() => { input().dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true })) })
    expect([...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toEqual(['#Health'])
    key('ArrowDown')
    key('Enter')
    expect(input().value).toBe('Run #Health ')
  })
})
