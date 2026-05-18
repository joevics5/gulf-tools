import { getTranslations } from 'next-intl/server'

const BASE_URL = 'https://gulftools.jobmeter.app'

export async function generateToolMetadata(
  locale: string,
  toolSlug: string,
  categorySlug: string
) {
  const t = await getTranslations({ locale, namespace: `tools.${toolSlug}` })

  return {
    title: `${t('title')} | Gulf Tools`,
    description: t('metaDescription'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/tools/${categorySlug}/${toolSlug}`,
      languages: {
        en: `${BASE_URL}/en/tools/${categorySlug}/${toolSlug}`,
        ar: `${BASE_URL}/ar/tools/${categorySlug}/${toolSlug}`,
        'x-default': `${BASE_URL}/en/tools/${categorySlug}/${toolSlug}`,
      },
    },
    openGraph: {
      title: t('title'),
      description: t('metaDescription'),
      url: `${BASE_URL}/${locale}/tools/${categorySlug}/${toolSlug}`,
      siteName: 'Gulf Tools',
      locale: locale === 'ar' ? 'ar_AE' : 'en_AE',
      type: 'website' as const,
      images: [
        {
          url: `${BASE_URL}/og/tools/${toolSlug}.png`,
          width: 1200,
          height: 630,
          alt: t('title'),
        },
      ],
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: t('title'),
      description: t('metaDescription'),
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large' as const,
        'max-snippet': -1,
      },
    },
  }
}

export async function generateCategoryMetadata(
  locale: string,
  categorySlug: string
) {
  const t = await getTranslations({
    locale,
    namespace: `categories.${categorySlug}`,
  })

  return {
    title: `${t('name')} Tools | Gulf Tools`,
    description: t('description'),
    alternates: {
      canonical: `${BASE_URL}/${locale}/tools/${categorySlug}`,
      languages: {
        en: `${BASE_URL}/en/tools/${categorySlug}`,
        ar: `${BASE_URL}/ar/tools/${categorySlug}`,
        'x-default': `${BASE_URL}/en/tools/${categorySlug}`,
      },
    },
    openGraph: {
      title: `${t('name')} Tools`,
      description: t('description'),
      url: `${BASE_URL}/${locale}/tools/${categorySlug}`,
      siteName: 'Gulf Tools',
      locale: locale === 'ar' ? 'ar_AE' : 'en_AE',
      type: 'website' as const,
    },
    robots: { index: true, follow: true },
  }
}

export async function generateHomepageMetadata(locale: string) {
  const t = await getTranslations({ locale, namespace: 'seo' })

  return {
    title: t('siteName'),
    description: t('siteDescription'),
    alternates: {
      canonical: `${BASE_URL}/${locale}`,
      languages: {
        en: `${BASE_URL}/en`,
        ar: `${BASE_URL}/ar`,
        'x-default': `${BASE_URL}/en`,
      },
    },
    openGraph: {
      title: t('siteName'),
      description: t('siteDescription'),
      url: `${BASE_URL}/${locale}`,
      siteName: 'Gulf Tools',
      locale: locale === 'ar' ? 'ar_AE' : 'en_AE',
      type: 'website' as const,
      images: [
        {
          url: `${BASE_URL}/og/homepage.png`,
          width: 1200,
          height: 630,
          alt: 'Gulf Tools',
        },
      ],
    },
    robots: { index: true, follow: true },
  }
}
