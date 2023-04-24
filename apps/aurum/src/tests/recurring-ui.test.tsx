import { act } from 'react'
import { describe, expect, it } from 'vitest'
import { fakeServer, settle } from './fakeServer'
import { $, buttonNamed, click, renderApp, setupApp, text, type, unmount } from './testing'

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

function choose(id: string, value: string) {
  const select = $<HTMLSelectElement>(`#${id}`)
  act(() => {
    select.value = value
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

const submit = () => act(() => $<HTMLFormElement>('.recurring-form').requestSubmit())
const hint = () => document.getElementById('recurring-schedule')?.textContent ?? null
const DAY = 86_400_000

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
    expect(rows()).toEqual(['RentMonthlyNext 30 NovhousingExpense −€900.00Pause “Rent”Delete “Rent”'])
    await settle()
    click(buttonNamed('Transactions'))
    expect([...document.querySelectorAll('.row__description')].map((p) => p.textContent)).toEqual(['Rent', 'Rent'])
  })

  it('says when a future item first posts', async () => {
    await signedIn()
    addRecurring('Gym', '30', '2022-12-01')
    expect(status()).toBe('Gym added, first on 1 Dec.')
    expect(rows()[0]).toContain('Next 1 Dec')
  })

  it('pauses, resumes and deletes an item', async () => {
    await signedIn()
    addRecurring('Rent', '900', '2022-12-01')
    click(buttonNamed('Pause “Rent”'))
    expect(rows()[0]).toContain('Paused')
    expect(status()).toBe('Rent paused.')
    click(buttonNamed('Resume “Rent”'))
    expect(rows()[0]).toContain('Next 1 Dec')
    click(buttonNamed('Delete “Rent”'))
    expect(text()).toContain('Nothing recurring yet.')
    expect(status()).toBe('Rent deleted. What it already posted stays.')
  })

  it('refuses a first day more than a year back', async () => {
    await signedIn()
    addRecurring('Rent', '900', '0202-11-08')
    expect($('#recurring-date-error').textContent).toBe('Choose a day from 8 Nov, 2021 on.')
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

  describe('weekly', () => {
    // The test day, 8 Nov 2022, is a Tuesday.
    it('asks for the weekday, starting from the first day chosen, and previews the dates it posts', async () => {
      await signedIn()
      expect(document.getElementById('recurring-weekday')).toBeNull()
      choose('recurring-frequency', 'weekly')
      expect($<HTMLSelectElement>('#recurring-weekday').value).toBe('2')
      expect([...$<HTMLSelectElement>('#recurring-weekday').options].map((o) => o.textContent)).toEqual([
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
      ])
      expect($('label[for="recurring-date"]').textContent).toBe('First payment')
      expect(hint()).toBe('Posts on 8 Nov, 15 Nov, 22 Nov, then every Tuesday.')
      expect($('#recurring-date').getAttribute('aria-describedby')).toBe('recurring-schedule')
      type($<HTMLInputElement>('#recurring-date'), '2022-12-27')
      choose('recurring-frequency', 'monthly')
      choose('recurring-frequency', 'weekly')
      expect(hint()).toBe('Posts on 27 Dec, 3 Jan, 10 Jan, then every Tuesday.')
    })

    it('refuses a first payment on another weekday and offers the next matching day', async () => {
      await signedIn()
      choose('recurring-frequency', 'weekly')
      choose('recurring-weekday', '1')
      expect(hint()).toBeNull()
      addRecurring('Cleaner', '40', '2022-11-09')
      expect($('#recurring-date-error').textContent).toBe('9 Nov is a Wednesday, not a Monday.')
      expect(document.activeElement).toBe($('#recurring-date'))
      expect(rows()).toEqual([])

      click(buttonNamed('Use Monday 14 Nov'))
      expect($<HTMLInputElement>('#recurring-date').value).toBe('2022-11-14')
      expect(document.getElementById('recurring-date-error')).toBeNull()
      expect(document.activeElement).toBe($('#recurring-date'))
      expect(hint()).toBe('Posts on 14 Nov, 21 Nov, 28 Nov, then every Monday.')
      expect($('#recurring-date').getAttribute('aria-describedby')).toBe('recurring-schedule')
      submit()
      expect(status()).toBe('Cleaner added, first on 14 Nov.')
      expect(rows()).toEqual(['CleanerWeekly, MondayNext 14 NovhousingExpense −€40.00Pause “Cleaner”Delete “Cleaner”'])
    })

    it('clears the mismatch when the weekday is changed to match', async () => {
      await signedIn()
      choose('recurring-frequency', 'weekly')
      choose('recurring-weekday', '5')
      submit()
      expect($('#recurring-date-error').textContent).toBe('8 Nov is a Tuesday, not a Friday.')
      choose('recurring-weekday', '2')
      expect(document.getElementById('recurring-date-error')).toBeNull()
      expect(hint()).toBe('Posts on 8 Nov, 15 Nov, 22 Nov, then every Tuesday.')
    })

    it('drops the mismatch when the item stops being weekly', async () => {
      await signedIn()
      choose('recurring-frequency', 'weekly')
      choose('recurring-weekday', '5')
      submit()
      expect($('#recurring-date-error').textContent).toBe('8 Nov is a Tuesday, not a Friday.')
      choose('recurring-frequency', 'monthly')
      expect(document.getElementById('recurring-date-error')).toBeNull()
      expect($('#recurring-date').getAttribute('aria-invalid')).toBe('false')
      expect($('label[for="recurring-date"]').textContent).toBe('First on')
    })

    // The fake server steps dates with the app's own occurrence(), so this checks posting and
    // repeat syncs, not the SQL: recurring_occurrence() adds 7 * count days, as occurrence() does.
    it('posts the previewed dates, seven days apart across the year end, once however often it syncs', async () => {
      const server = fakeServer()
      await renderApp(server.client({ user: { id: 'ana' } }).client)
      click(buttonNamed('Plan'))
      choose('recurring-frequency', 'weekly')
      type($<HTMLInputElement>('#recurring-date'), '2021-12-21')
      expect(hint()).toBe('Posts on 21 Dec, 28 Dec, 4 Jan, then every Tuesday.')
      addRecurring('Cleaner', '40', '2021-12-21')
      await settle()
      const posted = () => server.transactions.map((t) => String(t.occurred_on)).sort()
      const days = posted()
      expect(days.slice(0, 3)).toEqual(['2021-12-21', '2021-12-28', '2022-01-04'])
      expect(days.at(-1)).toBe('2022-11-08')
      expect(days).toHaveLength(47)
      expect(days.slice(1).every((day, n) => Date.parse(day) - Date.parse(days[n]) === 7 * DAY)).toBe(true)
      expect(rows()[0]).toContain('Next 15 Nov')

      // Another device opening the same account posts nothing more.
      unmount()
      await renderApp(server.client({ user: { id: 'ana' } }).client)
      await settle()
      expect(posted()).toEqual(days)
    })

    it('keeps an existing weekly item on its own weekday and schedule', async () => {
      const server = fakeServer()
      const stamp = '2022-10-01T09:00:00.000Z'
      server.recurring.push({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        user_id: 'ana',
        description: 'Market',
        amount: 25,
        type: 'expense',
        category: 'food',
        frequency: 'weekly',
        start_on: '2022-10-06',
        paused: false,
        paused_on: null,
        resumed_on: null,
        posted: 0,
        created_at: stamp,
        updated_at: stamp,
        deleted_at: null,
      })
      await renderApp(server.client({ user: { id: 'ana' } }).client)
      await settle()
      click(buttonNamed('Plan'))
      expect(rows()[0]).toContain('Weekly, ThursdayNext 10 Nov')
      expect(server.transactions.map((t) => t.occurred_on).sort()).toEqual(['2022-10-06', '2022-10-13', '2022-10-20', '2022-10-27', '2022-11-03'])
      expect(server.recurring[0]).toMatchObject({ start_on: '2022-10-06', frequency: 'weekly' })
    })
  })
})
