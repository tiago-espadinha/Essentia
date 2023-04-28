import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeServer } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type } from './testing'

setupApp()

async function withData() {
  await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
  for (const line of ['Groceries €60 food', 'Lunch €12 food', 'Bus €2 transport', '+Salary €2100 salary']) {
    type($<HTMLInputElement>('#add-transaction'), line)
    act(() => $<HTMLFormElement>('form.add').requestSubmit())
  }
  click(buttonNamed('Plan'))
  for (const [category, amount] of [['food', '200'], ['transport', '40']]) {
    type($<HTMLInputElement>('#budget-category'), category)
    type($<HTMLInputElement>('#budget-amount'), amount)
    act(() => $<HTMLFormElement>('.budget-form').requestSubmit())
  }
}

const categories = () =>
  [...document.querySelectorAll('.categories .row')].map((row) => [
    row.querySelector('.row__description')!.textContent,
    row.querySelector('.row__meta')!.textContent,
  ])
const budgets = () => [...document.querySelectorAll('.budget__name')].map((name) => name.textContent)
const nameField = () => $<HTMLInputElement>('#category-name')
const submit = () => act(() => $<HTMLFormElement>('dialog form').requestSubmit())

function choose(id: string, value: string) {
  const select = $<HTMLSelectElement>(`#${id}`)
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('categories', () => {
  it('says when there are none yet', async () => {
    await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
    click(buttonNamed('Plan'))
    expect(text()).toContain('No categories yet.')
  })

  it('lists every category in use with what uses it', async () => {
    await withData()
    expect(categories()).toEqual([
      ['food', '2 transactions · €200.00 budget'],
      ['salary', '1 transaction'],
      ['transport', '1 transaction · €40.00 budget'],
    ])
  })

  it('refuses a blank or unchanged name, saying why', async () => {
    await withData()
    click(buttonNamed('Rename “food”'))
    expect(document.activeElement).toBe(nameField())
    submit()
    expect($('#category-name-error').textContent).toBe('That is already its name.')
    expect(nameField().getAttribute('aria-invalid')).toBe('true')
    type(nameField(), '  ')
    submit()
    expect($('#category-name-error').textContent).toBe('Name the category.')
    expect(categories()[0][0]).toBe('food')
  })

  it('renames a category everywhere, saying what will happen first', async () => {
    await withData()
    click(buttonNamed('Rename “food”'))
    type(nameField(), 'Eating Out')
    expect($('#category-outcome').textContent).toBe('Moves to “eating out”: 2 transactions · €200.00 budget.')
    submit()
    expect(document.querySelector('dialog')).toBeNull()
    expect(categories()[0]).toEqual(['eating out', '2 transactions · €200.00 budget'])
    expect(budgets()).toContain('eating out')
    expect(document.activeElement).toBe(buttonNamed('Rename “eating out”'))
    expect($('.categories [role="status"]').textContent).toBe('Everything filed under “food” is now under “eating out”.')
  })

  it('merges into an existing category, which keeps its own budget', async () => {
    await withData()
    click(buttonNamed('Rename “transport”'))
    type(nameField(), 'food')
    expect($('#category-outcome').textContent).toBe(
      'Moves to “food”: 1 transaction · €40.00 budget. “food” already exists, so the two become one category. “food” keeps its €200.00 budget; the €40.00 budget of “transport” goes.',
    )
    expect(buttonNamed('Merge')).toBeTruthy()
    submit()
    expect(categories()).toEqual([
      ['food', '3 transactions · €200.00 budget'],
      ['salary', '1 transaction'],
    ])
    expect(budgets()).toEqual(['food'])
  })

  it('removes a category by moving its uses, deleting no transaction', async () => {
    await withData()
    click(buttonNamed('Remove “salary”'))
    expect($<HTMLSelectElement>('#category-target').value).toBe('other')
    choose('category-target', 'freelance')
    click(buttonNamed('Move and remove'))
    expect(categories().map(([name]) => name)).toEqual(['food', 'freelance', 'transport'])
    click(buttonNamed('Transactions'))
    expect(document.querySelectorAll('.rows .row')).toHaveLength(4)
  })

  it('keeps a category filter on the renamed category', async () => {
    await withData()
    click(buttonNamed('Transactions'))
    choose('filter-category', 'food')
    click(buttonNamed('Plan'))
    click(buttonNamed('Rename “food”'))
    type(nameField(), 'groceries')
    submit()
    click(buttonNamed('Transactions'))
    expect($<HTMLSelectElement>('#filter-category').value).toBe('groceries')
    expect([...document.querySelectorAll('.row__description')].map((cell) => cell.textContent)).toEqual(['Lunch', 'Groceries'])
  })

  it('leaves everything as it was on Cancel', async () => {
    await withData()
    click(buttonNamed('Remove “food”'))
    click(buttonNamed('Cancel'))
    expect(document.querySelector('dialog')).toBeNull()
    expect(categories()[0][0]).toBe('food')
    expect(document.activeElement).toBe(buttonNamed('Remove “food”'))
  })
})
