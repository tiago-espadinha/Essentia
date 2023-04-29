import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fakeServer, settle } from './fakeServer'
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

function choose(select: HTMLSelectElement, value: string) {
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

/** A transaction as the account holds it, 3.50 euros of food on the test day. */
const row = (n: number, description: string, changes: Record<string, unknown> = {}) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(n).padStart(12, '0')}`,
  user_id: 'ana',
  description,
  amount: 3.5,
  type: 'expense',
  category: 'food',
  occurred_on: '2022-11-08',
  created_at: '2022-11-08T08:00:00Z',
  updated_at: '2022-11-08T08:00:00Z',
  deleted_at: null,
  ...changes,
})

/** Catches the file the page hands the browser instead of saving it. */
function spyDownload() {
  const saved: Blob[] = []
  vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
    saved.push(blob as Blob)
    return 'blob:aurum'
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  return { saved, clicked }
}

/** Clicks Export and lets its sync finish. */
const exportCsv = () => settle(() => click(buttonNamed('Export CSV')))

const spend = () => [...document.querySelectorAll('.spend__item')].map((item) => item.textContent)
const monthRows = () => [...document.querySelectorAll('.months tbody tr')].map((row) => row.textContent)

describe('insights', () => {
  it('has nothing to show before the first transaction', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    expect(buttonNamed('Insights').getAttribute('aria-current')).toBe('page')
    expect(text()).toContain('Not enough data yet.')
    expect(document.querySelector('#add-transaction')).toBeNull()
    click(buttonNamed('Add a transaction'))
    expect(buttonNamed('Transactions').getAttribute('aria-current')).toBe('page')
    expect(document.activeElement).toBe($('#add-transaction'))
  })

  it('sums this month and splits its spending by category', async () => {
    await signedIn()
    quickAdd('+Salary €2100')
    quickAdd('Rent €900 housing')
    quickAdd('Groceries €60 food')
    quickAdd('Lunch €40 food')
    click(buttonNamed('Insights'))
    expect($('#insight-month').textContent).toContain('November 2022')
    expect($('.insight .hero__stats').textContent).toBe('Income€2,100.00Expenses€1,000.00Net€1,100.00')
    expect(spend()).toEqual(['housing€900.0090%', 'food€100.0010%'])
    expect(monthRows()[0]).toBe('November 2022€2,100.00€1,000.00€1,100.00')
    expect(monthRows()).toHaveLength(6)
    expect($('.months caption').textContent).toBe('Income, expenses and net for each of the last six months')
    expect(monthRows()[5]).toBe('June 2022€0.00€0.00€0.00')
  })

  it('shows another month on request, and says when it had no expenses', async () => {
    const server = fakeServer()
    server.transactions.push({
      id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
      user_id: 'ana',
      description: 'Bus pass',
      amount: 35,
      type: 'expense',
      category: 'transport',
      occurred_on: '2022-10-03',
      created_at: '2022-10-03T08:00:00.000Z',
      updated_at: '2022-10-03T08:00:00.000Z',
      deleted_at: null,
    })
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    click(buttonNamed('Insights'))
    expect(text()).toContain('No expenses in November 2022.')
    choose($('#insight-month'), '2022-10')
    expect(spend()).toEqual(['transport€35.00100%'])
    expect($('.insight .hero__stats').textContent).toContain('Net−€35.00')
  })
})

describe('insights over an interval', () => {
  const interval = (name: string) =>
    [...document.querySelectorAll<HTMLInputElement>('input[name="insight-interval"]')].find(
      (input) => input.parentElement!.textContent === name,
    )!
  const heading = () => $('#periods-title').textContent
  const region = () => $('.months-scroll').getAttribute('aria-label')
  /** The chart's bucket labels, once its lazy module has loaded. */
  const chartTicks = async () => {
    await act(() => vi.advanceTimersByTimeAsync(0))
    return [...document.querySelectorAll('.month-chart .recharts-cartesian-axis-tick-value')].map((tick) => tick.textContent)
  }

  it('starts on six months and switches the heading, table and chart together', async () => {
    await signedIn()
    quickAdd('Rent €900 housing')
    click(buttonNamed('Insights'))
    expect(interval('6 months').checked).toBe(true)
    expect(heading()).toBe('Last six months')
    expect(await chartTicks()).toEqual(['Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov'])

    click(interval('12 weeks'))
    expect(interval('12 weeks').checked).toBe(true)
    expect(heading()).toBe('Last 12 weeks')
    expect($('.months caption').textContent).toBe('Income, expenses and net for each of the last 12 weeks')
    expect(region()).toBe('Weekly totals')
    expect($('.months thead th').textContent).toBe('Week')
    expect(monthRows()).toHaveLength(12)
    expect(monthRows()[0]).toBe('Week of 7 Nov 2022€0.00€900.00−€900.00')
    expect(monthRows()[11]).toBe('Week of 22 Aug 2022€0.00€0.00€0.00')
    const weeks = await chartTicks()
    expect(weeks).toHaveLength(12)
    expect([weeks[0], weeks[11]]).toEqual(['22 Aug', '7 Nov'])

    click(interval('12 months'))
    expect(heading()).toBe('Last 12 months')
    expect(region()).toBe('Monthly totals')
    expect(monthRows()).toHaveLength(12)
    expect(monthRows()[0]).toBe('November 2022€0.00€900.00−€900.00')
    expect(monthRows()[11]).toBe('December 2021€0.00€0.00€0.00')
  })

  it('says when nothing falls in the interval instead of drawing an empty chart', async () => {
    const server = fakeServer()
    server.transactions.push(row(1, 'Old rent', { category: 'housing', amount: 800, occurred_on: '2021-12-01' }))
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    click(buttonNamed('Insights'))
    expect(text()).toContain('Nothing recorded in the last six months.')
    expect(document.querySelector('.month-chart')).toBeNull()
    expect(monthRows()).toHaveLength(6)
    click(interval('12 months'))
    expect(text()).not.toContain('Nothing recorded')
    expect(monthRows()[11]).toBe('December 2021€0.00€800.00−€800.00')
    expect(await chartTicks()).toHaveLength(12)
    click(interval('12 weeks'))
    expect(text()).toContain('Nothing recorded in the last 12 weeks.')
  })
})

describe('export', () => {
  it('cannot export before there is anything to export', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    expect(buttonNamed('Export CSV').disabled).toBe(true)
  })

  it('saves every transaction as a dated CSV file', async () => {
    await signedIn()
    quickAdd('+Salary €2100')
    quickAdd('Rent €900 housing')
    const { saved, clicked } = spyDownload()
    click(buttonNamed('Insights'))
    await exportCsv()
    expect(clicked).toHaveBeenCalledOnce()
    expect((clicked.mock.contexts[0] as HTMLAnchorElement).download).toBe('merces-2022-11-08.csv')
    // Blob.text() drops the byte order mark when it decodes, so the bytes are read.
    const bytes = new Uint8Array(await saved[0].arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(new TextDecoder().decode(bytes.slice(3)).split('\r\n')).toEqual([
      'date,type,description,category,amount',
      '2022-11-08,expense,Rent,housing,900.00',
      '2022-11-08,income,Salary,other,2100.00',
      '',
    ])
    expect($('.data__outcome').textContent).toBe('Exported 2 transactions, dated 8 Nov 2022.')
  })

  it('says the export covers the whole account, whatever the filters', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    click(buttonNamed('Insights'))
    const about = document.getElementById(buttonNamed('Export CSV').getAttribute('aria-describedby')!)!
    expect(about.textContent).toContain('Export saves every transaction on your account, from all dates and regardless of filters')
  })

  it('exports every year of the account while the list is filtered', async () => {
    const server = fakeServer()
    server.transactions.push(
      row(1, 'Salary, Nov', { type: 'income', category: 'salary', amount: 2100, occurred_on: '2022-11-01' }),
      row(2, '=HYPERLINK("x")', { occurred_on: '2021-06-15' }),
      row(3, 'Old rent', { category: 'housing', amount: 800, occurred_on: '2020-01-31' }),
      row(4, 'Gone', { deleted_at: '2022-11-07T08:00:00Z' }),
    )
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    choose($<HTMLSelectElement>('#filter-month'), '2022-11')
    choose($<HTMLSelectElement>('#filter-category'), 'salary')
    type($<HTMLInputElement>('#search'), 'sal')
    expect([...document.querySelectorAll('.row__description')].map((cell) => cell.textContent)).toEqual(['Salary, Nov'])
    const { saved } = spyDownload()
    click(buttonNamed('Insights'))
    await exportCsv()
    expect((await saved[0].text()).split('\r\n')).toEqual([
      'date,type,description,category,amount',
      '2022-11-01,income,"Salary, Nov",salary,2100.00',
      '2021-06-15,expense,"\'=HYPERLINK(""x"")",food,3.50',
      '2020-01-31,expense,Old rent,housing,800.00',
      '',
    ])
    expect($('.data__outcome').textContent).toBe('Exported 3 transactions, dated 31 Jan 2020 to 1 Nov 2022.')
  })

  it('saves no file when the account cannot be reached', async () => {
    const server = fakeServer()
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    quickAdd('Coffee €3.50')
    await settle()
    server.fail(true)
    const { clicked } = spyDownload()
    click(buttonNamed('Insights'))
    await exportCsv()
    expect(clicked).not.toHaveBeenCalled()
    expect($('.data__outcome').textContent).toBe(
      'Couldn’t reach your account, so no file was saved: it might have missed transactions. Try again later.',
    )
    expect($('.data__outcome').classList).toContain('notice--error')
    expect(buttonNamed('Export CSV').disabled).toBe(false)
  })

  it('keeps the focus on Export while it syncs, and saves one file however often it is pressed', async () => {
    const server = fakeServer()
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    quickAdd('Coffee €3.50')
    await settle()
    server.slow(1000)
    const { clicked } = spyDownload()
    click(buttonNamed('Insights'))
    const button = buttonNamed('Export CSV')
    button.focus()
    click(button)
    expect(button.textContent).toBe('Exporting…')
    expect(button.getAttribute('aria-disabled')).toBe('true')
    expect(document.activeElement).toBe(button)
    click(button)
    await settle()
    expect(clicked).toHaveBeenCalledOnce()
    expect(button.getAttribute('aria-disabled')).toBe('false')
    expect(document.activeElement).toBe(button)
  })

  it('saves no file when the account turns out to be empty', async () => {
    const server = fakeServer()
    await renderApp(server.client({ user: { id: 'ana' } }).client)
    quickAdd('Coffee €3.50')
    await settle()
    // Deleted on another device since this one synced.
    server.transactions[0].deleted_at = server.transactions[0].updated_at = '2022-11-08T10:00:00.000Z'
    const { clicked } = spyDownload()
    click(buttonNamed('Insights'))
    await exportCsv()
    expect(clicked).not.toHaveBeenCalled()
    expect($('.data__outcome').textContent).toBe('Your account has no transactions to export.')
  })

  it('says so when the browser cannot make the file', async () => {
    await signedIn()
    quickAdd('Coffee €3.50')
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
      throw new Error('quota')
    })
    click(buttonNamed('Insights'))
    await exportCsv()
    expect($('.data__outcome').textContent).toBe('Couldn’t save the file. Try again.')
  })
})

describe('import', () => {
  async function pick(content: string, size?: number) {
    const input = $<HTMLInputElement>('#import-file')
    const file = new File([content], 'bank.csv', { type: 'text/csv' })
    if (size !== undefined) Object.defineProperty(file, 'size', { value: size })
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  it('adds the rows of a file, even on an empty account, and lists the skipped ones', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    await pick(
      'date,type,description,category,amount\n2022-11-02,income,Salary,salary,2100\n2022-11-03,expense,Rent,housing,900\n2022-11-04,expense,Gift,,abc\n',
    )
    expect($('.data__outcome').textContent).toBe(
      'Imported 2 transactions. Skipped 1 row:Row 4: the amount is not one above zero, like 3.50.',
    )
    expect($('.hero__amount').textContent).toBe('€1,200.00')
    expect($<HTMLInputElement>('#import-file').disabled).toBe(false)
  })

  it('says why a file is refused and adds nothing', async () => {
    await signedIn()
    click(buttonNamed('Insights'))
    await pick('when,what\n2022-11-03,coffee\n')
    expect($('.data__outcome').textContent).toBe('The file needs the columns date, type, description, category and amount.')
    await pick('date,type,description,category,amount\n', 2_000_000)
    expect($('.data__outcome').textContent).toBe('The file is over 1 MB. Split it and import each part.')
    expect($('.hero__amount').textContent).toBe('€0.00')
  })
})
