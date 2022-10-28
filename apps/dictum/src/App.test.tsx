import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  $,
  buttonNamed,
  click,
  contentField,
  newDoc,
  press,
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

  it('has no sign-in or sync without a Supabase project', () => {
    const page = renderApp()
    newDoc('Local')
    expect(page.querySelector('#account-button')).toBeNull()
    expect(page.querySelector('.sync-notice')).toBeNull()
    expect(savedDocs().map((doc: { title: string }) => doc.title)).toEqual(['Local'])
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

describe('formatting', () => {
  setupApp()

  it('formats the selection from the toolbar and keeps the result selected', () => {
    renderApp()
    newDoc('Doc', 'make this bold')
    contentField().setSelectionRange(10, 14)
    click(buttonNamed('Bold'))
    expect(contentField().value).toBe('make this **bold**')
    expect(savedDocs()[0].content).toBe('make this **bold**')
    expect([contentField().selectionStart, contentField().selectionEnd]).toEqual([12, 16])
    expect(document.activeElement).toBe(contentField())
  })

  it('turns lines into a list', () => {
    renderApp()
    newDoc('Doc', 'milk\nbread')
    contentField().setSelectionRange(0, 10)
    click(buttonNamed('Bulleted list'))
    expect(contentField().value).toBe('- milk\n- bread')
  })

  it('formats with Ctrl or Cmd shortcuts in the editor', () => {
    renderApp()
    newDoc('Doc', 'word')
    contentField().setSelectionRange(0, 4)
    press(contentField(), 'b', { ctrlKey: true })
    expect(contentField().value).toBe('**word**')
    contentField().setSelectionRange(2, 6)
    press(contentField(), 'i', { metaKey: true })
    expect(contentField().value).toBe('**_word_**')
    press(contentField(), 'b', { ctrlKey: true, shiftKey: true })
    expect(contentField().value).toBe('**_word_**')
  })

  it('is one tab stop whose buttons the arrow keys, Home and End move between', () => {
    renderApp()
    newDoc('Doc')
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('.toolbar button')]
    const stops = () => buttons.filter((button) => button.tabIndex === 0)
    expect(stops()).toEqual([buttons[0]])

    act(() => buttons[0].focus())
    press(buttons[0], 'ArrowRight')
    expect(document.activeElement).toBe(buttons[1])
    expect(stops()).toEqual([buttons[1]])
    press(buttons[1], 'End')
    expect(document.activeElement).toBe(buttons.at(-1))
    press(buttons.at(-1)!, 'ArrowRight')
    expect(document.activeElement).toBe(buttons[0])
    press(buttons[0], 'ArrowLeft')
    expect(document.activeElement).toBe(buttons.at(-1))
    press(buttons.at(-1)!, 'Home')
    expect(document.activeElement).toBe(buttons[0])
  })

  it('names the shortcut of each button that has one', () => {
    renderApp()
    newDoc('Doc')
    expect(buttonNamed('Bold').title).toBe('Bold (Ctrl+B)')
    expect(buttonNamed('Bold').getAttribute('aria-keyshortcuts')).toBe('Control+B Meta+B')
    expect(buttonNamed('Link').title).toBe('Link (Ctrl+K)')
    expect(buttonNamed('Quote').title).toBe('Quote')
    expect(buttonNamed('Quote').hasAttribute('aria-keyshortcuts')).toBe(false)
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

  it('reads a task’s state out as words, since its box can’t be ticked', async () => {
    renderApp()
    newDoc('Doc', '- [x] Outline\n- [ ] Edit')
    await previewLoaded()
    const items = [...$('.preview-pane').querySelectorAll('li')]
    expect(items.map((item) => item.textContent)).toEqual(['Done: Outline', 'To do: Edit'])
    expect(items[0].querySelector('input')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows raw HTML as text and drops script and unsafe links', async () => {
    renderApp()
    newDoc('Doc', '<script>alert(1)</script>\n\n<img src=x onerror="alert(2)">\n\n[click](javascript:alert(3))')
    await previewLoaded()
    const preview = $('.preview-pane')
    expect(preview.querySelector('script, img')).toBeNull()
    expect(preview.querySelector('a')?.getAttribute('href')).toBe('')
  })

  it('opens links out in a new tab without a referrer, and keeps footnotes in the page', async () => {
    renderApp()
    newDoc('Doc', 'See [the site](https://example.com).[^1]\n\n[^1]: A note.')
    await previewLoaded()
    const [out, footnote] = [...$('.preview-pane').querySelectorAll('a')]
    expect(out.getAttribute('target')).toBe('_blank')
    expect(out.getAttribute('rel')).toBe('noopener noreferrer')
    expect(footnote.getAttribute('href')).toMatch(/^#/)
    expect(footnote.hasAttribute('target')).toBe(false)
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
