import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type } from './testing'

setupApp()

async function signedIn() {
  await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
  click(buttonNamed('Plan'))
}

function addRecurring(description: string, amount: string, firstOn: string) {
  type($<HTMLInputElement>('#recurring-description'), description)
  type($<HTMLInputElement>('#recurring-amount'), amount)
  type($<HTMLInputElement>('#recurring-category'), 'housing')
  type($<HTMLInputElement>('#recurring-date'), firstOn)
  act(() => $<HTMLFormElement>('.recurring-form').requestSubmit())
}

const rows = () => [...$('#recurring-title').closest('section')!.querySelectorAll('.row')].map((row) => row.textContent)
const status = () => $('#recurring-title').closest('section')!.querySelector('p[role="status"]')!.textContent

describe('recurring items', () => {
  it('starts with none', async () => {
    await signedIn()
    expect(text()).toContain('Nothing recurring yet.')
    expect($<HTMLInputElement>('#recurring-date').value).toBe('2022-11-08')
    expect($<HTMLSelectElement>('#recurring-frequency').value).toBe('monthly')
  })

  it('adds an item that posts what has fallen due on the next sync', async () => {
    await signedIn()
    addRecurring('Rent', '900', '2022-09-30')
    expect(status()).toBe('Rent added. What has fallen due posts with the next sync.')
    expect(document.activeElement).toBe($('#recurring-description'))
    expect(rows()).toEqual(['RentMonthlyNext Nov 30housingExpense −€900.00Pause “Rent”Delete “Rent”'])
    await settle()
    click(buttonNamed('Transactions'))
    expect([...document.querySelectorAll('.row__description')].map((p) => p.textContent)).toEqual(['Rent', 'Rent'])
  })

  it('says when a future item first posts', async () => {
    await signedIn()
    addRecurring('Gym', '30', '2022-12-01')
    expect(status()).toBe('Gym added, first on Dec 1.')
    expect(rows()[0]).toContain('Next Dec 1')
  })

  it('pauses, resumes and deletes an item', async () => {
    await signedIn()
    addRecurring('Rent', '900', '2022-12-01')
    click(buttonNamed('Pause “Rent”'))
    expect(rows()[0]).toContain('Paused')
    expect(status()).toBe('Rent paused.')
    click(buttonNamed('Resume “Rent”'))
    expect(rows()[0]).toContain('Next Dec 1')
    click(buttonNamed('Delete “Rent”'))
    expect(text()).toContain('Nothing recurring yet.')
    expect(status()).toBe('Rent deleted. What it already posted stays.')
  })

  it('refuses a first day more than a year back', async () => {
    await signedIn()
    addRecurring('Rent', '900', '0202-11-08')
    expect($('#recurring-date-error').textContent).toBe('Choose a day from Nov 8, 2021 on.')
    expect(document.activeElement).toBe($('#recurring-date'))
    expect(rows()).toEqual([])
    type($<HTMLInputElement>('#recurring-date'), '2021-11-08')
    act(() => $<HTMLFormElement>('.recurring-form').requestSubmit())
    expect(rows()).toHaveLength(1)
  })

  it('says what is missing', async () => {
    await signedIn()
    addRecurring('', 'x', '')
    expect($('#recurring-description-error').textContent).toBe('Describe the transaction.')
    expect($('#recurring-amount-error').textContent).toBe('Enter an amount above zero, like 3.50.')
    expect($('#recurring-date-error').textContent).toBe('Choose a date.')
    expect(document.activeElement).toBe($('#recurring-description'))
    expect(rows()).toEqual([])
  })
})
