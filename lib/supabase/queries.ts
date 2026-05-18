import { createSupabaseClient } from './client'

export type ArticleRow = {
  slug: string
  category_slug: string
  related_tool_slugs: string[]
  countries: string[]
  published: boolean
  published_at: string
  created_at: string
}

export type ArticleTranslationRow = {
  article_slug: string
  locale: string
  title: string
  excerpt: string | null
  content: string
  meta_description: string | null
  og_image_url: string | null
  reading_time_minutes: number
  is_translated: boolean
  created_at: string
}

export type ArticleWithTranslation = ArticleRow & {
  translation: ArticleTranslationRow | null
}

// ─── Fetch all published articles with translation for a locale ───────────────
export async function getPublishedArticles(
  locale: string,
  limit = 20
): Promise<ArticleWithTranslation[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      article_translations!inner(*)
    `)
    .eq('published', true)
    .eq('article_translations.locale', locale)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getPublishedArticles error:', error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    translation: row.article_translations?.[0] ?? null,
  }))
}

// ─── Fetch articles by category ───────────────────────────────────────────────
export async function getArticlesByCategory(
  categorySlug: string,
  locale: string,
  limit = 10
): Promise<ArticleWithTranslation[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      article_translations!inner(*)
    `)
    .eq('published', true)
    .eq('category_slug', categorySlug)
    .eq('article_translations.locale', locale)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getArticlesByCategory error:', error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    translation: row.article_translations?.[0] ?? null,
  }))
}

// ─── Fetch a single article by slug ───────────────────────────────────────────
export async function getArticleBySlug(
  slug: string,
  locale: string
): Promise<ArticleWithTranslation | null> {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      article_translations!inner(*)
    `)
    .eq('slug', slug)
    .eq('published', true)
    .eq('article_translations.locale', locale)
    .single()

  if (error) {
    // Try English fallback if locale translation not found
    if (locale !== 'en') {
      return getArticleBySlug(slug, 'en')
    }
    console.error('getArticleBySlug error:', error.message)
    return null
  }

  return {
    ...data,
    translation: (data as any).article_translations?.[0] ?? null,
  }
}

// ─── Fetch articles related to a tool ─────────────────────────────────────────
export async function getArticlesForTool(
  toolSlug: string,
  locale: string,
  limit = 3
): Promise<ArticleWithTranslation[]> {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('articles')
    .select(`
      *,
      article_translations!inner(*)
    `)
    .eq('published', true)
    .contains('related_tool_slugs', [toolSlug])
    .eq('article_translations.locale', locale)
    .order('published_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('getArticlesForTool error:', error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    ...row,
    translation: row.article_translations?.[0] ?? null,
  }))
}

// ─── Fetch all published slugs (for sitemap) ──────────────────────────────────
export async function getAllPublishedArticleSlugs(): Promise<
  { slug: string; published_at: string }[]
> {
  const supabase = await createSupabaseClient()

  const { data, error } = await supabase
    .from('articles')
    .select('slug, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false })

  if (error) {
    console.error('getAllPublishedArticleSlugs error:', error.message)
    return []
  }

  return data ?? []
}