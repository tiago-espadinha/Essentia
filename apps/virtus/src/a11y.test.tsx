import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import type { Habit } from './habits'
import { STORAGE_KEY } from './storage'
import { $, addHabit, buttonNamed, click, renderApp, setupApp, submit, type } from './testing'

setupApp()

// jsdom has no layout or computed colours, so contrast is checked in the browser
// by the design critique instead. The whole body, so open dialogs are included.
async function seriousViolations(): Promise<string[]> {
  const { violations } = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
}

function seed() {
  const base = { createdAt: '2022-08-01T08:00:00.000Z', days: [], unit: '', target: null }
  const habits: Partial<Habit>[] = [
    { name: 'Stretch', category: 'Health', log: { '2022-08-13': 1, '2022-08-14': 1, '2022-08-15': 1 } },
    { name: 'Read', category: 'Learning', unit: 'pages', target: 20, log: { '2022-08-14': 12 } },
    { name: 'Call home', category: 'Social', days: [0], log: {} },
  ]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(habits.map((habit, index) => ({ ...base, id: `h${index}`, ...habit }))))
}

describe('accessibility', () => {
  it('has no serious violations in the empty state', async () => {
    renderApp()
    expect(await seriousViolations()).toEqual([])
  })

  it('has no serious violations with the add error shown', async () => {
    renderApp()
    submit($<HTMLFormElement>('form.add'))
    expect(await seriousViolations()).toEqual([])
  })

  it.each(['Today', 'Streaks', 'Week', 'Stats'])('has no serious violations in %s with habits', async (view) => {
    seed()
    renderApp()
    click(buttonNamed(view))
    expect(await seriousViolations()).toEqual([])
  })

  it('has no serious violations in Stats without habits', async () => {
    renderApp()
    click(buttonNamed('Stats'))
    expect(await seriousViolations()).toEqual([])
  })

  it('has no serious violations when a search matches nothing', async () => {
    seed()
    renderApp()
    type($<HTMLInputElement>('#search'), 'swim')
    expect(await seriousViolations()).toEqual([])
  })

  it('has no serious violations in a habit’s stats', async () => {
    seed()
    renderApp()
    click(buttonNamed('Stats for “Read”'))
    expect(await seriousViolations()).toEqual([])
  })

  it('has no serious violations while editing', async () => {
    seed()
    renderApp()
    click(buttonNamed('Edit “Stretch”'))
    expect(await seriousViolations()).toEqual([])
  })

  it('has no serious violations with the undo notice shown', async () => {
    renderApp()
    addHabit('Gone')
    click(buttonNamed('Delete “Gone”'))
    expect(await seriousViolations()).toEqual([])
  })
})
