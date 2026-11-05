// 📁 app/sitemap.ts
// Root sitemap index — lists all child sitemaps.
// Google fetches this first then crawls each child independently.

import { MetadataRoute } from 'next'

import { BASE_URL } from '@/lib/i18n/locales'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE_URL}/sitemap-static.xml`,     lastModified: new Date() },
    { url: `${BASE_URL}/sitemap-categories.xml`, lastModified: new Date() },
    { url: `${BASE_URL}/sitemap-tools.xml`,      lastModified: new Date() },
    { url: `${BASE_URL}/sitemap-locations.xml`,  lastModified: new Date() },
    { url: `${BASE_URL}/sitemap-blog.xml`,       lastModified: new Date() },
  ]
}
