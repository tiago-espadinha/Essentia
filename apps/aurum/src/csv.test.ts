import { describe, expect, it } from 'vitest'
import { IMPORT_LIMITS, parseRecords, readCsv, toCsv } from './csv'
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

describe('parseRecords', () => {
  it('reads quoted commas, doubled quotes and line breaks, with any line end', () => {
    expect(parseRecords('a,"b, c","say ""hi"""\r\n"two\nlines",x\ry\n')).toEqual([['a', 'b, c', 'say "hi"'], ['two\nlines', 'x'], ['y']])
  })

  it('reads a quote inside an unquoted field as a character', () => {
    expect(parseRecords('a,TV 55" screen,b\nc')).toEqual([['a', 'TV 55" screen', 'b'], ['c']])
  })

  it('is null when a quote is never closed', () => {
    expect(parseRecords('a,"open\nb,c\n')).toBeNull()
  })

  it('drops a byte order mark and keeps empty fields', () => {
    expect(parseRecords('﻿a,,b')).toEqual([['a', '', 'b']])
  })
})

describe('readCsv', () => {
  const header = 'date,type,description,category,amount\r\n'

  it('reads back what toCsv wrote, formulas and all', () => {
    const list = [
      tx({ description: '=SUM(A1:A2)', category: '+tips', amount: 123456 }),
      tx({ description: "'-90s mix", category: "'food" }),
      tx({ description: 'Salary, Nov', type: 'income', category: 'salary', amount: 210000, date: '2022-11-01' }),
    ]
    const result = readCsv(toCsv(list))
    expect(result).toEqual({
      rows: list.map(({ date, type, amount, description, category }) => ({ date, type, amount, description, category })),
      skipped: [],
    })
  })

  it('takes the columns in any order and case, and tidies text', () => {
    expect(readCsv('Amount,Category,Type,Date,Description\n"1,234.50", Food ,EXPENSE,2022-11-03,  Big   shop \n')).toEqual({
      rows: [{ date: '2022-11-03', type: 'expense', amount: 123450, description: 'Big shop', category: 'food' }],
      skipped: [],
    })
  })

  it('gives a missing category the default', () => {
    const result = readCsv(`${header}2022-11-03,expense,Coffee,,3.50`)
    expect(result).toMatchObject({ rows: [{ category: 'other' }] })
  })

  it('skips rows that are no transaction and says which and why, counting the header as row 1', () => {
    const result = readCsv(
      header +
        [
          '2022-11-03,expense,Coffee,food,3.50',
          '2022-02-30,expense,Bad day,food,1',
          '',
          '2022-11-03,refund,Odd,food,1',
          '2022-11-03,expense,Free,food,0',
          '2022-11-03,expense,Negative,food,-4',
          '2022-11-03,expense,Too precise,food,0,500',
          '2022-11-03,expense,,food,1',
          `2022-11-03,expense,${'x'.repeat(201)},food,1`,
          `2022-11-03,expense,Long,${'c'.repeat(41)},1`,
        ].join('\n'),
    )
    expect(result).toMatchObject({ rows: [{ description: 'Coffee' }] })
    expect('skipped' in result && result.skipped.map(({ row, reason }) => `${row} ${reason.split(' ')[1]}`)).toEqual([
      '3 date',
      '5 type',
      '6 amount',
      '7 amount',
      '8 amount',
      '9 description',
      '10 description',
      '11 category',
    ])
  })

  it('refuses a file without the columns, without rows, or with too many rows', () => {
    expect(readCsv('')).toEqual({ error: 'The file is empty.' })
    expect(readCsv(`${header}2022-11-03,expense,"Coffee,food,3.50\n2022-11-04,expense,Tea,food,2\n`)).toEqual({
      error: 'A quote in the file is never closed. Check the file in a spreadsheet and save it again.',
    })
    expect(readCsv('date,amount\n2022-11-03,1')).toEqual({
      error: 'The file needs the columns date, type, description, category and amount.',
    })
    expect(readCsv(`${header}\r\n\r\n`)).toEqual({ error: 'The file has no transactions in it.' })
    const many = header + '2022-11-03,expense,Coffee,food,3.50\n'.repeat(IMPORT_LIMITS.rows + 1)
    expect(readCsv(many)).toEqual({ error: 'Keep it to 5,000 transactions per file.' })
  })
})
