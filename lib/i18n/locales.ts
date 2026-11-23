import { routing, type Locale } from './routing'
import ogManifest from '../og/manifest.json'

/**
 * Single place for per-locale facts. Adding a language = add it to
 * routing.ts, add an entry here, add messages/<locale>.json (+ tools/*.json).
 * Nothing else should test `locale === 'ar'`.
 */
type LocaleMeta = {
  dir: 'ltr' | 'rtl'
  /** Open Graph locale */
  og: string
}

export const LOCALE_META: Record<Locale, LocaleMeta> = {
  en: { dir: 'ltr', og: 'en_AE' },
  ar: { dir: 'rtl', og: 'ar_AE' },
}

export const BASE_URL = 'https://gulftools.jobmeter.app'

export const isRtl = (locale: string) => LOCALE_META[locale as Locale]?.dir === 'rtl'

export const ogLocale = (locale: string) =>
  LOCALE_META[locale as Locale]?.og ?? LOCALE_META[routing.defaultLocale].og

/** Normalises '' | '/' | 'about' | '/about' -> '' | '/about' */
const normalizePath = (path: string) => {
  const p = path.startsWith('/') ? path : `/${path}`
  return p === '/' ? '' : p
}

/**
 * hreflang map for a path, including x-default. Pass `locales` to list only the
 * languages that really exist for the page (e.g. untranslated tools are left out).
 */
export function languageAlternates(
  pathWithoutLocale: string,
  locales: readonly string[] = routing.locales
) {
  const path = normalizePath(pathWithoutLocale)
  const def = locales.includes(routing.defaultLocale) ? routing.defaultLocale : locales[0]
  return {
    ...Object.fromEntries(locales.map(l => [l, `${BASE_URL}/${l}${path}`])),
    ...(def ? { 'x-default': `${BASE_URL}/${def}${path}` } : {}),
  }
}

/**
 * canonical + hreflang for one page. Every page MUST set this: Next shallow-merges
 * metadata, so a page without its own `alternates` would otherwise inherit the
 * parent layout's. Use as `alternates: pageAlternates(locale, '/about')`.
 */
export function pageAlternates(locale: string, pathWithoutLocale: string) {
  return {
    canonical: `${BASE_URL}/${locale}${normalizePath(pathWithoutLocale)}`,
    languages: languageAlternates(pathWithoutLocale),
  }
}

/**
 * Default Open Graph image (1200x630) for pages without a dedicated one.
 * public/og/default-<locale>.jpg; unknown locales fall back to the default locale.
 */
export function defaultOgImage(locale: string, alt = 'Gulf Tools') {
  const l = routing.locales.includes(locale as Locale) ? locale : routing.defaultLocale
  return { url: `${BASE_URL}/og/default-${l}.jpg`, width: 1200, height: 630, alt }
}

/**
 * Per-tool OG image if `node scripts/generate-og.mjs` has produced one for this
 * (locale, tool) — listed in lib/og/manifest.json — otherwise the shared default.
 */
export function toolOgImage(locale: string, toolSlug: string, alt = 'Gulf Tools') {
  const have = (ogManifest as Record<string, string[]>)[locale]
  if (have?.includes(toolSlug)) {
    return { url: `${BASE_URL}/og/tools/${locale}/${toolSlug}.jpg`, width: 1200, height: 630, alt }
  }
  return defaultOgImage(locale, alt)
}
