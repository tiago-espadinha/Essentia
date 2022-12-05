import { describe, expect, it } from 'vitest'
import { toCsv } from './csv'
import { createTransaction, type TransactionFields } from './transactions'

const tx = (fields: Partial<TransactionFields>, at = '2022-11-03T10:00:00Z') =>
  createTransaction({ description: 'Coffee', amount: 350, type: 'expense', category: 'food', date: '2022-11-03', ...fields }, new Date(at))

const lines = (csv: string) => csv.split('\r\n').slice(0, -1)

describe('toCsv', () => {
  it('writes a header and one row per transaction, newest first, amounts in euros', () => {
    const csv = toCsv([
      tx({ date: '2022-11-01', description: 'Salary', amount: 210000, type: 'income', category: 'salary' }),
      tx({ date: '2022-11-03' }),
    ])
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(lines(csv)).toEqual([
      'date,type,description,category,amount',
      '2022-11-03,expense,Coffee,food,3.50',
      '2022-11-01,income,Salary,salary,2100.00',
    ])
  })

  it('quotes commas, quotes and line breaks', () => {
    expect(lines(toCsv([tx({ description: 'Tea, "large"' })]))[1]).toBe('2022-11-03,expense,"Tea, ""large""",food,3.50')
  })

  it('keeps a spreadsheet from running text as a formula', () => {
    const csv = toCsv([
      tx({ description: '=HYPERLINK("http://x","y")', category: '@sum' }),
      tx({ description: '+1', category: '-2' }, '2022-11-03T09:00:00Z'),
    ])
    expect(lines(csv)[1]).toBe(`2022-11-03,expense,"'=HYPERLINK(""http://x"",""y"")",'@sum,3.50`)
    expect(lines(csv)[2]).toBe(`2022-11-03,expense,'+1,'-2,3.50`)
  })

  it('adds one more apostrophe to text that already starts with one before a formula character', () => {
    expect(lines(toCsv([tx({ description: "'-90s mix", category: "'food" })]))[1]).toBe(`2022-11-03,expense,''-90s mix,'food,3.50`)
  })

  it('is only the header when there is nothing to export', () => {
    expect(toCsv([])).toBe('date,type,description,category,amount\r\n')
  })
})
