import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { build } from 'vite'
import { suitePwa } from './pwa.ts'

test('precache integrity matches final Vite output after lazy-import CSS rewriting', async () => {
  const root = mkdtempSync(join(tmpdir(), 'essentia-pwa-build-'))
  try {
    mkdirSync(join(root, 'public'))
    writeFileSync(join(root, 'index.html'), '<!doctype html><html><head></head><body><script type="module" src="/main.js"></script></body></html>')
    writeFileSync(join(root, 'main.js'), 'globalThis.showPreview = () => import("./lazy.js")')
    writeFileSync(join(root, 'lazy.js'), 'import "./lazy.css"; export const text = "Preview"')
    writeFileSync(join(root, 'lazy.css'), 'main { display: block; }')
    const outDir = join(root, 'dist')
    await build({ root, configFile: false, plugins: [suitePwa('Essentia', 'Essentia')], logLevel: 'silent' })
    const worker = readFileSync(join(outDir, 'sw.js'), 'utf8')
    const config = JSON.parse(worker.match(/const config = (.*)\n/)[1])
    assert.ok(config.files.some(file => /lazy-.*\.css$/.test(file)))
    for (const file of config.files) {
      const bytes = readFileSync(join(outDir, file))
      assert.equal(config.integrity[file], `sha256-${createHash('sha256').update(bytes).digest('base64')}`, file)
    }
    assert.equal(worker.includes('__ESSENTIA_PWA__'), false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
