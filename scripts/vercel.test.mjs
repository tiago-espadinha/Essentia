import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { rewrite } from '../vite.preview.config.mjs'

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'))
const LINK = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'

/** Vercel's `:name` and `:name*` segments, enough for the rules this project uses. */
const matches = (source, path) =>
  new RegExp(`^${source.replace(/:\w+\*/g, '.*').replace(/:\w+/g, '[^/]+')}$`).test(path)
const rewriteOf = (path) => config.rewrites.find((rule) => matches(rule.source, path))?.destination ?? path
const headersOf = (path) =>
  Object.fromEntries(config.headers.filter((rule) => new RegExp(`^${rule.source}$`).test(path)).flatMap((rule) => rule.headers).map((h) => [h.key, h.value]))

// Vercel's matcher is approximated above: this pins that vercel.json and the preview server agree.
test('both share paths open Folio, out of search results, under the suite-wide headers', () => {
  for (const path of [`/folio/shared/${LINK}`, `/dictum/shared/${LINK}`]) {
    assert.equal(rewriteOf(path), '/folio/index.html', path)
    assert.equal(rewrite(path, () => false), '/folio/index.html', path)
    assert.equal(rewrite(`${path}/`, () => false), '/folio/index.html', path)
    const headers = headersOf(path)
    assert.equal(headers['X-Robots-Tag'], 'noindex, nofollow', path)
    assert.match(headers['Content-Security-Policy'], /default-src 'self'/, path)
    assert.equal(headers['X-Frame-Options'], 'DENY', path)
  }
})

test('Dictum itself still opens Dictum, and other apps are neither rewritten nor hidden', () => {
  assert.equal(rewriteOf('/dictum/'), '/dictum/index.html')
  assert.equal(rewrite('/dictum/', () => false), '/dictum/index.html')
  assert.equal(rewrite('/dictum/sw.js', () => true), '/dictum/sw.js')
  for (const path of ['/folio/', '/folio/assets/index.js', '/']) {
    assert.equal(rewriteOf(path), path)
    assert.equal(rewrite(path, () => false), path)
    assert.equal(headersOf(path)['X-Robots-Tag'], undefined, path)
  }
})
