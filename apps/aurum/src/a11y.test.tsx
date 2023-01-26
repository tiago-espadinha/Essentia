import axe from 'axe-core'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, type } from './testing'

setupApp()

// Moderate findings fail too; minor ones are best-practice notes. jsdom has no layout
// or computed colours, so contrast is checked in the browser by the design critique
// instead. The whole body, so open dialogs are included. axe waits on real timers,
// so the test's fixed clock is put back once it is done.
async function violations(): Promise<string[]> {
  const now = Date.now()
  vi.useRealTimers()
  try {
    const { violations } = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } })
    return violations
      .filter((violation) => violation.impact !== 'minor')
      .map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)
  } finally {
    vi.useFakeTimers({ now })
  }
}

async function signedIn() {
  const server = fakeServer()
  await renderApp(server.client({ user: { id: 'ana' } }).client)
  return server
}

function quickAdd(line: string) {
  const field = $<HTMLInputElement>('#add-transaction')
  type(field, line)
  act(() => field.form!.requestSubmit())
}

function choose(id: string, value: string) {
  act(() => {
    const select = $<HTMLSelectElement>(`#${id}`)
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function pick(content: string) {
  const input = $<HTMLInputElement>('#import-file')
  Object.defineProperty(input, 'files', { value: [new File([content], 'bank.csv', { type: 'text/csv' })], configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

async function withTransactions() {
  await signedIn()
  quickAdd('+Salary €2100')
  quickAdd('Rent €900 housing')
  quickAdd('Lunch €12 food')
}

describe('accessibility', () => {
  it('has no violations when no account service is set up', async () => {
    await renderApp(null)
    expect(await violations()).toEqual([])
  })

  it('has no violations at the sign-in gate', async () => {
    await renderApp(fakeServer().client(null).client)
    expect(await violations()).toEqual([])
  })

  it('has no violations on an empty account', async () => {
    await signedIn()
    expect(await violations()).toEqual([])
  })

  it('has no violations when a line cannot be read', async () => {
    await signedIn()
    quickAdd('Coffee')
    expect(await violations()).toEqual([])
  })

  it('has no violations in the list, filtered and matching nothing', async () => {
    await withTransactions()
    expect(await violations()).toEqual([])
    choose('filter-category', 'housing')
    expect(await violations()).toEqual([])
    type($<HTMLInputElement>('#search'), 'swim')
    expect(await violations()).toEqual([])
  })

  it('has no violations in the edit dialog, with and without errors', async () => {
    await withTransactions()
    click(buttonNamed('Edit “Lunch”'))
    expect(await violations()).toEqual([])
    type($<HTMLInputElement>('#edit-description'), '')
    click(buttonNamed('Save'))
    expect(await violations()).toEqual([])
  })

  it('has no violations with the undo notice', async () => {
    await withTransactions()
    click(buttonNamed('Delete “Lunch”'))
    expect(await violations()).toEqual([])
  })

  it('has no violations when the sync fails', async () => {
    const server = await signedIn()
    server.fail(true)
    await settle(() => quickAdd('Lunch €12 food'))
    expect(await violations()).toEqual([])
  })

  it('has no violations when the device refuses to save', async () => {
    await signedIn()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('full')
    })
    quickAdd('Lunch €12 food')
    expect(await violations()).toEqual([])
  })

  it('has no violations in the account menu', async () => {
    await signedIn()
    click(buttonNamed('Account'))
    expect(await violations()).toEqual([])
  })

  it('has no violations in insights, empty and with the chart', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    expect(await violations()).toEqual([])
    click(buttonNamed('Transactions'))
    quickAdd('Rent €900 housing')
    click(buttonNamed('Insights'))
    await act(async () => {
      await import('./MonthBars')
    })
    expect(document.querySelector('.month-chart svg')).not.toBeNull()
    expect(await violations()).toEqual([])
  })

  it('has no violations after an import, done and refused', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    await pick('date,type,description,category,amount\n2022-11-02,income,Salary,salary,2100\n2022-11-04,expense,Gift,,abc\n')
    expect(await violations()).toEqual([])
    await pick('not,a,bank,file\n')
    expect(await violations()).toEqual([])
  })

  it('has no violations in the plan, empty and with errors', async () => {
    await withTransactions()
    click(buttonNamed('Plan'))
    await settle()
    expect(await violations()).toEqual([])
    act(() => $<HTMLFormElement>('.budget-form').requestSubmit())
    act(() => $<HTMLFormElement>('.recurring-form').requestSubmit())
    expect(await violations()).toEqual([])
  })

  it('has no violations with budgets and recurring items', async () => {
    await withTransactions()
    click(buttonNamed('Plan'))
    await settle()
    type($<HTMLInputElement>('#budget-category'), 'food')
    type($<HTMLInputElement>('#budget-amount'), '10')
    act(() => $<HTMLFormElement>('.budget-form').requestSubmit())
    type($<HTMLInputElement>('#recurring-description'), 'Rent')
    type($<HTMLInputElement>('#recurring-amount'), '900')
    type($<HTMLInputElement>('#recurring-category'), 'housing')
    act(() => $<HTMLFormElement>('.recurring-form').requestSubmit())
    expect($('#budgets-title').closest('section')!.textContent).toContain('food')
    expect($('#recurring-title').closest('section')!.querySelector('.row')!.textContent).toContain('Rent')
    expect(await violations()).toEqual([])
  })
})
