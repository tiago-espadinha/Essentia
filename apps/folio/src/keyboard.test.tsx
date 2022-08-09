import { describe, expect, it } from 'vitest'
import { $, buttonNamed, click, newNote, press, renderApp, setupApp } from './testing'

setupApp()

function toolbarStops(): string[] {
  return [...$('[role="toolbar"]').querySelectorAll('button')]
    .filter((button) => button.tabIndex === 0)
    .map((button) => button.getAttribute('aria-label') ?? '')
}

describe('formatting toolbar', () => {
  it('is one Tab stop, starting at Bold', () => {
    renderApp()
    newNote('x')
    expect(toolbarStops()).toEqual(['Bold'])
  })

  it('moves with the arrow keys, wrapping at both ends', () => {
    renderApp()
    newNote('x')
    buttonNamed('Bold').focus()
    press(buttonNamed('Bold'), 'ArrowRight')
    expect(document.activeElement).toBe(buttonNamed('Italic'))
    expect(toolbarStops()).toEqual(['Italic'])
    press(buttonNamed('Italic'), 'ArrowLeft')
    press(buttonNamed('Bold'), 'ArrowLeft')
    expect(document.activeElement).toBe(buttonNamed('Numbered list'))
    press(buttonNamed('Numbered list'), 'ArrowRight')
    expect(document.activeElement).toBe(buttonNamed('Bold'))
  })

  it('jumps to the ends with Home and End', () => {
    renderApp()
    newNote('x')
    buttonNamed('Bold').focus()
    press(buttonNamed('Bold'), 'End')
    expect(document.activeElement).toBe(buttonNamed('Numbered list'))
    press(buttonNamed('Numbered list'), 'Home')
    expect(document.activeElement).toBe(buttonNamed('Bold'))
  })

  it('leaves other keys alone', () => {
    renderApp()
    newNote('x')
    buttonNamed('Bold').focus()
    press(buttonNamed('Bold'), 'ArrowDown')
    expect(document.activeElement).toBe(buttonNamed('Bold'))
  })

  it('moves the Tab stop to the last button used', () => {
    renderApp()
    newNote('x')
    click(buttonNamed('Quote'))
    expect(toolbarStops()).toEqual(['Quote'])
  })
})
