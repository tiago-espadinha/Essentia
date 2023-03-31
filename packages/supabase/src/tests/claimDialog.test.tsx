import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaimDialog } from '../components/ClaimDialog'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

// jsdom does not implement native modal behavior; browser checks cover focus trapping.
HTMLDialogElement.prototype.showModal = function () { this.open = true }

let container: HTMLElement
let root: Root

beforeEach(() => {
  container = document.body.appendChild(document.createElement('div'))
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const buttons = () => [...container.querySelectorAll<HTMLButtonElement>('dialog button')]

describe('ClaimDialog', () => {
  it('offers removal by default, as the apps that clear declined work expect', () => {
    act(() => root.render(<ClaimDialog count={2} noun={['habit', 'habits']} email="ana@example.com" onAnswer={() => {}} />))
    expect(buttons().map((button) => button.textContent)).toEqual(['Remove from device', 'Add to account'])
    expect(container.textContent).toContain('or remove them from this device.')
    expect(container.textContent).toContain('Removing can’t be undone.')
  })

  it('can keep declined work on this device instead, and says so before the choice', () => {
    const onAnswer = vi.fn()
    act(() => root.render(<ClaimDialog count={1} noun={['task', 'tasks']} email="ana@example.com" decline="keep" onAnswer={onAnswer} />))
    expect(buttons().map((button) => button.textContent)).toEqual(['Keep on this device', 'Add to account'])
    expect(container.textContent).toContain('or keep it on this device only.')
    expect(container.textContent).toContain('Kept work stays here and comes back when you sign out.')
    expect(container.textContent).not.toContain('can’t be undone')
    act(() => buttons()[0].click())
    expect(onAnswer).toHaveBeenCalledWith(false)
  })

  it('words the keep choice for several items', () => {
    act(() => root.render(<ClaimDialog count={2} noun={['task', 'tasks']} email="ana@example.com" decline="keep" onAnswer={() => {}} />))
    expect(container.textContent).toContain('This device has 2 tasks made while signed out.')
    expect(container.textContent).toContain('or keep them on this device only.')
  })
})
