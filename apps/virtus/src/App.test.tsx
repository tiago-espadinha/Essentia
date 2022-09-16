import { act } from 'react'
import { describe, expect, it } from 'vitest'
import type { Habit } from './habits'
import { STORAGE_KEY } from './storage'
import {
  $,
  addHabit,
  buttonNamed,
  choose,
  click,
  habitNames,
  renderApp,
  setupApp,
  submit,
  TODAY,
  type,
  unmount,
} from './testing'

setupApp()

const saved = (): Habit[] => JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
const section = (id: string) => [...document.querySelectorAll(`[aria-labelledby="${id}"] .habit__name`)].map((n) => n.textContent)
const checkbox = (name: string) =>
  [...document.querySelectorAll<HTMLInputElement>('.habit__check')].find(
    (box) => document.getElementById(box.getAttribute('aria-labelledby')!)?.textContent === name,
  )!

function store(habits: Partial<Habit>[]) {
  const base = { category: 'General', createdAt: '2022-08-01T08:00:00.000Z', days: [], unit: '', target: null, log: {} }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits.map((habit, index) => ({ ...base, id: `h${index}`, name: `Habit ${index}`, ...habit }))))
}

describe('Virtus', () => {
  it('starts with the empty state and no demo habits', () => {
    renderApp()
    expect($('#empty-title').textContent).toBe('No habits yet.')
    expect(habitNames()).toEqual([])
    expect(document.querySelector('[role="progressbar"]')).toBeNull()
  })

  describe('adding', () => {
    it('adds a daily yes/no habit to the top, clears the input and keeps focus', () => {
      renderApp()
      addHabit('Stretch')
      addHabit('  Read  ')

      expect(section('section-due')).toEqual(['Read', 'Stretch'])
      expect($<HTMLInputElement>('#add-habit').value).toBe('')
      expect(document.activeElement).toBe($('#add-habit'))
      expect($('.progress__count').textContent).toBe('0 of 2 done today')
      expect(saved().map((habit) => habit.name)).toEqual(['Read', 'Stretch'])
    })

    it('refuses a habit without a name, again on each submit', () => {
      renderApp()
      submit($<HTMLFormElement>('form.add'))
      const first = $('#add-habit-error')
      submit($<HTMLFormElement>('form.add'))

      expect(habitNames()).toEqual([])
      expect($('#add-habit').getAttribute('aria-invalid')).toBe('true')
      expect($('#add-habit-error').textContent).toBe('Name the habit first.')
      expect($('#add-habit-error')).not.toBe(first)
    })

    it('adds a numeric habit on some days from the options', () => {
      renderApp()
      click(buttonNamed('Options'))
      expect($('.add__options').getAttribute('aria-expanded')).toBe('true')
      choose($<HTMLSelectElement>('#add-schedule'), 'some')
      click($('.days__day[aria-label="Monday"]'))
      click($('.days__day[aria-label="Wednesday"]'))
      choose($<HTMLSelectElement>('#add-kind'), 'amount')
      type($<HTMLInputElement>('#add-unit'), 'pages')
      type($<HTMLInputElement>('#add-target'), '20')
      type($<HTMLInputElement>('#add-category'), 'Learning')
      addHabit('Read')

      expect(saved()[0]).toMatchObject({ name: 'Read', category: 'Learning', days: [1, 3], unit: 'pages', target: 20 })
      expect($('.add__options').getAttribute('aria-expanded')).toBe('false')
      expect($('.habit__meta').textContent).toContain('Mon, Wed')
    })

    it('opens the options to show a settings error', () => {
      renderApp()
      click(buttonNamed('Options'))
      choose($<HTMLSelectElement>('#add-kind'), 'amount')
      click(buttonNamed('Options'))
      addHabit('Read')

      expect(saved()).toEqual([])
      expect($('.add__options').getAttribute('aria-expanded')).toBe('true')
      expect($('#add-unit-error').textContent).toBe('Name the unit, like pages or minutes.')
    })
  })

  describe('checking in', () => {
    it('moves a habit to Done today and back, keeping focus on its checkbox', () => {
      renderApp()
      addHabit('Stretch')
      click(checkbox('Stretch'))

      expect(section('section-due')).toEqual([])
      expect(section('section-done')).toEqual(['Stretch'])
      expect(checkbox('Stretch').checked).toBe(true)
      expect(document.activeElement).toBe(checkbox('Stretch'))
      expect(saved()[0].log).toEqual({ [TODAY]: 1 })
      expect($('.progress__count').textContent).toBe('1 of 1 done today')

      click(checkbox('Stretch'))
      expect(section('section-due')).toEqual(['Stretch'])
      expect(saved()[0].log).toEqual({})
    })

    it('lists habits that are not due today apart, and counts a bonus check-in as done', () => {
      store([{ name: 'Weekend run', days: [0, 6] }, { name: 'Daily' }])
      renderApp()
      expect(section('section-not-due')).toEqual(['Weekend run'])
      expect($('.progress__count').textContent).toBe('0 of 1 done today')

      click(checkbox('Weekend run'))
      expect(section('section-done')).toEqual(['Weekend run'])
      expect($('.progress__count').textContent).toBe('0 of 1 done today')
    })

    it('logs amounts and completes a numeric habit only at its target', () => {
      store([{ name: 'Read', unit: 'pages', target: 20 }])
      renderApp()
      const log = (amount: string) => {
        type($<HTMLInputElement>('#habit-h0-control'), amount)
        submit($<HTMLFormElement>('form.amount'))
      }

      log('12')
      expect(section('section-due')).toEqual(['Read'])
      expect($('.amount__today').textContent).toBe('12 / 20 pages today')
      log('8')
      expect(section('section-done')).toEqual(['Read'])
      expect(saved()[0].log).toEqual({ [TODAY]: 20 })
      expect(document.activeElement).toBe($('#habit-h0-control'))

      click(buttonNamed(/^Clear/))
      expect(saved()[0].log).toEqual({})
    })

    it('adds decimal amounts without float noise', () => {
      store([{ name: 'Run', unit: 'km', target: null }])
      renderApp()
      for (const amount of ['0.1', '0.2']) {
        type($<HTMLInputElement>('#habit-h0-control'), amount)
        submit($<HTMLFormElement>('form.amount'))
      }
      expect(saved()[0].log).toEqual({ [TODAY]: 0.3 })
    })

    it('refuses an amount that is not a positive number', () => {
      store([{ name: 'Read', unit: 'pages', target: null }])
      renderApp()
      type($<HTMLInputElement>('#habit-h0-control'), '-3')
      submit($<HTMLFormElement>('form.amount'))

      expect(saved()[0].log).toEqual({})
      expect($('#habit-h0-amount-error').textContent).toBe('Use a number above zero.')
    })

    it('shows the current streak, with a note at a milestone', () => {
      store([{ name: 'Stretch', log: { '2022-08-12': 1, '2022-08-13': 1, '2022-08-14': 1 } }])
      renderApp()
      expect($('.habit__streak').textContent).toBe('3 day streak · milestone')
      click(checkbox('Stretch'))
      expect($('.habit__streak').textContent).toBe('4 day streak')
    })
  })

  describe('deleting', () => {
    it('removes a habit, moves focus to the next row and undoes the delete in place', () => {
      renderApp()
      addHabit('C')
      addHabit('B')
      addHabit('A')
      click(buttonNamed('Delete “B”'))

      expect(habitNames()).toEqual(['A', 'C'])
      expect(document.activeElement).toBe(checkbox('C'))
      expect($('.undo').textContent).toContain('Deleted “B” and its history.')

      click(buttonNamed('Undo'))
      expect(habitNames()).toEqual(['A', 'B', 'C'])
      expect(saved().map((habit) => habit.name)).toEqual(['A', 'B', 'C'])
      expect(document.activeElement).toBe(checkbox('B'))
      expect($('.undo').textContent).toBe('')
    })

    it('moves focus to the add field when the last habit goes', () => {
      renderApp()
      addHabit('Only')
      click(buttonNamed('Delete “Only”'))
      expect(document.activeElement).toBe($('#add-habit'))
      expect($('#empty-title')).toBeTruthy()
    })
  })

  describe('persistence', () => {
    it('restores habits and check-ins after a reload', () => {
      renderApp()
      addHabit('Stretch')
      click(checkbox('Stretch'))
      unmount()

      renderApp()
      expect(section('section-done')).toEqual(['Stretch'])
    })

    it('says so when the browser refuses to save', () => {
      renderApp()
      const setItem = Storage.prototype.setItem
      Storage.prototype.setItem = () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      }
      try {
        addHabit('Stretch')
      } finally {
        Storage.prototype.setItem = setItem
      }
      expect($('.notice').textContent).toContain('Couldn’t save on this device.')
      expect(habitNames()).toEqual(['Stretch'])
    })
  })
})

