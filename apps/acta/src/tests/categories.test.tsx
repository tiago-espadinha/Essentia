import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from '../data/storage'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit, taskTexts, type } from './testing'

setupApp()
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true }

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

describe('managing categories', () => {
  const seedThree = () =>
    seed([
      { text: 'Write', category: 'Work' },
      { text: 'Ship', category: 'work', completed: true },
      { text: 'Cook', category: 'Home' },
      { text: 'Misc', category: 'General' },
    ])
  const openManager = () => click(buttonNamed('Categories'))
  const rows = () => [...document.querySelectorAll('.categories__row')].map((row) => row.textContent)
  const nameInput = () => $<HTMLInputElement>('#category-name')

  it('lists every category with its task count; General has no actions', () => {
    seedThree()
    expect(buttonNamed('Categories').getAttribute('aria-expanded')).toBe('false')
    openManager()
    expect(buttonNamed('Categories').getAttribute('aria-expanded')).toBe('true')
    expect(rows()).toEqual([
      'General1 task',
      'Home1 taskRename “Home”Remove “Home”',
      'Work2 tasksRename “Work”Remove “Work”',
    ])
  })

  it('renames a category on all its tasks and the filter follows', () => {
    seedThree()
    click(buttonNamed('Work'))
    openManager()
    click(buttonNamed('Rename “Work”'))
    expect($('#category-title').textContent).toBe('Rename “Work”')
    type(nameInput(), '  Office   hours ')
    expect($('#category-outcome').textContent).toBe('2 tasks move to “Office hours”.')
    click(buttonNamed('Rename'))

    expect(document.querySelector('dialog')).toBeNull()
    expect(categoryOf('Write')).toBe('Office hours')
    expect(categoryOf('Ship')).toBe('Office hours')
    expect($('#list-title').textContent).toBe('All · Office hours')
    expect(taskTexts()).toEqual(['Write', 'Ship'])
    expect(document.activeElement).toBe(buttonNamed('Rename “Office hours”'))
    expect($('.categories__status').textContent).toBe('Tasks filed under “Work” are now under “Office hours”.')
  })

  it('says a rename into an existing category merges, and changes nothing on cancel', () => {
    seedThree()
    openManager()
    click(buttonNamed('Rename “Work”'))
    type(nameInput(), 'HOME')
    expect($('#category-outcome').textContent).toBe('“Home” already exists, so the two become one: 2 tasks move to it.')
    click(buttonNamed('Cancel'))
    expect(categoryOf('Write')).toBe('Work')

    click(buttonNamed('Rename “Work”'))
    type(nameInput(), 'HOME')
    click(buttonNamed('Merge'))
    expect(rows()).toEqual(['General1 task', 'Home3 tasksRename “Home”Remove “Home”'])
    expect(categoryOf('Write')).toBe('Home')
  })

  it.each([
    ['   ', 'Name the category.'],
    [' Work ', 'That is already its name.'],
  ])('refuses the name %j inline and saves nothing', (value, message) => {
    seedThree()
    openManager()
    click(buttonNamed('Rename “Work”'))
    type(nameInput(), value)
    submit($<HTMLFormElement>('dialog form'))
    expect($('#category-error').textContent).toBe(message)
    expect(nameInput().getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(nameInput())
    expect(categoryOf('Write')).toBe('Work')
  })

  it('removes a category by moving its tasks to General, after saying so', () => {
    seedThree()
    click(buttonNamed('Home'))
    openManager()
    click(buttonNamed('Remove “Home”'))
    expect($('#category-outcome').textContent).toBe('1 task moves to General.')
    expect(document.activeElement).toBe(buttonNamed('Cancel'))
    click(buttonNamed('Move and remove'))

    expect(categoryOf('Cook')).toBe('General')
    expect(rows()).toEqual(['General2 tasks', 'Work2 tasksRename “Work”Remove “Work”'])
    expect($('#list-title').textContent).toBe('All')
    expect(document.activeElement).toBe(buttonNamed('Categories'))
  })

  it('keeps the moves after a reload', () => {
    seedThree()
    openManager()
    click(buttonNamed('Rename “Work”'))
    type(nameInput(), 'Office')
    click(buttonNamed('Rename'))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { text: string; category: string }[]
    expect(stored.map((task) => [task.text, task.category])).toEqual([
      ['Write', 'Office'], ['Ship', 'Office'], ['Cook', 'Home'], ['Misc', 'General'],
    ])
  })
})
