import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '@essentia/ui'
import { EMPTY_FORM, readForm } from '../domain/habitForm'
import { addDays, describeDays, formatHabitAmount, shortDate, weekOf } from '../domain/habits'
import { messages } from '../locale'
import { STORAGE_KEY } from '../data/storage'
import { $, addHabit, buttonNamed, choose, click, habitNames, renderApp, setupApp, submit, type } from './testing'

setupApp()
afterEach(() => setLocale('en-GB'))
const locale = (value: 'en-GB' | 'pt-PT') => act(() => { setLocale(value) })

describe('Portuguese habits', () => {
  it('creates, edits, deletes and restores user content without translating stored categories', () => {
    locale('pt-PT')
    renderApp()
    expect($('#empty-title').textContent).toBe('Ainda não há hábitos.')
    addHabit('Read in English')
    expect(habitNames()).toEqual(['Read in English'])
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].category).toBe('General')
    click(buttonNamed('Editar “Read in English”'))
    type($<HTMLInputElement>('#edit-name'), 'Ler mais')
    click(buttonNamed('Guardar'))
    click(buttonNamed('Eliminar “Ler mais”'))
    expect($('.undo').textContent).toContain('«Ler mais» e o respetivo histórico foram eliminados.')
    click(buttonNamed('Anular'))
    expect(habitNames()).toEqual(['Ler mais'])
  })

  it('labels the habit settings', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([
      { id: 'a', name: 'Run', category: 'Fitness', createdAt: '2022-08-02T08:00:00.000Z', days: [], unit: '', target: null, log: {} },
      { id: 'b', name: 'Read', category: 'Learning', createdAt: '2022-08-01T08:00:00.000Z', days: [], unit: '', target: null, log: {} },
    ]))
    locale('pt-PT')
    renderApp()
    click(buttonNamed('Opções'))
    expect($('label[for="add-schedule"]').textContent).toBe('Repete-se')
    expect([...$<HTMLSelectElement>('#add-schedule').options].map((option) => option.text)).toEqual(['Todos os dias', 'Nos dias escolhidos'])
    expect($('label[for="add-kind"]').textContent).toBe('Registar como')
  })

  it('switches existing validation, Undo and editor labels without losing edits or focus', () => {
    renderApp()
    submit($<HTMLFormElement>('form.add'))
    locale('pt-PT')
    expect($('#add-habit-error').textContent).toBe('Dê primeiro um nome ao hábito.')
    addHabit('Read')
    click(buttonNamed('Editar “Read”'))
    const input = $<HTMLInputElement>('#edit-name')
    type(input, 'Unsaved original')
    input.focus()
    locale('en-GB')
    expect(input.value).toBe('Unsaved original')
    expect(document.activeElement).toBe(input)
    expect(buttonNamed('Save')).toBeTruthy()
    click(buttonNamed('Cancel'))
    click(buttonNamed('Delete “Read”'))
    locale('pt-PT')
    expect($('.undo').textContent).toContain('«Read»')
    click(buttonNamed('Anular'))
    expect(habitNames()).toEqual(['Read'])
  })

  it('keeps numeric parsing compatible and formats logged values and calendar labels', () => {
    locale('pt-PT')
    renderApp()
    type($<HTMLInputElement>('#add-habit'), 'Ler')
    click(buttonNamed('Opções'))
    choose($<HTMLSelectElement>('#add-kind'), 'amount')
    type($<HTMLInputElement>('#add-unit'), 'pages')
    type($<HTMLInputElement>('#add-target'), '1.5')
    submit($<HTMLFormElement>('form.add'))
    click($('.habit__log'))
    type($<HTMLInputElement>('#log-amount'), '1,2345')
    submit($<HTMLFormElement>('dialog form'))
    expect($('#log-amount-error').textContent).toBe(`Use um número de 0,01 a ${new Intl.NumberFormat('pt-PT').format(1e6)}.`)
    type($<HTMLInputElement>('#log-amount'), '1,5')
    submit($<HTMLFormElement>('dialog form'))
    expect($('.habit__amount').textContent).toBe('1,5 / 1,5 pages')
    expect($('.habit__log').textContent).toBe('Registar pages em «Ler», 1,5 / 1,5 pages hoje, objetivo atingido')
    expect(readForm({ ...EMPTY_FORM, name: 'Read', numeric: true, unit: 'pages', target: '1,5' })).toHaveProperty('errors.target')
    expect(shortDate('2022-08-15')).toBe(new Intl.DateTimeFormat('pt-PT', { month: 'short', day: 'numeric' }).format(new Date('2022-08-15T12:00:00')))
    expect(describeDays([1, 3])).toBe('seg., qua.')
    expect(weekOf('2022-08-15')[0]).toBe('2022-08-15')
    locale('en-GB')
    expect($('.habit__amount').textContent).toBe('1.5 / 1.5 pages')
    expect(describeDays([1, 3])).toBe('Mon, Wed')
  })

  it('preserves small existing log values in row and week display in both locales', () => {
    const day = new Date()
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      id: 'small', name: 'Small existing log', category: 'General', createdAt: day.toISOString(),
      days: [], unit: 'litres', target: 1e-30, log: { [key]: 1e-30 },
    }]))
    renderApp()
    for (const language of ['en-GB', 'pt-PT'] as const) {
      locale(language)
      click(buttonNamed(language === 'pt-PT' ? 'Hoje' : 'Today'))
      const expected = new Intl.NumberFormat(language, { maximumSignificantDigits: 21, notation: 'scientific' }).format(1e-30)
      expect($('.habit__amount').textContent).toBe(`${expected} / ${expected} litres`)
      click(buttonNamed(language === 'pt-PT' ? 'Semana' : 'Week'))
      expect(document.body.textContent).toContain(expected)
    }
    locale('pt-PT')
    click(buttonNamed('Hoje'))
    click($('#habit-small-stats'))
    expect($('.strip__day').getAttribute('title')).not.toMatch(/^\d{4}-\d{2}-\d{2}:/)
    expect($('.strip__day').getAttribute('title')).toBe(`${shortDate(addDays(key, -29))}: não previsto`)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].log[key]).toBe(1e-30)
  })

  it('keeps finite extreme values compact and nonzero', () => {
    for (const language of ['en-GB', 'pt-PT'] as const) {
      locale(language)
      for (const value of [Number.MIN_VALUE, Number.MAX_VALUE]) {
        const text = formatHabitAmount(value)
        expect(text.length).toBeLessThan(30)
        expect(text).toContain('E')
        expect(text).not.toMatch(/^0(?:E|$)/)
      }
    }
  })

  it('keeps translation interpolations consistent', () => {
    for (const [english, portuguese] of Object.entries(messages)) {
      expect(portuguese.trim()).not.toBe('')
      expect([...portuguese.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()).toEqual([...english.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort())
    }
  })

  it('preserves the displayed precision of small positive targets in both locales', () => {
    renderApp()
    type($<HTMLInputElement>('#add-habit'), 'Tiny target')
    click(buttonNamed('Options'))
    choose($<HTMLSelectElement>('#add-kind'), 'amount')
    type($<HTMLInputElement>('#add-unit'), 'litres')
    type($<HTMLInputElement>('#add-target'), '0.0001')
    submit($<HTMLFormElement>('form.add'))
    expect(document.body.textContent).toContain('0.0001')
    locale('pt-PT')
    expect(document.body.textContent).toContain('0,0001')
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)[0].target).toBe(0.0001)
  })
})