describe('editing', () => {
  const dialog = () => document.querySelector('dialog')

  it('edits the settings in a dialog, keeps the check-ins and returns focus', () => {
    store([{ name: 'Read', log: { [TODAY]: 1 } }])
    renderApp()
    click(buttonNamed('Edit “Read”'))

    expect(dialog()?.open).toBe(true)
    expect(document.activeElement).toBe($('#edit-name'))
    expect($<HTMLInputElement>('#edit-name').value).toBe('Read')
    type($<HTMLInputElement>('#edit-name'), 'Read fiction')
    type($<HTMLInputElement>('#edit-category'), 'Learning')
    choose($<HTMLSelectElement>('#edit-schedule'), 'some')
    click($('.days__day[aria-label="Monday"]'))
    submit($<HTMLFormElement>('.dialog__body'))

    expect(dialog()).toBeNull()
    expect(saved()[0]).toMatchObject({ name: 'Read fiction', category: 'Learning', days: [1], log: { [TODAY]: 1 } })
    expect(document.activeElement).toBe($('#habit-h0-edit'))
  })

  it('refuses an empty name and keeps the dialog open', () => {
    store([{ name: 'Read' }])
    renderApp()
    click(buttonNamed('Edit “Read”'))
    type($<HTMLInputElement>('#edit-name'), ' ')
    submit($<HTMLFormElement>('.dialog__body'))

    expect(dialog()?.open).toBe(true)
    expect($('#edit-name-error').textContent).toBe('Name the habit first.')
    expect(saved()[0].name).toBe('Read')
  })

  it('discards changes on Cancel and when the dialog closes with Esc', () => {
    store([{ name: 'Read' }])
    renderApp()
    click(buttonNamed('Edit “Read”'))
    type($<HTMLInputElement>('#edit-name'), 'Changed')
    click(buttonNamed('Cancel'))
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe($('#habit-h0-edit'))

    click(buttonNamed('Edit “Read”'))
    type($<HTMLInputElement>('#edit-name'), 'Changed')
    // The browser fires close after Esc.
    act(() => {
      dialog()!.dispatchEvent(new Event('close'))
    })
    expect(dialog()).toBeNull()
    expect(saved()[0].name).toBe('Read')
  })
})
