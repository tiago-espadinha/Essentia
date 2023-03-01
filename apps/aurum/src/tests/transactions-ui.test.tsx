import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type } from './testing'

setupApp()

async function signedIn() {
  const server = fakeServer()
  const device = server.client({ user: { id: 'ana' } })
  await renderApp(device.client)
  return { server, device }
}

const addField = () => $<HTMLInputElement>('#add-transaction')
const rows = () => [...document.querySelectorAll('.row')].map((row) => row.querySelector('.row__description')!.textContent)
const amounts = () => [...document.querySelectorAll('.row__amount')].map((cell) => cell.textContent)

function quickAdd(line: string) {
  type(addField(), line)
  act(() => addField().form!.requestSubmit())
}

function field(id: string) {
  return $<HTMLInputElement>(`#${id}`)
}

describe('adding transactions', () => {
  it('starts empty, with the add field as the action', async () => {
    await signedIn()
    expect(text()).toContain('Nothing recorded yet.')
    expect($('.hero__amount').textContent).toBe('€0.00')
  })

  it('adds a line as an expense dated today, clears the field and keeps focus', async () => {
    await signedIn()
    addField().focus()
    quickAdd('Coffee €3.50')
    expect(rows()).toEqual(['Coffee'])
    expect(amounts()).toEqual(['Expense −€3.50'])
    expect(text()).toContain('Nov 8')
    expect(addField().value).toBe('')
    expect(document.activeElement).toBe(addField())
  })

  it('records income with a leading plus and updates the totals', async () => {
    await signedIn()
    quickAdd('+Salary €2100')
    quickAdd('Rent €900 housing')
    expect(rows()).toEqual(['Rent', 'Salary'])
    expect($('.hero__amount').textContent).toBe('€1,200.00')
    expect(text()).toContain('housing')
    expect(document.querySelector('.amount--income.row__amount')?.textContent).toBe('Income +€2,100.00')
  })

  it('explains the format when a line has no amount, and keeps what was typed', async () => {
    await signedIn()
    quickAdd('Coffee')
    expect($('[role="alert"]').textContent).toContain('like “Coffee €3.50”')
    expect(addField().getAttribute('aria-invalid')).toBe('true')
    expect(addField().value).toBe('Coffee')
    expect(rows()).toEqual([])
  })

  it('reaches the account', async () => {
    const { server } = await signedIn()
    quickAdd('Coffee €3.50')
    await settle()
    expect(server.transactions).toMatchObject([{ description: 'Coffee', amount: 3.5, type: 'expense' }])
  })
})

describe('editing a transaction', () => {
  it('changes every field, and focus returns to the row', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    click(buttonNamed('Edit “Coffee”'))
    expect($('dialog').hasAttribute('open')).toBe(true)
    expect(document.activeElement).toBe(field('edit-description'))
    expect(field('edit-amount').value).toBe('3.50')

    type(field('edit-description'), 'Refund')
    type(field('edit-amount'), '12,40')
    click($('input[name="edit-type"][value="income"]'))
    type(field('edit-category'), 'Gifts')
    type(field('edit-date'), '2022-11-01')
    click(buttonNamed('Save'))

    expect(document.querySelector('dialog')).toBeNull()
    expect(rows()).toEqual(['Refund'])
    expect(amounts()).toEqual(['Income +€12.40'])
    expect(text()).toContain('Nov 1')
    expect(text()).toContain('gifts')
    expect(document.activeElement?.id).toMatch(/-edit$/)
  })

  it('shows what to fix and moves to the first field in error', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    click(buttonNamed('Edit “Coffee”'))
    type(field('edit-description'), ' ')
    type(field('edit-amount'), '-2')
    click(buttonNamed('Save'))
    expect($('#edit-description-error').textContent).toBe('Describe the transaction.')
    expect($('#edit-amount-error').textContent).toBe('Enter an amount above zero, like 3.50.')
    expect(field('edit-amount').getAttribute('aria-describedby')).toBe('edit-amount-error')
    expect(document.activeElement).toBe(field('edit-description'))
    expect(rows()).toEqual(['Coffee'])
  })

  it('changes nothing on cancel', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    click(buttonNamed('Edit “Coffee”'))
    type(field('edit-description'), 'Tea')
    click(buttonNamed('Cancel'))
    expect(document.querySelector('dialog')).toBeNull()
    expect(rows()).toEqual(['Coffee'])
  })

  it('closes when a sync removes the transaction being edited', async () => {
    const { server } = await signedIn()
    quickAdd('Coffee €3.50')
    await settle()
    click(buttonNamed('Edit “Coffee”'))
    server.transactions[0].deleted_at = '2022-11-08T12:00:00.000Z'
    server.transactions[0].updated_at = '2022-11-08T12:00:00.000Z'
    await settle(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(rows()).toEqual([])
    expect(document.querySelector('dialog')).toBeNull()
  })
})

describe('deleting a transaction', () => {
  it('removes it at once with an undo, and focus moves to the next row', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    quickAdd('Lunch €12')
    click(buttonNamed('Delete “Lunch”'))
    expect(rows()).toEqual(['Coffee'])
    expect($('.undo').textContent).toContain('Deleted “Lunch”.')
    expect(document.activeElement).toBe(buttonNamed('Edit “Coffee”'))

    click(buttonNamed('Undo'))
    expect(rows()).toEqual(['Lunch', 'Coffee'])
    expect($('.undo').textContent).toBe('')
    expect(document.activeElement).toBe(buttonNamed('Edit “Lunch”'))
  })

  it('moves focus to the add field when the last one goes', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    click(buttonNamed('Delete “Coffee”'))
    expect(text()).toContain('Nothing recorded yet.')
    expect(document.activeElement).toBe(addField())
  })

  it('drops the undo once something new is added', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    click(buttonNamed('Delete “Coffee”'))
    quickAdd('Tea €2')
    expect($('.undo').textContent).toBe('')
  })

  it('sends the deletion to the account', async () => {
    const { server } = await signedIn()
    quickAdd('Coffee €3.50')
    await settle()
    click(buttonNamed('Delete “Coffee”'))
    await settle()
    expect(server.transactions[0].deleted_at).not.toBeNull()
  })
  it('drops the undo when another account signs in straight after', async () => {
    const { device } = await signedIn()
    quickAdd('Coffee €3.50')
    click(buttonNamed('Delete “Coffee”'))
    await device.signInAs('ben')
    expect($('.undo').textContent).toBe('')
  })
})
