import { describe, expect, it } from 'vitest'
import { sanitizeHtml } from './sanitize'

describe('sanitizeHtml', () => {
  it('keeps the formatting the editor makes', () => {
    const html =
      '<h1>Plan</h1><h2>Week</h2><p><strong>a</strong> <b>b</b> <em>c</em> <i>d</i> <u>e</u><br></p>' +
      '<blockquote>q</blockquote><ul><li>one</li></ul><ol><li>two</li></ol><div>line</div>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('removes scripts and their content', () => {
    expect(sanitizeHtml('<p>a</p><script>alert(1)</script>')).toBe('<p>a</p>')
  })

  it('removes event handlers and every other attribute', () => {
    expect(sanitizeHtml('<p onclick="alert(1)" style="color:red" class="x" id="y">a</p>')).toBe('<p>a</p>')
  })

  it('removes images, frames, styles and forms', () => {
    const html =
      '<img src=x onerror="alert(1)"><iframe src="https://example.com"></iframe>' +
      '<style>p{}</style><form><input></form><svg><script>alert(1)</script></svg><p>kept</p>'
    expect(sanitizeHtml(html)).toBe('<p>kept</p>')
  })

  it('removes links and javascript: URLs but keeps their text', () => {
    expect(sanitizeHtml('<p><a href="javascript:alert(1)">click</a></p>')).toBe('<p>click</p>')
  })

  it('keeps the text of unknown wrappers such as spans and fonts', () => {
    expect(sanitizeHtml('<p><span style="font-weight:700">bold</span> <font color="red">red</font></p>')).toBe(
      '<p>bold red</p>',
    )
  })

  it('leaves plain text alone, escaping markup characters', () => {
    expect(sanitizeHtml('5 < 6 & 7')).toBe('5 &lt; 6 &amp; 7')
  })
})
