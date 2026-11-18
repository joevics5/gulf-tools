'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

type TerminationType = 'terminated' | 'resigned' | 'marriage' | 'misconduct' | 'employer_breach'
type ContractType = 'unlimited' | 'limited'
type WorkerType = 'monthly' | 'domestic'

type Result = {
  eligible: boolean
  totalGratuity: number
  first5Years: number
  beyond5Years: number
  reductionFactor: number
  adjustedGratuity: number
  serviceYears: number
  dailyRate: number
  message?: string
  entitlementLevel: 'full' | 'partial' | 'none'
}

function formatNum(n: number, decimals = 3) {
  return `KWD ${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function calculateGratuity(
  basicSalary: number,
  years: number,
  months: number,
  days: number,
  terminationType: TerminationType,
  contractType: ContractType,
  workerType: WorkerType
): Result {
  const totalYears = years + months / 12 + days / 365

  if (totalYears < 1 && terminationType !== 'marriage') {
    return {
      eligible: false,
      totalGratuity: 0,
      first5Years: 0,
      beyond5Years: 0,
      reductionFactor: 0,
      adjustedGratuity: 0,
      serviceYears: totalYears,
      dailyRate: 0,
      entitlementLevel: 'none',
      message: 'Minimum 1 year of continuous service is required for gratuity eligibility under Kuwait Labour Law No. 6 of 2010.',
    }
  }

  if (terminationType === 'misconduct') {
    return {
      eligible: false,
      totalGratuity: 0,
      first5Years: 0,
      beyond5Years: 0,
      reductionFactor: 0,
      adjustedGratuity: 0,
      serviceYears: totalYears,
      dailyRate: 0,
      entitlementLevel: 'none',
      message: 'Gratuity is forfeited in cases of termination due to gross misconduct as defined under Kuwait Labour Law.',
    }
  }

  const dailyRate = basicSalary / 30

  let first5 = 0
  let beyond5 = 0

  if (workerType === 'domestic') {
    // Domestic workers: 1 month per year
    const totalGratuity = basicSalary * totalYears
    return {
      eligible: true,
      totalGratuity,
      first5Years: totalGratuity,
      beyond5Years: 0,
      reductionFactor: 1,
      adjustedGratuity: totalGratuity,
      serviceYears: totalYears,
      dailyRate,
      entitlementLevel: 'full',
    }
  }

  // Monthly-paid: 15 days for first 5 years, 30 days beyond
  const yearsInFirst5 = Math.min(5, totalYears)
  const yearsBeyond5 = Math.max(0, totalYears - 5)

  first5 = dailyRate * 15 * yearsInFirst5
  beyond5 = dailyRate * 30 * yearsBeyond5

  const fullGratuity = first5 + beyond5

  // Cap at 1.5 years remuneration
  const cap = basicSalary * 18
  const cappedGratuity = Math.min(fullGratuity, cap)

  // Determine reduction factor for resignation on unlimited contracts
  let reductionFactor = 1
  let entitlementLevel: 'full' | 'partial' | 'none' = 'full'

  const isFullEntitlement =
    terminationType === 'terminated' ||
    terminationType === 'marriage' ||
    terminationType === 'employer_breach'

  const isLimitedResignation = terminationType === 'resigned' && contractType === 'limited'

  if (isFullEntitlement || isLimitedResignation) {
    reductionFactor = 1
    entitlementLevel = 'full'
  } else if (terminationType === 'resigned' && contractType === 'unlimited') {
    if (totalYears < 3) {
      reductionFactor = 0
      entitlementLevel = 'none'
    } else if (totalYears < 5) {
      reductionFactor = 0.5
      entitlementLevel = 'partial'
    } else if (totalYears < 10) {
      reductionFactor = 2 / 3
      entitlementLevel = 'partial'
    } else {
      reductionFactor = 1
      entitlementLevel = 'full'
    }
  }

  if (reductionFactor === 0) {
    return {
      eligible: false,
      totalGratuity: cappedGratuity,
      first5Years: first5,
      beyond5Years: beyond5,
      reductionFactor: 0,
      adjustedGratuity: 0,
      serviceYears: totalYears,
      dailyRate,
      entitlementLevel: 'none',
      message: 'Employees who resign with less than 3 years of service on an unlimited contract are not entitled to gratuity under Kuwait Labour Law No. 6 of 2010.',
    }
  }

  const adjustedGratuity = cappedGratuity * reductionFactor

  return {
    eligible: true,
    totalGratuity: cappedGratuity,
    first5Years: first5,
    beyond5Years: beyond5,
    reductionFactor,
    adjustedGratuity,
    serviceYears: totalYears,
    dailyRate,
    entitlementLevel,
  }
}

export default function KuwaitGratuityCalculator({ locale }: Props) {
  const isAr = locale === 'ar'
  const tt = useTranslations('tool')

  const [basicSalary, setBasicSalary] = useState('')
  const [years, setYears] = useState('')
  const [months, setMonths] = useState('0')
  const [days, setDays] = useState('0')
  const [terminationType, setTerminationType] = useState<TerminationType>('terminated')
  const [contractType, setContractType] = useState<ContractType>('unlimited')
  const [workerType, setWorkerType] = useState<WorkerType>('monthly')
  const [result, setResult] = useState<Result | null>(null)

  function calculate() {
    const salary = parseFloat(basicSalary)
    const y = parseInt(years) || 0
    const m = parseInt(months) || 0
    const d = parseInt(days) || 0
    if (!salary || salary <= 0) return
    setResult(calculateGratuity(salary, y, m, d, terminationType, contractType, workerType))
  }

  function reset() {
    setBasicSalary('')
    setYears('')
    setMonths('0')
    setDays('0')
    setTerminationType('terminated')
    setContractType('unlimited')
    setWorkerType('monthly')
    setResult(null)
  }

  // Scenario shortcuts
  function applyScenario(y: number, t: TerminationType) {
    setYears(String(y))
    setMonths('0')
    setDays('0')
    setTerminationType(t)
  }


  const scenarios = [
    { label: tt('inline.5_yrs_terminated'), y: 5, t: 'terminated' as TerminationType },
    { label: tt('inline.4_yrs_resigned'), y: 4, t: 'resigned' as TerminationType },
    { label: tt('inline.10_yrs_resigned'), y: 10, t: 'resigned' as TerminationType },
    { label: tt('inline.7_yrs_terminated'), y: 7, t: 'terminated' as TerminationType },
  ]

  const entitlementBadge = result
    ? result.entitlementLevel === 'full'
      ? { text: tt('fullEntitlement'), cls: 'bg-emerald-100 text-emerald-700' }
      : result.entitlementLevel === 'partial'
      ? { text: tt('partialEntitlement'), cls: 'bg-amber-100 text-amber-700' }
      : { text: tt('notEligible'), cls: 'bg-red-100 text-red-700' }
    : null

  return (
    <div className="space-y-6">

      {/* Worker Type Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
        {(['monthly', 'domestic'] as WorkerType[]).map(wt => (
          <button
            key={wt}
            onClick={() => setWorkerType(wt)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
              workerType === wt ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {wt === 'monthly' ? tt('monthly') : tt('domestic')}
          </button>
        ))}
      </div>

      {/* Domestic worker note */}
      {workerType === 'domestic' && (
        <div className="flex gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <span className="text-blue-500 text-base leading-none mt-0.5">ℹ️</span>
          <p className="text-sm text-blue-800">{tt('domesticNote')}</p>
        </div>
      )}

      {/* Quick Scenarios */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{tt('quickScenarios')}</p>
        <div className="flex flex-wrap gap-2">
          {scenarios.map(s => (
            <button
              key={s.label}
              onClick={() => applyScenario(s.y, s.t)}
              className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Basic Salary */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">{tt('salary')}</label>
          <p className="text-xs text-gray-500 mb-1.5">{tt('salaryHint')}</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">KWD</span>
            <input
              type="number"
              min="0"
              value={basicSalary}
              onChange={e => setBasicSalary(e.target.value)}
              placeholder={tt('enterAmount')}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Service Period */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('serviceTitle')}</label>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <input
                type="number"
                min="0"
                max="50"
                value={years}
                onChange={e => setYears(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-center"
              />
              <p className="text-xs text-center text-gray-500 mt-1">{tt('yearsLabel')}</p>
            </div>
            <div>
              <input
                type="number"
                min="0"
                max="11"
                value={months}
                onChange={e => setMonths(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-center"
              />
              <p className="text-xs text-center text-gray-500 mt-1">{tt('monthsLabel')}</p>
            </div>
            <div>
              <input
                type="number"
                min="0"
                max="30"
                value={days}
                onChange={e => setDays(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-center"
              />
              <p className="text-xs text-center text-gray-500 mt-1">{tt('daysLabel')}</p>
            </div>
          </div>
        </div>

        {/* Termination Type */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('terminationLabel')}</label>
          <select
            value={terminationType}
            onChange={e => setTerminationType(e.target.value as TerminationType)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          >
            <option value="terminated">{tt('terminated')}</option>
            <option value="resigned">{tt('resigned')}</option>
            <option value="marriage">{tt('marriage')}</option>
            <option value="employer_breach">{tt('employer_breach')}</option>
            <option value="misconduct">{tt('misconduct')}</option>
          </select>
        </div>

        {/* Marriage note */}
        {terminationType === 'marriage' && (
          <div className="sm:col-span-2 flex gap-3 px-4 py-3 bg-pink-50 border border-pink-100 rounded-xl">
            <span className="text-pink-500 text-base leading-none mt-0.5">💍</span>
            <p className="text-sm text-pink-800">{tt('marriageNote')}</p>
          </div>
        )}

        {/* Contract Type — only relevant for resignation on monthly */}
        {terminationType === 'resigned' && workerType === 'monthly' && (
          <div className="sm:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('contractLabel')}</label>
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              {(['unlimited', 'limited'] as ContractType[]).map(ct => (
                <button
                  key={ct}
                  onClick={() => setContractType(ct)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                    contractType === ct ? 'bg-white shadow text-emerald-700' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {ct === 'unlimited' ? tt('unlimited') : tt('limited')}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={calculate}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {tt('calculate')}
        </button>
        <button
          onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors"
        >
          {tt('reset')}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">{tt('results')}</h3>
            {entitlementBadge && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${entitlementBadge.cls}`}>
                {entitlementBadge.text}
              </span>
            )}
          </div>

          {result.eligible ? (
            <>
              {/* Hero */}
              <div className="bg-emerald-600 rounded-xl p-4 text-white">
                <div className="text-sm opacity-80 mb-1">{tt('totalGratuity')}</div>
                <div className="text-3xl font-black">{formatNum(result.adjustedGratuity)}</div>
                {result.reductionFactor < 1 && (
                  <div className="mt-1.5 text-xs opacity-75">
                    {isAr ? `بعد تطبيق نسبة ${Math.round(result.reductionFactor * 100)}%` : `After ${Math.round(result.reductionFactor * 100)}% entitlement factor`}
                  </div>
                )}
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <ResultRow label={tt('serviceYears')} value={`${result.serviceYears.toFixed(2)} ${tt('inline.yrs')}`} />
                <ResultRow label={tt('dailyRate')} value={formatNum(result.dailyRate)} />
                {result.first5Years > 0 && (
                  <ResultRow label={tt('first5')} value={formatNum(result.first5Years)} />
                )}
                {result.beyond5Years > 0 && (
                  <ResultRow label={tt('beyond5')} value={formatNum(result.beyond5Years)} />
                )}
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <ResultRow
                    label={tt('inline.subtotal_before_adjustment')}
                    value={formatNum(result.totalGratuity)}
                  />
                  {result.reductionFactor < 1 && (
                    <ResultRow
                      label={`${tt('adjustment')} (${Math.round(result.reductionFactor * 100)}%)`}
                      value={formatNum(result.adjustedGratuity)}
                      highlight
                    />
                  )}
                  {result.reductionFactor === 1 && (
                    <ResultRow
                      label={tt('inline.total_gratuity_entitlement')}
                      value={formatNum(result.adjustedGratuity)}
                      highlight
                    />
                  )}
                </div>
              </div>

              {/* Cap note */}
              <div className="flex gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-xl">
                <span className="text-amber-500 text-sm leading-none mt-0.5">ℹ️</span>
                <p className="text-xs text-amber-800">{tt('capNote')}</p>
              </div>

              {/* Payment note */}
              <div className="flex gap-2.5 px-3 py-2.5 bg-gray-100 rounded-xl">
                <span className="text-gray-500 text-sm leading-none mt-0.5">🕐</span>
                <p className="text-xs text-gray-600">{tt('paymentNote')}</p>
              </div>
            </>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="font-semibold text-red-700 mb-1">{tt('notEligible')}</div>
              <p className="text-sm text-red-600">{result.message}</p>
            </div>
          )}

          {/* Legal disclaimer */}
          <div className="flex gap-2.5 px-4 py-3 bg-gray-100 rounded-xl border border-gray-200">
            <span className="text-gray-500 text-base leading-none mt-0.5">⚖️</span>
            <p className="text-xs text-gray-500 leading-relaxed">{tt('legalNote')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultRow({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold text-right ${highlight ? 'text-emerald-600' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}
