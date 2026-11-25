'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// PIFSS (Public Institution for Social Security) private-sector rates for Kuwaiti employees.
// Expatriates have no social security contributions. Sources: PwC Worldwide Tax Summaries
// (Kuwait, other taxes) and Oracle Fusion HCM Kuwait social insurance; see the page article.
export const PIFSS = {
  minSalary: 230,          // contributions are calculated on at least KWD 230
  ceiling: 2750,           // contributory salary ceiling
  basicBandCeiling: 1500,  // the extra 2.5% (gratuity) applies up to this amount
  employeeRate: 0.08,
  employeeExtraRate: 0.025,
  employerRate: 0.115,
} as const

export type KuwaitSalaryResult = {
  gross: number
  contributory: number
  employeeMain: number
  employeeExtra: number
  employeeTotal: number
  employer: number
  net: number
}

export function calcKuwaitSalary(
  gross: number,
  contributorySalary: number | null,
  kuwaiti: boolean
): KuwaitSalaryResult {
  const subject = contributorySalary && contributorySalary > 0 ? contributorySalary : gross
  const base = kuwaiti ? Math.max(subject, PIFSS.minSalary) : 0
  const employeeMain = kuwaiti ? PIFSS.employeeRate * Math.min(base, PIFSS.ceiling) : 0
  const employeeExtra = kuwaiti ? PIFSS.employeeExtraRate * Math.min(base, PIFSS.basicBandCeiling) : 0
  const employeeTotal = employeeMain + employeeExtra
  const employer = kuwaiti ? PIFSS.employerRate * Math.min(base, PIFSS.ceiling) : 0
  return {
    gross,
    contributory: base,
    employeeMain,
    employeeExtra,
    employeeTotal,
    employer,
    net: gross - employeeTotal,
  }
}

// KWD has three decimal places (1 KWD = 1,000 fils)
const kwd = (n: number) =>
  `KWD ${n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`

export default function KuwaitSalaryCalculator(_props: Props) {
  const t = useTranslations('tool')

  const [gross, setGross] = useState('')
  const [contributory, setContributory] = useState('')
  const [nationality, setNationality] = useState<'kuwaiti' | 'expat'>('kuwaiti')
  const [result, setResult] = useState<KuwaitSalaryResult | null>(null)

  const kuwaiti = nationality === 'kuwaiti'

  function calculate() {
    const g = parseFloat(gross)
    if (!g || g <= 0) return
    const c = parseFloat(contributory)
    setResult(calcKuwaitSalary(g, Number.isFinite(c) ? c : null, kuwaiti))
  }

  function reset() {
    setGross('')
    setContributory('')
    setNationality('kuwaiti')
    setResult(null)
  }

  const field =
    'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.nationality')}</label>
          <select value={nationality} onChange={e => setNationality(e.target.value as 'kuwaiti' | 'expat')} className={field}>
            <option value="kuwaiti">{t('nationalities.kuwaiti')}</option>
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

        {kuwaiti && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('labels.contributory')}</label>
            <input
              type="number" min="0" step="0.001" inputMode="decimal"
              value={contributory} onChange={e => setContributory(e.target.value)}
              placeholder={t('labels.contributoryPlaceholder')} className={field}
            />
            <p className="text-xs text-gray-500 mt-1">{t('labels.contributoryHint')}</p>
          </div>
        )}
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
            <div className="text-3xl font-black">{kwd(result.net)}</div>
          </div>

          <div className="space-y-3">
            <Row label={t('labels.grossSalary')} value={kwd(result.gross)} />
            {kuwaiti ? (
              <>
                <Row label={t('labels.contributorySalary')} value={kwd(result.contributory)} />
                <Row label={t('labels.employeeMain')} value={`− ${kwd(result.employeeMain)}`} negative />
                <Row label={t('labels.employeeExtra')} value={`− ${kwd(result.employeeExtra)}`} negative />
                <Row label={t('labels.employeeTotal')} value={`− ${kwd(result.employeeTotal)}`} negative />
              </>
            ) : (
              <Row label={t('labels.noDeductions')} value="—" />
            )}
            <div className="border-t border-gray-200 pt-3 space-y-3">
              <Row label={t('labels.annualGross')} value={kwd(result.gross * 12)} />
              <Row label={t('labels.annualNet')} value={kwd(result.net * 12)} highlight />
              {kuwaiti && (
                <>
                  <Row label={t('labels.employer')} value={kwd(result.employer)} />
                  <Row label={t('labels.employerCost')} value={kwd(result.gross + result.employer)} />
                </>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500">{kuwaiti ? t('notes.kuwaiti') : t('notes.expat')}</p>
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
