import { describe, expect, it } from 'vitest'
import { EMPTY_FORM, formOf, readForm, type HabitForm } from './habitForm'

describe('habit form', () => {
  it('reads a yes/no daily habit', () => {
    expect(readForm({ ...EMPTY_FORM, name: 'Stretch', days: [1] })).toEqual({
      draft: { name: 'Stretch', category: '', days: [], unit: '', target: null },
    })
  })

  it('reads a numeric habit on some days', () => {
    const form: HabitForm = { ...EMPTY_FORM, name: 'Read', everyDay: false, days: [1, 3], numeric: true, unit: 'pages', target: '20' }
    expect(readForm(form)).toEqual({
      draft: { name: 'Read', category: '', days: [1, 3], unit: 'pages', target: 20 },
    })
    expect(readForm({ ...form, days: [1], target: ' ' })).toMatchObject({ draft: { target: null } })
  })

  it('drops numeric settings when the habit is yes/no', () => {
    expect(readForm({ ...EMPTY_FORM, name: 'Walk', unit: 'km', target: '5' })).toMatchObject({ draft: { unit: '', target: null } })
  })

  it('reports each missing or invalid field', () => {
    expect(readForm({ ...EMPTY_FORM, everyDay: false, numeric: true, target: '-2' })).toEqual({
      errors: {
        name: 'Name the habit first.',
        days: 'Pick at least one day.',
        unit: 'Name the unit, like pages or minutes.',
        target: 'Use a number above zero, or leave it empty.',
      },
    })
    expect(readForm({ ...EMPTY_FORM, name: 'Read', numeric: true, unit: 'pages', target: 'ten' })).toMatchObject({
      errors: { target: expect.any(String) },
    })
  })

  it('fills the form from a habit', () => {
    const habit = {
      id: 'a',
      name: 'Read',
      category: 'Learning',
      createdAt: '2022-08-15T08:00:00.000Z',
      days: [],
      unit: 'pages',
      target: 20,
      log: {},
    }
    expect(formOf(habit)).toEqual({
      name: 'Read',
      category: 'Learning',
      everyDay: true,
      days: [],
      numeric: true,
      unit: 'pages',
      target: '20',
    })
  })
})
