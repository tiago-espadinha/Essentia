import { describe, expect, it } from 'vitest'
import { act } from 'react'
import { STORAGE_KEY } from '../data/storage'
import { $, addTask, renderApp, setupApp, submit, taskTexts, type, unmount } from './testing'

setupApp()

const categoryOf = (text: string) =>
  [...document.querySelectorAll('.task')].find((row) => row.querySelector('.task__text')?.textContent === text)
    ?.querySelector('.task__tag')?.textContent

function seed(tasks: { text: string; category: string }[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(tasks.map((task, index) => ({ id: String(index + 1), completed: false, due: '', ...task }))),
  )
  renderApp()
}

const input = () => $<HTMLInputElement>('#add-task')
const chip = () => document.querySelector('.ui-hashtag-chip')!

describe('a #tag in the add field', () => {
  it('files the task under the tag, reusing a spelling in use, and keeps it after reload', () => {
    seed([{ text: 'Review', category: 'Deep work' }])
    type(input(), 'Read the brief #deep_WORK')
    expect(chip().textContent).toBe('Category: Deep work')
    submit($<HTMLFormElement>('form.add'))
    expect(categoryOf('Read the brief')).toBe('Deep work')
    expect(input().value).toBe('')
    expect(chip().textContent).toBe('')

    unmount()
    renderApp()
    expect(categoryOf('Read the brief')).toBe('Deep work')
  })

  it('wins over the Category field, and the last tag wins over earlier ones', () => {
    renderApp()
    type($<HTMLInputElement>('#add-category'), 'Home')
    addTask('Call #x about #work')
    expect(categoryOf('Call #x about')).toBe('work')
  })

  it('keeps an escaped or mid-word # as text and uses the Category field', () => {
    renderApp()
    type($<HTMLInputElement>('#add-category'), 'Code')
    addTask('Fix C# bug \\#12')
    expect(categoryOf('Fix C# bug #12')).toBe('Code')
  })

  it('refuses a text that is only a tag and saves nothing', () => {
    renderApp()
    type(input(), '#work')
    submit($<HTMLFormElement>('form.add'))
    expect($('#add-task-error').textContent).toBe('Write something first.')
    expect(taskTexts()).toEqual([])
    expect(input().value).toBe('#work')
  })

  it('suggests categories in use while a tag is typed and picks one with Tab', () => {
    seed([{ text: 'A', category: 'Work' }, { text: 'B', category: 'Writing' }, { text: 'C', category: 'Home & garden' }])
    act(() => input().focus())
    type(input(), 'Plan #w')
    expect([...document.querySelectorAll('[role="option"]')].map((option) => option.textContent)).toEqual(['#Work', '#Writing'])
    act(() => { input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })) })
    expect(input().value).toBe('Plan #Work ')
  })
})
