import { MetadataRoute } from 'next'
import { TOOLS } from '@/lib/registry/tools'
import { CATEGORIES } from '@/lib/registry/categories'
import { LOCATIONS } from '@/lib/registry/locations'
import { getAllPublishedArticleSlugs } from '@/lib/supabase/queries'

const BASE_URL = 'https://gulftools.jobmeter.app'
const locales = ['en', 'ar']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  // ─── Homepages ──────────────────────────────────────────────────────────────
  locales.forEach(locale => {
    entries.push({
      url: `${BASE_URL}/${locale}`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
      alternates: {
        languages: { en: `${BASE_URL}/en`, ar: `${BASE_URL}/ar` },
      },
    })
  })

  // ─── Tools directory ────────────────────────────────────────────────────────
  locales.forEach(locale => {
    entries.push({
      url: `${BASE_URL}/${locale}/tools`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.95,
    })
  })

  // ─── Blog index ─────────────────────────────────────────────────────────────
  locales.forEach(locale => {
    entries.push({
      url: `${BASE_URL}/${locale}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
      alternates: {
        languages: {
          en: `${BASE_URL}/en/blog`,
          ar: `${BASE_URL}/ar/blog`,
        },
      },
    })
  })

  // ─── Category pages ─────────────────────────────────────────────────────────
  CATEGORIES.forEach(category => {
    locales.forEach(locale => {
      entries.push({
        url: `${BASE_URL}/${locale}/tools/${category.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.9,
        alternates: {
          languages: {
            en: `${BASE_URL}/en/tools/${category.slug}`,
            ar: `${BASE_URL}/ar/tools/${category.slug}`,
          },
        },
      })
    })
  })

  // ─── Tool pages ─────────────────────────────────────────────────────────────
  TOOLS.forEach(tool => {
    locales.forEach(locale => {
      entries.push({
        url: `${BASE_URL}/${locale}/tools/${tool.category}/${tool.slug}`,
        lastModified: new Date(tool.launchDate),
        changeFrequency: 'monthly',
        priority: 0.8,
        alternates: {
          languages: {
            en: `${BASE_URL}/en/tools/${tool.category}/${tool.slug}`,
            ar: `${BASE_URL}/ar/tools/${tool.category}/${tool.slug}`,
          },
        },
      })
    })

    // Country variant pages
    if (tool.hasCountryVariants) {
      tool.countries.forEach(country => {
        locales.forEach(locale => {
          entries.push({
            url: `${BASE_URL}/${locale}/location/${country}/${tool.category}/${tool.slug}`,
            lastModified: new Date(tool.launchDate),
            changeFrequency: 'monthly',
            priority: 0.75,
          })
        })
      })
    }
  })

  // ─── Location pages ──────────────────────────────────────────────────────────
  locales.forEach(locale => {
    entries.push({
      url: `${BASE_URL}/${locale}/location`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.85,
    })
  })

  LOCATIONS.forEach(location => {
    locales.forEach(locale => {
      entries.push({
        url: `${BASE_URL}/${locale}/location/${location.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.85,
        alternates: {
          languages: {
            en: `${BASE_URL}/en/location/${location.slug}`,
            ar: `${BASE_URL}/ar/location/${location.slug}`,
          },
        },
      })
    })
  })

  // ─── Blog articles (live from Supabase) ─────────────────────────────────────
  try {
    const articleSlugs = await getAllPublishedArticleSlugs()
    articleSlugs.forEach(({ slug, published_at }) => {
      locales.forEach(locale => {
        entries.push({
          url: `${BASE_URL}/${locale}/blog/${slug}`,
          lastModified: new Date(published_at),
          changeFrequency: 'monthly',
          priority: 0.7,
          alternates: {
            languages: {
              en: `${BASE_URL}/en/blog/${slug}`,
              ar: `${BASE_URL}/ar/blog/${slug}`,
            },
          },
        })
      })
    })
  } catch {
    // Supabase unavailable during build — articles excluded from sitemap
    console.warn('sitemap: could not fetch article slugs from Supabase')
  }

  return entries
}