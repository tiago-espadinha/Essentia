import { act, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { HashtagChip, HashtagInput } from '../components/HashtagInput'
import { setLocale } from '../domain/locale'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLElement
let root: Root
const onKeyDown = vi.fn()

function Field({ categories }: { categories: string[] }) {
  const [value, setValue] = useState('')
  const ref = useRef<HTMLInputElement>(null)
  return <HashtagInput id="add" inputRef={ref} value={value} onValueChange={setValue} categories={categories}
    maxTag={50} aria-label="New" onKeyDown={onKeyDown} />
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  act(() => root.render(<Field categories={['Work', 'Writing', 'Home', 'Deep work']} />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  onKeyDown.mockReset()
  setLocale('en-GB')
})

const input = () => container.querySelector('input')!
const options = () => [...container.querySelectorAll('[role="option"]')].map((option) => option.textContent)

function type(value: string) {
  act(() => {
    input().focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value)
    input().dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function press(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => { input().dispatchEvent(event) })
  return event
}

it('is a closed combobox until a # word is typed', () => {
  type('Buy milk')
  expect(input().getAttribute('role')).toBe('combobox')
  expect(input().getAttribute('aria-expanded')).toBe('false')
  expect(container.querySelector('[role="listbox"]')).toBeNull()
})

it('suggests categories completing the tag and picks one with the arrows and Enter', () => {
  type('Buy #w')
  expect(input().getAttribute('aria-expanded')).toBe('true')
  expect(container.querySelector('[role="listbox"]')!.getAttribute('aria-label')).toBe('Categories')
  expect(options()).toEqual(['#Work', '#Writing'])
  press('ArrowDown')
  press('ArrowDown')
  expect(input().getAttribute('aria-activedescendant')).toBe('add-tags-1')
  press('ArrowDown')
  expect(input().getAttribute('aria-activedescendant')).toBe('add-tags-0')
  press('ArrowUp')
  const enter = press('Enter')
  expect(enter.defaultPrevented).toBe(true)
  expect(input().value).toBe('Buy #Writing ')
  expect(input().selectionStart).toBe(13)
  expect(container.querySelector('[role="listbox"]')).toBeNull()
  expect(onKeyDown).not.toHaveBeenCalled()
})

it('lets Enter submit when no suggestion is chosen', () => {
  type('Buy #w')
  const enter = press('Enter')
  expect(enter.defaultPrevented).toBe(false)
  expect(onKeyDown).toHaveBeenCalledOnce()
})

it('picks the first suggestion with Tab and spells spaces as underscores', () => {
  type('#de')
  press('Tab')
  expect(input().value).toBe('#Deep_work ')
})

it('closes with Escape until the tag is typed again', () => {
  type('#w')
  expect(press('Escape').defaultPrevented).toBe(true)
  expect(container.querySelector('[role="listbox"]')).toBeNull()
  expect(press('Tab').defaultPrevented).toBe(false)
  type('#wo')
  expect(options()).toEqual(['#Work'])
})

it('picks a suggestion with a tap without losing focus', () => {
  type('Plan #h')
  const option = container.querySelector('[role="option"]')!
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true })
  act(() => { option.dispatchEvent(down) })
  expect(down.defaultPrevented).toBe(true)
  act(() => { option.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  expect(input().value).toBe('Plan #Home ')
  expect(document.activeElement).toBe(input())
})

it('stays closed when nothing completes the tag', () => {
  type('#zz')
  expect(input().getAttribute('aria-expanded')).toBe('false')
})

it('names the target category in a polite live region, in Portuguese too', () => {
  act(() => root.render(<HashtagChip category="Work" />))
  const chip = container.querySelector('p')!
  expect(chip.getAttribute('aria-live')).toBe('polite')
  expect(chip.textContent).toBe('Category: Work')
  setLocale('pt-PT')
  act(() => root.render(<HashtagChip category="Casa" />))
  expect(chip.textContent).toBe('Categoria: Casa')
  act(() => root.render(<HashtagChip category={null} />))
  expect(chip.textContent).toBe('')
})
