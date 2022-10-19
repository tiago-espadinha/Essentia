import { describe, expect, it } from 'vitest'
import { handles, precacheFiles, staleCaches } from './offline'

const SCOPE = 'https://essentia.test/virtus/'

describe('handles', () => {
  it('takes reads inside the app', () => {
    expect(handles({ method: 'GET', url: `${SCOPE}assets/index-abc.js` }, SCOPE)).toBe(true)
    expect(handles({ method: 'GET', url: SCOPE }, SCOPE)).toBe(true)
  })

  it('leaves Supabase, fonts and other apps to the network', () => {
    expect(handles({ method: 'GET', url: 'https://abc.supabase.co/rest/v1/habits?select=*' }, SCOPE)).toBe(false)
    expect(handles({ method: 'GET', url: 'https://fonts.gstatic.com/s/font.woff2' }, SCOPE)).toBe(false)
    expect(handles({ method: 'GET', url: 'https://essentia.test/dictum/' }, SCOPE)).toBe(false)
    expect(handles({ method: 'GET', url: 'https://essentia.test/virtus-old/' }, 'https://essentia.test/virtus/')).toBe(false)
  })

  it('never takes writes', () => {
    expect(handles({ method: 'POST', url: `${SCOPE}assets/index-abc.js` }, SCOPE)).toBe(false)
  })
})

describe('staleCaches', () => {
  it('drops older Virtus caches and keeps the current one and other apps', () => {
    const keys = ['virtus-old1', 'virtus-new2', 'dictum-v1', 'folio-cache']
    expect(staleCaches(keys, 'virtus-new2')).toEqual(['virtus-old1'])
  })
})

describe('precacheFiles', () => {
  it('lists the page first, then the bundle and public files without maps or the worker', () => {
    expect(
      precacheFiles(['sw.js', 'index.html', 'assets/index-b.js', 'assets/index-b.js.map', 'favicon.svg', 'assets/index-a.css', '.vite/manifest.json']),
    ).toEqual(['./', 'assets/index-a.css', 'assets/index-b.js', 'favicon.svg'])
  })

  it('lists each file once', () => {
    expect(precacheFiles(['favicon.svg', 'favicon.svg'])).toEqual(['./', 'favicon.svg'])
  })
})
