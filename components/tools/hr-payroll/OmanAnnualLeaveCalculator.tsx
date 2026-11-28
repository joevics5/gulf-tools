'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'

type Props = { locale: string }

// Oman Labour Law (Royal Decree 53/2023): Art. 78 gives at least 30 days of annual leave on full (gross) wage,
// which cannot be taken before 6 months from the joining date. Art. 81: leave must be taken at least once every 2 years.
// Value of leave days here = monthly gross wage / 30 per day (assumption).
export const LEAVE_DAYS_PER_YEAR = 30
export const FIRST_LEAVE_MONTHS = 6

export function addMonthsUTC(iso: string, months: number): Date {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, last))
  return target
}

export function calcLeaveValue(days: number, monthlyGross: number) {
  const daily = monthlyGross / 30
  return { daily, value: daily * days }
}

const omr = (n: number) => `OMR ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function OmanAnnualLeaveCalculator(_props: Props) {
  const t = useTranslations('tool')
  const locale = useLocale()
  const [wage, setWage] = useState('')
  const [days, setDays] = useState('')
  const [joined, setJoined] = useState('')
  const [result, setResult] = useState<{ daily: number; value: number; days: number; first: Date | null } | null>(null)

  function calculate() {
    const w = parseFloat(wage), d = parseFloat(days)
    if (!(w > 0) || !(d > 0)) return
    setResult({ ...calcLeaveValue(d, w), days: d, first: joined ? addMonthsUTC(joined, FIRST_LEAVE_MONTHS) : null })
  }
  function reset() { setWage(''); setDays(''); setJoined(''); setResult(null) }

  const fmtDate = (d: Date) => new Intl.DateTimeFormat(`${locale}-OM-u-nu-latn`, { dateStyle: 'long', timeZone: 'UTC' }).format(d)

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
  const label = 'block text-sm font-semibold text-gray-700 mb-1.5'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{t('labels.wage')}</label>
          <input type="number" min="0" step="0.001" inputMode="decimal" value={wage} onChange={e => setWage(e.target.value)} placeholder={t('labels.enterAmount')} className={field} />
        </div>
        <div>
          <label className={label}>{t('labels.days')}</label>
          <input type="number" min="0" step="0.5" inputMode="decimal" value={days} onChange={e => setDays(e.target.value)} placeholder="0" className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.daysHint')}</p>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{t('labels.joined')}</label>
          <input type="date" value={joined} onChange={e => setJoined(e.target.value)} className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.joinedHint')}</p>
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
            <div className="text-sm opacity-80 mb-1">{t('labels.value')}</div>
            <div className="text-3xl font-black">{omr(result.value)}</div>
          </div>
          <div className="space-y-3">
            <Row label={t('labels.dailyRate')} value={omr(result.daily)} />
            <Row label={t('labels.daysCounted')} value={`${result.days} ${t('labels.daysUnit')}`} />
            {result.first && <Row label={t('labels.firstLeave')} value={fmtDate(result.first)} />}
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
