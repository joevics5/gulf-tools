// 📁 app/[locale]/tools/[category]/[tool]/page.tsx
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { TOOLS, getToolBySlug, getRelatedTools } from '@/lib/registry/tools'
import { CATEGORIES } from '@/lib/registry/categories'
import { generateToolMetadata } from '@/lib/utils/seo'
import {
  generateToolSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
} from '@/lib/schema/schemas'
import { SchemaOrg } from '@/components/seo/SchemaOrg'
import { Breadcrumb } from '@/components/layout/Breadcrumb'
import { ToolWrapper } from '@/components/tools/ToolWrapper'
import Link from 'next/link'
import AdUnit from '@/components/ads/AdUnit'
import { AD_SLOTS } from '@/components/ads/slots'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

// ─── Color map for category badges ───────────────────────────────────────────
const categoryColorMap: Record<string, string> = {
  finance:         'bg-emerald-50 text-emerald-700',
  'hr-payroll':    'bg-teal-50 text-teal-700',
  'islamic-tools': 'bg-green-50 text-green-700',
  'tax-vat':       'bg-red-50 text-red-700',
  business:        'bg-blue-50 text-blue-700',
  'real-estate':   'bg-orange-50 text-orange-700',
  currency:        'bg-yellow-50 text-yellow-700',
  education:       'bg-indigo-50 text-indigo-700',
  health:          'bg-pink-50 text-pink-700',
  career:          'bg-slate-50 text-slate-700',
  travel:          'bg-sky-50 text-sky-700',
  auto:            'bg-zinc-50 text-zinc-700',
  productivity:    'bg-amber-50 text-amber-700',
  government:      'bg-stone-50 text-stone-700',
}

// Real tool names for sidebar anchor text (SEO: avoid slug-formatted text)
const TOOL_NAMES: Record<string, { en: string; ar: string }> = {
  'salary-calculator':           { en: 'Salary Calculator',              ar: 'حاسبة الراتب' },
  'loan-emi-calculator':         { en: 'Loan EMI Calculator',            ar: 'حاسبة القسط الشهري' },
  'gratuity-calculator':         { en: 'Gratuity Calculator',            ar: 'حاسبة مكافأة نهاية الخدمة' },
  'zakat-calculator':            { en: 'Zakat Calculator',               ar: 'حاسبة الزكاة' },
  'hijri-gregorian-converter':   { en: 'Hijri–Gregorian Converter',      ar: 'محول التاريخ الهجري' },
  'uae-vat-calculator':          { en: 'UAE VAT Calculator',             ar: 'حاسبة ضريبة القيمة المضافة الإمارات' },
  'ksa-vat-calculator':          { en: 'Saudi VAT Calculator',           ar: 'حاسبة ضريبة القيمة المضافة السعودية' },
  'invoice-generator':           { en: 'Invoice Generator',              ar: 'مولّد الفواتير' },
  'compound-interest-calculator':{ en: 'Compound Interest Calculator',   ar: 'حاسبة الفائدة المركبة' },
  'savings-goal-calculator':     { en: 'Savings Goal Calculator',        ar: 'حاسبة هدف الادخار' },
  'leave-encashment-calculator': { en: 'Leave Encashment Calculator',    ar: 'حاسبة صرف الإجازة' },
  'notice-period-calculator':    { en: 'Notice Period Calculator',       ar: 'حاسبة فترة الإشعار' },
  'profit-margin-calculator':    { en: 'Profit Margin Calculator',       ar: 'حاسبة هامش الربح' },
}

