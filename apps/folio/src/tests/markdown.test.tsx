import { describe, expect, it, vi } from 'vitest'
import { $, buttonNamed, click, press, renderApp, rowTitles, savedNotes, setupApp, type } from './testing'

const source = '# Essay\n\nFirst *draft* with <b>tags</b> and `code`.\n'

function seedDictum() {
  const stamp = '2023-01-12T10:30:00.000Z'
  localStorage.setItem('essentia-dictum-sync', JSON.stringify({ owner: null, deleted: {} }))
  localStorage.setItem('essentia-dictum-documents', JSON.stringify([
    { id: '16fd2706-8baf-433b-82eb-8c7fada847da', title: 'Essay draft', content: source, folder: 'Writing', tags: ['essay'], createdAt: stamp, updatedAt: stamp },
  ]))
}

describe('markdown notes in Folio', () => {
  setupApp()

  it('opens a moved Dictum document as its markdown source, with the markdown toolbar and Write/Preview', () => {
    seedDictum()
    const app = renderApp()
    expect(rowTitles()).toEqual(['Essay draft'])
    expect($('.note-row__preview').textContent).toBe('Essay First draft with <b>tags</b> and code.')
    expect($<HTMLTextAreaElement>('#note-source').value).toBe(source)
    expect(app.querySelector('.editor__body[contenteditable]')).toBeNull()
    expect(buttonNamed('Code block')).toBeTruthy()
    expect(buttonNamed('Underline', { optional: true })).toBeNull()
    expect(buttonNamed('Write').getAttribute('aria-pressed')).toBe('true')
    expect($('.md-panes').dataset.mode).toBe('write')
  })

  it('formats the selection from the toolbar and with Ctrl+B, keeping the format', () => {
    seedDictum()
    renderApp()
    const text = $<HTMLTextAreaElement>('#note-source')
    text.setSelectionRange(16, 21)
    press(text, 'b', { ctrlKey: true })
    expect(savedNotes()[0]).toMatchObject({ format: 'markdown', body: source.replace('draft', '**draft**') })
    text.setSelectionRange(0, 0)
    click(buttonNamed('Quote'))
    expect(savedNotes()[0].body.startsWith('> # Essay')).toBe(true)
  })

  it('makes italic with Ctrl+I and a link with Ctrl+K', () => {
    seedDictum()
    renderApp()
    const text = $<HTMLTextAreaElement>('#note-source')
    const tags = source.indexOf('tags')
    text.setSelectionRange(tags, tags + 4)
    press(text, 'i', { ctrlKey: true })
    expect(savedNotes()[0].body).toBe(source.replace('tags', '_tags_'))
    text.setSelectionRange(2, 7)
    press(text, 'k', { ctrlKey: true })
    expect(savedNotes()[0].body).toBe(source.replace('tags', '_tags_').replace('Essay', '[Essay](url)'))
  })

  it('previews markdown without raw HTML or unsafe links', async () => {
    seedDictum()
    renderApp()
    type($<HTMLTextAreaElement>('#note-source'), '# Title\n\n<img src=x onerror="alert(1)"> [bad](javascript:alert(1)) [ok](https://example.com)\n\n- [x] done')
    click(buttonNamed('Preview'))
    expect($('.md-panes').dataset.mode).toBe('preview')
    // The preview is its own chunk; under a full parallel run its first import can take a while.
    const preview = await vi.waitFor(() => $('.md-preview .prose'), { timeout: 5_000 })
    expect(preview.querySelector('h1')?.textContent).toBe('Title')
    expect(preview.querySelector('img, [onerror]')).toBeNull()
    expect(preview.textContent).toContain('<img src=x onerror="alert(1)">')
    const links = [...preview.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['', 'https://example.com'])
    expect(links[1].getAttribute('rel')).toBe('noopener noreferrer')
    expect(preview.textContent).toContain('Done:')
  })

  it('saves edits to the source exactly as typed and keeps the format', () => {
    seedDictum()
    renderApp()
    const edited = `${source}\n<script>kept as text</script>\n`
    type($<HTMLTextAreaElement>('#note-source'), edited)
    expect(savedNotes()[0]).toMatchObject({ format: 'markdown', body: edited, folder: 'Writing' })
    expect(localStorage.getItem('essentia-dictum-documents')).toContain('First *draft*')
    expect(localStorage.getItem('essentia-dictum-documents')).not.toContain('kept as text')
  })

  it('creates new notes as rich text', () => {
    seedDictum()
    renderApp()
    click(buttonNamed('New note'))
    expect(savedNotes()[0]).toMatchObject({ format: 'rich', folder: '' })
    expect($('.editor__body').getAttribute('contenteditable')).toBe('true')
  })
})
