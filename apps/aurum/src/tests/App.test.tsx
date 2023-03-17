import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type } from './testing'

setupApp()

describe('offline finance', () => {
  it('keeps memory-only records and their warning through offline retry and reconnect', async () => {
    const server = fakeServer()
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    const input = $<HTMLInputElement>('#add-transaction')
    type(input, 'Memory coffee €3.50')
    act(() => input.form!.requestSubmit())
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('offline')))
    expect(text()).toContain('Your latest changes may be lost if you close this page.')
    expect(text()).not.toContain('Your existing changes are kept on this device.')
    click(buttonNamed('Try again'))
    expect($('h1').textContent).toBe('A connection is needed.')
    online.mockReturnValue(true)
    click(buttonNamed('Try again'))
    expect(text()).toContain('Memory coffee')
    expect(text()).toContain('Your latest changes may be lost if you close this page.')
  })

  it('replaces write controls with recovery, preserves unsynced records and returns online', async () => {
    const server = fakeServer()
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    const before = localStorage.getItem('essentia-aurum-transactions')
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    act(() => window.dispatchEvent(new Event('offline')))
    expect($('h1').textContent).toBe('A connection is needed.')
    expect(document.querySelector('form')).toBeNull()
    expect(document.querySelector('dialog')).toBeNull()
    expect(text()).toContain('Your existing changes are kept on this device.')
    expect(localStorage.getItem('essentia-aurum-transactions')).toBe(before)
    online.mockReturnValue(true)
    act(() => window.dispatchEvent(new Event('online')))
    expect($('h1').textContent).toBe('Your money')
  })

  it('launches offline in Portuguese without offering finance writes', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    document.documentElement.lang = 'pt-PT'
    try {
      await renderApp(null)
      expect($('h1').textContent).toBe('É necessária uma ligação.')
      expect(buttonNamed('Tentar novamente')).toBeTruthy()
      expect(document.querySelector('form')).toBeNull()
    } finally {
      document.documentElement.lang = 'en-GB'
    }
  })
})

describe('before sign-in', () => {
  it('explains that Merces needs an account service when the build has none', async () => {
    await renderApp(null)
    expect($('h1').textContent).toBe('Merces isn’t set up here')
    expect($('header').textContent).toContain('Merces Your Money')
    expect(document.querySelector('form')).toBeNull()
    expect(document.querySelector('#account-button')).toBeNull()
  })

  it('asks a signed-out visitor to sign in, with the form on the page', async () => {
    await renderApp(fakeServer().client(null).client)
    expect($('h1').textContent).toBe('Your money, in one place')
    expect($('#auth-email')).toBeTruthy()
    expect($('#auth-password')).toBeTruthy()
    expect(text()).toContain('Merces keeps your income and expenses in your account')
  })

  it('opens on the transactions once signed in, with the account menu in the header', async () => {
    const server = fakeServer()
    const device = server.client(null)
    await renderApp(device.client)
    await device.signInAs('ana')
    expect($('h1').textContent).toBe('Your money')
    expect(document.querySelector('#auth-email')).toBeNull()
    expect($('header #account-button')).toBeTruthy()
  })

  it('shows quiet loading lines until the account has been read', async () => {
    const server = fakeServer()
    server.slow(5000)
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    expect($('[role="status"]').getAttribute('aria-label')).toBe('Loading your transactions')
    await settle()
    await settle()
    expect(document.querySelector('.skeleton')).toBeNull()
  })
})

describe('sync failures', () => {
  it('says the sync failed, keeps the device copy, and retries on request', async () => {
    const server = fakeServer()
    server.fail(true)
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    expect($('[role="alert"]').textContent).toContain('Couldn’t sync with your account. Your changes are kept on this device.')
    server.fail(false)
    click(buttonNamed('Try again'))
    await settle()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})
