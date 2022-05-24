import { describe, expect, it, vi } from 'vitest'
import { STORAGE_KEY } from './storage'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit, taskTexts, unmount } from './testing'

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
