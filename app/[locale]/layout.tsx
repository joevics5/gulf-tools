import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/lib/i18n/routing'
import { Cairo } from 'next/font/google'
import { SchemaOrg } from '@/components/seo/SchemaOrg'
import { generateOrganizationSchema } from '@/lib/schema/schemas'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  if (!routing.locales.includes(locale as any)) {
    notFound()
  }

  const messages = await getMessages()
  const isRTL = locale === 'ar'

  return (
    <html
      lang={locale}
      dir={isRTL ? 'rtl' : 'ltr'}
      className={cairo.variable}
    >
      <head>
        <SchemaOrg schema={generateOrganizationSchema()} />
      </head>
      <body className="font-[family-name:var(--font-cairo)] antialiased bg-gray-50 text-gray-900">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}