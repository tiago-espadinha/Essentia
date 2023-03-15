import { act } from 'react'
import { afterEach, expect, it } from 'vitest'
import { setLocale } from '@essentia/ui'
import { STORAGE_KEY } from '../data/storage'
import { formatDue, isIsoDay } from '../domain/tasks'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit, taskTexts, type } from './testing'

setupApp()
afterEach(() => { document.documentElement.lang = 'en-GB' })

it('switches open validation and edits without changing data or losing focus', () => {
  renderApp()
  submit($<HTMLFormElement>('form.add'))
  act(() => setLocale('pt-PT'))
  expect($('#add-task-error').textContent).toBe('Escreva algo primeiro.')
  addTask('General — keep my words')
  const stored = localStorage.getItem(STORAGE_KEY)
  click(buttonNamed('Editar “General — keep my words”'))
  const field = $<HTMLInputElement>('form.editor input')
  type(field, 'Unsaved words')
  field.focus()
  act(() => setLocale('en-GB'))
  expect(document.activeElement).toBe(field)
  expect(field.value).toBe('Unsaved words')
  expect(localStorage.getItem(STORAGE_KEY)).toBe(stored)
  act(() => setLocale('pt-PT'))
  click(buttonNamed('Guardar'))
  expect(taskTexts()).toEqual(['Unsaved words'])
  expect($('.task__tag').textContent).toBe('General')
  click(buttonNamed('Eliminar “Unsaved words”'))
  expect($('[role="status"]').textContent).toBe('Eliminou “Unsaved words”.Anular')
  act(() => setLocale('en-GB'))
  expect($('[role="status"]').textContent).toBe('Deleted “Unsaved words”.Undo')
  click(buttonNamed('Undo'))
  expect(taskTexts()).toEqual(['Unsaved words'])
})

it('localizes leap-day presentation while retaining ISO date validation', () => {
  for (const locale of ['en-GB', 'pt-PT'] as const) {
    setLocale(locale)
    expect(formatDue('2024-02-29')).toBe(new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC', day: 'numeric', month: 'short',
    }).format(new Date('2024-02-29T00:00:00Z')))
    expect(isIsoDay('2024-02-29')).toBe(true)
    expect(isIsoDay('2023-02-29')).toBe(false)
  }
})
