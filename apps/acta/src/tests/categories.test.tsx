import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit, taskTexts, type } from './testing'

setupApp()

const categoryOf = (text: string) =>
  [...document.querySelectorAll('.task')].find((row) => row.querySelector('.task__text')?.textContent === text)
    ?.querySelector('.task__tag')?.textContent

function seed(tasks: { text: string; category: string; completed?: boolean }[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(tasks.map((task, index) => ({ id: String(index + 1), completed: false, due: '', ...task }))),
  )
  renderApp()
}

describe('choosing a category while adding', () => {
  it('files the task under the typed category, reusing the spelling in use, then resets', () => {
    seed([{ text: 'Review', category: 'Work' }])
    const input = $<HTMLInputElement>('#add-category')
    expect(input.placeholder).toBe('General')
    expect([...document.querySelectorAll('#add-categories option')].map((option) => option.getAttribute('value'))).toEqual(['Work'])

    type(input, '  work ')
    addTask('Ship')
    expect(categoryOf('Ship')).toBe('Work')
    expect(input.value).toBe('')

    addTask('Water plants')
    expect(categoryOf('Water plants')).toBe('General')
  })

  it('collapses spaces in a new category name', () => {
    renderApp()
    type($<HTMLInputElement>('#add-category'), ' Deep    work ')
    addTask('Write')
    expect(categoryOf('Write')).toBe('Deep work')
  })
})

describe('filtering by category', () => {
  it('lists spellings that differ only in case as one chip that finds them all', () => {
    seed([
      { text: 'One', category: 'work' },
      { text: 'Two', category: 'WORK' },
      { text: 'Three', category: 'Home' },
    ])
    expect([...document.querySelectorAll('.chip')].map((chip) => chip.textContent)).toEqual(['Any', 'Home', 'work'])
    click(buttonNamed('work'))
    expect(taskTexts()).toEqual(['One', 'Two'])
  })

  it('keeps the filter when a task moves between spellings of its category', () => {
    seed([
      { text: 'One', category: 'Work' },
      { text: 'Two', category: 'Work' },
      { text: 'Three', category: 'Home' },
    ])
    click(buttonNamed('Work'))
    click(buttonNamed('Edit “One”'))
    type(document.querySelector<HTMLInputElement>('.editor input[list]')!, 'WORK')
    submit($<HTMLFormElement>('form.editor'))
    expect(taskTexts()).toEqual(['One', 'Two'])
    expect(categoryOf('One')).toBe('Work')
  })
})
