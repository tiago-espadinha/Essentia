import { setLocale } from '@essentia/ui'
import { act } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { readCsv, toCsv } from '../domain/csv'
import { amountText, formatMoney, parseAmount } from '../domain/money'
import { createTransaction, monthLabel, shortDate } from '../domain/transactions'
import { messages } from '../locale'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type } from './testing'

setupApp()
afterEach(() => { act(() => { setLocale('en-GB') }) })

function switchTo(locale: 'en-GB' | 'pt-PT') {
  act(() => { setLocale(locale) })
}

async function signedIn() {
  const server = fakeServer()
  const device = server.client({ user: { id: 'ana' } })
  await renderApp(device.client)
  return server
}

function add(value: string) {
  const input = $<HTMLInputElement>('#add-transaction')
  type(input, value)
  act(() => input.form!.requestSubmit())
}

describe('Merces locale compatibility', () => {
  it('renders EUR and day-first dates using the selected locale without changing input or CSV grammar', () => {
    const fields = { description: 'Café', category: 'food', date: '2022-11-03', type: 'expense' as const, amount: 123456 }
    const transaction = createTransaction(fields)
    const csv = toCsv([transaction])
    for (const locale of ['en-GB', 'pt-PT'] as const) {
      switchTo(locale)
      expect(formatMoney(123456)).toBe(new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(1234.56))
      expect(shortDate(fields.date)).toBe(new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(2022, 10, 3)))
      expect(monthLabel('2022-11')).toBe(new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(2022, 10, 1)))
      expect(['3.50', '3,5', '1,234.56', '1.234,56', '1,234'].map(parseAmount)).toEqual([350, 350, 123456, 123456, 123400])
      expect(amountText(123456)).toBe('1234.56')
      expect(toCsv([transaction])).toBe(csv)
      expect(readCsv(csv)).toEqual({ rows: [fields], skipped: [] })
    }
  })

  it('switches an open invalid edit form without losing its values or focus, then saves unchanged content', async () => {
    const server = await signedIn()
    add('Coffee €3.50')
    click(buttonNamed('Edit “Coffee”'))
    const description = $<HTMLInputElement>('#edit-description')
    const amount = $<HTMLInputElement>('#edit-amount')
    type(description, 'Café da Ana')
    type(amount, '-1')
    click(buttonNamed('Save'))
    expect($('#edit-amount-error').textContent).toBe('Enter an amount above zero, like 3.50.')
    const focused = document.activeElement
    switchTo('pt-PT')
    expect($('dialog').getAttribute('open')).not.toBeNull()
    expect(description.value).toBe('Café da Ana')
    expect(amount.value).toBe('-1')
    expect(document.activeElement).toBe(focused)
    expect($('#edit-amount-error').textContent).toBe('Introduza um montante superior a zero, como 3.50.')
    expect(text()).toContain('Editar transação')
    type(amount, '12,40')
    click(buttonNamed('Guardar'))
    await settle()
    expect(server.transactions).toMatchObject([{ description: 'Café da Ana', amount: 12.4, category: 'other', type: 'expense' }])
    expect($('.row__description').textContent).toBe('Café da Ana')
    expect($('.row__amount').textContent).toContain('12,40')
    click(buttonNamed('Eliminar “Café da Ana”'))
    expect($('.undo').textContent).toContain('“Café da Ana” eliminado.')
    switchTo('en-GB')
    expect($('.undo').textContent).toContain('Deleted “Café da Ana”.')
    click(buttonNamed('Undo'))
    expect($('.row__description').textContent).toBe('Café da Ana')
  })

  it('translates the unavailable-account page', async () => {
    switchTo('pt-PT')
    await renderApp(null)
    expect(text()).toContain('O Merces não está configurado aqui')
  })

  it('translates budget and recurring feedback when switching with a populated plan', async () => {
    await signedIn()
    switchTo('pt-PT')
    add('Café')
    expect($('[role="alert"]').textContent).toContain('Escreva uma descrição')
    expect($<HTMLInputElement>('#add-transaction').value).toBe('Café')
    click(buttonNamed('Planeamento'))
    click(buttonNamed('Definir orçamento'))
    expect($('#budget-category-error').textContent).toBe('Indique a categoria deste limite.')
    type($<HTMLInputElement>('#budget-category'), 'food')
    type($<HTMLInputElement>('#budget-amount'), '150,50')
    click(buttonNamed('Definir orçamento'))
    expect(text()).toContain('Orçamento de food definido para')
    switchTo('en-GB')
    expect(text()).toContain('Budget for food set to €150.50 a month.')
    switchTo('pt-PT')
    type($<HTMLInputElement>('#recurring-description'), 'Renda')
    type($<HTMLInputElement>('#recurring-amount'), '900')
    click(buttonNamed('Adicionar movimento recorrente'))
    expect(text()).toContain('Renda adicionado.')
    switchTo('en-GB')
    expect(text()).toContain('Renda added.')
  })

  it('translates retained CSV failure and skipped-row outcomes without changing machine headers', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    const input = $<HTMLInputElement>('#import-file')
    async function pick(content: string) {
      const file = new File([content], 'bank.csv', { type: 'text/csv' })
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    }
    await pick('when,what\n2022-11-03,Coffee\n')
    switchTo('pt-PT')
    expect($('.data__outcome').textContent).toBe('O ficheiro precisa das colunas date, type, description, category e amount.')
    await pick('date,type,description,category,amount\n2022-11-03,expense,Café,food,3.50\n2022-11-04,expense,Gift,,abc\n')
    expect($('.data__outcome').textContent).toBe('Foi importada 1 transação. Foi ignorada 1 linha:Linha 3: o montante não é superior a zero, como 3.50.')
    switchTo('en-GB')
    expect($('.data__outcome').textContent).toBe('Imported 1 transaction. Skipped 1 row:Row 3: the amount is not one above zero, like 3.50.')
  })

  it('keeps every dictionary interpolation and provides non-empty Portuguese messages', () => {
    for (const [key, value] of Object.entries(messages)) {
      expect(value.trim(), key).not.toBe('')
      expect([...value.matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort(), key)
        .toEqual([...key.matchAll(/\{(\w+)\}/g)].map(x => x[1]).sort())
    }
  })
})
