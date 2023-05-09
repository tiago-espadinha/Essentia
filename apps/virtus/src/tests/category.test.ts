import { describe, expect, it } from 'vitest'
import { CATEGORY_TONES, categoryTone, categoryTones } from '../domain/category'

const habit = (category: string, day: number) => ({ category, createdAt: `2022-08-${String(day).padStart(2, '0')}T08:00:00.000Z` })

describe('categoryTones', () => {
  // Preferred hues: Fitness 3, Health 3, Learning 5, Mindfulness 5, Family 5, Money 5, Social 4.
  const seven = ['Fitness', 'Health', 'Learning', 'Mindfulness', 'Family', 'Money', 'Social'].map((name, index) => habit(name, index + 1))

  it('gives up to six categories in use six different hues, oldest first at its preferred hue', () => {
    const tone = categoryTones(seven.slice(0, 6))
    expect(['Fitness', 'Health', 'Learning', 'Mindfulness', 'Family', 'Money'].map(tone)).toEqual([3, 4, 5, 6, 1, 2])
  })

  it('never recolours earlier categories when a new one arrives, and shares hues beyond six', () => {
    const before = categoryTones(seven.slice(0, 3))
    const after = categoryTones(seven)
    for (const name of ['Fitness', 'Health', 'Learning']) expect(after(name)).toBe(before(name))
    expect(after('Social')).toBe(categoryTone('Social'))
  })

  it('treats case and space variants as one category and keeps the default neutral', () => {
    const tone = categoryTones([habit('Fitness', 1), habit(' fitness', 2), habit('General', 3), habit('Health', 4)])
    expect(tone('FITNESS ')).toBe(3)
    expect(tone('General')).toBe(0)
    expect(tone('Health')).toBe(4)
  })

  it('lets a later category move back once the hue it gave way to is free', () => {
    // Health gives way to Fitness (both prefer 3) until Fitness's last habit goes.
    expect(categoryTones([habit('Fitness', 1), habit('Health', 2)])('Health')).toBe(4)
    expect(categoryTones([habit('Health', 2)])('Health')).toBe(3)
  })

  it('treats composed and decomposed accents as one name', () => {
    const tone = categoryTones([habit('Saúde', 1)])
    expect(tone('Saúde')).toBe(tone('Saúde'))
    expect(categoryTone('Saúde')).toBe(categoryTone('Saúde'))
  })

  it('does not depend on the order habits are listed in', () => {
    const tone = categoryTones(seven.toReversed())
    expect(['Fitness', 'Health', 'Learning'].map(tone)).toEqual([3, 4, 5])
  })

  it('falls back to the preferred hue for a name not in use', () => {
    expect(categoryTones([])('Fitness')).toBe(categoryTone('Fitness'))
  })
})

describe('categoryTone', () => {
  it('gives the default category and an empty name the neutral tone', () => {
    expect(categoryTone('General')).toBe(0)
    expect(categoryTone(' general ')).toBe(0)
    expect(categoryTone('')).toBe(0)
    expect(categoryTone('   ')).toBe(0)
  })

  it('maps a name to the same hue whatever its case or surrounding spaces', () => {
    const tone = categoryTone('Fitness')
    expect(tone).toBeGreaterThanOrEqual(1)
    expect(tone).toBeLessThanOrEqual(CATEGORY_TONES)
    expect(categoryTone('fitness')).toBe(tone)
    expect(categoryTone('  FITNESS ')).toBe(tone)
  })

  it('keeps hues stable between releases', () => {
    // Pinned so a change to the mapping is a deliberate one: users learn these colours.
    expect(['Fitness', 'Mindfulness', 'Health', 'Social', 'Learning', 'Saúde'].map(categoryTone)).toEqual([3, 5, 3, 4, 5, 3])
  })

  it('uses every hue about evenly', () => {
    const counts = new Map<number, number>()
    for (let i = 0; i < 600; i++) {
      const tone = categoryTone(`Category ${i}`)
      counts.set(tone, (counts.get(tone) ?? 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6])
    for (const count of counts.values()) expect(count).toBeGreaterThan(75)
  })
})
