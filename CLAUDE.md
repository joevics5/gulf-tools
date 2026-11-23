@AGENTS.md

# Gulf Tools — Working Notes for Claude / Coding Agents

Standards that are cheap to follow now and expensive to retrofit across 70+ tools later.

## Architecture in one minute

- **One registry, one template.** Tools are declared in `lib/registry/tools.ts`
  (slug, category, countries, related tools). Every tool renders through
  `app/[locale]/tools/[category]/[tool]/page.tsx`. Don't create per-language
  pages or per-language copies of a component.
- **Locales** are defined in `lib/i18n/routing.ts`; per-locale facts (direction,
  OG locale, hreflang) live in `lib/i18n/locales.ts`. **Never write
  `locale === 'ar'`** — use `isRtl(locale)`, `ogLocale(locale)`,
  `languageAlternates(path)`.
- **Tool UI strings are not in components.** They live in
  `messages/<locale>/tools/<slug>.json` and are read with
  `useTranslations('tool')`. The tool page wraps each tool in `<ToolMessages>`,
  which sends only that tool's strings to the browser.
- Tool SEO copy (title, description, FAQ, article) comes from the Supabase
  `tool_translations` table, not from the JSON files.

## Adding a tool

1. Add the entry to `lib/registry/tools.ts`.
2. Create the component in `components/tools/<category>/` and add its `case` to
   `loadToolComponent` in the tool page.
3. Add `messages/en/tools/<slug>.json` and `messages/ar/tools/<slug>.json`
   with **identical key sets**.
4. Add the `tool_translations` rows (en + ar) in Supabase.
5. Run the checklist below.

Component pattern:

```tsx
'use client'
import { useTranslations } from 'next-intl'

export default function MyCalculator(_props: { locale: string }) {
  const t = useTranslations('tool')
  return <label>{t('labels.amount')}</label>
}
```

Reference implementation: `components/tools/finance/SalaryCalculator.tsx`.

Not every older tool is migrated yet. Tools that still contain `isAr`
ternaries work as before; when you touch one, migrate it to this pattern
instead of adding more ternaries. Locale-specific *data* (month names, currency
labels) goes in the JSON file too, not in the component.

## Adding a language

1. Add the code to `lib/i18n/routing.ts` and an entry to `LOCALE_META` in
   `lib/i18n/locales.ts` (TypeScript will flag anything missed).
2. Add `messages/<locale>.json`.
3. Add `messages/<locale>/tools/<slug>.json` for each migrated tool.
4. Add `tool_translations` rows for the locale. **A tool page with no row for a
   locale serves English fallback text**: it is automatically `noindex`, left
   out of hreflang and out of `sitemap-tools.xml`, and appears in all three as
   soon as the row exists. Don't work around that by copying English into the row.
5. Replace the hard-coded `['en', 'ar']` lists in `app/sitemap-*.xml/route.ts`
   with `routing.locales`.

## Every page MUST ship with these four things

Applies to every page a user can land on from a search engine. A page without
them is not done.

1. **Visible breadcrumb + back button** (`components/layout/Breadcrumb`,
   `BackButton`) at the top of the page. In RTL, icons and separators mirror —
   the existing components handle this; don't hand-roll new ones.
2. **JSON-LD** via `components/seo/SchemaOrg`: a `BreadcrumbList` whose names
   and URLs **exactly match** the visible breadcrumb, a `mainEntity` (see
   `lib/schema/schemas.ts`), and `FAQPage` if the page has an FAQ.
3. **Metadata**: `title`, `description`, `openGraph` and
   `alternates: pageAlternates(locale, '/path')` (canonical + hreflang incl.
   `x-default`). **Every page must set its own `alternates`** — Next merges
   metadata shallowly, so a page without it inherits its parent's. Don't put a
   canonical in a layout. Don't add a `title.template`: titles already end in
   `| Gulf Tools`. For images use `defaultOgImage(locale, alt)` (1200x630,
   `public/og/default-<locale>.jpg`); only reference a per-page image that exists. Tool pages
   use `toolOgImage(locale, slug, alt)`: a per-tool card if `lib/og/manifest.json` lists it,
   else the default. Generate cards with `scripts/generate-og.mjs` (see header for setup).
4. **Discovery**: the URL appears in the right `app/sitemap-*.xml/route.ts`
   and is linked from its category/hub page.

## Pre-commit checklist

- [ ] Strings come from `messages/<locale>/tools/<slug>.json`; en and ar key sets match
- [ ] No new `locale === 'ar'` / `isAr` branching
- [ ] Breadcrumb visible; matches `BreadcrumbList` JSON-LD
- [ ] Metadata complete, hreflang via `languageAlternates()`
- [ ] Tool in registry, `loadToolComponent`, and sitemap
- [ ] RTL checked visually for Arabic (`dir="rtl"` flows from the page)
- [ ] `npm run lint`, `npx tsc --noEmit` and `npm run build` pass
- [ ] `npm run check:messages` passes

## Concurrent editing

Other sessions may be working in this repo. Before pushing, `git fetch` and
check the remote; merge, don't force-push, and re-verify on the merged tree.
