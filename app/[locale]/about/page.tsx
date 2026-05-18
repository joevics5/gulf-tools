// 📁 app/[locale]/about/page.tsx
import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Breadcrumb } from '@/components/layout/Breadcrumb'

type Params = { locale: string }

export async function generateMetadata({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  return {
    title: locale === 'ar' ? 'من نحن | Gulf Tools' : 'About Us | Gulf Tools',
    description:
      locale === 'ar'
        ? 'تعرّف على Gulf Tools — مجموعة أدوات مجانية مبنية للمقيمين والمهنيين والشركات في دول الخليج'
        : 'Learn about Gulf Tools — free calculators and tools built for expats, professionals and businesses across the Gulf',
    robots: { index: true, follow: true },
  }
}

export default async function AboutPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params
  const isAr = locale === 'ar'
  const tNav = await getTranslations({ locale, namespace: 'nav' })

  const breadcrumbItems = [
    { label: tNav('home'), href: `/${locale}` },
    { label: isAr ? 'من نحن' : 'About Us', href: `/${locale}/about` },
  ]

  const stats = [
    { value: '50+', label: isAr ? 'أداة مجانية' : 'Free Tools' },
    { value: '7',   label: isAr ? 'دول خليجية' : 'Gulf Countries' },
    { value: '2',   label: isAr ? 'لغة' : 'Languages' },
    { value: '0',   label: isAr ? 'تسجيل مطلوب' : 'Sign-ups Required' },
  ]

  return (
    <>
      <Header locale={locale} />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumb items={breadcrumbItems} />

        {/* Hero */}
        <div className="text-center py-12">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 mb-4">
            {isAr ? 'من نحن' : 'About Gulf Tools'}
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
            {isAr
              ? 'أدوات مجانية مبنية خصيصاً للمقيمين والمهنيين والشركات في دول الخليج'
              : 'Free tools built specifically for expats, professionals and businesses across the Gulf region'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
              <div className="text-3xl font-black text-emerald-600 mb-1">{stat.value}</div>
              <div className="text-sm text-gray-500">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white border border-gray-100 rounded-2xl p-8 sm:p-10 space-y-8">
          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-3">
              {isAr ? 'ما هو Gulf Tools؟' : 'What is Gulf Tools?'}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {isAr
                ? 'Gulf Tools هو مشروع من شبكة JobMeter، يوفر أدوات وحاسبات مجانية مصممة خصيصاً للمقيمين في دول الخليج العربي — الإمارات والسعودية وقطر والكويت والبحرين وعُمان ومصر. كل أداة مبنية مع مراعاة القوانين المحلية والعملات والأنظمة الخاصة بكل دولة.'
                : 'Gulf Tools is a project by the JobMeter network, providing free tools and calculators designed specifically for residents of the Arabian Gulf — UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Oman and Egypt. Every tool is built with local laws, currencies and regulations in mind.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-3">
              {isAr ? 'لماذا بنينا هذا؟' : 'Why We Built This'}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {isAr
                ? 'معظم الأدوات المالية والحسابية على الإنترنت مصممة للأسواق الغربية. لا تأخذ بعين الاعتبار مكافأة نهاية الخدمة أو ضريبة القيمة المضافة بنسبة 5% أو 15%، أو التقويم الهجري، أو نظام التأمينات الاجتماعية في السعودية. بنينا Gulf Tools لأن المقيمين في الخليج يستحقون أدوات مصممة لواقعهم.'
                : 'Most financial and calculation tools online are built for Western markets. They don\'t account for end-of-service gratuity, 5% or 15% VAT, the Hijri calendar, or Saudi GOSI contributions. We built Gulf Tools because Gulf residents deserve tools designed for their reality.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-3">
              {isAr ? 'مجاني تماماً' : 'Completely Free'}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {isAr
                ? 'جميع أدوات Gulf Tools مجانية بالكامل ولا تتطلب تسجيلاً أو إنشاء حساب. نحن ندعم الموقع من خلال الإعلانات. لا نبيع بياناتك ولا نجمع معلومات شخصية.'
                : 'All Gulf Tools are completely free and require no registration or account creation. We support the site through advertising. We do not sell your data or collect personal information.'}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-gray-900 mb-3">
              {isAr ? 'جزء من شبكة JobMeter' : 'Part of the JobMeter Network'}
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {isAr
                ? 'Gulf Tools هو مشروع تابع لـ JobMeter، منصة البحث عن الوظائف المدعومة بالذكاء الاصطناعي للباحثين عن عمل في الخليج وأفريقيا.'
                : 'Gulf Tools is a project under JobMeter, the AI-powered job discovery platform for job seekers in the Gulf and Africa.'}
            </p>
            <a
              href="https://jobmeter.app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-3 text-emerald-600 hover:text-emerald-700 font-semibold text-sm transition-colors"
            >
              {isAr ? 'زيارة JobMeter ←' : 'Visit JobMeter →'}
            </a>
          </section>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Link
            href={`/${locale}/tools`}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-4 rounded-xl transition-colors"
          >
            {isAr ? 'تصفح جميع الأدوات ←' : 'Browse All Tools →'}
          </Link>
        </div>
      </div>
      <Footer locale={locale} />
    </>
  )
}