import { describe, expect, it } from 'vitest'
import { convert, markdownToRich, richToMarkdown } from '../domain/convert'
import { sanitizeHtml } from '../domain/sanitize'

const rich = (body: string) => ({ format: 'rich' as const, body })
const markdown = (body: string) => ({ format: 'markdown' as const, body })

describe('rich text to markdown', () => {
  it('writes headings, lists, quotes, bold and italic as markdown', () => {
    const html =
      '<h1>Plan</h1><h2>Week</h2><p>Some <strong>bold</strong> and <em>soft</em> words.</p>' +
      '<blockquote>Said once</blockquote><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>'
    expect(richToMarkdown(html)).toEqual({
      format: 'markdown',
      body: '# Plan\n\n## Week\n\nSome **bold** and *soft* words.\n\n> Said once\n\n- one\n- two\n\n1. first\n2. second',
      losses: [],
    })
  })

  it('reads b and i as bold and italic, divs as paragraphs and breaks as hard line breaks', () => {
    expect(richToMarkdown('<div>a <b>b</b> <i>c</i></div><div>line<br>next</div>').body).toBe('a **b** *c*\n\nline\\\nnext')
  })

  it('drops underline, keeping its text, and says so', () => {
    expect(richToMarkdown('<p>an <u>underlined</u> word</p>')).toMatchObject({ body: 'an underlined word', losses: ['underline'] })
  })

  it('escapes text that markdown would read as markup', () => {
    const { body } = richToMarkdown('<p># not a heading</p><p>2. not a list</p><p>a *star* and_under_score [x](y) &amp;copy;</p>')
    expect(body).toBe('\\# not a heading\n\n2\\. not a list\n\na \\*star\\* and\\_under\\_score \\[x\\](y) \\&copy;')
    expect(markdownToRich(body).body).toBe('<p># not a heading</p><p>2. not a list</p><p>a *star* and_under_score [x](y) &amp;copy;</p>')
  })

  it('escapes a lone list, rule or underline marker at a line start', () => {
    const html = '<p>Notes<br>-</p><p>+</p><p>1.</p><p>---</p><p>Title<br>===</p>'
    const { body } = richToMarkdown(html)
    expect(body).toBe('Notes\\\n\\-\n\n\\+\n\n1\\.\n\n\\---\n\nTitle\\\n\\===')
    expect(markdownToRich(body).body).toBe(html)
  })

  it('keeps a heading that ends in #', () => {
    const { body } = richToMarkdown('<h2>Issue #</h2>')
    expect(markdownToRich(body).body).toBe('<h2>Issue #</h2>')
  })

  it('writes italic that survives inside a word', () => {
    const { body } = richToMarkdown('<p>foo<i>bar</i>baz</p>')
    expect(markdownToRich(body).body).toBe('<p>foo<em>bar</em>baz</p>')
  })

  it('keeps text pasted straight into a list as an item, and skips what holds none', () => {
    expect(richToMarkdown('<ul><li>a</li><p>b</p><br></ul>').body).toBe('- a\n- b')
  })

  it('nests a list placed straight inside a list under the item before it', () => {
    const { body } = richToMarkdown('<ul><li>a</li><ul><li>b</li><li>c</li></ul></ul>')
    expect(body).toBe('- a\n  - b\n  - c')
    expect(markdownToRich(body).body).toBe('<ul><li>a<ul><li>b</li><li>c</li></ul></li></ul>')
  })

  it('keeps an asterisk inside italic text', () => {
    const { body } = richToMarkdown('<p><i>a*b</i></p>')
    expect(markdownToRich(body).body).toBe('<p><em>a*b</em></p>')
  })

  it('keeps nested lists nested', () => {
    expect(richToMarkdown('<ul><li>a<ul><li>b</li></ul></li><li>c</li></ul>').body).toBe('- a\n  - b\n- c')
  })
})

