import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('./pwa-worker.js', import.meta.url), 'utf8')
const origin = 'https://essentia.test'

function worker({ base = '/virtus/', version = 'new', stores = new Map(), broken = false } = {}) {
  const prefix = base === '/virtus/' ? 'virtus-' : 'essentia-hub-'
  const files = [`${base}index.html`, `${base}assets/entry.js`, `${base}assets/lazy.js`, `${base}offline.html`]
  const integrity = Object.fromEntries(files.map((path) => [path, `sha256-${createHash('sha256').update(`static ${version}: ${origin + path}`).digest('base64')}`]))
  const config = { base, version, prefix, files, integrity }
  const listeners = new Map()
  let networkFails = false
  const network = []
  const takeovers = []
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      return {
        async addAll(requests) {
          // Deliberately model a partial write too: even if a browser/cache
          // implementation fails mid-install, the failed build must be removed.
          for (const request of requests) {
            assert.equal(request.cache, 'reload')
            assert.equal(request.integrity, integrity[new URL(request.url).pathname])
            if (broken && request.url.endsWith('lazy.js')) throw Error('interrupted install')
            stores.get(name).set(request.url, `static ${version}: ${request.url}`)
          }
        },
      }
    },
    async keys() { return [...stores.keys()] },
    async delete(name) { return stores.delete(name) },
    async match(url, { cacheName }) {
      const value = stores.get(cacheName)?.get(url)
      return value === undefined ? undefined : new Response(value)
    },
  }
  runInNewContext(source.replace('__ESSENTIA_PWA__', JSON.stringify(config)), {
    self: {
      registration: { scope: origin + base, unregister: async () => { takeovers.push('unregister'); return true } },
      addEventListener: (name, callback) => listeners.set(name, callback),
      skipWaiting: () => takeovers.push('skipWaiting'),
      clients: { claim: () => takeovers.push('claim') },
    },
    caches, URL, Request, Response, Set,
    async fetch(request) {
      network.push(request.url)
      if (networkFails) throw Error('offline')
      if (config.integrity[new URL(request.url).pathname] && request.integrity) {
        assert.equal(request.integrity, config.integrity[new URL(request.url).pathname])
        return new Response(`static ${version}: ${request.url}`)
      }
      return new Response('PRIVATE shared response')
    },
  })
  return {
    stores, network, takeovers, files, cacheName: prefix + version,
    offline() { networkFails = true },
    async lifecycle(name) {
      let pending
      listeners.get(name)({ waitUntil(value) { pending = value } })
      await pending
    },
    async request(path, { method = 'GET', mode = 'cors' } = {}) {
      let response
      listeners.get('fetch')({
        request: { url: path.startsWith('https:') ? path : origin + path, method, mode },
        respondWith(value) { response = value },
      })
      return response === undefined ? null : await response
    },
  }
}

test('installs only its static allowlist and waits without claiming open clients', async () => {
  const w = worker()
  await w.lifecycle('install')
  assert.deepEqual([...w.stores.get(w.cacheName).keys()], w.files.map((path) => origin + path))
  assert.deepEqual(w.takeovers, [])
})

test('activation deletes only this target’s obsolete caches', async () => {
  const stores = new Map([
    ['virtus-old', new Map()], ['essentia-hub-other', new Map()],
    ['essentia-dictum-other', new Map()], ['unrelated-cache', new Map()],
  ])
  const w = worker({ stores })
  await w.lifecycle('install')
  await w.lifecycle('activate')
  assert.deepEqual([...stores.keys()], ['essentia-hub-other', 'essentia-dictum-other', 'unrelated-cache', 'virtus-new'])
  assert.deepEqual(w.takeovers, [])
})

test('interrupted update removes the partial new build and preserves the working build', async () => {
  const stores = new Map([['virtus-old', new Map([[origin + '/virtus/index.html', 'working page']])]])
  const w = worker({ stores, broken: true })
  await assert.rejects(w.lifecycle('install'), /interrupted install/)
  assert.equal(stores.has('virtus-new'), false)
  assert.equal(stores.get('virtus-old').get(origin + '/virtus/index.html'), 'working page')
})

