// Rules shared by the service worker (sw/worker.ts) and the build plugin that
// writes its precache list (vite.config.ts). Every Essentia app shares one
// origin, so Virtus only touches caches that start with its own prefix.

export const CACHE_PREFIX = 'virtus-'

/** The global in sw/worker.ts that the build replaces with the precache manifest. */
export const MANIFEST_TOKEN = '__VIRTUS_PRECACHE__'

export interface Precache {
  version: string
  /** Paths relative to the worker's scope; `./` is the app's page. */
  files: string[]
}

export const cacheName = (version: string) => `${CACHE_PREFIX}${version}`

/** Older Virtus caches to drop once a new worker takes over; other apps' caches stay. */
export function staleCaches(keys: string[], current: string): string[] {
  return keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== current)
}

/** Whether the worker answers a request: only same-origin reads inside the app's scope; Supabase and fonts go straight to the network. */
export function handles(request: { method: string; url: string }, scope: string): boolean {
  return request.method === 'GET' && request.url.startsWith(scope)
}

/** The built files to store on install: the page, the bundle and the public files, without source maps or the worker itself. */
export function precacheFiles(fileNames: string[]): string[] {
  const files = fileNames.filter((name) => name !== 'sw.js' && name !== 'index.html' && !name.endsWith('.map') && !name.startsWith('.vite/'))
  return ['./', ...[...new Set(files)].sort()]
}
