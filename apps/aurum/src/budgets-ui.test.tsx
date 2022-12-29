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

function setBudget(category: string, amount: string) {
  type($<HTMLInputElement>('#budget-category'), category)
  type($<HTMLInputElement>('#budget-amount'), amount)
  act(() => $<HTMLFormElement>('.budget-form').requestSubmit())
}

const items = () => [...document.querySelectorAll('.budget')].map((item) => item.textContent)

describe('budgets', () => {
  it('starts with none, under this month', async () => {
    await signedIn()
    click(buttonNamed('Plan'))
    expect(buttonNamed('Plan').getAttribute('aria-current')).toBe('page')
    expect($('.insight .section-row').textContent).toContain('November 2022')
    expect(text()).toContain('No budgets yet.')
  })

  it('sets this month’s spending in the category against its limit', async () => {
    await signedIn()
    quickAdd('Groceries €60 food')
    quickAdd('Lunch €50 food')
    quickAdd('Bus €2 transport')
    click(buttonNamed('Plan'))
    setBudget(' Food ', '100')
    setBudget('transport', '40,50')
    expect(items()).toEqual([
      'food€110.00 of €100.00€10.00 overEdit food budgetRemove food budget',
      'transport€2.00 of €40.50€38.50 leftEdit transport budgetRemove transport budget',
    ])
    expect($('.budget .spend__fill').className).toContain('budget__fill--over')
    expect($('[role="status"]:not(.skeleton)').textContent).toBe('Budget for transport set to €40.50 a month.')
    expect(document.activeElement).toBe($('#budget-category'))
  })

  it('changes a limit through Edit, and removes a budget', async () => {
    await signedIn()
    click(buttonNamed('Plan'))
    setBudget('food', '100')
    click(buttonNamed('Edit food budget'))
    expect($<HTMLInputElement>('#budget-category').value).toBe('food')
    expect($<HTMLInputElement>('#budget-amount').value).toBe('100.00')
    expect(document.activeElement).toBe($('#budget-amount'))
    type($<HTMLInputElement>('#budget-amount'), '150')
    act(() => $<HTMLFormElement>('.budget-form').requestSubmit())
    expect(items()).toEqual(['food€0.00 of €150.00€150.00 leftEdit food budgetRemove food budget'])

    click(buttonNamed('Edit food budget'))
    type($<HTMLInputElement>('#budget-category'), 'groceries')
    act(() => $<HTMLFormElement>('.budget-form').requestSubmit())
    expect(items()).toEqual(['groceries€0.00 of €150.00€150.00 leftEdit groceries budgetRemove groceries budget'])

    click(buttonNamed('Remove groceries budget'))
    expect(text()).toContain('No budgets yet.')
    expect(document.activeElement).toBe($('#budget-category'))
  })

  it('says what is missing and keeps what was typed', async () => {
    await signedIn()
    click(buttonNamed('Plan'))
    setBudget('', 'lots')
    expect($('#budget-category-error').textContent).toBe('Name the category this limit is for.')
    expect($('#budget-amount-error').textContent).toBe('Enter a monthly limit, like 200 or 150.50.')
    expect($('#budget-category').getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe($('#budget-category'))
    expect($<HTMLInputElement>('#budget-amount').value).toBe('lots')
    type($<HTMLInputElement>('#budget-category'), 'food')
    expect(document.querySelector('#budget-category-error')).toBeNull()
    expect(items()).toEqual([])
  })
})
