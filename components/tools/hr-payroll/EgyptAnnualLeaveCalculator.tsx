'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// Egypt Labour Law (Law 14 of 2025), Art. 124: paid annual leave, not counting holidays or weekly rest days:
// 15 days in the first year of service, 21 days from the second year, 30 days after ten years of service or for workers
// over 50, and 45 days for persons with disabilities. In force since 1 September 2025.
// Sources: English translation of the law (Andersen), Deloitte and Clyde & Co summaries.
// Cash value of leave days here = monthly wage / 30 per day (assumption).
export type LeaveInput = { completedYears: number; over50: boolean; disability: boolean }

export function leaveEntitlement({ completedYears, over50, disability }: LeaveInput): { days: number; reason: 'disability' | 'senior' | 'later' | 'first' } {
  if (disability) return { days: 45, reason: 'disability' }
  if (over50 || completedYears >= 10) return { days: 30, reason: 'senior' }
  if (completedYears >= 1) return { days: 21, reason: 'later' }
  return { days: 15, reason: 'first' }
}

export const leaveValue = (monthlyWage: number, days: number) => (monthlyWage / 30) * days

const egp = (n: number) => `EGP ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function EgyptAnnualLeaveCalculator(_props: Props) {
  const t = useTranslations('tool')
  const [years, setYears] = useState('')
  const [over50, setOver50] = useState(false)
  const [disability, setDisability] = useState(false)
  const [wage, setWage] = useState('')
  const [unused, setUnused] = useState('')
  const [result, setResult] = useState<{ days: number; reason: string; value: number | null; unused: number } | null>(null)

  function calculate() {
    const y = parseFloat(years)
    if (!(y >= 0)) return
    const e = leaveEntitlement({ completedYears: Math.floor(y), over50, disability })
    const w = parseFloat(wage), u = parseFloat(unused)
    setResult({ ...e, value: w > 0 && u > 0 ? leaveValue(w, u) : null, unused: u > 0 ? u : 0 })
  }
  function reset() { setYears(''); setOver50(false); setDisability(false); setWage(''); setUnused(''); setResult(null) }

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'
  const label = 'block text-sm font-semibold text-gray-700 mb-1.5'
  const check = 'flex items-center gap-3 text-sm text-gray-700'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={label}>{t('labels.years')}</label>
          <input type="number" min="0" step="1" inputMode="numeric" value={years} onChange={e => setYears(e.target.value)} placeholder="0" className={field} />
          <p className="text-xs text-gray-500 mt-1">{t('labels.yearsHint')}</p>
        </div>
        <label className={check}><input type="checkbox" checked={over50} onChange={e => setOver50(e.target.checked)} className="h-4 w-4" />{t('labels.over50')}</label>
        <label className={check}><input type="checkbox" checked={disability} onChange={e => setDisability(e.target.checked)} className="h-4 w-4" />{t('labels.disability')}</label>
        <div>
          <label className={label}>{t('labels.wage')}</label>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={wage} onChange={e => setWage(e.target.value)} placeholder={t('labels.enterAmount')} className={field} />
        </div>
        <div>
          <label className={label}>{t('labels.unused')}</label>
          <input type="number" min="0" step="0.5" inputMode="decimal" value={unused} onChange={e => setUnused(e.target.value)} placeholder="0" className={field} />
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
            <div className="text-sm opacity-80 mb-1">{t('labels.entitlement')}</div>
            <div className="text-3xl font-black">{result.days} {t('labels.daysUnit')}</div>
          </div>
          <div className="space-y-3">
            <Row label={t('labels.basis')} value={t(`reasons.${result.reason}`)} />
            {result.value !== null && <Row label={t('labels.value', { days: String(result.unused) })} value={egp(result.value)} />}
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
