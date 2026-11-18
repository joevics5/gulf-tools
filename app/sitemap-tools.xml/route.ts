// 📁 app/sitemap-tools/route.ts
// Covers: tool pages, per locale that has real translated content.
// Falls back to the full TOOLS registry if Supabase is unavailable.

import { buildSitemapXml, xmlResponse } from '@/lib/sitemap/xml'
import { TOOLS } from '@/lib/registry/tools'
import { createSupabasePublicClient } from '@/lib/supabase/client'

import { BASE_URL, languageAlternates } from '@/lib/i18n/locales'
import { routing } from '@/lib/i18n/routing'
const locales  = routing.locales

/**
 * tool slug -> locales that have their own tool_translations row.
 * Locales without a row serve English fallback content and are noindexed by the
 * tool page, so they must not appear in the sitemap or hreflang.
 * If Supabase is unavailable, assume every tool exists in every locale.
 */
async function getTranslatedLocales(): Promise<Map<string, string[]>> {
  const everything = new Map(TOOLS.map(t => [t.slug, [...locales] as string[]]))
  try {
    const supabase = createSupabasePublicClient()
    const { data, error } = await supabase.from('tool_translations').select('tool_slug, locale')
    if (error || !data) return everything

    const map = new Map<string, string[]>()
    for (const row of data as { tool_slug: string; locale: string }[]) {
      map.set(row.tool_slug, [...(map.get(row.tool_slug) ?? []), row.locale])
    }
    return map
  } catch {
    return everything
  }
}

export async function GET() {
  const translated = await getTranslatedLocales()

  const entries = TOOLS.flatMap(tool => {
    const have = (translated.get(tool.slug) ?? []).filter(l => (locales as readonly string[]).includes(l))
    // A tool is only listed if it has default-locale content (the fallback source).
    if (!have.includes(routing.defaultLocale)) return []
    const path = `/tools/${tool.category}/${tool.slug}`
    return have.map(locale => ({
      url: `${BASE_URL}/${locale}${path}`,
      lastModified: new Date(tool.launchDate),
      changeFrequency: 'monthly' as const,
      priority: tool.featured ? 0.85 : 0.75,
      alternates: languageAlternates(path, have),
    }))
  })

  return xmlResponse(buildSitemapXml(entries))
}
