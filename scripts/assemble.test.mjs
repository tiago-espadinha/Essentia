import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

test('assembles old and new finance entries with their canonical assets, replacing stale output', () => {
  const root = mkdtempSync(join(tmpdir(), 'essentia-assembly-'))
  try {
    mkdirSync(join(root, 'apps/aurum/dist/assets'), { recursive: true })
    mkdirSync(join(root, 'apps/hub/dist'), { recursive: true })
    mkdirSync(join(root, 'dist/merces'), { recursive: true })
    const entry = '<script type="module" src="/merces/assets/finance.js"></script>'
    writeFileSync(join(root, 'apps/aurum/dist/index.html'), entry)
    writeFileSync(join(root, 'apps/aurum/dist/assets/finance.js'), 'finance')
    writeFileSync(join(root, 'apps/hub/dist/index.html'), 'hub')
    writeFileSync(join(root, 'dist/merces/index.html'), 'stale')
    execFileSync(process.execPath, [fileURLToPath(new URL('./assemble.mjs', import.meta.url))], { cwd: root })
    for (const path of ['aurum', 'merces']) {
      assert.equal(readFileSync(join(root, `dist/${path}/index.html`), 'utf8'), entry)
      assert.equal(readFileSync(join(root, `dist/${path}/assets/finance.js`), 'utf8'), 'finance')
    }
    assert.equal(readFileSync(join(root, 'dist/index.html'), 'utf8'), 'hub')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
