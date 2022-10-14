import { describe, expect, it } from 'vitest'
import {
  $,
  blur,
  buttonNamed,
  choose,
  click,
  fieldLabelled,
  newDoc,
  press,
  reload,
  renderApp,
  rowTitles,
  savedDocs,
  setupApp,
  type,
} from './testing'

const folderField = () => fieldLabelled('.doc-fields', 'Folder')
const tagsField = () => fieldLabelled('.doc-fields', 'Tags')
const folderFilter = () => fieldLabelled<HTMLSelectElement>('.filters', 'Folder')
const tagFilter = () => fieldLabelled<HTMLSelectElement>('.filters', 'Tag')
const search = () => $<HTMLInputElement>('#search')

function file(folder: string, tags?: string) {
  type(folderField(), folder)
  blur(folderField())
  if (tags === undefined) return
  type(tagsField(), tags)
  press(tagsField(), 'Enter')
}

describe('organizing documents', () => {
  setupApp()

  it('files a document in a folder with tags, kept after a reload', () => {
    renderApp()
    newDoc('Letter')
    file('  Work   mail ', '#Draft, urgent, draft')
    expect(savedDocs()[0]).toMatchObject({ folder: 'Work mail', tags: ['draft', 'urgent'] })
    expect(tagsField().value).toBe('draft, urgent')
    reload()
    expect(folderField().value).toBe('Work mail')
    expect(tagsField().value).toBe('draft, urgent')
    expect($('.doc-row').textContent).toContain('Work mail')
  })

  it('offers the existing folders when filing', () => {
    renderApp()
    newDoc('One')
    file('Essays')
    newDoc('Two')
    expect([...document.querySelectorAll<HTMLOptionElement>('#folder-options option')].map((o) => o.value)).toEqual([
      'Essays',
    ])
  })

  it('narrows the list by folder, unfiled, tag and search', () => {
    renderApp()
    newDoc('Letter')
    file('Work', 'draft')
    newDoc('Essay', 'On quiet tools')
    file('', 'draft')
    newDoc('Diary')

    choose(folderFilter(), 'Work')
    expect(rowTitles()).toEqual(['Letter'])
    choose(folderFilter(), '')
    expect(rowTitles()).toEqual(['Diary', 'Essay'])
    choose(tagFilter(), 'draft')
    expect(rowTitles()).toEqual(['Essay'])
    choose(folderFilter(), '*')
    choose(tagFilter(), '*')
    type(search(), 'QUIET')
    expect(rowTitles()).toEqual(['Essay'])
  })

  it('says when nothing matches and clears the filters', () => {
    renderApp()
    newDoc('Letter')
    type(search(), 'nothing like this')
    expect($('.list-pane .empty__title').textContent).toBe('Nothing matches.')
    click(buttonNamed('Clear filters'))
    expect(search().value).toBe('')
    expect(rowTitles()).toEqual(['Letter'])
  })

  it('starts a new document in the folder in view and clears the search to show it', () => {
    renderApp()
    newDoc('Letter')
    file('Work')
    choose(folderFilter(), 'Work')
    type(search(), 'Letter')
    newDoc('Memo')
    expect(search().value).toBe('')
    expect(folderFilter().value).toBe('Work')
    expect(rowTitles()).toEqual(['Memo', 'Letter'])
    expect(savedDocs()[0]).toMatchObject({ title: 'Memo', folder: 'Work' })
  })

  it('drops a tag filter once no document has the tag', () => {
    renderApp()
    newDoc('Letter')
    file('', 'draft')
    choose(tagFilter(), 'draft')
    type(tagsField(), '')
    blur(tagsField())
    expect(tagFilter().value).toBe('*')
    expect(tagFilter().disabled).toBe(true)
    expect(rowTitles()).toEqual(['Letter'])
  })
})
