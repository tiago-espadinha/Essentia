import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { NOTES_KEY } from '../data/storage'
import { createNote } from '../domain/notes'
import { buttonNamed, click, renderApp, rowTitles, setupApp } from './testing'

const other = { ...createNote(new Date('2023-04-06T09:00:00Z'), 'b'), title: 'From the other tab' }

function storeFromAnotherTab(key: string) {
  act(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify([other]))
    window.dispatchEvent(new StorageEvent('storage', { key }))
  })
}

describe('notes open in two tabs', () => {
  setupApp()

  it('takes in what another tab stored, so the next change here keeps it', () => {
    renderApp()
    storeFromAnotherTab(NOTES_KEY)
    expect(rowTitles()).toEqual(['From the other tab'])

    click(buttonNamed('New note'))
    const stored = JSON.parse(localStorage.getItem(NOTES_KEY)!) as { title: string }[]
    expect(stored.map((note) => note.title)).toEqual(['', 'From the other tab'])
  })

  it('ignores changes to other keys', () => {
    renderApp()
    storeFromAnotherTab('essentia-dictum-documents')
    expect(rowTitles()).toEqual([])
  })
})
