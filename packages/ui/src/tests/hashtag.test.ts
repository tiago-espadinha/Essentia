import { describe, expect, it } from 'vitest'
import { applyTag, parseHashtag, tagAtCaret, tagFor, tagSuggestions } from '../domain/hashtag'

const parse = (input: string, max = 100) => parseHashtag(input, max)

describe('parseHashtag', () => {
  it.each([
    ['Buy milk #errands', 'Buy milk', 'errands'],
    ['#errands Buy milk', 'Buy milk', 'errands'],
    ['Buy #errands milk', 'Buy milk', 'errands'],
    ['Read #deep_work', 'Read', 'deep work'],
    ['Read #__deep__work_', 'Read', 'deep work'],
    ['Ler #café-manhã', 'Ler', 'café-manhã'],
    ['Run #5k', 'Run', '5k'],
  ])('reads %j as title %j in category %j', (input, text, tag) => {
    expect(parse(input)).toEqual({ text, tag })
  })

  it('lets the last tag win and keeps earlier tags as typed', () => {
    expect(parse('A #x #y')).toEqual({ text: 'A #x', tag: 'y' })
    expect(parse('#x middle #y end')).toEqual({ text: '#x middle end', tag: 'y' })
  })

  it.each([
    ['Fix C# bug', 'Fix C# bug'],
    ['a#b', 'a#b'],
    ['Call #work, then rest', 'Call #work, then rest'],
    ['Pay # 3', 'Pay # 3'],
    ['Just #', 'Just #'],
    ['Odd #_', 'Odd #_'],
    ['See #a/b', 'See #a/b'],
  ])('keeps %j as plain text', (input, text) => {
    expect(parse(input)).toEqual({ text, tag: null })
  })

  it('writes an escaped hash as a literal one, inside or beside a tag', () => {
    expect(parse('Pay \\#3 invoice')).toEqual({ text: 'Pay #3 invoice', tag: null })
    expect(parse('\\#notatag')).toEqual({ text: '#notatag', tag: null })
    expect(parse('Pay \\#3 #bills')).toEqual({ text: 'Pay #3', tag: 'bills' })
  })

  it('leaves a tag longer than the category limit as text', () => {
    expect(parse(`Plan #${'a'.repeat(51)}`, 50)).toEqual({ text: `Plan #${'a'.repeat(51)}`, tag: null })
    expect(parse(`Plan #${'a'.repeat(50)}`, 50)).toEqual({ text: 'Plan', tag: 'a'.repeat(50) })
  })

  it('returns an empty title for a text that is only a tag', () => {
    expect(parse('  #work  ')).toEqual({ text: '', tag: 'work' })
  })

  it('keeps untagged text, spacing included, apart from escapes', () => {
    expect(parse('  two  spaces ')).toEqual({ text: '  two  spaces ', tag: null })
  })

  it.each(['Buy milk #errands', 'A #x #y', '#a b \\#c #d_e f', 'x #toolong_name_here'])(
    'loses no word of %j: the title and the tag account for all of it', (input) => {
      const { text, tag } = parse(input, 12)
      const words = (value: string) => value.replace(/\\#/g, '#').split(/\s+/).filter(Boolean)
      const tagWord = tag === null ? [] : [words(input).findLast((word) => word.startsWith('#') && word !== '#')!]
      expect([...words(text), ...tagWord].sort()).toEqual(words(input).sort())
    })
})

describe('tagAtCaret', () => {
  it('finds the tag word around the caret and what is typed so far', () => {
    expect(tagAtCaret('Buy #err', 8)).toEqual({ start: 4, end: 8, query: 'err' })
    expect(tagAtCaret('Buy #errands milk', 6)).toEqual({ start: 4, end: 12, query: 'e' })
    expect(tagAtCaret('#', 1)).toEqual({ start: 0, end: 1, query: '' })
    expect(tagAtCaret('#deep_wo', 8)).toEqual({ start: 0, end: 8, query: 'deep wo' })
  })

  it('ignores words that are not tags', () => {
    expect(tagAtCaret('Fix C#', 6)).toBeNull()
    expect(tagAtCaret('Buy #err ', 9)).toBeNull()
    expect(tagAtCaret('Buy \\#3', 7)).toBeNull()
    expect(tagAtCaret('#a,b', 4)).toBeNull()
  })
})

describe('tagSuggestions', () => {
  const categories = ['Work', 'work', 'Home & garden', 'Deep work', 'Writing', 'snake_case', 'General']

  it('lists categories completing the query once each, ignoring case', () => {
    expect(tagSuggestions(categories, 'w', 100)).toEqual(['Work', 'Writing'])
    expect(tagSuggestions(categories, 'DEEP W', 100)).toEqual(['Deep work'])
    expect(tagSuggestions(categories, '', 100)).toEqual(['Work', 'Deep work', 'Writing', 'General'])
  })

  it('leaves out names a tag cannot express or the limit refuses', () => {
    expect(tagSuggestions(categories, 'h', 100)).toEqual([])
    expect(tagSuggestions(categories, 's', 100)).toEqual([])
    expect(tagSuggestions(['Writing'], 'w', 5)).toEqual([])
  })
})

describe('tagFor and applyTag', () => {
  it('spells a category as a tag', () => {
    expect(tagFor('Deep  work')).toBe('Deep_work')
    expect(tagFor('C++')).toBeNull()
    expect(tagFor('a_b')).toBeNull()
  })

  it('replaces the tag being typed and puts the caret after a space', () => {
    expect(applyTag('Buy #er', { start: 4, end: 7, query: 'er' }, 'Errands')).toEqual({ value: 'Buy #Errands ', caret: 13 })
    expect(applyTag('Buy #er milk', { start: 4, end: 7, query: 'er' }, 'Deep work')).toEqual({ value: 'Buy #Deep_work milk', caret: 15 })
  })
})
