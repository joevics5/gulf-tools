'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// Kuwait Labour Law (Law 6 of 2010, private sector), Art. 66: overtime is paid at the normal rate for the same period
// plus 25%. Overtime is limited to 2 hours a day and 180 hours a year (DLA Piper, Mondaq summaries).
// Hourly rate here = monthly basic wage / 30 / daily hours (assumption).
export const OVERTIME_PREMIUM = 0.25
export const MAX_DAILY_OVERTIME = 2
export const MAX_YEARLY_OVERTIME = 180

export type KuwaitOvertimeResult = { daily: number; hourly: number; perHour: number; amount: number }

export function calcKuwaitOvertime(basicMonthly: number, dailyHours: number, hours: number): KuwaitOvertimeResult {
  const daily = basicMonthly / 30
  const hourly = daily / dailyHours
  const perHour = hourly * (1 + OVERTIME_PREMIUM)
  return { daily, hourly, perHour, amount: perHour * hours }
}

const kwd = (n: number) => `KWD ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function KuwaitOvertimeCalculator(_props: Props) {
  const t = useTranslations('tool')
  const [basic, setBasic] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [hours, setHours] = useState('')
  const [result, setResult] = useState<(KuwaitOvertimeResult & { hours: number }) | null>(null)

  function calculate() {
    const b = parseFloat(basic), d = parseFloat(hoursPerDay), h = parseFloat(hours)
    if (!(b > 0) || !(d > 0) || !(h > 0)) return
    setResult({ ...calcKuwaitOvertime(b, d, h), hours: h })
  }
  function reset() { setBasic(''); setHoursPerDay('8'); setHours(''); setResult(null) }

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
  const label = 'block text-sm font-semibold text-gray-700 mb-1.5'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={label}>{t('labels.basic')}</label>
          <input type="number" min="0" step="0.001" inputMode="decimal" value={basic} onChange={e => setBasic(e.target.value)} placeholder={t('labels.enterAmount')} className={field} />
        </div>
        <div>
          <label className={label}>{t('labels.dailyHours')}</label>
          <input type="number" min="1" max="24" step="0.5" inputMode="decimal" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.dailyHoursHint')}</p>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{t('labels.hours')}</label>
          <input type="number" min="0" step="0.5" inputMode="decimal" value={hours} onChange={e => setHours(e.target.value)} placeholder="0" className={field} />
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
            <div className="text-sm opacity-80 mb-1">{t('labels.totalPay')}</div>
            <div className="text-3xl font-black">{kwd(result.amount)}</div>
          </div>
          <div className="space-y-3">
            <Row label={t('labels.dailyRate')} value={kwd(result.daily)} />
            <Row label={t('labels.hourlyRate')} value={kwd(result.hourly)} />
            <Row label={t('labels.perHour')} value={kwd(result.perHour)} />
          </div>
          {result.hours > MAX_YEARLY_OVERTIME && <p className="text-xs text-amber-600">{t('notes.overYear', { max: String(MAX_YEARLY_OVERTIME) })}</p>}
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
