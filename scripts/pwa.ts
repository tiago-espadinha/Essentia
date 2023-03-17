import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import type { Plugin } from 'vite'

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')
const tokens = source('../packages/tokens/tokens.css')
const rootTokens = tokens.match(/:root\s*\{([^}]+)\}/)?.[1] ?? ''

function color(name: string): string {
  const value = rootTokens.match(new RegExp(`--color-${name}:\\s*([^;]+);`))?.[1]?.trim()
  if (!value) throw new Error(`Missing PWA color token: ${name}`)
  return value
}

const themeColor = color('terracotta')
const backgroundColor = color('sand')

/** Every entry owns a static-only cache and an independent worker lifecycle. */
export function suitePwa(shortName: string, name: string): Plugin {
  let base = '/'
  let publicDir = ''
  return {
    name: 'essentia-pwa',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      base = config.base
      publicDir = config.publicDir
    },
    transformIndexHtml(html, context) {
      if (!context.filename.endsWith('index.html')) return html
      // Older Virtus markup used root-relative metadata; one canonical set also
      // makes the legacy finance entry install the canonical Merces identity.
      return {
        html: html.replace(/\s*<(?:link\b[^>]*\brel="(?:manifest|apple-touch-icon)"|meta\b[^>]*\bname="theme-color")[^>]*>/g, ''),
        tags: [
          { tag: 'link', attrs: { rel: 'manifest', href: `${base}manifest.webmanifest` }, injectTo: 'head' },
          { tag: 'link', attrs: { rel: 'apple-touch-icon', href: `${base}icon-192.png` }, injectTo: 'head' },
          { tag: 'meta', attrs: { name: 'theme-color', content: themeColor }, injectTo: 'head' },
        ],
      }
    },
    generateBundle(_, bundle) {
      const contents = new Map<string, string | Uint8Array>()
      for (const entry of readdirSync(publicDir, { recursive: true, withFileTypes: true })) {
        const path = join(entry.parentPath, entry.name)
        if (statSync(path).isFile()) contents.set(relative(publicDir, path).split(sep).join('/'), readFileSync(path))
      }
      for (const output of Object.values(bundle)) {
        contents.set(output.fileName, output.type === 'chunk' ? output.code : output.source)
      }
      const generated = new Map([
        ['manifest.webmanifest', JSON.stringify({
          id: base, name, short_name: shortName, start_url: base, scope: base,
          display: 'standalone', background_color: backgroundColor, theme_color: themeColor,
          icons: [
            { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png' },
            { src: `${base}icon-512.png`, sizes: '512x512', type: 'image/png' },
            { src: `${base}icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        }, null, 2)],
        ['offline.html', source('./pwa-offline.html').replaceAll('__BASE__', base).replaceAll('__APP__', shortName)],
        ['pwa-offline.js', source('./pwa-offline.js')],
        ['pwa-offline.css', tokens + '\n' + source('../packages/tokens/base.css') + '\n' + source('./pwa-offline.css')],
      ])
      for (const [fileName, content] of generated) {
        contents.set(fileName, content)
        this.emitFile({ type: 'asset', fileName, source: content })
      }
      const files = [...contents.keys()].filter((file) => file !== 'sw.js' && file !== '404.html' && !file.endsWith('.map') && !file.startsWith('.vite/')).sort()
      const worker = source('./pwa-worker.js')
      const hash = createHash('sha256').update(worker)
      for (const file of files) hash.update(file).update(contents.get(file)!)
      const config = {
        base,
        prefix: shortName === 'Virtus' ? 'virtus-' : `essentia-${shortName === 'Essentia' ? 'hub' : shortName.toLowerCase()}-`,
        version: hash.digest('hex').slice(0, 16),
        files: files.map((file) => `${base}${file}`),
        integrity: Object.fromEntries(files.map((file) => [
          `${base}${file}`, `sha256-${createHash('sha256').update(contents.get(file)!).digest('base64')}`,
        ])),
      }
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: worker.replace('__ESSENTIA_PWA__', JSON.stringify(config)) })
    },
  }
}
