import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('../tokens/tokens.css', 'utf8')

/** The declarations of the first rule whose selector line is exactly `selector {`, at any indent. */
function block(selector: string): Record<string, string> {
  const start = css.split('\n').findIndex((line) => line.trim() === `${selector} {`)
  if (start < 0) throw new Error(`No rule ${selector}`)
  const rest = css.split('\n').slice(start).join('\n')
  const body = rest.slice(rest.indexOf('{') + 1, rest.indexOf('}'))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const TONES = [1, 2, 3, 4, 5, 6].map((n) => `--color-category-${n}`)
const light = block(':root')
const dark = block(':root[data-theme="dark"]')
const systemDark = block(':root:not([data-theme="light"])')

describe('category marker tokens', () => {
  it('define six hues in both themes, the same for the system and the chosen dark theme', () => {
    for (const tone of TONES) {
      expect(light[tone]).toMatch(/^#[0-9A-F]{6}$/)
      expect(dark[tone]).toMatch(/^#[0-9A-F]{6}$/)
      expect(systemDark[tone]).toBe(dark[tone])
    }
    expect(new Set(TONES.map((tone) => light[tone])).size).toBe(6)
    expect(new Set(TONES.map((tone) => dark[tone])).size).toBe(6)
    expect(light['--color-category-neutral']).toBe('var(--color-mid)')
  })

  it('reach 3:1 against the background and surface in light and dark', () => {
    for (const [theme, background] of [[light, light], [dark, dark]] as const) {
      for (const tone of TONES) {
        expect(contrast(theme[tone], background['--color-sand'])).toBeGreaterThanOrEqual(3)
        expect(contrast(theme[tone], background['--color-paper'])).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('reuse no status or accent value, and no accent rule redefines them', () => {
    const accents = [...css.matchAll(/--color-(?:terracotta|accent-text):\s*(#[0-9A-Fa-f]{6})/g)].map(([, hex]) => hex.toUpperCase())
    const reserved = new Set([...accents, light['--color-success'], light['--color-danger'], dark['--color-success'], dark['--color-danger']])
    for (const tone of TONES) {
      expect(reserved.has(light[tone])).toBe(false)
      expect(reserved.has(dark[tone])).toBe(false)
    }
    for (const rule of css.match(/\[data-accent="\w+"\][^{]*\{[^}]*\}/g) ?? []) {
      expect(rule).not.toContain('--color-category')
    }
  })
})
