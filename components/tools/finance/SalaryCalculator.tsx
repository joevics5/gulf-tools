'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

const COUNTRIES = [
  { value: 'uae',     currency: 'AED', gosi: false },
  { value: 'saudi',   currency: 'SAR', gosi: true  },
  { value: 'qatar',   currency: 'QAR', gosi: false },
  { value: 'kuwait',  currency: 'KWD', gosi: false },
  { value: 'bahrain', currency: 'BHD', gosi: false },
  { value: 'oman',    currency: 'OMR', gosi: false },
  { value: 'egypt',   currency: 'EGP', gosi: false },
]

const NATIONALITIES = ['expat', 'national'] as const

type Result = {
  grossMonthly: number
  deductions: number
  netMonthly: number
  annualGross: number
  annualNet: number
  currency: string
  gosiDeducted: boolean
}

function formatNum(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// `locale` is still passed by the tool page; strings come from useTranslations.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export default function SalaryCalculator(_props: Props) {
  const t = useTranslations('tool')

  const [gross, setGross] = useState('')
  const [country, setCountry] = useState('uae')
  const [nationality, setNationality] = useState('expat')
  const [result, setResult] = useState<Result | null>(null)

  const selectedCountry = COUNTRIES.find(c => c.value === country)!

  function calculate() {
    const grossVal = parseFloat(gross)
    if (!grossVal || grossVal <= 0) return

    let deductions = 0
    let gosiDeducted = false

    // KSA GOSI: expats pay 2%, nationals pay 9%
    if (country === 'saudi') {
      deductions = nationality === 'national'
        ? grossVal * 0.09
        : grossVal * 0.02
      gosiDeducted = true
    }

    // Egypt income tax (simplified flat estimate for display)
    if (country === 'egypt') {
      if (grossVal > 7667) deductions = grossVal * 0.20
      else if (grossVal > 3833) deductions = grossVal * 0.10
    }

    const net = grossVal - deductions

    setResult({
      grossMonthly: grossVal,
      deductions,
      netMonthly: net,
      annualGross: grossVal * 12,
      annualNet: net * 12,
      currency: selectedCountry.currency,
      gosiDeducted,
    })
  }

  function reset() {
    setGross('')
    setCountry('uae')
    setNationality('expat')
    setResult(null)
  }

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gross salary */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {t('labels.gross')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
              {selectedCountry.currency}
            </span>
            <input
              type="number"
              min="0"
              value={gross}
              onChange={e => setGross(e.target.value)}
              placeholder={t('labels.enterAmount')}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Country */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {t('labels.country')}
          </label>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          >
            {COUNTRIES.map(c => (
              <option key={c.value} value={c.value}>{t(`countries.${c.value}`)}</option>
            ))}
          </select>
        </div>

        {/* Nationality */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {t('labels.nationality')}
          </label>
          <select
            value={nationality}
            onChange={e => setNationality(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          >
            {NATIONALITIES.map(n => (
              <option key={n} value={n}>{t(`nationalities.${n}`)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={calculate}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {t('labels.calculate')}
        </button>
        <button
          onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors"
        >
          {t('labels.reset')}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <h3 className="font-bold text-gray-900">{t('labels.results')}</h3>

          {/* Net monthly — hero result */}
          <div className="bg-emerald-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80 mb-1">{t('labels.netMonthly')}</div>
            <div className="text-3xl font-black">
              {formatNum(result.netMonthly, result.currency)}
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-3">
            <ResultRow
              label={t('labels.grossSalary')}
              value={formatNum(result.grossMonthly, result.currency)}
            />
            <ResultRow
              label={result.gosiDeducted ? t('labels.gosi') : t('labels.noDeductions')}
              value={result.deductions > 0
                ? `− ${formatNum(result.deductions, result.currency)}`
                : '—'}
              negative={result.deductions > 0}
            />
            <div className="border-t border-gray-200 pt-3">
              <ResultRow
                label={t('labels.annualGross')}
                value={formatNum(result.annualGross, result.currency)}
              />
              <ResultRow
                label={t('labels.annualNet')}
                value={formatNum(result.annualNet, result.currency)}
                highlight
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultRow({
  label,
  value,
  negative = false,
  highlight = false,
}: {
  label: string
  value: string
  negative?: boolean
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span
        className={`text-sm font-semibold ${
          highlight ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  )
}