describe('markdown to rich text', () => {
  it('turns headings, lists, quotes, bold and italic into rich text', () => {
    const md = '# Plan\n\n## Week\n\nSome **bold**, __strong__, *soft* and _soft_ words.\n\n> Said once\n\n- one\n- two\n\n1. first\n2. second'
    expect(markdownToRich(md)).toEqual({
      format: 'rich',
      body:
        '<h1>Plan</h1><h2>Week</h2><p>Some <strong>bold</strong>, <strong>strong</strong>, <em>soft</em> and <em>soft</em> words.</p>' +
        '<blockquote>Said once</blockquote><ul><li>one</li><li>two</li></ul><ol><li>first</li><li>second</li></ol>',
      losses: [],
    })
  })

  it('keeps line breaks and reads underlined headings', () => {
    expect(markdownToRich('Title\n=====\n\nSub\n---\n\nline one\nline two').body).toBe(
      '<h1>Title</h1><h2>Sub</h2><p>line one<br>line two</p>',
    )
  })

  it('makes deeper headings level 2, and says so only when there is one', () => {
    expect(markdownToRich('### Three\n\n###### Six')).toMatchObject({ body: '<h2>Three</h2><h2>Six</h2>', losses: ['deepHeadings'] })
    expect(markdownToRich('## Two').losses).toEqual([])
  })

  it('keeps what rich text cannot hold as the text it was written as, naming each kind', () => {
    const md = [
      'Use `npm test` and see [docs](https://example.com) or https://example.com/raw ~~old~~',
      '![chart](chart.png)',
      '```js\nconst a = 1\n```',
      '| a | b |\n| - | - |\n| 1 | 2 |',
      '- [ ] open\n- [x] done',
      '***',
    ].join('\n\n')
    const { body, losses } = markdownToRich(md)
    expect(losses).toEqual(['code', 'links', 'tables', 'taskLists', 'images', 'strikethrough', 'rules'])
    expect(body).toBe(
      '<p>Use `npm test` and see [docs](https://example.com) or https://example.com/raw ~~old~~</p>' +
        '<p>![chart](chart.png)</p><p>```js<br>const a = 1<br>```</p>' +
        '<p>| a | b |<br>| - | - |<br>| 1 | 2 |</p><ul><li>[ ] open</li><li>[x] done</li></ul><p>***</p>',
    )
  })

  it('names nothing when everything carries over', () => {
    expect(convert(markdown('Plain words\n\n- and a list')).losses).toEqual([])
    expect(convert(rich('<p>Plain words</p>')).losses).toEqual([])
  })

  it('never produces markup outside the rich-text allowlist', () => {
    const md = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1)) **<b onclick="y">b</b>**'
    const { body } = markdownToRich(md)
    expect(body).toBe(sanitizeHtml(body))
    const parsed = new DOMParser().parseFromString(body, 'text/html').body
    expect(parsed.querySelector('script, img, a, b, [onclick], [onerror]')).toBeNull()
    expect(parsed.textContent).toContain('<script>alert(1)</script>')
  })

  it('reads nested and loose lists', () => {
    expect(markdownToRich('- a\n  - b\n- c\n\n- d').body).toBe('<ul><li>a<ul><li>b</li></ul></li><li>c</li><li>d</li></ul>')
    expect(markdownToRich('1. a\ncontinued\n2. b').body).toBe('<ol><li>a<br>continued</li><li>b</li></ol>')
  })

  it('reads tab-indented continuations and nested items', () => {
    expect(markdownToRich('1. a\n\tb').body).toBe('<ol><li>a<br>b</li></ol>')
    expect(markdownToRich('- a\n\tcontinued').body).toBe('<ul><li>a<br>continued</li></ul>')
    expect(markdownToRich('- a\n\t- b').body).toBe('<ul><li>a<ul><li>b</li></ul></li></ul>')
  })

  it('numbers an ordered list from 1, whatever it starts at', () => {
    expect(markdownToRich('3. c\n4. d').body).toBe('<ol><li>c</li><li>d</li></ol>')
  })

  it('handles empty and whitespace-only notes', () => {
    expect(markdownToRich('').body).toBe('')
    expect(markdownToRich('  \n\n ').body).toBe('')
    expect(richToMarkdown('').body).toBe('')
    expect(richToMarkdown('<p><br></p>').body).toBe('')
  })
})

describe('converting back and forth', () => {
  const samples = [
    '<h1>Plan</h1><p>Some <strong>bold</strong> and <em>soft</em> words.</p><blockquote>Said once</blockquote>',
    '<ul><li>one</li><li>two<ul><li>inner</li></ul></li></ul><ol><li>first</li><li>second</li></ol>',
    '<p>line<br>next</p><h2>Café ✨ 東京</h2><p>a *star* &amp; <strong><em>both</em></strong></p>',
  ]

  it.each(samples)('rich text comes back the same: %s', (html) => {
    expect(convert(convert(rich(html)))).toEqual({ format: 'rich', body: html, losses: [] })
  })

  it.each(samples)('a second round gives the same markdown: %s', (html) => {
    const once = convert(rich(html))
    expect(convert(convert(once))).toEqual(once)
  })
})
