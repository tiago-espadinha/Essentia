import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fakeServer } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, type } from './testing'

// The chart's file cannot be fetched, as when offline or after a deploy.
vi.mock('./MonthBars', () => {
  throw new Error('Failed to fetch dynamically imported module')
})

setupApp()

describe('insights without the chart', () => {
  it('keeps the page and the table when the chart cannot load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await renderApp(fakeServer().client({ user: { id: 'ana' } }).client)
    const field = $<HTMLInputElement>('#add-transaction')
    type(field, 'Rent €900 housing')
    act(() => field.form!.requestSubmit())
    click(buttonNamed('Insights'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect($('.month-chart__placeholder')).not.toBeNull()
    expect($('.months tbody tr').textContent).toBe('November 2022€0.00€900.00−€900.00')
  })
})
