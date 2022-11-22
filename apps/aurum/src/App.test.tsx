import { describe, expect, it } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text } from './testing'

setupApp()

describe('before sign-in', () => {
  it('explains that Aurum needs an account service when the build has none', async () => {
    await renderApp(null)
    expect($('h1').textContent).toBe('Aurum isn’t set up here')
    expect(document.querySelector('form')).toBeNull()
    expect(document.querySelector('#account-button')).toBeNull()
  })

  it('asks a signed-out visitor to sign in, with the form on the page', async () => {
    await renderApp(fakeServer().client(null).client)
    expect($('h1').textContent).toBe('Your money, in one place')
    expect($('#auth-email')).toBeTruthy()
    expect($('#auth-password')).toBeTruthy()
    expect(text()).toContain('Aurum keeps your income and expenses in your account')
  })

  it('opens on the transactions once signed in, with the account menu in the header', async () => {
    const server = fakeServer()
    const device = server.client(null)
    await renderApp(device.client)
    await device.signInAs('ana')
    expect($('h1').textContent).toBe('Aurum transactions')
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
    expect($('[role="alert"]').textContent).toContain('Couldn’t sync with your account. Your transactions are kept on this device.')
    server.fail(false)
    click(buttonNamed('Try again'))
    await settle()
    expect(document.querySelector('[role="alert"]')).toBeNull()
  })
})
