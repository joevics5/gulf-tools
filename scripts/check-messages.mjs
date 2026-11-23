// Verifies every locale has the same tool message files and key sets as the
// default locale. Run with: npm run check:messages
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'messages')
const DEFAULT = 'en'
const locales = readdirSync(root, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
  )
}

const toolsDir = l => join(root, l, 'tools')
const files = l => (existsSync(toolsDir(l)) ? readdirSync(toolsDir(l)).filter(f => f.endsWith('.json')) : [])
const base = files(DEFAULT)
let problems = 0

for (const locale of locales) {
  if (locale === DEFAULT) continue
  const have = new Set(files(locale))
  for (const f of base) {
    if (!have.has(f)) {
      console.error(`✗ ${locale}: missing tools/${f}`)
      problems++
      continue
    }
    const a = new Set(keys(JSON.parse(readFileSync(join(toolsDir(DEFAULT), f), 'utf8'))))
    const b = new Set(keys(JSON.parse(readFileSync(join(toolsDir(locale), f), 'utf8'))))
    for (const k of a) if (!b.has(k)) { console.error(`✗ ${locale}/${f}: missing key ${k}`); problems++ }
    for (const k of b) if (!a.has(k)) { console.error(`✗ ${locale}/${f}: extra key ${k}`); problems++ }
  }
  for (const f of have) if (!base.includes(f)) { console.error(`✗ ${locale}: tools/${f} has no ${DEFAULT} counterpart`); problems++ }
}

// ICU safety. next-intl returns messages without `{` or `<` untouched, but in a message WITH
// placeholders an apostrophe is ICU quoting syntax: a doubled one collapses to one, and one
// next to a brace quotes it. Keep apostrophes away from braces and never double them.
const leaves = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? leaves(v, `${p}${k}.`) : [[`${p}${k}`, v]]))
for (const locale of locales) {
  for (const f of files(locale)) {
    const tool = JSON.parse(readFileSync(join(toolsDir(locale), f), 'utf8'))
    for (const [k, v] of leaves(tool)) {
      if (typeof v === 'string' && /[{<]/.test(v) && /''|'[{}]|[{}]'/.test(v)) {
        console.error(`✗ ${locale}/${f}: "${k}" has an apostrophe next to ICU syntax or a doubled apostrophe`); problems++
      }
    }
  }
}

if (problems) { console.error(`\n${problems} problem(s)`); process.exit(1) }
console.log(`✓ tool messages consistent across: ${locales.join(', ')} (${base.length} tool file(s))`)
