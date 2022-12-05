import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeServer } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type } from './testing'

setupApp()

async function signedIn() {
  await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
}

function quickAdd(line: string) {
  const field = $<HTMLInputElement>('#add-transaction')
  type(field, line)
  act(() => field.form!.requestSubmit())
}

function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const spend = () => [...document.querySelectorAll('.spend__item')].map((item) => item.textContent)
const monthRows = () => [...document.querySelectorAll('.months tbody tr')].map((row) => row.textContent)

describe('insights', () => {
  it('has nothing to show before the first transaction', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    expect(buttonNamed('Insights').getAttribute('aria-current')).toBe('page')
    expect(text()).toContain('Not enough data yet.')
    expect(document.querySelector('#add-transaction')).toBeNull()
    click(buttonNamed('Add a transaction'))
    expect(buttonNamed('Transactions').getAttribute('aria-current')).toBe('page')
    expect(document.activeElement).toBe($('#add-transaction'))
  })

  it('sums this month and splits its spending by category', async () => {
    await signedIn()
    quickAdd('+Salary €2100')
    quickAdd('Rent €900 housing')
    quickAdd('Groceries €60 food')
    quickAdd('Lunch €40 food')
    click(buttonNamed('Insights'))
    expect($('#insight-month').textContent).toContain('November 2022')
    expect($('.insight .hero__stats').textContent).toBe('Income€2,100.00Expenses€1,000.00Net€1,100.00')
    expect(spend()).toEqual(['housing€900.0090%', 'food€100.0010%'])
    expect(monthRows()[0]).toBe('November 2022€2,100.00€1,000.00€1,100.00')
    expect(monthRows()).toHaveLength(6)
    expect(monthRows()[5]).toBe('June 2022€0.00€0.00€0.00')
  })

  it('shows another month on request, and says when it had no expenses', async () => {
    const server = fakeServer()
    server.transactions.push({
      id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
      user_id: 'ana',
      description: 'Bus pass',
      amount: 35,
      type: 'expense',
      category: 'transport',
      occurred_on: '2022-10-03',
      created_at: '2022-10-03T08:00:00.000Z',
      updated_at: '2022-10-03T08:00:00.000Z',
      deleted_at: null,
    })
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    click(buttonNamed('Insights'))
    expect(text()).toContain('No expenses in November 2022.')
    choose($('#insight-month'), '2022-10')
    expect(spend()).toEqual(['transport€35.00100%'])
    expect($('.insight .hero__stats').textContent).toContain('Net−€35.00')
  })
})
