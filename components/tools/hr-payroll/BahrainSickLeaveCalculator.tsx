'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// Bahrain Labour Law (Law 36 of 2012), sick leave in a year: 15 days at full pay, the next 20 days
// at half pay, then 20 days unpaid. The daily rate is monthly wage / 30 (calendar days).
// Sources: Labour Law summaries (Ahlan Hamad, DT Consultancy); official text not retrievable.
export const SICK_TIERS = [
  { key: 'full', days: 15, pay: 1 },
  { key: 'half', days: 20, pay: 0.5 },
  { key: 'unpaid', days: 20, pay: 0 },
] as const
export const SICK_MAX_DAYS = SICK_TIERS.reduce((n, x) => n + x.days, 0) // 55

export type SickLeaveResult = {
  dailyRate: number
  tiers: { key: string; days: number; pay: number; amount: number }[]
  paidTotal: number
  normalTotal: number
  deduction: number
  outside: number
}

export function calcSickLeave(sickDays: number, monthlyWage: number): SickLeaveResult {
  const dailyRate = monthlyWage / 30
  let left = Math.max(0, sickDays)
  const tiers = SICK_TIERS.map(tier => {
    const d = Math.min(left, tier.days)
    left -= d
    return { key: tier.key, days: d, pay: tier.pay, amount: d * dailyRate * tier.pay }
  })
  const covered = tiers.reduce((n, x) => n + x.days, 0)
  const paidTotal = tiers.reduce((n, x) => n + x.amount, 0)
  const normalTotal = covered * dailyRate
  return { dailyRate, tiers, paidTotal, normalTotal, deduction: normalTotal - paidTotal, outside: left }
}

const bhd = (n: number) => `BHD ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function BahrainSickLeaveCalculator(_props: Props) {
  const t = useTranslations('tool')
  const [daysIn, setDaysIn] = useState('')
  const [wage, setWage] = useState('')
  const [result, setResult] = useState<SickLeaveResult | null>(null)

  function calculate() {
    const d = parseFloat(daysIn)
    const w = parseFloat(wage)
    if (!(d > 0) || !(w > 0)) return
    setResult(calcSickLeave(d, w))
  }
  function reset() { setDaysIn(''); setWage(''); setResult(null) }

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.sickDays')}</label>
          <input type="number" min="0" step="1" inputMode="numeric" value={daysIn} onChange={e => setDaysIn(e.target.value)} placeholder="0" className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.sickDaysHint')}</p>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.wage')}</label>
          <input type="number" min="0" step="0.001" inputMode="decimal" value={wage} onChange={e => setWage(e.target.value)} placeholder={t('labels.enterAmount')} className={field} />
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
            <div className="text-sm opacity-80 mb-1">{t('labels.paidTotal')}</div>
            <div className="text-3xl font-black">{bhd(result.paidTotal)}</div>
          </div>
          <div className="space-y-3">
            {result.tiers.filter(x => x.days > 0).map(x => (
              <Row key={x.key} label={`${t(`tiers.${x.key}`)} — ${x.days} ${t('labels.daysUnit')}`} value={bhd(x.amount)} />
            ))}
            <div className="border-t border-gray-200 pt-3 space-y-3">
              <Row label={t('labels.dailyRate')} value={bhd(result.dailyRate)} />
              <Row label={t('labels.normalTotal')} value={bhd(result.normalTotal)} />
              <Row label={t('labels.deduction')} value={`− ${bhd(result.deduction)}`} negative />
            </div>
          </div>
          {result.outside > 0 && <p className="text-xs text-amber-600">{t('notes.outside', { days: String(result.outside) })}</p>}
          <p className="text-xs text-gray-500">{t('notes.rules')}</p>
          <p className="text-xs text-gray-500">{t('notes.disclaimer')}</p>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, negative = false }: { label: string; value: string; negative?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${negative ? 'text-red-500' : 'text-gray-900'}`}>{value}</span>
    </div>
  )
}
