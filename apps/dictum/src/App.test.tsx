import { describe, expect, it, vi } from 'vitest'
import {
  $,
  buttonNamed,
  click,
  contentField,
  newDoc,
  previewLoaded,
  reload,
  renderApp,
  rowTitles,
  savedDocs,
  setupApp,
  titleField,
  type,
} from './testing'

describe('Dictum', () => {
  setupApp()

  it('starts with an empty state that offers a new document', () => {
    const page = renderApp()
    expect(page.querySelector('.empty__title')?.textContent).toBe('Nothing written yet.')
    expect(page.textContent).toContain('Your document opens here.')
    newDoc()
    expect(document.activeElement).toBe(titleField())
    expect(rowTitles()).toEqual(['Untitled'])
  })

  it('saves the title and text and brings them back after a reload', () => {
    renderApp()
    newDoc('Essay', '# On quiet\n\nTools that step back.')
    expect(savedDocs()).toMatchObject([{ title: 'Essay', content: '# On quiet\n\nTools that step back.' }])
    reload()
    expect(rowTitles()).toEqual(['Essay'])
    expect(titleField().value).toBe('Essay')
    expect(contentField().value).toBe('# On quiet\n\nTools that step back.')
  })

  it('lists the most recently edited document first and keeps the open one open', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2022-10-05T09:00:00Z'))
    renderApp()
    newDoc('First')
    vi.setSystemTime(new Date('2022-10-05T09:05:00Z'))
    newDoc('Second')
    expect(rowTitles()).toEqual(['Second', 'First'])

    click($('.doc-row:not([aria-current])'))
    expect(titleField().value).toBe('First')
    vi.setSystemTime(new Date('2022-10-05T09:10:00Z'))
    type(contentField(), 'Edited')
    // Editing moves it to the top, and it stays the open document.
    expect(rowTitles()).toEqual(['First', 'Second'])
    expect($('.doc-row[aria-current="true"]').textContent).toContain('First')
    expect(titleField().value).toBe('First')
  })

  it('counts words and reading time', () => {
    renderApp()
    newDoc('Count', '# Title\n\n- one two three')
    expect($('.doc-head__stats').textContent).toBe('4 words · 1 min read')
  })

  it('switches between writing and the preview', () => {
    renderApp()
    newDoc('Doc', 'Hello')
    expect($('.panes').dataset.mode).toBe('write')
    click(buttonNamed('Preview'))
    expect($('.panes').dataset.mode).toBe('preview')
    expect(buttonNamed('Preview').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('the preview', () => {
  setupApp()

  it('renders GFM tables, task lists and highlighted code', async () => {
    renderApp()
    newDoc('Doc', '| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n\n```js\nconst x = 1\n```')
    await previewLoaded()
    const preview = $('.preview-pane')
    expect(preview.querySelectorAll('td')).toHaveLength(2)
    expect(preview.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true)
    expect(preview.querySelector('code.hljs .hljs-keyword')?.textContent).toBe('const')
  })

  it('shows raw HTML as text and drops script and unsafe links', async () => {
    renderApp()
    newDoc('Doc', '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[click](javascript:alert(3))')
    await previewLoaded()
    const preview = $('.preview-pane')
    expect(preview.querySelector('script, img')).toBeNull()
    expect(preview.querySelector('a')?.getAttribute('href')).toBe('')
  })

  it('says where the preview will show while the document is empty', async () => {
    renderApp()
    newDoc()
    await previewLoaded()
    expect($('.preview-pane').textContent).toBe('The preview shows here as you write.')
  })
})

describe('on a phone', () => {
  setupApp({ phone: true })

  it('shows the list, then the document with a way back that returns focus to its row', () => {
    renderApp()
    newDoc('Essay')
    expect($('.dictum').dataset.view).toBe('doc')
    click(buttonNamed('Documents'))
    expect($('.dictum').dataset.view).toBe('list')
    expect(document.activeElement).toBe($('.doc-row'))
    click($('.doc-row'))
    expect($('.dictum').dataset.view).toBe('doc')
    expect(document.activeElement).toBe(titleField())
  })
})
