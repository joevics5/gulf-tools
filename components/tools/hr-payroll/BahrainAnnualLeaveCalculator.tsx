'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// Bahrain Labour Law (Law 36 of 2012): 30 calendar days of paid annual leave per year of service.
// Leave accrues pro rata, 2.5 days per completed month. Unused leave is paid out on termination.
// The cash value uses a calendar-day rate of monthly wage / 30 (30 leave days = one month's wage).
// Sources: Labour Law summaries (Ahlan Hamad, DT Consultancy, LeaveBalance); official text not
// retrievable when this was written, so the tool states its assumptions.
export const ANNUAL_LEAVE_DAYS_PER_YEAR = 30
export const DAYS_PER_MONTH = ANNUAL_LEAVE_DAYS_PER_YEAR / 12 // 2.5
export const DAY_RATE_DIVISOR = 30

export type AnnualLeaveResult = {
  completedMonths: number
  accrued: number
  taken: number
  balance: number
  dailyRate: number
  value: number
}

/** Completed calendar months between two dates (end must not be before start). */
export function completedMonths(start: Date, end: Date) {
  const m = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  return Math.max(0, m - (end.getDate() < start.getDate() ? 1 : 0))
}

export function calcAnnualLeave(start: Date, end: Date, taken: number, monthlyWage: number): AnnualLeaveResult {
  const months = completedMonths(start, end)
  const accrued = months * DAYS_PER_MONTH
  const balance = accrued - taken
  const dailyRate = monthlyWage / DAY_RATE_DIVISOR
  return { completedMonths: months, accrued, taken, balance, dailyRate, value: Math.max(0, balance) * dailyRate }
}

const parseDate = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}
const bhd = (n: number) => `BHD ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`
const days = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

export default function BahrainAnnualLeaveCalculator(_props: Props) {
  const t = useTranslations('tool')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [taken, setTaken] = useState('')
  const [wage, setWage] = useState('')
  const [result, setResult] = useState<AnnualLeaveResult | null>(null)
  const [error, setError] = useState(false)

  function calculate() {
    const s = parseDate(start)
    const e = end ? parseDate(end) : new Date()
    if (!s || !e || e < s) { setError(true); setResult(null); return }
    setError(false)
    setResult(calcAnnualLeave(s, e, parseFloat(taken) || 0, parseFloat(wage) || 0))
  }
  function reset() { setStart(''); setEnd(''); setTaken(''); setWage(''); setResult(null); setError(false) }

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.startDate')}</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className={field} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.endDate')}</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.endDateHint')}</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.taken')}</label>
          <input type="number" min="0" step="0.5" inputMode="decimal" value={taken} onChange={e => setTaken(e.target.value)} placeholder="0" className={field} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.wage')}</label>
          <input type="number" min="0" step="0.001" inputMode="decimal" value={wage} onChange={e => setWage(e.target.value)} placeholder={t('labels.optional')} className={field} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{t('labels.dateError')}</p>}

      <div className="flex gap-3">
        <button onClick={calculate} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">{t('labels.calculate')}</button>
        <button onClick={reset} className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">{t('labels.reset')}</button>
      </div>

      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <h3 className="font-bold text-gray-900">{t('labels.results')}</h3>
          <div className="bg-emerald-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80 mb-1">{t('labels.balance')}</div>
            <div className="text-3xl font-black">{days(result.balance)} {t('labels.daysUnit')}</div>
          </div>
          <div className="space-y-3">
            <Row label={t('labels.months')} value={String(result.completedMonths)} />
            <Row label={t('labels.accrued')} value={`${days(result.accrued)} ${t('labels.daysUnit')}`} />
            <Row label={t('labels.takenResult')} value={`− ${days(result.taken)} ${t('labels.daysUnit')}`} negative />
            {parseFloat(wage) > 0 && (
              <div className="border-t border-gray-200 pt-3 space-y-3">
                <Row label={t('labels.dailyRate')} value={bhd(result.dailyRate)} />
                <Row label={t('labels.value')} value={bhd(result.value)} highlight />
              </div>
            )}
          </div>
          {result.balance < 0 && <p className="text-xs text-amber-600">{t('notes.overdrawn')}</p>}
          <p className="text-xs text-gray-500">{t('notes.rules')}</p>
          <p className="text-xs text-gray-500">{t('notes.disclaimer')}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, negative = false, highlight = false }: { label: string; value: string; negative?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}
