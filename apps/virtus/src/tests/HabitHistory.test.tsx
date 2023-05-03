import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '@essentia/ui'
import { addDays, type Habit } from '../domain/habits'
import { STORAGE_KEY } from '../data/storage'
import { $, buttonNamed, click, renderApp, setupApp, TODAY, unmount } from './testing'

setupApp()
afterEach(() => setLocale('en-GB'))

function store(habit: Partial<Habit>) {
  const base = { id: 'h0', name: 'Read', category: 'General', createdAt: '2022-08-01T08:00:00.000Z', days: [], unit: '', target: null, log: {} }
  localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...base, ...habit }]))
}

/** `count` consecutive days ending today, each with `value(i)`; i = 0 is today. */
const days = (count: number, value: (i: number) => number = () => 1) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [addDays(TODAY, -i), value(i)]))

const openHistory = () => click(buttonNamed(/^Stats for/))
const shownDays = () => [...document.querySelectorAll('.history__entry time')].map((time) => time.getAttribute('datetime'))
const months = () => [...document.querySelectorAll('.history__month-title')].map((title) => title.textContent)

describe('habit history', () => {
  it('says so when a habit has no check-ins', () => {
    store({})
    renderApp()
    openHistory()
    expect($('#history-title').textContent).toBe('History')
    expect($('.history__empty').textContent).toBe('No check-ins yet.')
    expect(document.querySelector('.history__more')).toBeNull()
  })

  it('lists every logged day beyond 30 days, newest first, revealing older batches until the oldest', () => {
    // 130 days: 60 + 60 + 10, from 8 April 2022 to today.
    store({ log: days(130) })
    renderApp()
    openHistory()

    expect($('.history .strip__header').textContent).toContain('130 days logged')
    expect(shownDays()).toHaveLength(60)
    expect(shownDays()[0]).toBe(TODAY)
    expect(months()).toEqual(['August 2022 15 days', 'July 2022 31 days', 'June 2022 30 days'])

    click($('.history__more'))
    expect(shownDays()).toHaveLength(120)
    expect(document.activeElement).toBe($(`#history-day-${addDays(TODAY, -60)}`))

    expect($('.history__more').textContent).toContain('10 more')
    click($('.history__more'))
    expect(shownDays()).toHaveLength(130)
    expect(new Set(shownDays()).size).toBe(130)
    expect(shownDays().at(-1)).toBe('2022-04-08')
    expect(months().at(-1)).toBe('April 2022 23 days')
    expect(document.querySelector('.history__more')).toBeNull()
  })

  it('shows the stored day, the amount and whether the target was met, in words', () => {
    store({ unit: 'pages', target: 10, log: { [TODAY]: 12, '2022-08-14': 9.5, '2021-12-31': 10 } })
    renderApp()
    openHistory()

    const entries = [...document.querySelectorAll('.history__entry')].map((entry) => entry.textContent)
    expect(entries).toEqual(['Mon 15 Aug 12 pages target met', 'Sun 14 Aug 9.5 pages below target', 'Fri 31 Dec 10 pages target met'])
    expect(months()).toEqual(['August 2022 2 days', 'December 2021 1 day'])
  })

  it('marks a yes/no check-in in words and shows an amount without a target as it is', () => {
    store({ log: { [TODAY]: 1 } })
    renderApp()
    openHistory()
    expect($('.history__entry').textContent).toBe('Mon 15 Aug Checked in')
    unmount()

    store({ unit: 'km', log: { [TODAY]: 3.2 } })
    renderApp()
    openHistory()
    expect($('.history__entry').textContent).toBe('Mon 15 Aug 3.2 km')
  })

  it('reads in Portuguese', () => {
    act(() => setLocale('pt-PT'))
    store({ unit: 'páginas', target: 10, log: { [TODAY]: 12, '2022-08-14': 2 } })
    renderApp()
    click($('#habit-h0-stats'))
    expect($('#history-title').textContent).toBe('Histórico')
    expect($('.history .strip__header').textContent).toContain('2 dias registados')
    expect([...document.querySelectorAll('.history__state')].map((state) => state.textContent)).toEqual(['objetivo atingido', 'abaixo do objetivo'])
  })
})
