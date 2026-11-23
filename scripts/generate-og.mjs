// Generates one 1200x630 Open Graph image per (tool, locale) from tool_translations titles.
//
//   npm i --no-save playwright @fontsource/cairo && npx playwright install chromium
//   node scripts/generate-og.mjs            # reads NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY (or .env.local)
//   node scripts/generate-og.mjs rows.json  # or a JSON array of { tool_slug, locale, title } for offline use
//
// Writes public/og/tools/<locale>/<slug>.jpg and lib/og/manifest.json. The tool page uses a
// tool's own image only if it is listed in the manifest, otherwise the shared default, so a
// partial run is safe. Chromium (not satori/next-og) renders the cards: it shapes Arabic correctly.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'package.json'))

let chromium
try { ({ chromium } = require('playwright')) } catch {
  console.error('Missing dev tools. Run:  npm i --no-save playwright @fontsource/cairo && npx playwright install chromium'); process.exit(1)
}
let fontDir
try { fontDir = join(dirname(require.resolve('@fontsource/cairo/package.json')), 'files') } catch {
  console.error('Missing @fontsource/cairo. Run:  npm i --no-save playwright @fontsource/cairo'); process.exit(1)
}

// ---- load .env.local if present (no dependency) ----
const envFile = join(root, '.env.local')
if (existsSync(envFile)) for (const l of readFileSync(envFile, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
}

async function loadRows() {
  const arg = process.argv[2]
  if (arg) return JSON.parse(readFileSync(arg, 'utf8'))
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, or pass a rows.json'); process.exit(1) }
  const res = await fetch(`${url}/rest/v1/tool_translations?select=tool_slug,locale,title`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!res.ok) { console.error('Supabase request failed:', res.status, await res.text()); process.exit(1) }
  return res.json()
}

const b64 = f => readFileSync(join(fontDir, f)).toString('base64')
const AR = 'U+0600-06FF,U+0750-077F,U+FB50-FDFF,U+FE70-FEFF,U+200C-200F', LAT = 'U+0000-00FF,U+2013-2014,U+2022,U+2026'
const face = (f, w, r) => `@font-face{font-family:Cairo;font-weight:${w};src:url(data:font/woff2;base64,${b64(f)}) format('woff2');unicode-range:${r}}`
const css = [face('cairo-arabic-700-normal.woff2', 700, AR), face('cairo-latin-700-normal.woff2', 700, LAT), face('cairo-arabic-500-normal.woff2', 500, AR), face('cairo-latin-500-normal.woff2', 500, LAT)].join('')
const logo = readFileSync(join(root, 'public/logo.png')).toString('base64')
const BRAND = { en: 'Gulf Tools', ar: 'أدوات الخليج' }
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const card = (locale, title) => `<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><style>${css}
*{margin:0;box-sizing:border-box}html,body{width:1200px;height:630px;overflow:hidden}
.root{width:1200px;height:630px;font-family:Cairo,sans-serif;background:linear-gradient(135deg,#064e3b 0%,#047857 55%,#10b981 100%);color:#fff;display:flex;flex-direction:column;justify-content:space-between;padding:70px 90px;position:relative;overflow:hidden}
.c1,.c2{position:absolute;border-radius:50%;background:rgba(255,255,255,.07)}.c1{width:520px;height:520px;right:-140px;top:-180px}.c2{width:320px;height:320px;left:-90px;bottom:-140px}
.brand{display:flex;align-items:center;gap:22px;position:relative;font-size:38px;font-weight:700}.brand img{width:84px;height:84px;border-radius:20px;background:#fff;padding:8px}
h1{position:relative;font-size:${title.length > 38 ? 78 : 96}px;font-weight:700;line-height:1.2;max-width:1000px}
.url{position:relative;font-size:30px;font-weight:500;opacity:.85}
</style><body><div class=root><div class=c1></div><div class=c2></div>
<div class=brand><img src="data:image/png;base64,${logo}"><span>${BRAND[locale] ?? BRAND.en}</span></div>
<h1>${esc(title)}</h1><div class=url>gulftools.jobmeter.app</div></div></body></html>`

const rows = (await loadRows()).filter(r => r.tool_slug && r.locale && r.title && /^[a-z0-9-]+$/.test(r.tool_slug) && /^[a-z]{2,3}$/.test(r.locale))
if (!rows.length) { console.error('No usable rows'); process.exit(1) }

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
const manifest = {}
for (const { tool_slug, locale, title } of rows) {
  const dir = join(root, 'public/og/tools', locale); mkdirSync(dir, { recursive: true })
  await page.setContent(card(locale, title)); await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: join(dir, `${tool_slug}.jpg`), type: 'jpeg', quality: 86 })
  ;(manifest[locale] ??= []).push(tool_slug)
}
await browser.close()
for (const l of Object.keys(manifest)) manifest[l].sort()
mkdirSync(join(root, 'lib/og'), { recursive: true })
writeFileSync(join(root, 'lib/og/manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Generated ${rows.length} image(s) for: ${Object.entries(manifest).map(([l, s]) => `${l}=${s.length}`).join(', ')}`)
