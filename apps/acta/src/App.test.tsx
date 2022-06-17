import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from './storage'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit, taskTexts, type, unmount } from './testing'

setupApp()

describe('Acta', () => {
  it('starts with the empty state and no demo tasks', () => {
    renderApp()
    expect($('#empty-title').textContent).toBe('Nothing on the list.')
    expect(taskTexts()).toEqual([])

    click(buttonNamed('Add a task'))
    expect(document.activeElement).toBe($('#add-task'))
  })

  it('adds tasks to the top, clears the input and keeps focus', () => {
    renderApp()
    addTask('First')
    addTask('  Second  ')

    expect(taskTexts()).toEqual(['Second', 'First'])
    expect($<HTMLInputElement>('#add-task').value).toBe('')
    expect(document.activeElement).toBe($('#add-task'))
    expect($('.hero__sub').textContent).toBe('2 tasks · 2 remaining')
  })

  it('refuses an empty task with an inline error', () => {
    renderApp()
    submit($<HTMLFormElement>('form.add'))

    expect(taskTexts()).toEqual([])
    expect($('#add-task').getAttribute('aria-invalid')).toBe('true')
    expect($('#add-task-error').textContent).toBe('Write something first.')
    expect($('#add-task-error').getAttribute('role')).toBe('alert')
  })

  it('announces the error again on each refused submit', () => {
    renderApp()
    submit($<HTMLFormElement>('form.add'))
    const first = $('#add-task-error')
    submit($<HTMLFormElement>('form.add'))

    expect($('#add-task-error')).not.toBe(first)
    expect(first.isConnected).toBe(false)
  })

  it('completes and reopens a task', () => {
    renderApp()
    addTask('Write tests')
    const check = $<HTMLInputElement>('.task__check')
    expect(document.getElementById(check.getAttribute('aria-labelledby')!)?.textContent).toBe('Write tests')

    click(check)
    expect(check.checked).toBe(true)
    expect($('.hero__sub').textContent).toBe('1 task · 0 remaining')
    expect($('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('100')

    click(check)
    expect(check.checked).toBe(false)
  })

  it('deletes a task', () => {
    renderApp()
    addTask('Keep')
    addTask('Drop')
    click(buttonNamed('Delete “Drop”'))

    expect(taskTexts()).toEqual(['Keep'])
  })

  it('keeps tasks after a reload', () => {
    renderApp()
    addTask('Persist me')
    click($('.task__check'))
    unmount()

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toHaveLength(1)
    renderApp()
    expect(taskTexts()).toEqual(['Persist me'])
    expect($<HTMLInputElement>('.task__check').checked).toBe(true)
  })

  it('warns when the list cannot be saved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    renderApp()
    addTask('Unsaved')

    expect($('[role="alert"]').textContent).toMatch(/Couldn’t save on this device/)
    expect(taskTexts()).toEqual(['Unsaved'])
  })
})

describe('editing a task', () => {
  function field(label: string): HTMLInputElement {
    const labelElement = [...document.querySelectorAll('.editor label')].find((l) => l.textContent === label)
    return document.getElementById(labelElement!.getAttribute('for')!) as HTMLInputElement
  }

  it('saves text, category and due date', () => {
    renderApp()
    addTask('Draft')
    click(buttonNamed('Edit “Draft”'))
    expect(document.activeElement).toBe(field('Task'))

    type(field('Task'), 'Final')
    type(field('Category'), 'Design')
    type(field('Due date'), '2999-05-28')
    submit($<HTMLFormElement>('form.editor'))

    expect(taskTexts()).toEqual(['Final'])
    expect(document.activeElement).toBe(buttonNamed('Edit “Final”'))
    expect($('.task__tag').textContent).toBe('Design')
    expect($('time').getAttribute('datetime')).toBe('2999-05-28')
    expect($('time').textContent).toBe('May 28')
  })

  it('marks an open task with a past due date as overdue', () => {
    renderApp()
    addTask('Late')
    click(buttonNamed('Edit “Late”'))
    type(field('Due date'), '2000-01-01')
    submit($<HTMLFormElement>('form.editor'))

    expect($('.task__due--over').textContent).toBe('Overdue · Jan 1')
  })

  it('refuses empty text and keeps the editor open', () => {
    renderApp()
    addTask('Keep me')
    click(buttonNamed('Edit “Keep me”'))
    type(field('Task'), '  ')
    submit($<HTMLFormElement>('form.editor'))

    expect(field('Task').getAttribute('aria-invalid')).toBe('true')
    expect(document.querySelector('.field-error')?.textContent).toBe('A task needs some text.')
  })

  it('cancels with the button or Escape without saving', () => {
    renderApp()
    addTask('Original')
    click(buttonNamed('Edit “Original”'))
    type(field('Task'), 'Changed')
    click(buttonNamed('Cancel'))
    expect(taskTexts()).toEqual(['Original'])
    expect(document.activeElement).toBe(buttonNamed('Edit “Original”'))

    click(buttonNamed('Edit “Original”'))
    type(field('Task'), 'Changed')
    act(() => {
      field('Task').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(document.querySelector('form.editor')).toBeNull()
    expect(taskTexts()).toEqual(['Original'])
    expect(document.activeElement).toBe(buttonNamed('Edit “Original”'))
  })

  it('does not pull focus back to the row when a filter shows it again', () => {
    renderApp()
    addTask('Open')
    click(buttonNamed('Edit “Open”'))
    click(buttonNamed('Cancel'))
    click(buttonNamed('Done'))
    act(() => buttonNamed('All').focus())
    click(buttonNamed('All'))

    expect(document.activeElement).toBe(buttonNamed('All'))
  })

  it('moves focus to the add field when the saved task leaves the filter', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', text: 'Move me', completed: false, category: 'Work', due: '' },
        { id: '2', text: 'Stay', completed: false, category: 'Work', due: '' },
        { id: '3', text: 'Sketch', completed: false, category: 'Design', due: '' },
      ]),
    )
    renderApp()
    click(buttonNamed('Work'))
    click(buttonNamed('Edit “Move me”'))
    type(field('Category'), 'Design')
    submit($<HTMLFormElement>('form.editor'))

    expect(taskTexts()).toEqual(['Stay'])
    expect(document.activeElement).toBe($('#add-task'))
  })
})

