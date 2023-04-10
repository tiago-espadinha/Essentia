import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { $, buttonNamed, click, newNote, renderApp, savedNotes, setupApp, type, writeBody } from './testing'

const savedVersions = () => JSON.parse(localStorage.getItem('essentia-notes-versions') ?? '[]')
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))
const versionRows = () => [...document.querySelectorAll('.version__excerpt')].map((element) => element.textContent)

describe('versions in Folio', () => {
  setupApp()

  it('saves a version once typing pauses for 30 seconds', () => {
    vi.useFakeTimers()
    renderApp()
    newNote('Plan')
    writeBody('<p>First draft</p>')
    wait(29_000)
    expect(savedVersions()).toEqual([])
    writeBody('<p>Second draft</p>')
    wait(29_000)
    expect(savedVersions()).toEqual([])
    wait(1_000)
    expect(savedVersions()).toMatchObject([{ title: 'Plan', body: '<p>Second draft</p>', format: 'rich' }])
  })

  it('saves no version for pinning alone', () => {
    vi.useFakeTimers()
    renderApp()
    newNote()
    click(buttonNamed('Pin'))
    wait(30_000)
    expect(savedVersions()).toEqual([])
  })

  it('saves on request and restores a version into the open editor, saving the current state first', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(new Date('2023-04-09T09:00:00'))
    renderApp()
    newNote('Plan')
    writeBody('<p>First draft</p>')
    click(buttonNamed('Versions'))
    expect(document.querySelector('.versions__empty')?.textContent).toBe('No versions yet.')
    click(buttonNamed('Save this version'))
    expect(buttonNamed('This version is saved').disabled).toBe(true)
    click(buttonNamed('Close'))

    vi.setSystemTime(new Date('2023-04-09T09:05:00'))
    writeBody('<p>Second draft</p>')
    type($<HTMLTextAreaElement>('#note-title'), 'Plan, revised')
    click(buttonNamed('Versions'))
    expect(versionRows()).toEqual(['First draft'])
    click(buttonNamed(/^Restore the version from/))

    expect(savedNotes()[0]).toMatchObject({ title: 'Plan', body: '<p>First draft</p>' })
    expect($('.editor__body').innerHTML).toBe('<p>First draft</p>')
    expect($<HTMLTextAreaElement>('#note-title').value).toBe('Plan')
    expect(savedVersions().map((v: { title: string }) => v.title)).toEqual(['Plan, revised', 'Plan'])
    // A pending autosave of the replaced text does not land after the restore.
    wait(30_000)
    expect(savedVersions()).toHaveLength(2)
  })
})
