import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, type } from './testing'

setupApp()
HTMLDialogElement.prototype.close = function () { this.open = false }

function search(query = '') {
  click($('.ui-search-trigger'))
  type($<HTMLInputElement>('dialog input'), query)
}

function transaction(id: string, user: string, description: string) {
  return { id: `aaaaaaaa-aaaa-4aaa-8aaa-${id === 'one' ? '000000000001' : '000000000002'}`, user_id: user, description, amount: 3.5, type: 'expense', category: 'food', occurred_on: '2022-11-08',
    created_at: '2022-11-08T08:00:00.000Z', updated_at: '2022-11-08T08:00:00.000Z', deleted_at: null }
}

describe('finance search', () => {
  it.each(['hidden coffee', 'FOOD'])('finds %s outside transaction filters and focuses its row', async (query) => {
    const server = fakeServer()
    server.transactions.push(transaction('one', 'ana', 'Hidden coffee'))
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    click(buttonNamed('Income'))
    expect(document.querySelector('.row__description')).toBeNull()
    search(query)
    click($('dialog button[role="option"]'))
    expect($('.row__description').textContent).toBe('Hidden coffee')
    expect(document.activeElement).toBe(buttonNamed('Edit “Hidden coffee”'))
    expect(buttonNamed('All').getAttribute('aria-pressed')).toBe('true')
  })

  it('offers destinations with unavailable records when signed out', async () => {
    await renderApp(fakeServer().client(null).client)
    search()
    expect($('dialog [role="status"]').textContent).toContain('Records are unavailable')
    expect($('dialog a[href="/merces/"]').textContent).toContain('Merces')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
  })

  it('closes private results on offline transition and offers navigation only on reopening', async () => {
    const server = fakeServer()
    server.transactions.push(transaction('one', 'ana', 'Private coffee'))
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    search('Private')
    expect($('dialog button[role="option"]').textContent).toContain('Private coffee')
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('offline')))
    expect(document.querySelector('dialog')).toBeNull()
    search()
    expect($('dialog [role="status"]').textContent).toContain('Records are unavailable')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    expect($('dialog a[href="/folio/"]')).toBeTruthy()
  })

  it('discards query and private results immediately on account switch and sign-out', async () => {
    const server = fakeServer()
    server.transactions.push(transaction('one', 'ana', 'Ana private'), transaction('two', 'ben', 'Ben private'))
    const device = server.client({ user: { id: 'ana' } })
    await renderApp(device.client)
    search('Ana')
    expect($('dialog button[role="option"]').textContent).toBe('Ana private')
    device.emit('ben')
    expect(document.querySelector('dialog')).toBeNull()
    await settle()
    search('Ana')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    type($<HTMLInputElement>('dialog input'), 'Ben')
    expect($('dialog button[role="option"]').textContent).toBe('Ben private')
    device.emit(null)
    expect(document.querySelector('dialog')).toBeNull()
    search()
    expect($<HTMLInputElement>('dialog input').value).toBe('')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
  })

  it('cannot restore old-account search results after a delayed request resolves', async () => {
    const server = fakeServer()
    server.transactions.push(transaction('one', 'ana', 'Ana delayed'), transaction('two', 'ben', 'Ben current'))
    server.slow(5000)
    const device = server.client({ user: { id: 'ana' } })
    await renderApp(device.client)
    search('Ana')
    expect($('dialog [role="status"]').textContent).toContain('Loading records')
    device.emit('ben')
    expect(document.querySelector('dialog')).toBeNull()
    server.slow(0)
    await settle()
    await settle()
    await settle()
    search('Ana')
    expect(document.querySelector('dialog button[role="option"]')).toBeNull()
    type($<HTMLInputElement>('dialog input'), 'Ben')
    expect($('dialog button[role="option"]').textContent).toBe('Ben current')
  })
})