describe('filtering tasks', () => {
  function seed() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', text: 'Sketch', completed: false, category: 'Design', due: '' },
        { id: '2', text: 'Ship', completed: true, category: 'Work', due: '' },
        { id: '3', text: 'Review', completed: false, category: 'Work', due: '' },
      ]),
    )
    renderApp()
  }

  it('shows active or done tasks', () => {
    seed()
    click(buttonNamed('Active'))
    expect(taskTexts()).toEqual(['Sketch', 'Review'])
    expect(buttonNamed('Active').getAttribute('aria-pressed')).toBe('true')
    expect($('#list-title').textContent).toBe('Active')

    click(buttonNamed('Done'))
    expect(taskTexts()).toEqual(['Ship'])
  })

  it('combines a category with the status, and toggles the category off', () => {
    seed()
    click(buttonNamed('Work'))
    expect(taskTexts()).toEqual(['Ship', 'Review'])
    expect($('#list-title').textContent).toBe('All · Work')

    click(buttonNamed('Active'))
    expect(taskTexts()).toEqual(['Review'])

    click(buttonNamed('Work'))
    expect(taskTexts()).toEqual(['Sketch', 'Review'])
  })

  it('shows a filtered empty state that resets the filters', () => {
    seed()
    click(buttonNamed('Done'))
    click(buttonNamed('Design'))
    expect(taskTexts()).toEqual([])
    expect($('.empty--filtered .empty__title').textContent).toBe('Nothing matches.')

    click(buttonNamed('Show all tasks'))
    expect(taskTexts()).toEqual(['Sketch', 'Ship', 'Review'])
  })

  it('drops a category filter once only one category is left', () => {
    seed()
    click(buttonNamed('Design'))
    click(buttonNamed('Edit “Sketch”'))
    const category = document.querySelector<HTMLInputElement>('.editor input[list]')!
    type(category, 'Work')
    submit($<HTMLFormElement>('form.editor'))
    expect(document.querySelector('.chip')).toBeNull()

    addTask('New')
    expect($('#list-title').textContent).toBe('All')
    expect(taskTexts()).toEqual(['New', 'Sketch', 'Ship', 'Review'])
  })

  it('drops a category filter when its last task is deleted', () => {
    seed()
    click(buttonNamed('Design'))
    click(buttonNamed('Delete “Sketch”'))
    expect($('#list-title').textContent).toBe('All')
    expect(taskTexts()).toEqual(['Ship', 'Review'])
  })
})
