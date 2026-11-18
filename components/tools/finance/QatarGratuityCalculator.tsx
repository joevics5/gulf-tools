'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

type Result = {
  eligible: boolean
  totalGratuity: number
  serviceYears: number
  dailyRate: number
  gratuityPerYear: number
  fullYears: number
  fractionalMonths: number
  message?: string
}

function formatNum(n: number, decimals = 2) {
  return `QAR ${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function dateDiffDetailed(start: Date, end: Date, excludedMonths: number) {
  const msPerDay = 1000 * 60 * 60 * 24
  const totalDays = Math.floor((end.getTime() - start.getTime()) / msPerDay)
  const adjustedDays = Math.max(0, totalDays - excludedMonths * 30)
  const totalYears = adjustedDays / 365.25
  const fullYears = Math.floor(totalYears)
  const fractionalYears = totalYears - fullYears
  const fractionalMonths = Math.round(fractionalYears * 12)
  return { totalYears, fullYears, fractionalMonths }
}

function calculateGratuity(
  basicSalary: number,
  startDate: Date,
  endDate: Date,
  excludedMonths: number
): Result {
  if (endDate <= startDate) {
    return { eligible: false, totalGratuity: 0, serviceYears: 0, dailyRate: 0, gratuityPerYear: 0, fullYears: 0, fractionalMonths: 0, message: 'End date must be after start date.' }
  }

  const { totalYears, fullYears, fractionalMonths } = dateDiffDetailed(startDate, endDate, excludedMonths)

  if (totalYears < 1) {
    return { eligible: false, totalGratuity: 0, serviceYears: totalYears, dailyRate: 0, gratuityPerYear: 0, fullYears, fractionalMonths, message: 'Minimum 1 year of continuous service is required for gratuity eligibility under Qatar Labour Law.' }
  }

  const dailyRate = basicSalary / 30
  const gratuityPerYear = dailyRate * 21
  const totalGratuity = gratuityPerYear * totalYears

  return {
    eligible: true,
    totalGratuity,
    serviceYears: totalYears,
    dailyRate,
    gratuityPerYear,
    fullYears,
    fractionalMonths,
  }
}

export default function QatarGratuityCalculator(_props: Props) {
  const t = useTranslations('tool')

  const todayStr = new Date().toISOString().split('T')[0]

  const [basicSalary, setBasicSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState(todayStr)
  const [nationality, setNationality] = useState('expat')
  const [excludedMonths, setExcludedMonths] = useState('0')
  const [misconduct, setMisconduct] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [serviceDuration, setServiceDuration] = useState<string>('')

  // Live service duration preview
  useEffect(() => {
    if (!startDate || !endDate) { setServiceDuration(''); return }
    const s = new Date(startDate)
    const e = new Date(endDate)
    if (e <= s) { setServiceDuration(''); return }
    const { fullYears, fractionalMonths } = dateDiffDetailed(s, e, parseInt(excludedMonths) || 0)
    const parts = []
    if (fullYears > 0) parts.push(`${fullYears} ${fullYears === 1 ? (t('inline.year')) : (t('inline.years'))}`)
    if (fractionalMonths > 0) parts.push(`${fractionalMonths} ${t('inline.mo')}`)
    setServiceDuration(parts.join(', ') || (t('inline.less_than_1_month')))
  }, [startDate, endDate, excludedMonths, t])

  function calculate() {
    const salary = parseFloat(basicSalary)
    if (!salary || salary <= 0 || !startDate || !endDate) return
    const res = calculateGratuity(salary, new Date(startDate), new Date(endDate), parseInt(excludedMonths) || 0)
    setResult(res)
  }

  function reset() {
    setBasicSalary('')
    setStartDate('')
    setEndDate(todayStr)
    setNationality('expat')
    setExcludedMonths('0')
    setMisconduct(false)
    setResult(null)
    setServiceDuration('')
  }


  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Basic Salary */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t('salary')}
          </label>
          <p className="text-xs text-gray-500 mb-1.5">{t('salaryHint')}</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">QAR</span>
            <input
              type="number"
              min="0"
              value={basicSalary}
              onChange={e => setBasicSalary(e.target.value)}
              placeholder={t('enterAmount')}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('startDate')}</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('endDate')}</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        {/* Service Duration Preview */}
        {serviceDuration && (
          <div className="sm:col-span-2 flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-xl">
            <span className="text-xs text-emerald-700 font-medium">{t('preview')}</span>
            <span className="text-sm font-bold text-emerald-800">{serviceDuration}</span>
          </div>
        )}

        {/* Nationality */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('nationality')}</label>
          <select
            value={nationality}
            onChange={e => setNationality(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          >
            <option value="expat">{t('expat')}</option>
            <option value="qatari">{t('qatari')}</option>
          </select>
        </div>

        {/* Excluded Months */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('excludedMonths')}</label>
          <input
            type="number"
            min="0"
            max="120"
            value={excludedMonths}
            onChange={e => setExcludedMonths(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        {/* Misconduct checkbox */}
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={misconduct}
              onChange={e => setMisconduct(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-gray-600">{t('misconduct')}</span>
          </label>
        </div>
      </div>

      {/* Misconduct warning */}
      {misconduct && (
        <div className="flex gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-amber-500 text-base leading-none mt-0.5">⚠️</span>
          <p className="text-sm text-amber-800">{t('misconductWarning')}</p>
        </div>
      )}

      {/* Qatari note */}
      {nationality === 'qatari' && (
        <div className="flex gap-3 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
          <span className="text-blue-500 text-base leading-none mt-0.5">ℹ️</span>
          <p className="text-sm text-blue-800">{t('qatariNote')}</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={calculate}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {t('calculate')}
        </button>
        <button
          onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors"
        >
          {t('reset')}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <h3 className="font-bold text-gray-900">{t('results')}</h3>

          {result.eligible ? (
            <>
              {/* Hero result */}
              <div className="bg-emerald-600 rounded-xl p-4 text-white">
                <div className="text-sm opacity-80 mb-1">{t('totalGratuity')}</div>
                <div className="text-3xl font-black">{formatNum(result.totalGratuity)}</div>
                {misconduct && (
                  <div className="mt-2 text-xs bg-white/20 rounded-lg px-3 py-1.5">⚠️ {t('inline.may_be_forfeited_due_to_misconduct')}</div>
                )}
              </div>

              {/* Breakdown */}
              <div className="space-y-3">
                <ResultRow
                  label={t('servicePeriod')}
                  value={`${result.fullYears}y ${result.fractionalMonths}mo (${result.serviceYears.toFixed(2)} ${t('inline.yrs')})`}
                />
                <ResultRow
                  label={t('inline.basic_monthly_salary')}
                  value={formatNum(parseFloat(basicSalary))}
                />
                <ResultRow
                  label={t('dailyRate')}
                  value={`${formatNum(result.dailyRate)} ${t('inline.30_days')}`}
                />
                <ResultRow
                  label={t('perYear')}
                  value={`${formatNum(result.gratuityPerYear)} × ${result.serviceYears.toFixed(2)}`}
                />
                <div className="border-t border-gray-200 pt-3">
                  <ResultRow
                    label={t('inline.total_gratuity_entitlement')}
                    value={formatNum(result.totalGratuity)}
                    highlight
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <div className="font-semibold text-red-700 mb-1">{t('notEligible')}</div>
              <p className="text-sm text-red-600">{result.message}</p>
            </div>
          )}

          {/* Legal disclaimer */}
          <div className="flex gap-2.5 px-4 py-3 bg-gray-100 rounded-xl border border-gray-200">
            <span className="text-gray-500 text-base leading-none mt-0.5">⚖️</span>
            <p className="text-xs text-gray-500 leading-relaxed">{t('legalNote')}</p>
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