test('controlled navigation and lazy assets stay on the same installed build', async () => {
  const w = worker({ version: 'A' })
  await w.lifecycle('install')
  const page = await w.request('/virtus/?view=week', { mode: 'navigate' })
  const index = await w.request('/virtus/index.html', { mode: 'navigate' })
  const lazy = await w.request('/virtus/assets/lazy.js')
  assert.match(await page.text(), /^static A:/)
  assert.match(await index.text(), /^static A:/)
  assert.match(await lazy.text(), /^static A:/)
  assert.deepEqual(w.network, [])
})

test('never handles private APIs, writes, foreign origins, unknown or neighboring app paths', async () => {
  const w = worker()
  await w.lifecycle('install')
  const before = [...w.stores.get(w.cacheName)]
  for (const path of [
    '/virtus/api/private', '/virtus/unknown', '/virtus-old/', '/dictum/',
    'https://abc.supabase.co/rest/v1/habits', 'https://fonts.gstatic.com/font.woff2',
  ]) {
    assert.equal(await w.request(path), null, path)
    assert.equal(await w.request(path, { mode: 'navigate' }), null, path)
  }
  assert.equal(await w.request('/virtus/assets/entry.js', { method: 'POST' }), null)
  assert.deepEqual([...w.stores.get(w.cacheName)], before)
})

test('static query variants serve only their original build-generated response', async () => {
  const w = worker()
  await w.lifecycle('install')
  const response = await w.request('/virtus/assets/entry.js?private=sentinel')
  assert.equal(await response.text(), 'static new: https://essentia.test/virtus/assets/entry.js')
  assert.equal([...w.stores.get(w.cacheName).keys()].some((path) => path.includes('?')), false)
})

test('root worker bypasses every app and owns only hub navigation/assets', async () => {
  const w = worker({ base: '/' })
  await w.lifecycle('install')
  assert.match(await (await w.request('/', { mode: 'navigate' })).text(), /static new:/)
  for (const path of ['/virtus/', '/acta/', '/folio/', '/merces/', '/aurum/', '/dictum/shared/id', '/api/private']) {
    assert.equal(await w.request(path, { mode: 'navigate' }), null, path)
    assert.equal(await w.request(path + 'assets/entry.js'), null, path)
  }
})

test('shared navigation remains network-only, with a static offline fallback and no retained content', async () => {
  const w = worker({ base: '/dictum/' })
  await w.lifecycle('install')
  const path = '/dictum/shared/aaaaaaaa-aaaa-4aaa-8aaa-000000000001'
  assert.equal(await (await w.request(path, { mode: 'navigate' })).text(), 'PRIVATE shared response')
  w.offline()
  assert.match(await (await w.request(path, { mode: 'navigate' })).text(), /static new: .*offline.html/)
  assert.equal([...w.stores.values()].some((cache) => [...cache.values()].some((body) => body.includes('PRIVATE'))), false)
  assert.equal([...w.stores.values()].some((cache) => cache.has(origin + path)), false)
})

test('evicted static assets recover only through integrity-checked network reads without runtime caching', async () => {
  const w = worker()
  await w.lifecycle('install')
  w.stores.clear()
  assert.match(await (await w.request('/virtus/assets/lazy.js')).text(), /static new:/)
  assert.equal(w.stores.size, 0)
  assert.deepEqual(w.takeovers, [])
})

test('evicted navigation recovers the current online entry and permits a complete fresh installation', async () => {
  const w = worker()
  await w.lifecycle('install')
  w.stores.clear()
  assert.equal((await w.request('/virtus/', {mode:'navigate'})).ok, true)
  assert.deepEqual(w.takeovers, ['unregister'])
  assert.equal(w.stores.size, 0)
})

test('offline eviction cannot unregister a working registration or invent unavailable assets', async () => {
  const w = worker()
  await w.lifecycle('install')
  w.stores.clear()
  w.offline()
  await assert.rejects(w.request('/virtus/', {mode:'navigate'}), /offline/)
  assert.deepEqual(w.takeovers, [])
})
