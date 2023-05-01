import { setLocale } from '@essentia/ui'
import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { BUDGETS_KEY, RECURRING_KEY } from '../data/storage'
import { fakeServer, settle } from './fakeServer'
import { buttonNamed, click, renderApp, setupApp, text, type, unmount, $ } from './testing'

setupApp()

function quickAdd(line: string) {
  const field = $<HTMLInputElement>('#add-transaction')
  type(field, line)
  act(() => field.form!.requestSubmit())
}

const shelf = () => document.querySelector('[aria-labelledby="badges-title"]')
const badgeEl = (name: string) =>
  [...document.querySelectorAll('.badge')].find((badge) => badge.querySelector('.badge__name')?.textContent === name)
const earnedNames = () => [...document.querySelectorAll('.badge:not(.badge--locked) .badge__name')].map((b) => b.textContent)

const budgetRow = (user: string) => ({ user_id: user, category: 'food', amount: 200, updated_at: '2022-11-01T08:00:00Z', deleted_at: null })

describe('finance badges', () => {
  it('shows no shelf for an empty account', async () => {
    await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
    click(buttonNamed('Insights'))
    expect(text()).toContain('Not enough data yet.')
    expect(shelf()).toBeNull()
  })

  it('closes the Insights figures with every badge, what it asks for and how far along it is', async () => {
    const server = fakeServer()
    server.budgets.push(budgetRow('ana'))
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    quickAdd('Coffee €3.50')
    click(buttonNamed('Insights'))
    const sections = [...document.querySelectorAll('.insight')].map((section) => section.getAttribute('aria-labelledby'))
    expect(sections).toEqual(['month-title', 'periods-title', 'badges-title', 'data-title'])
    expect(shelf()!.querySelector('.section-row')!.textContent).toBe('Badges2 of 8')
    expect(earnedNames()).toEqual(['First entry', 'First budget'])
    expect(badgeEl('First entry')!.textContent).toBe('First entryRecord your first transaction, earned')
    expect(badgeEl('Keeping count')!.textContent).toBe('Keeping countRecord 50 transactions, not earned yet1 of 50')
    expect(badgeEl('Three months running')!.querySelector('.badge__progress')!.textContent).toBe('1 of 3 months')
    expect(badgeEl('In the black')!.querySelector('.badge__progress')).toBeNull()
  })

  it('waits for budgets and recurring items before showing badges', async () => {
    const server = fakeServer()
    server.budgets.push(budgetRow('ana'))
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    quickAdd('Coffee €3.50')
    await settle()
    unmount()
    // The device still holds the transaction, so Insights opens before the account is read again.
    localStorage.removeItem(BUDGETS_KEY)
    localStorage.removeItem(RECURRING_KEY)
    server.slow(5000)
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    click(buttonNamed('Insights'))
    expect(text()).toContain('Spending by category')
    expect(shelf()).toBeNull()
    await settle()
    await settle()
    expect(earnedNames()).toEqual(['First entry', 'First budget'])
  })

  it('follows the account that is signed in', async () => {
    const server = fakeServer()
    server.budgets.push(budgetRow('ana'))
    const device = server.client({ user: { id: 'ana' } })
    await renderApp(device.client)
    quickAdd('Coffee €3.50')
    await settle()
    await device.signInAs('ben')
    quickAdd('Tea €2.00')
    click(buttonNamed('Insights'))
    expect(earnedNames()).toEqual(['First entry'])
    expect(text()).not.toContain('Coffee')
  })

  it('reads in Portuguese', async () => {
    act(() => { setLocale('pt-PT') })
    try {
      await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
      quickAdd('Café €3.50')
      click(buttonNamed('Análise'))
      expect(shelf()!.querySelector('.section-row')!.textContent).toBe('Distintivos1 de 8')
      expect(earnedNames()).toEqual(['Primeiro registo'])
      expect(badgeEl('Três meses seguidos')!.querySelector('.badge__progress')!.textContent).toBe('1 de 3 meses')
    } finally {
      act(() => { setLocale('en-GB') })
    }
  })
})
