import 'server-only'

/**
 * Per-tool UI strings live in messages/<locale>/tools/<slug>.json.
 *
 * Tool components read them with `useTranslations('tool')` (the tool page wraps
 * them in <ToolMessages>), so a tool never branches on the locale itself and a
 * new language is a content task: add messages/<locale>/tools/*.json files.
 *
 * Returns null when a tool has no strings for this locale yet (e.g. a tool that
 * hasn't been migrated, or a locale that hasn't been translated).
 */
export async function loadToolMessages(
  locale: string,
  toolSlug: string
): Promise<Record<string, unknown> | null> {
  // Slugs come from the URL; only allow what a registry slug can contain so the
  // dynamic import below can never be pointed outside messages/.
  if (!/^[a-z0-9-]+$/.test(toolSlug) || !/^[a-z]{2,3}(-[A-Za-z]+)?$/.test(locale)) {
    return null
  }

  try {
    return (await import(`@/messages/${locale}/tools/${toolSlug}.json`)).default
  } catch {
    return null
  }
}
