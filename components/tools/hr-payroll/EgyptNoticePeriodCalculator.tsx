'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type Props = { locale: string }

// Egypt Labour Law (Law 14 of 2025), Art. 156: an open-ended contract can be ended with written notice of at least
// three months; Art. 161: the notice period cannot be waived or reduced. In force since 1 September 2025.
// Sources: English translation of the law (Andersen), Deloitte and Clyde & Co summaries.
export const NOTICE_MONTHS = 3

export function addMonthsUTC(iso: string, months: number): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target
}

export default function EgyptNoticePeriodCalculator(_props: Props) {
  const t = useTranslations('tool')
  const locale = useLocale()
  const [given, setGiven] = useState('')
  const [result, setResult] = useState<Date | null>(null)

  const fmtDate = (d: Date) => new Intl.DateTimeFormat(`${locale}-EG-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(d)

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.given')}</label>
        <input type="date" value={given} onChange={e => setGiven(e.target.value)} className={field} />
      </div>

      <div className="flex gap-3">
        <button onClick={() => { if (given) setResult(addMonthsUTC(given, NOTICE_MONTHS)) }} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">{t('labels.calculate')}</button>
        <button onClick={() => { setGiven(''); setResult(null) }} className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">{t('labels.reset')}</button>
      </div>

      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <h3 className="font-bold text-gray-900">{t('labels.results')}</h3>
          <div className="bg-emerald-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80 mb-1">{t('labels.lastDay')}</div>
            <div className="text-3xl font-black">{fmtDate(result)}</div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-600">{t('labels.noticeLength')}</span>
            <span className="text-sm font-semibold text-gray-900">{t('labels.months', { n: String(NOTICE_MONTHS) })}</span>
          </div>
          <p className="text-xs text-gray-500">{t('notes.rules')}</p>
          <p className="text-xs text-gray-500">{t('notes.disclaimer')}</p>
        </div>
      )}
    </div>
  )
}
