'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// Bahrain SIO (Social Insurance Organization) private-sector contributions.
// Bahraini employees: 7% pension + 1% unemployment = 8% (employee); the employer pays 18% in 2026
// (15% pension + 3% work injury), rising by 1 point a year to 20% in 2028.
// Expatriates: 1% unemployment (employee) and 3% work injury (employer). Insurable wage is capped at
// BHD 4,000 a month. Sources: Deloitte Bahrain Highlights 2026, PwC Worldwide Tax Summaries, Mercans.
export const SIO = {
  ceiling: 4000,
  bahraini: { employee: 0.08 },
  expat: { employee: 0.01, employer: 0.03 },
} as const

/** Employer rate for Bahraini employees: 18% in 2026, +1 point a year, 20% from 2028. */
export function bahrainiEmployerRate(year: number) {
  return 0.18 + 0.01 * (Math.min(Math.max(year, 2026), 2028) - 2026)
}

export type BahrainSalaryResult = {
  gross: number
  insurable: number
  employee: number
  employer: number
  employerRate: number
  net: number
}

export function calcBahrainSalary(
  gross: number,
  insurableSalary: number | null,
  bahraini: boolean,
  year: number
): BahrainSalaryResult {
  const subject = insurableSalary && insurableSalary > 0 ? insurableSalary : gross
  const insurable = Math.min(subject, SIO.ceiling)
  const employeeRate = bahraini ? SIO.bahraini.employee : SIO.expat.employee
  const employerRate = bahraini ? bahrainiEmployerRate(year) : SIO.expat.employer
  const employee = insurable * employeeRate
  return {
    gross,
    insurable,
    employee,
    employer: insurable * employerRate,
    employerRate,
    net: gross - employee,
  }
}

// BHD has three decimal places (1 BHD = 1,000 fils)
const bhd = (n: number) =>
  `BHD ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function BahrainSalaryCalculator(_props: Props) {
  const t = useTranslations('tool')

  const [gross, setGross] = useState('')
  const [insurable, setInsurable] = useState('')
  const [nationality, setNationality] = useState<'bahraini' | 'expat'>('bahraini')
  const [result, setResult] = useState<BahrainSalaryResult | null>(null)

  const bahraini = nationality === 'bahraini'

  function calculate() {
    const g = parseFloat(gross)
    if (!g || g <= 0) return
    const i = parseFloat(insurable)
    setResult(calcBahrainSalary(g, Number.isFinite(i) ? i : null, bahraini, new Date().getFullYear()))
  }

  function reset() {
    setGross('')
    setInsurable('')
    setNationality('bahraini')
    setResult(null)
  }

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.nationality')}</label>
          <select value={nationality} onChange={e => setNationality(e.target.value as 'bahraini' | 'expat')} className={field}>
            <option value="bahraini">{t('nationalities.bahraini')}</option>
            <option value="expat">{t('nationalities.expat')}</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.gross')}</label>
          <input
            type="number" min="0" step="0.001" inputMode="decimal"
            value={gross} onChange={e => setGross(e.target.value)}
            placeholder={t('labels.enterAmount')} className={field}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.insurable')}</label>
          <input
            type="number" min="0" step="0.001" inputMode="decimal"
            value={insurable} onChange={e => setInsurable(e.target.value)}
            placeholder={t('labels.insurablePlaceholder')} className={field}
          />
          <p className="text-xs text-gray-500 mt-1">{t('labels.insurableHint')}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={calculate} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
          {t('labels.calculate')}
        </button>
        <button onClick={reset} className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
          {t('labels.reset')}
        </button>
      </div>

      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <h3 className="font-bold text-gray-900">{t('labels.results')}</h3>

          <div className="bg-emerald-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80 mb-1">{t('labels.netMonthly')}</div>
            <div className="text-3xl font-black">{bhd(result.net)}</div>
          </div>

          <div className="space-y-3">
            <Row label={t('labels.grossSalary')} value={bhd(result.gross)} />
            <Row label={t('labels.insurableSalary')} value={bhd(result.insurable)} />
            <Row
              label={bahraini ? t('labels.employeeBahraini') : t('labels.employeeExpat')}
              value={`− ${bhd(result.employee)}`}
              negative
            />
            <div className="border-t border-gray-200 pt-3 space-y-3">
              <Row label={t('labels.annualGross')} value={bhd(result.gross * 12)} />
              <Row label={t('labels.annualNet')} value={bhd(result.net * 12)} highlight />
              <Row label={t('labels.employer', { rate: String(Math.round(result.employerRate * 1000) / 10) })} value={bhd(result.employer)} />
              <Row label={t('labels.employerCost')} value={bhd(result.gross + result.employer)} />
            </div>
          </div>

          <p className="text-xs text-gray-500">{bahraini ? t('notes.bahraini') : t('notes.expat')}</p>
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
