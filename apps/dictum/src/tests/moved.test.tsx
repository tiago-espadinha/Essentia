import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { DOCS_KEY, MOVED_KEY, VERSIONS_KEY } from '../data/storage'
import { renderApp, setupApp } from './testing'

const stamp = '2022-10-20T09:00:00.000Z'
const doc = (id: string, title: string) => ({ id, title, content: `# ${title}`, folder: '', tags: [], createdAt: stamp, updatedAt: stamp })
const movedDoc = doc('16fd2706-8baf-433b-82eb-8c7fada847da', 'Moved essay')
const keptDoc = doc('886313e1-3b8a-4372-9b90-0c9aee199e5d', 'Still here')
const movedVersion = { id: 'v1', docId: movedDoc.id, title: 'Moved essay', content: '# Old', savedAt: stamp }

function seed() {
  localStorage.setItem(DOCS_KEY, JSON.stringify([movedDoc, keptDoc]))
  localStorage.setItem(VERSIONS_KEY, JSON.stringify([movedVersion]))
  localStorage.setItem(MOVED_KEY, JSON.stringify({ schema: 1, imported: {}, moved: [movedDoc.id], skipped: { folio: 0, dictum: 0 } }))
}

const rowTitles = (app: HTMLElement, selector: string) =>
  [...app.querySelectorAll(`${selector} .doc-row__title`)].map((title) => title.textContent)

describe('documents moved to Folio', () => {
  setupApp()

  it('lists them only as links to Folio', () => {
    seed()
    const app = renderApp()
    expect(rowTitles(app, '.docs:not(.moved .docs)')).toEqual(['Still here'])
    expect(rowTitles(app, '.moved')).toEqual(['Moved essay'])
    expect(app.querySelector('.moved h3')?.textContent).toBe('Moved to Folio')
    expect(app.querySelector<HTMLAnchorElement>('.moved a')?.getAttribute('href')).toBe('/folio/')
  })

  it('writes them back unchanged when other documents are edited', () => {
    seed()
    const app = renderApp()
    act(() => app.querySelector<HTMLButtonElement>('.doc-row')!.click())
    const title = app.querySelector<HTMLTextAreaElement>('textarea')!
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    act(() => {
      setValue.call(title, 'Edited')
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const saved = JSON.parse(localStorage.getItem(DOCS_KEY)!)
    expect(saved).toContainEqual(movedDoc)
    expect(saved).toHaveLength(2)
    expect(JSON.parse(localStorage.getItem(VERSIONS_KEY)!)).toContainEqual(movedVersion)
  })

})
