import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Search } from '../components/Search'
import { setLocale } from '../domain/locale'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
HTMLDialogElement.prototype.showModal = function () { this.open = true }
HTMLDialogElement.prototype.close = function () { this.open = false }

let container: HTMLElement
let root: Root
function render(element: ReactNode) { act(() => root.render(element)) }
function clickSearch() { act(() => container.querySelector<HTMLButtonElement>('.ui-search-trigger')!.click()) }
function key(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
  act(() => target.dispatchEvent(event))
  return event
}
function query(value: string) {
  const input = container.querySelector('input')!
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const options = () => [...container.querySelectorAll<HTMLElement>('[role="option"]')]

beforeEach(() => {
  document.documentElement.lang = 'en-GB'
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue('Linux x86_64')
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

describe('suite search', () => {
  it('opens from the control and Ctrl+K, focuses input and restores the arbitrary shortcut opener on Escape', () => {
    render(<><input aria-label="Draft" /><Search /></>)
    const draft = container.querySelector('input')!
    draft.focus()
    expect(key('k', { ctrlKey: true }).defaultPrevented).toBe(true)
    const dialog = container.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(document.activeElement).toBe(dialog.querySelector('input'))
    act(() => dialog.dispatchEvent(new Event('cancel', { cancelable: true })))
    expect(container.querySelector('dialog')).toBeNull()
    expect(document.activeElement).toBe(draft)
    clickSearch()
    expect(container.querySelector('dialog')?.open).toBe(true)
  })

  it('uses Cmd+K on macOS and leaves unmodified, composing, repeat and another modal shortcuts alone', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    render(<Search />)
    for (const init of [{}, { ctrlKey: true }, { metaKey: true, isComposing: true }, { metaKey: true, repeat: true }, { metaKey: true, shiftKey: true }]) {
      expect(key('k', init).defaultPrevented).toBe(false)
      expect(container.querySelector('dialog')).toBeNull()
    }
    const other = document.body.appendChild(document.createElement('dialog'))
    other.open = true
    expect(key('k', { metaKey: true }).defaultPrevented).toBe(false)
    other.remove()
    expect(key('k', { metaKey: true }).defaultPrevented).toBe(true)
  })

  it('wraps Tab and Shift+Tab within the dialog, including when no results remain', () => {
    render(<Search />)
    clickSearch()
    const first = container.querySelector<HTMLButtonElement>('dialog button')!
    const last = options().at(-1)!
    act(() => last.focus())
    expect(key('Tab', {}, last).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    expect(key('Tab', { shiftKey: true }, first).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
    query('no matching app')
    const input = container.querySelector('input')!
    input.focus()
    expect(key('Tab', {}, input).defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    key('Tab', { shiftKey: true }, first)
    expect(document.activeElement).toBe(input)
  })

  it('shows canonical navigation for an empty query and searches only supplied live records, selecting by keyboard', () => {
    const onSelect = vi.fn()
    render(<Search sourceLabel="Notes" records={[{ id: 'one', title: 'Orchard', text: 'APPLE #garden' }]} onSelect={onSelect} />)
    clickSearch()
    expect(options().map(item => item.getAttribute('href'))).toEqual(['/', '/folio/', '/acta/', '/virtus/', '/merces/', '/dictum/'])
    expect(container.textContent).not.toContain('Orchard')
    query('apple')
    expect(options().map(item => item.textContent)).toEqual(['Orchard'])
    const input = container.querySelector('input')!
    key('ArrowDown', {}, input)
    expect(input.getAttribute('aria-activedescendant')).toBe(options()[0].id)
    key('Enter', {}, input)
    expect(onSelect).toHaveBeenCalledWith('one')
    expect(container.querySelector('dialog')).toBeNull()
  })

  it('bounds results and keeps navigation available for loading/unavailable sources without leaking supplied records', () => {
    const records = Array.from({ length: 30 }, (_, id) => ({ id: String(id), title: `record ${id}`, text: 'body' }))
    render(<Search sourceLabel="Notes" records={records} />)
    clickSearch()
    query('record')
    expect(options()).toHaveLength(20)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('20 of 30 matching records')
    render(<Search sourceLabel="Notes" records={records} sourceState="loading" />)
    expect(options()).toHaveLength(0)
    expect(container.textContent).toContain('Loading records…')
    render(<Search sourceLabel="Notes" records={records} sourceState="unavailable" />)
    expect(container.textContent).not.toContain('record 0')
    query('')
    expect(options()).toHaveLength(6)
    expect(container.textContent).toContain('Records are unavailable')
  })

  it('closes and clears query/selection on an ownership change and does not persist search data', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem')
    render(<Search sessionKey="A" sourceLabel="Notes" records={[{ id: 'A', title: 'Private A', text: '' }]} />)
    clickSearch()
    query('private')
    expect(container.textContent).toContain('Private A')
    render(<Search sessionKey="B" sourceLabel="Notes" records={[{ id: 'B', title: 'Private B', text: '' }]} />)
    expect(container.querySelector('dialog')).toBeNull()
    clickSearch()
    expect(container.querySelector('input')?.value).toBe('')
    expect(container.textContent).not.toContain('Private A')
    query('private')
    expect(options().map(item => item.textContent)).toEqual(['Private B'])
    expect(write).not.toHaveBeenCalled()
  })

  it('updates from live records, treats markup as text, and localizes the no-results state', () => {
    render(<Search sourceLabel="Notes" records={[]} />)
    clickSearch()
    query('needle')
    expect(container.textContent).toContain('No results. Try another search.')
    render(<Search sourceLabel="Notes" records={[{ id: 'one', title: '<img src=x onerror=alert(1)>', text: 'needle' }]} />)
    expect(options()).toHaveLength(1)
    expect(container.querySelector('img')).toBeNull()
    query('missing')
    act(() => setLocale('pt-PT'))
    expect(container.textContent).toContain('Sem resultados. Tente outra pesquisa.')
  })

  it('starts keyboard navigation at the first result and preserves identity when a neighbouring result disappears', () => {
    const onSelect = vi.fn()
    const records = ['one', 'two', 'three'].map(id => ({ id, title: id, text: 'record' }))
    render(<Search sourceLabel="Notes" records={records} onSelect={onSelect} />)
    clickSearch()
    query('record')
    const input = container.querySelector('input')!
    key('ArrowDown', {}, input)
    expect(options()[0].getAttribute('aria-selected')).toBe('true')
    key('ArrowDown', {}, input)
    expect(options()[1].getAttribute('aria-selected')).toBe('true')
    render(<Search sourceLabel="Notes" records={records.slice(1)} onSelect={onSelect} />)
    expect(options()[0].getAttribute('aria-selected')).toBe('true')
    key('Enter', {}, input)
    expect(onSelect).toHaveBeenCalledWith('two')
  })

  it('does not activate a deleted record or unavailable source, and leaves navigation-only wording on the hub', () => {
    const onSelect = vi.fn()
    const records = [{ id: 'one', title: 'one', text: 'record' }]
    render(<Search sourceLabel="Notes" records={records} onSelect={onSelect} />)
    clickSearch()
    query('record')
    const input = container.querySelector('input')!
    key('ArrowDown', {}, input)
    render(<Search sourceLabel="Notes" records={[{ id: 'two', title: 'Another result', text: 'record' }]} onSelect={onSelect} />)
    expect(input.hasAttribute('aria-activedescendant')).toBe(false)
    key('Enter', {}, input)
    expect(onSelect).not.toHaveBeenCalled()
    render(<Search sourceLabel="Notes" records={records} sourceState="unavailable" onSelect={onSelect} />)
    key('Enter', {}, input)
    expect(onSelect).not.toHaveBeenCalled()
    render(<Search />)
    query('')
    expect(container.querySelector('label')?.textContent).toBe('Find an app')
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Choose an app.')
    expect(container.querySelector('.ui-search-trigger')?.getAttribute('aria-keyshortcuts')).toBe('Control+K')
  })
})
