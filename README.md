# Gulf Tools

Free calculators and guides for the Gulf region (UAE, Saudi Arabia, Qatar, Kuwait,
Bahrain, Oman, Egypt), in English and Arabic.

Next.js (App Router) · next-intl · Supabase · Tailwind 4

## Develop

```bash
npm install
npm run dev            # http://localhost:3000 (redirects to /en)
npm run lint
npm run check:messages # en/ar tool strings have identical keys
npm run build
node scripts/generate-og.mjs  # per-tool social cards from tool_translations (see script header)
```

Supabase connection details go in `.env.local` (see `lib/supabase/client.ts` for the
variable names).

## Layout

| Path | What |
|---|---|
| `lib/registry/` | Tools, categories, locations — the single source of truth |
| `app/[locale]/tools/[category]/[tool]/page.tsx` | The one template every tool renders through |
| `components/tools/<category>/` | Tool components |
| `messages/<locale>.json` | Site-wide UI strings |
| `messages/<locale>/tools/<slug>.json` | Per-tool UI strings |
| `lib/i18n/` | Locale routing, per-locale metadata, tool message loading |
| `lib/supabase/` | Tool SEO copy and blog content (`tool_translations`, `articles`) |

Contributor rules and the per-page checklist are in [CLAUDE.md](./CLAUDE.md).
