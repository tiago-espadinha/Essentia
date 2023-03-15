import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { expect, it } from 'vitest'
import { messages as acta } from '../../../../apps/acta/src/locale'
import { messages as aurum } from '../../../../apps/aurum/src/locale'
import { messages as dictum } from '../../../../apps/dictum/src/locale'
import { messages as folio } from '../../../../apps/folio/src/locale'
import { messages as hub } from '../../../../apps/hub/src/locale'
import { messages as virtus } from '../../../../apps/virtus/src/locale'
import { messages as account } from '../../../supabase/src/locale'
import { messages as ui } from '../locale'

const catalogs = { acta, aurum, dictum, folio, hub, virtus, account, ui }
const variables = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort()

function literalKeys(node: ts.Node): string[] {
  if (ts.isStringLiteralLike(node)) return [node.text]
  if (ts.isConditionalExpression(node)) return [...literalKeys(node.whenTrue), ...literalKeys(node.whenFalse)]
  return []
}

it.each(Object.entries(catalogs))('%s has Portuguese copy with matching interpolation variables', (_name, messages) => {
  for (const [key, value] of Object.entries(messages)) {
    expect(value.trim(), key).not.toBe('')
    expect(variables(value), key).toEqual(variables(key))
  }
})

it.each(Object.entries(catalogs))('%s translates every literal message used by its source', (name, messages) => {
  const directory = resolve('../..', name === 'ui' ? 'packages/ui/src' : name === 'account'
    ? 'packages/supabase/src' : `apps/${name}/src`)
  const missing: string[] = []
  for (const entry of readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) continue
    const path = resolve(entry.parentPath, entry.name)
    if (path.includes('/tests/') || entry.name === 'locale.ts') continue
    const source = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true,
      path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
    function visit(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 't') {
        const key = node.arguments[0]
        for (const text of key ? literalKeys(key) : []) {
          if (!Object.hasOwn(messages, text)) missing.push(`${entry.name}: ${text}`)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  expect(missing).toEqual([])
})
