import { DEFAULT_CATEGORY, type Habit } from './habits'

/** Number of shared category marker tokens (`--color-category-1` to `-6`). */
export const CATEGORY_TONES = 6

/** Category names that differ only in case, Unicode form or surrounding spaces share a colour. */
const keyOf = (category: string) => category.normalize('NFC').trim().toLowerCase()

/**
 * The hue a category name prefers: 0 is the neutral default category, 1 to 6
 * pick a shared token. Derived from the name alone, so nothing is stored.
 */
export function categoryTone(category: string): number {
  const key = keyOf(category)
  if (key === '' || key === DEFAULT_CATEGORY.toLowerCase()) return 0
  // FNV-1a, then a murmur3 finaliser: plain FNV clusters short names modulo 6.
  let hash = 0x811c9dc5
  for (const char of key) hash = Math.imul(hash ^ char.codePointAt(0)!, 0x01000193)
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  hash ^= hash >>> 16
  return ((hash >>> 0) % CATEGORY_TONES) + 1
}

/**
 * Tones for the categories in use. Categories claim hues in the order their
 * first habit was created, starting at the hue their name prefers and moving
 * to the next free one, so up to six categories never share a colour and adding
 * a habit never recolours an existing category. Deleting a category's habits or
 * moving its oldest one elsewhere can free or take a hue and shift later
 * categories. Beyond six, names share hues.
 */
export function categoryTones(habits: readonly Pick<Habit, 'category' | 'createdAt'>[]): (category: string) => number {
  const tones = new Map<string, number>()
  const taken = new Set<number>()
  // Code-point order breaks ties, so every locale assigns the same hues.
  const byKey = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  const oldestFirst = habits.toSorted((a, b) => byKey(a.createdAt, b.createdAt) || byKey(keyOf(a.category), keyOf(b.category)))
  for (const { category } of oldestFirst) {
    const key = keyOf(category)
    if (tones.has(key)) continue
    const preferred = categoryTone(category)
    let tone = preferred
    if (tone !== 0) {
      for (let step = 1; step < CATEGORY_TONES && taken.has(tone); step++) tone = (tone % CATEGORY_TONES) + 1
      if (taken.has(tone)) tone = preferred
      taken.add(tone)
    }
    tones.set(key, tone)
  }
  return (category) => tones.get(keyOf(category)) ?? categoryTone(category)
}
