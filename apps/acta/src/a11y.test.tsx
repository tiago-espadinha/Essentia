import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { STORAGE_KEY } from './storage'
import { $, addTask, buttonNamed, click, renderApp, setupApp, submit } from './testing'

setupApp()

// jsdom has no layout or computed colours, so contrast is checked in the browser
// by the design critique instead.
async function seriousViolations(container: HTMLElement): Promise<string[]> {
  const { violations } = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } })
  return violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
}

describe('accessibility', () => {
  it('has no serious violations in the empty state', async () => {
    expect(await seriousViolations(renderApp())).toEqual([])
  })

  it('has no serious violations with a list, a done task and categories', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: '1', text: 'Sketch', completed: false, category: 'Design', due: '2000-01-01' },
        { id: '2', text: 'Ship', completed: true, category: 'Work', due: '' },
      ]),
    )
    expect(await seriousViolations(renderApp())).toEqual([])
  })

  it('has no serious violations in the filtered empty state', async () => {
    const container = renderApp()
    addTask('Open')
    click(buttonNamed('Done'))
    expect(await seriousViolations(container)).toEqual([])
  })

  it('has no serious violations while editing', async () => {
    const container = renderApp()
    addTask('Draft')
    click(buttonNamed('Edit “Draft”'))
    expect(await seriousViolations(container)).toEqual([])
  })

  it('has no serious violations with the undo notice shown', async () => {
    const container = renderApp()
    addTask('Gone')
    click(buttonNamed('Delete “Gone”'))
    expect(await seriousViolations(container)).toEqual([])
  })

  it('has no serious violations with the add error shown', async () => {
    const container = renderApp()
    submit($<HTMLFormElement>('form.add'))
    expect(await seriousViolations(container)).toEqual([])
  })
})
