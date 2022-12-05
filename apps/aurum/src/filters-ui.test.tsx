import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeServer } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type } from './testing'

setupApp()

async function withTransactions() {
  await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
  for (const line of ['+Salary €2100 salary', 'Rent €900 housing', 'Coffee €3.50', 'Groceries €40 food']) {
    type($<HTMLInputElement>('#add-transaction'), line)
    act(() => $<HTMLFormElement>('form.add').requestSubmit())
  }
}

const rows = () => [...document.querySelectorAll('.row__description')].map((cell) => cell.textContent)

function choose(id: string, value: string) {
  const select = $<HTMLSelectElement>(`#${id}`)
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('filtering transactions', () => {
  it('has no filters until there is something to filter', async () => {
    await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
    expect(document.querySelector('[role="search"]')).toBeNull()
  })

  it('shows one type at a time, with the count and net of what is shown', async () => {
    await withTransactions()
    expect(buttonNamed('All').getAttribute('aria-pressed')).toBe('true')
    click(buttonNamed('Expenses'))
    expect(rows()).toEqual(['Groceries', 'Coffee', 'Rent'])
    expect($('.filtered').textContent).toBe('3 of 4 shown · net −€943.50')
    click(buttonNamed('Income'))
    expect(rows()).toEqual(['Salary'])
    expect(buttonNamed('Income').getAttribute('aria-pressed')).toBe('true')
    // The hero keeps the whole balance.
    expect($('.hero__amount').textContent).toBe('€1,156.50')
  })

  it('searches, and narrows by category', async () => {
    await withTransactions()
    type($<HTMLInputElement>('#search'), 'co')
    expect(rows()).toEqual(['Coffee'])
    type($<HTMLInputElement>('#search'), '')
    expect([...$<HTMLSelectElement>('#filter-category').options].map((o) => o.value)).toEqual(['', 'food', 'housing', 'other', 'salary'])
    choose('filter-category', 'housing')
    expect(rows()).toEqual(['Rent'])
  })

  it('narrows by month, named in full', async () => {
    await withTransactions()
    expect([...$<HTMLSelectElement>('#filter-month').options].map((o) => o.textContent)).toEqual(['Any month', 'November 2022'])
    choose('filter-month', '2022-11')
    expect(rows()).toHaveLength(4)
  })

  it('says when nothing matches, and clears the filters on request', async () => {
    await withTransactions()
    type($<HTMLInputElement>('#search'), 'holiday')
    expect(text()).toContain('Nothing matches.')
    click(buttonNamed('Clear filters'))
    expect(rows()).toHaveLength(4)
    expect($<HTMLInputElement>('#search').value).toBe('')
  })

  it('clears the filters when a new transaction is added, so it shows', async () => {
    await withTransactions()
    click(buttonNamed('Income'))
    type($<HTMLInputElement>('#add-transaction'), 'Tea €2')
    act(() => $<HTMLFormElement>('form.add').requestSubmit())
    expect(rows()).toContain('Tea')
    expect(buttonNamed('All').getAttribute('aria-pressed')).toBe('true')
  })

  it('lets a category filter lapse once its last transaction is deleted', async () => {
    await withTransactions()
    choose('filter-category', 'housing')
    click(buttonNamed('Delete “Rent”'))
    expect(rows()).toHaveLength(3)
    expect($<HTMLSelectElement>('#filter-category').value).toBe('')
  })
  it('moves focus to the add field when an edit takes the row out of the filter', async () => {
    await withTransactions()
    click(buttonNamed('Expenses'))
    click(buttonNamed('Edit “Coffee”'))
    click($('input[name="edit-type"][value="income"]'))
    click(buttonNamed('Save'))
    expect(rows()).not.toContain('Coffee')
    expect(document.activeElement).toBe($('#add-transaction'))
  })
})
