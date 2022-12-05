import { describe, expect, it } from 'vitest'
import { amountText, formatMoney, formatSigned, fromEuros, MAX_CENTS, parseAmount, toEuros } from './money'

describe('parseAmount', () => {
  it.each([
    ['3.50', 350],
    ['3,50', 350],
    ['3.5', 350],
    ['3,5', 350],
    ['2100', 210_000],
    ['0.01', 1],
    ['1,234.56', 123_456],
    ['1.234,56', 123_456],
    ['1.234', 123_400],
    ['1,234,567', 123_456_700],
    ['3.505', 350_500],
    [' 12 ', 1200],
    ['9999999999.99', MAX_CENTS],
  ])('reads %j as %i cents', (text, cents) => {
    expect(parseAmount(text)).toBe(cents)
  })

  it.each(['', 'abc', '0', '0.00', '-3', '1.2345', '1,234,56', '1.234.5,6,7', '0,500', '0.500', '012,345', '12.34.5', '1,2,3', '.', '€3', '10000000000', '1e3'])('refuses %j', (text) => {
    expect(parseAmount(text)).toBeNull()
  })
})

describe('euros at the table', () => {
  it('turns cents into euros and back exactly', () => {
    for (const cents of [1, 10, 350, 12_345, 99_999, MAX_CENTS]) expect(fromEuros(toEuros(cents))).toBe(cents)
  })

  it('reads numbers and numeric strings, rounding float noise', () => {
    expect(fromEuros(0.1 + 0.2)).toBe(30)
    expect(fromEuros('12.40')).toBe(1240)
  })

  it.each([null, undefined, '', 'x', 0, -1, Number.NaN, Infinity, 1e10, {}])('refuses %j', (value) => {
    expect(fromEuros(value)).toBeNull()
  })
})

describe('formatting', () => {
  it('shows euros with two decimals and grouping', () => {
    expect(formatMoney(350)).toBe('€3.50')
    expect(formatMoney(210_000)).toBe('€2,100.00')
    expect(formatMoney(-350)).toBe('−€3.50')
  })

  it('signs income and expenses', () => {
    expect(formatSigned(210_000, 'income')).toBe('+€2,100.00')
    expect(formatSigned(350, 'expense')).toBe('−€3.50')
  })

  it('gives the editable text of an amount', () => {
    expect(amountText(350)).toBe('3.50')
    expect(amountText(210_000)).toBe('2100.00')
  })
})
