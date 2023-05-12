import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setLocale } from '@essentia/ui'
import { STORAGE_KEY } from '../data/storage'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit, taskTexts, type, unmount } from './testing'

setupApp()

// A fixed clock, so 'overdue' does not depend on the day the suite runs.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2023, 4, 12, 9))
})
afterEach(() => {
  vi.useRealTimers()
  act(() => setLocale('en-GB'))
})

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { text: string; due: string }[]
const addDue = () => $<HTMLInputElement>('#add-due-date')
const toggle = () => $<HTMLButtonElement>('.add__due-toggle')

/** jsdom cannot hold a half-typed date, so the field reports one the way a browser does. */
function makePartial(input: HTMLInputElement) {
  Object.defineProperty(input, 'validity', { configurable: true, value: { badInput: true } })
}

function reload() {
  unmount()
  renderApp()
}

describe('a due date while adding a task', () => {
  it('opens from a toggle under the add field and saves the date with the task', () => {
    renderApp()
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(document.querySelector('#add-due-date')).toBeNull()

    click(buttonNamed('Add due date'))
    expect(toggle().getAttribute('aria-expanded')).toBe('true')
    expect(toggle().getAttribute('aria-controls')).toBe('add-due')
    expect(document.querySelector('label[for="add-due-date"]')?.textContent).toBe('Due date')

    type(addDue(), '2023-06-01')
    expect(toggle().textContent).toBe('Due 1 Jun')
    addTask('Pay rent')

    expect(taskTexts()).toEqual(['Pay rent'])
    expect($('.task time').getAttribute('datetime')).toBe('2023-06-01')
    expect(stored()).toMatchObject([{ text: 'Pay rent', due: '2023-06-01' }])
    // The form starts over: no date carries into the next task.
    expect(toggle().textContent).toBe('Add due date')
    expect(toggle().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe($('#add-task'))
  })

  it('adds an undated task when no date is chosen, as before', () => {
    renderApp()
    addTask('Someday')
    click(buttonNamed('Add due date'))
    addTask('Still someday')
    expect(stored()).toMatchObject([{ due: '' }, { due: '' }])
    expect(document.querySelector('.task time')).toBeNull()
  })

  it('keeps a chosen date when the toggle closes, and clears it on request', () => {
    renderApp()
    click(buttonNamed('Add due date'))
    type(addDue(), '2023-06-01')
    click(toggle())
    expect(toggle().textContent).toBe('Due 1 Jun')

    click(toggle())
    click(buttonNamed('Clear date'))
    expect(addDue().value).toBe('')
    expect(document.activeElement).toBe(addDue())
    expect(toggle().textContent).toBe('Add due date')
    addTask('Undated after all')
    expect(stored()).toMatchObject([{ due: '' }])
  })

  it('refuses a partly typed date with a message tied to the field', () => {
    renderApp()
    click(buttonNamed('Add due date'))
    makePartial(addDue())
    addTask('Half a date')

    expect(taskTexts()).toEqual([])
    expect(addDue().getAttribute('aria-invalid')).toBe('true')
    expect(addDue().getAttribute('aria-describedby')).toBe('add-due-date-error')
    expect($('#add-due-date-error').textContent).toBe('Enter a full date, or clear it.')
    expect($('#add-due-date-error').getAttribute('role')).toBe('alert')
    expect(document.activeElement).toBe(addDue())
    expect($<HTMLInputElement>('#add-task').value).toBe('Half a date')

    click(buttonNamed('Clear date'))
    expect(document.querySelector('#add-due-date-error')).toBeNull()
    Reflect.deleteProperty(addDue(), 'validity')
    submit($<HTMLFormElement>('form.add'))
    expect(taskTexts()).toEqual(['Half a date'])
    expect(stored()).toMatchObject([{ due: '' }])
  })

  it('drops a refused partial date and its message when the toggle closes', () => {
    renderApp()
    click(buttonNamed('Add due date'))
    makePartial(addDue())
    addTask('Half a date')
    expect(document.querySelector('#add-due-date-error')).not.toBeNull()

    click(toggle())
    click(toggle())
    expect(document.querySelector('#add-due-date-error')).toBeNull()
    expect(addDue().getAttribute('aria-invalid')).toBe('false')
    expect(() => buttonNamed('Clear date')).toThrow()
  })

  it('accepts a past date and shows the task as overdue before and after reload', () => {
    renderApp()
    click(buttonNamed('Add due date'))
    type(addDue(), '2023-05-11')
    addTask('Late already')
    expect($('.task__due--over').textContent).toBe('Overdue · 11 May')

    reload()
    expect($('.task__due--over').textContent).toBe('Overdue · 11 May')
  })

  it('shows a task due today as due, not overdue, after reload', () => {
    renderApp()
    click(buttonNamed('Add due date'))
    type(addDue(), '2023-05-12')
    addTask('Today')
    reload()
    expect(document.querySelector('.task__due--over')).toBeNull()
    expect($('.task__meta time').textContent).toBe('12 May')
  })
})

describe('changing a due date later', () => {
  const editorDue = () => $<HTMLInputElement>('form.editor input[type="date"]')

  it('changes and clears the date in the editor, and the change survives reload', () => {
    renderApp()
    click(buttonNamed('Add due date'))
    type(addDue(), '2023-06-01')
    addTask('Pay rent')

    click(buttonNamed('Edit “Pay rent”'))
    type(editorDue(), '2023-06-05')
    submit($<HTMLFormElement>('form.editor'))
    reload()
    expect($('.task time').getAttribute('datetime')).toBe('2023-06-05')

    click(buttonNamed('Edit “Pay rent”'))
    click(buttonNamed('Clear date'))
    expect(editorDue().value).toBe('')
    submit($<HTMLFormElement>('form.editor'))
    reload()
    expect(document.querySelector('.task time')).toBeNull()
    expect(stored()).toMatchObject([{ text: 'Pay rent', due: '' }])
  })

  it('offers Clear date only once there is a date to clear', () => {
    renderApp()
    addTask('Undated')
    click(buttonNamed('Edit “Undated”'))
    expect(() => buttonNamed('Clear date')).toThrow()
    type(editorDue(), '2023-06-01')
    expect(buttonNamed('Clear date')).toBeTruthy()
  })

  it('refuses a partly typed date and keeps the editor open', () => {
    renderApp()
    addTask('Keep my date')
    click(buttonNamed('Edit “Keep my date”'))
    makePartial(editorDue())
    submit($<HTMLFormElement>('form.editor'))

    expect(document.querySelector('form.editor')).not.toBeNull()
    expect(editorDue().getAttribute('aria-invalid')).toBe('true')
    const errorId = editorDue().getAttribute('aria-describedby')!
    expect(document.getElementById(errorId)?.textContent).toBe('Enter a full date, or clear it.')
    expect(document.activeElement).toBe(editorDue())
  })

  it('still loads undated tasks saved before due dates could be set on creation', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'a', text: 'Old task', completed: false, category: 'General', due: '' }]),
    )
    renderApp()
    expect(taskTexts()).toEqual(['Old task'])
    expect(document.querySelector('.task time')).toBeNull()
  })
})

describe('in Portuguese', () => {
  it('labels the toggle, the clear button and the message', () => {
    renderApp()
    act(() => setLocale('pt-PT'))
    click(buttonNamed('Adicionar data limite'))
    makePartial(addDue())
    addTask('Meia data')
    expect($('#add-due-date-error').textContent).toBe('Indique uma data completa ou limpe-a.')
    expect(buttonNamed('Limpar data')).toBeTruthy()
  })
})