function getToolName(slug: string, locale: string): string {
  const entry = TOOL_NAMES[slug]
  if (entry) return locale === 'ar' ? entry.ar : entry.en
  return slug.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

type Params = { locale: string; category: string; tool: string }

// ISR: rebuild tool pages every 24 hours
export const revalidate = 86400

// Pre-build all tool pages at deploy time
export async function generateStaticParams() {
  const locales = ['en', 'ar']
  return TOOLS.flatMap(tool =>
    locales.map(locale => ({
      locale,
      category: tool.category,
      tool: tool.slug,
    }))
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale, category, tool: toolSlug } = await params
  return generateToolMetadata(locale, toolSlug, category)
}

// ─── Async loader — only imports the one tool that's actually needed ──────────
async function loadToolComponent(toolSlug: string) {
  try {
    switch (toolSlug) {
      case 'salary-calculator':
        return (await import('@/components/tools/finance/SalaryCalculator')).default
      case 'gratuity-calculator':
        return (await import('@/components/tools/hr-payroll/GratuityCalculator')).default
      case 'zakat-calculator':
        return (await import('@/components/tools/islamic-tools/ZakatCalculator')).default
      default:
        return null
    }
  } catch {
    return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function ToolPage({ params }: { params: Promise<Params> }) {
  const { locale, category, tool: toolSlug } = await params

  const tool = getToolBySlug(toolSlug)
  if (!tool || tool.category !== category) notFound()

  const categoryData = CATEGORIES.find(c => c.slug === category)
  if (!categoryData) notFound()

  const t = await getTranslations({ locale, namespace: `tools.${toolSlug}` })
  const tNav = await getTranslations({ locale, namespace: 'nav' })
  const tCat = await getTranslations({ locale, namespace: `categories.${category}` })
  const tCommon = await getTranslations({ locale, namespace: 'common' })

  const BASE_URL = 'https://gulftools.jobmeter.app'
  const toolUrl = `${BASE_URL}/${locale}/tools/${category}/${toolSlug}`

  const ToolComponent = await loadToolComponent(toolSlug)
  const relatedTools = getRelatedTools(tool)

  const breadcrumbItems = [
    { label: tNav('home'),  href: `/${locale}` },
    { label: tNav('tools'), href: `/${locale}/tools` },
    { label: tCat('name'), href: `/${locale}/tools/${category}` },
    { label: t('title'),   href: `/${locale}/tools/${category}/${toolSlug}` },
  ]

  const faqs = [
    { question: t('faq.q1'), answer: t('faq.a1') },
    { question: t('faq.q2'), answer: t('faq.a2') },
    { question: t('faq.q3'), answer: t('faq.a3') },
  ]

  const schemas = [
    generateToolSchema({ title: t('title'), description: t('description'), url: toolUrl, category, locale }),
    generateFAQSchema(faqs),
    generateBreadcrumbSchema(breadcrumbItems.map(b => ({ name: b.label, url: `${BASE_URL}${b.href}` }))),
  ]

  const badgeColor = categoryColorMap[category] ?? 'bg-gray-50 text-gray-700'
  const isRTL = locale === 'ar'

  return (
    <>
      <SchemaOrg schema={schemas} />

      {/* Header */}
      <Header locale={locale} activePath={`/${locale}/tools`} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb items={breadcrumbItems} />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 mt-2">

          {/* Main */}
          <main className="min-w-0">
            <div className="mb-6">
              <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-3 ${badgeColor}`}>
                {categoryData.icon} {tCat('name')}
              </span>
              <h1 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-2">
                {t('title')}
              </h1>
              <p className="text-gray-500 text-lg leading-relaxed">{t('description')}</p>
            </div>

            {/* Ad: above tool */}
            <div className="mb-6">
              <p className="text-xs text-gray-400 text-center mb-1">Advertisement</p>
              <AdUnit slot={AD_SLOTS.TOOL_BANNER_1} />
            </div>

            <ToolWrapper>
              {ToolComponent ? (
                <ToolComponent locale={locale} />
              ) : (
                <div className="text-center py-16 text-gray-400">
                  <div className="text-4xl mb-3">🔧</div>
                  <p className="font-medium">{tCommon('comingSoon')}</p>
                </div>
              )}
            </ToolWrapper>

            {/* Ad: below tool result */}
            <div className="my-6">
              <p className="text-xs text-gray-400 text-center mb-1">Advertisement</p>
              <AdUnit slot={AD_SLOTS.TOOL_BANNER_2} />
            </div>

            {/* FAQ */}
            <section className="mt-10" aria-labelledby="faq-heading">
              <h2 id="faq-heading" className="text-2xl font-bold text-gray-900 mb-6">
                {tCommon('frequentlyAsked')}
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <details key={i} className="group border border-gray-200 rounded-xl overflow-hidden">
                    <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer font-semibold text-gray-800 hover:bg-gray-50 transition-colors list-none">
                      <span>{faq.question}</span>
                      <span className="text-gray-400 text-xl flex-shrink-0 group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <div className="px-5 pb-4 pt-1 text-gray-600 leading-relaxed text-sm">
                      {faq.answer}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </main>

          {/* Sidebar */}
          <aside className="space-y-6">
            {relatedTools.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="font-bold text-gray-900 mb-4 text-sm uppercase tracking-wide">
                  {tCommon('relatedTools')}
                </h3>
                <div className="space-y-2">
                  {relatedTools.map(related => (
                    <Link
                      key={related.slug}
                      href={`/${locale}/tools/${related.category}/${related.slug}`}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-sm flex-shrink-0">🔧</div>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-emerald-600 transition-colors leading-snug">
                        {getToolName(related.slug, locale)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Country variant pages — coming in Phase 2 */}

            <div>
              <p className="text-xs text-gray-400 text-center mb-1">Advertisement</p>
              <AdUnit slot={AD_SLOTS.BANNER} format="autorelaxed" />
            </div>
          </aside>
        </div>
      </div>

      <Footer locale={locale} />
    </>
  )
}