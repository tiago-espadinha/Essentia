// Virtus's service worker, built to /virtus/sw.js. The build swaps the manifest
// token for the hashed file list, so each deploy installs as a new version.
import { cacheName, handles, staleCaches, type Precache } from '../src/offline'

declare const self: ServiceWorkerGlobalScope
// A free global, so the minifier keeps its name for the build to replace.
declare const __VIRTUS_PRECACHE__: Precache

const precache = __VIRTUS_PRECACHE__
const CACHE = cacheName(precache.version)
const scope = self.registration.scope

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(precache.files.map((file) => new Request(file, { cache: 'reload' })))))
  // Past the HTTP cache, so the page and its assets come from the same deploy.
  // A new build takes over on the next visit, without a prompt.
  void self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(staleCaches(keys, CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (!handles(request, scope)) return

  // Pages come from the network while online, so a deploy shows up straight away.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => fromCache(scope)))
    return
  }
  // Assets carry `crossorigin`, so their requests send an Origin header that the
  // install requests did not; hosts answer with `Vary: Origin`, which would miss.
  event.respondWith(caches.match(request, { cacheName: CACHE, ignoreVary: true }).then((cached) => cached ?? fetch(request)))
})

async function fromCache(url: string): Promise<Response> {
  return (await caches.match(url, { cacheName: CACHE, ignoreSearch: true, ignoreVary: true })) ?? Response.error()
}
