'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type Props = { locale: string }

// Oman Labour Law (Royal Decree 53/2023), Art. 38: on an indefinite contract either party gives written notice of
// 30 days for monthly-paid workers and 15 days for others, unless the contract sets longer. Ending without notice means
// compensation equal to the notice period. Art. 36(5): the employer's notice is at least one month.
// Art. 37: probation up to 3 months (monthly-paid) or 2 months (others). Compensation here = monthly wage / 30 x missing days (assumption).
export const NOTICE_MONTHLY = 30
export const NOTICE_OTHER = 15

export function addDaysUTC(iso: string, days: number): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days))
}

export function noticeDays(monthlyPaid: boolean, contractDays: number | null): number {
  const base = monthlyPaid ? NOTICE_MONTHLY : NOTICE_OTHER
  return contractDays && contractDays > base ? contractDays : base
}

const omr = (n: number) => `OMR ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function OmanNoticePeriodCalculator(_props: Props) {
  const t = useTranslations('tool')
  const locale = useLocale()
  const [given, setGiven] = useState('')
  const [monthly, setMonthly] = useState(true)
  const [contract, setContract] = useState('')
  const [wage, setWage] = useState('')
  const [result, setResult] = useState<{ days: number; last: Date; comp: number | null } | null>(null)

  function calculate() {
    if (!given) return
    const days = noticeDays(monthly, parseFloat(contract) || null)
    const w = parseFloat(wage)
    setResult({ days, last: addDaysUTC(given, days), comp: w > 0 ? (w / 30) * days : null })
  }
  function reset() { setGiven(''); setMonthly(true); setContract(''); setWage(''); setResult(null) }

  const fmtDate = (d: Date) => new Intl.DateTimeFormat(`${locale}-OM-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(d)

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
        <div>
          <label className={label}>{t('labels.contractDays')}</label>
          <input type="number" min="0" step="1" inputMode="numeric" value={contract} onChange={e => setContract(e.target.value)} placeholder="0" className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.contractDaysHint')}</p>
        </div>
        <div>
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
            <Row label={t('labels.noticeLength')} value={`${result.days} ${t('labels.daysUnit')}`} />
            {result.comp !== null && <Row label={t('labels.compensation')} value={omr(result.comp)} />}
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
