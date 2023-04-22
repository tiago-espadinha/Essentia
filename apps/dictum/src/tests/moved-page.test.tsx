import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { setLocale } from '@essentia/ui'
import { MovedPage } from '../components/MovedPage'
import { DOCS_KEY } from '../data/storage'
import './testing'

afterEach(() => {
  document.body.innerHTML = ''
  document.documentElement.lang = 'en-GB'
  localStorage.clear()
})

function render() {
  const container = document.body.appendChild(document.createElement('div'))
  const root = createRoot(container)
  act(() => root.render(<MovedPage />))
  return container
}

describe('the Dictum page', () => {
  it('says Dictum is part of Folio and links there, leaving this device’s documents in place', () => {
    const saved = JSON.stringify([{ id: '16fd2706-8baf-433b-82eb-8c7fada847da', title: 'Essay', content: '# Essay' }])
    localStorage.setItem(DOCS_KEY, saved)
    const page = render()
    expect(page.querySelectorAll('h1')).toHaveLength(1)
    expect(page.querySelector('h1')?.textContent).toBe('Dictum is now part of Folio.')
    expect(page.querySelector('main a')?.getAttribute('href')).toBe('/folio/')
    expect(page.querySelector('textarea, input')).toBeNull()
    expect(document.title).toBe('Dictum is now part of Folio · Essentia')
    expect(localStorage.getItem(DOCS_KEY)).toBe(saved)
  })

  it('switches to Portuguese', () => {
    const page = render()
    act(() => { setLocale('pt-PT') })
    expect(page.querySelector('h1')?.textContent).toBe('O Dictum faz agora parte do Folio.')
    expect(page.querySelector('main a')?.textContent).toBe('Abrir o Folio')
  })
})
