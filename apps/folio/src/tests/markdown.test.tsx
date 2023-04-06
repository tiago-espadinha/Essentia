import { describe, expect, it } from 'vitest'
import { $, buttonNamed, click, renderApp, rowTitles, savedNotes, setupApp, type } from './testing'

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

  it('opens a moved Dictum document as its markdown source, without the rich toolbar', () => {
    seedDictum()
    const app = renderApp()
    expect(rowTitles()).toEqual(['Essay draft'])
    expect($<HTMLTextAreaElement>('.editor__source').value).toBe(source)
    expect(app.querySelector('.editor__body[contenteditable]')).toBeNull()
    expect(app.querySelector('.toolbar')).toBeNull()
    expect(app.querySelector('.editor__format')?.textContent).toBe('Markdown source')
  })

  it('saves edits to the source exactly as typed and keeps the format', () => {
    seedDictum()
    renderApp()
    const edited = `${source}\n<script>kept as text</script>\n`
    type($<HTMLTextAreaElement>('.editor__source'), edited)
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
