'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type Props = { locale: string }

// Kuwait Labour Law (Law 6 of 2010, private sector), Art. 44: on an indefinite contract notice is 3 months for workers
// paid monthly and 1 month for other workers; ending without notice means compensation equal to pay for the notice period.
// Sources: the law's explanatory memorandum and a DLA Piper employment summary. Compensation here = monthly wage x notice months.
export const NOTICE_MONTHS_MONTHLY = 3
export const NOTICE_MONTHS_OTHER = 1

export function addMonthsUTC(iso: string, months: number): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target
}

export const noticeMonths = (monthlyPaid: boolean) => (monthlyPaid ? NOTICE_MONTHS_MONTHLY : NOTICE_MONTHS_OTHER)

const kwd = (n: number) => `KWD ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function KuwaitNoticePeriodCalculator(_props: Props) {
  const t = useTranslations('tool')
  const locale = useLocale()
  const [given, setGiven] = useState('')
  const [monthly, setMonthly] = useState(true)
  const [wage, setWage] = useState('')
  const [result, setResult] = useState<{ months: number; last: Date; comp: number | null } | null>(null)

  function calculate() {
    if (!given) return
    const months = noticeMonths(monthly)
    const w = parseFloat(wage)
    setResult({ months, last: addMonthsUTC(given, months), comp: monthly && w > 0 ? w * months : null })
  }
  function reset() { setGiven(''); setMonthly(true); setWage(''); setResult(null) }

  const fmtDate = (d: Date) => new Intl.DateTimeFormat(`${locale}-KW-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(d)

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
  const label = 'block text-sm font-semibold text-gray-700 mb-1.5'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{t('labels.given')}</label>
          <input type="date" value={given} onChange={e => setGiven(e.target.value)} className={field} />
        </div>
        <div>
          <label className={label}>{t('labels.payType')}</label>
          <select value={monthly ? 'monthly' : 'other'} onChange={e => setMonthly(e.target.value === 'monthly')} className={field}>
            <option value="monthly">{t('payTypes.monthly')}</option>
            <option value="other">{t('payTypes.other')}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{t('labels.wage')}</label>
          <input type="number" min="0" step="0.001" inputMode="decimal" value={wage} onChange={e => setWage(e.target.value)} placeholder={t('labels.enterAmount')} className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.wageHint')}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={calculate} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">{t('labels.calculate')}</button>
        <button onClick={reset} className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">{t('labels.reset')}</button>
      </div>

      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <h3 className="font-bold text-gray-900">{t('labels.results')}</h3>
          <div className="bg-emerald-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80 mb-1">{t('labels.lastDay')}</div>
            <div className="text-3xl font-black">{fmtDate(result.last)}</div>
          </div>
          <div className="space-y-3">
            <Row label={t('labels.noticeLength')} value={t('labels.months', { n: String(result.months) })} />
            {result.comp !== null && <Row label={t('labels.compensation')} value={kwd(result.comp)} />}
          </div>
          <p className="text-xs text-gray-500">{t('notes.rules')}</p>
          <p className="text-xs text-gray-500">{t('notes.disclaimer')}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  )
}
