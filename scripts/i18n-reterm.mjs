// Bulk Hindi terminology corrections.
// Reads scripts/i18n-terms.json ({ "oldWording": "newWording", ... }) and applies
// every replacement to all string VALUES in messages/hi/*.json (keys untouched).
// Idempotent. Use for glossary corrections after the auto-generated first pass:
//   1) edit scripts/i18n-terms.json   2) node scripts/i18n-reterm.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const terms = JSON.parse(readFileSync(join(root, 'scripts', 'i18n-terms.json'), 'utf8'))
const pairs = Object.entries(terms).filter(([k]) => k !== '_comment')

const mapStrings = (v) => {
  if (typeof v === 'string') {
    let s = v
    for (const [from, to] of pairs) s = s.split(from).join(to)
    return s
  }
  if (Array.isArray(v)) return v.map(mapStrings)
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mapStrings(x)]))
  return v
}

const dir = join(root, 'messages', 'hi')
let changed = 0
for (const f of readdirSync(dir).filter(x => x.endsWith('.json'))) {
  const p = join(dir, f)
  const before = readFileSync(p, 'utf8')
  const after = JSON.stringify(mapStrings(JSON.parse(before)), null, 2) + '\n'
  if (after !== before) { writeFileSync(p, after); changed++; console.log('updated', f) }
}
console.log(`${pairs.length} term(s) applied · ${changed} file(s) changed`)
