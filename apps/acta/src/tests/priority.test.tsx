import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '@essentia/ui'
import { STORAGE_KEY } from '../data/storage'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit, unmount } from './testing'

setupApp()
afterEach(() => act(() => setLocale('en-GB')))

const stored = () => JSON.parse(localStorage.getItem(STORAGE_KEY)!) as { text: string; priority: string }[]
const addPriority = () => $<HTMLSelectElement>('#add-priority')
const editorPriority = () => $<HTMLSelectElement>('form.editor select')
const rowPriority = () => document.querySelector('.task__priority')?.textContent ?? null

function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

function labelOf(select: HTMLSelectElement) {
  return document.querySelector(`label[for="${select.id}"]`)?.textContent
}

function reload() {
  unmount()
  renderApp()
}

describe('task priority', () => {
  it('offers None, Low, Medium and High under a Priority label, starting at None', () => {
    renderApp()
    expect(labelOf(addPriority())).toBe('Priority')
    expect([...addPriority().options].map((option) => option.textContent)).toEqual(['None', 'Low', 'Medium', 'High'])
    expect(addPriority().value).toBe('none')
  })

  it('saves the chosen level with a new task, names it in words on the row, and starts over', () => {
    renderApp()
    choose(addPriority(), 'high')
    addTask('File taxes')
    expect(rowPriority()).toBe('High priority')
    expect(stored()).toMatchObject([{ text: 'File taxes', priority: 'high' }])
    expect(addPriority().value).toBe('none')

    addTask('Water plants')
    expect(stored()).toMatchObject([{ text: 'Water plants', priority: 'none' }, { priority: 'high' }])
    // None shows no label: only the first row carries one.
    expect(document.querySelectorAll('.task__priority')).toHaveLength(1)
  })

  it('changes and clears the level in the editor, and keeps it after reload', () => {
    renderApp()
    addTask('Book dentist')
    expect(rowPriority()).toBeNull()

    click(buttonNamed('Edit “Book dentist”'))
    expect(labelOf(editorPriority())).toBe('Priority')
    expect(editorPriority().value).toBe('none')
    choose(editorPriority(), 'medium')
    submit($<HTMLFormElement>('form.editor'))
    expect(rowPriority()).toBe('Medium priority')
    reload()
    expect(rowPriority()).toBe('Medium priority')

    click(buttonNamed('Edit “Book dentist”'))
    expect(editorPriority().value).toBe('medium')
    choose(editorPriority(), 'none')
    submit($<HTMLFormElement>('form.editor'))
    expect(rowPriority()).toBeNull()
    reload()
    expect(rowPriority()).toBeNull()
    expect(stored()).toMatchObject([{ priority: 'none' }])
  })

  it('loads tasks saved before priorities at None', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ id: 'a', text: 'Old task', completed: false, category: 'General', due: '' }]))
    renderApp()
    expect(rowPriority()).toBeNull()
    click(buttonNamed('Edit “Old task”'))
    expect(editorPriority().value).toBe('none')
  })

  it('reads in Portuguese', () => {
    renderApp()
    act(() => setLocale('pt-PT'))
    expect(labelOf(addPriority())).toBe('Prioridade')
    expect([...addPriority().options].map((option) => option.textContent)).toEqual(['Nenhuma', 'Baixa', 'Média', 'Alta'])
    choose(addPriority(), 'low')
    addTask('Regar plantas')
    expect(rowPriority()).toBe('Prioridade baixa')
  })
})
