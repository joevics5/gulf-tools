import { routing, type Locale } from './routing'

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

/** hreflang map for a path that exists in every locale, including x-default. */
export function languageAlternates(pathWithoutLocale: string) {
  const path = pathWithoutLocale.startsWith('/') ? pathWithoutLocale : `/${pathWithoutLocale}`
  return {
    ...Object.fromEntries(routing.locales.map(l => [l, `${BASE_URL}/${l}${path}`])),
    'x-default': `${BASE_URL}/${routing.defaultLocale}${path}`,
  }
}
