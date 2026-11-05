import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { loadToolMessages } from '@/lib/i18n/toolMessages'

/**
 * Server component. Gives a tool's client component access to its own strings
 * under the `tool` namespace:
 *
 *   const t = useTranslations('tool')
 *   t('labels.gross')
 *
 * Only the current tool's strings are sent to the browser, not every tool's.
 */
export async function ToolMessages({
  locale,
  toolSlug,
  children,
}: {
  locale: string
  toolSlug: string
  children: React.ReactNode
}) {
  const [base, tool] = await Promise.all([getMessages(), loadToolMessages(locale, toolSlug)])

  if (!tool) return <>{children}</>

  return (
    <NextIntlClientProvider locale={locale} messages={{ ...base, tool }}>
      {children}
    </NextIntlClientProvider>
  )
}
