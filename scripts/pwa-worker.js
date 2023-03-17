/* Build-time configuration contains only this entry's static output. */
const config = __ESSENTIA_PWA__
const cacheName = config.prefix + config.version
const origin = new URL(self.registration.scope).origin
const staticPaths = new Set(config.files)
const absolute = (path) => origin + path

self.addEventListener('install', (event) => {
  // Do not skip waiting: existing pages must retain their own build's assets.
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(cacheName)
      await cache.addAll(config.files.map((path) => new Request(absolute(path), {
        cache: 'reload', integrity: config.integrity[path],
      })))
    } catch (error) {
      await caches.delete(cacheName)
      throw error
    }
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith(config.prefix) && key !== cacheName).map((key) => caches.delete(key)))
  })())
})

async function cached(path) {
  const response = await caches.match(absolute(path), { cacheName, ignoreVary: true })
  if (response) return response
  // Eviction can leave a live registration without its files. Only the exact
  // build's static bytes are acceptable when recovering an individual asset.
  return fetch(new Request(absolute(path), { integrity: config.integrity[path] }))
}

async function entry(request) {
  const response = await caches.match(absolute(`${config.base}index.html`), { cacheName, ignoreVary: true })
  if (response) return response
  // The original deploy may be gone. Recover the current network entry, then
  // let its normal registration install a complete build instead of stranding
  // this browser behind an unchanged worker with an evicted cache.
  const current = await fetch(request)
  if (current.ok) await self.registration.unregister()
  return current
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== origin) return

  if (request.mode === 'navigate') {
    if (url.pathname === config.base || url.pathname === `${config.base}index.html`) {
      event.respondWith(entry(request))
    } else if (config.base === '/dictum/' && url.pathname.startsWith('/dictum/shared/')) {
      // The shell is static, but neither shared responses nor private records
      // ever enter Cache Storage. Revoked shares therefore cannot reappear offline.
      event.respondWith(fetch(request).catch(() => cached(`${config.base}offline.html`)))
    }
    return
  }

  if (staticPaths.has(url.pathname)) event.respondWith(cached(url.pathname))
})
