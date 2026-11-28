'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// Oman Labour Law (Royal Decree 53/2023), Art. 71-72. Hourly overtime = basic hourly wage plus a premium:
//   with worker consent (Art. 71): +25% daytime, +50% night
//   without consent, limited cases (Art. 72): +50% daytime, +75% night
// Weekly rest day / holiday: extra pay of 100% (Art. 71) or 200% (Art. 72) of the daily basic wage, on top of the day's wage
// (or a day off in lieu under Art. 71). Hourly rate here = monthly basic / 30 / daily hours (assumption).
export type OvertimeKind = 'day' | 'night' | 'rest'
export const PREMIUM = {
  consent: { day: 0.25, night: 0.5, rest: 1 },
  noConsent: { day: 0.5, night: 0.75, rest: 2 },
} as const

export type OvertimeResult = { hourly: number; daily: number; premium: number; unit: number; amount: number }

export function calcOvertime(basicMonthly: number, dailyHours: number, kind: OvertimeKind, consent: boolean, quantity: number): OvertimeResult {
  const daily = basicMonthly / 30
  const hourly = daily / dailyHours
  const premium = (consent ? PREMIUM.consent : PREMIUM.noConsent)[kind]
  // day/night: each hour is paid at hourly x (1 + premium). rest: premium x daily wage per day, on top of the normal day's wage.
  const unit = kind === 'rest' ? daily * premium : hourly * (1 + premium)
  return { hourly, daily, premium, unit, amount: unit * quantity }
}

const omr = (n: number) => `OMR ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function OmanOvertimeCalculator(_props: Props) {
  const t = useTranslations('tool')
  const [basic, setBasic] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState('8')
  const [kind, setKind] = useState<OvertimeKind>('day')
  const [consent, setConsent] = useState(true)
  const [qty, setQty] = useState('')
  const [result, setResult] = useState<(OvertimeResult & { kind: OvertimeKind; qty: number }) | null>(null)

  function calculate() {
    const b = parseFloat(basic), h = parseFloat(hoursPerDay), q = parseFloat(qty)
    if (!(b > 0) || !(h > 0) || !(q > 0)) return
    setResult({ ...calcOvertime(b, h, kind, consent, q), kind, qty: q })
  }
  function reset() { setBasic(''); setHoursPerDay('8'); setKind('day'); setConsent(true); setQty(''); setResult(null) }

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
        <div>
          <label className={label}>{t('labels.kind')}</label>
          <select value={kind} onChange={e => setKind(e.target.value as OvertimeKind)} className={field}>
            <option value="day">{t('kinds.day')}</option>
            <option value="night">{t('kinds.night')}</option>
            <option value="rest">{t('kinds.rest')}</option>
          </select>
        </div>
        <div>
          <label className={label}>{t('labels.consent')}</label>
          <select value={consent ? 'yes' : 'no'} onChange={e => setConsent(e.target.value === 'yes')} className={field}>
            <option value="yes">{t('consent.yes')}</option>
            <option value="no">{t('consent.no')}</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={label}>{kind === 'rest' ? t('labels.restDays') : t('labels.hours')}</label>
          <input type="number" min="0" step={kind === 'rest' ? '1' : '0.5'} inputMode="decimal" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className={field} />
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
            <div className="text-sm opacity-80 mb-1">{t(result.kind === 'rest' ? 'labels.totalExtra' : 'labels.totalPay')}</div>
            <div className="text-3xl font-black">{omr(result.amount)}</div>
          </div>
          <div className="space-y-3">
            <Row label={t('labels.dailyRate')} value={omr(result.daily)} />
            {result.kind !== 'rest' && <Row label={t('labels.hourlyRate')} value={omr(result.hourly)} />}
            <Row label={t('labels.premium')} value={`${Math.round(result.premium * 100)}%`} />
            <Row label={t(result.kind === 'rest' ? 'labels.perDay' : 'labels.perHour')} value={omr(result.unit)} />
          </div>
          <p className="text-xs text-gray-500">{t(result.kind === 'rest' ? 'notes.restRule' : 'notes.hourRule')}</p>
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
