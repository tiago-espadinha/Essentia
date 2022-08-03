import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { $, newNote, renderApp, setupApp, type, writeBody } from './testing'

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
  it('has no serious violations in the empty library', async () => {
    expect(await seriousViolations(renderApp())).toEqual([])
  })

  it('has no serious violations with formatted notes open in the editor', async () => {
    const container = renderApp()
    newNote('Sourdough')
    writeBody('<h2>Starter</h2><p>Feed it <strong>daily</strong>.</p><ul><li>Flour</li></ul>')
    newNote('Plan')
    expect(await seriousViolations(container)).toEqual([])
  })

  it('has no serious violations when nothing matches the search', async () => {
    const container = renderApp()
    newNote('Sourdough')
    type($<HTMLInputElement>('#search'), 'zzz')
    expect(await seriousViolations(container)).toEqual([])
  })
})
