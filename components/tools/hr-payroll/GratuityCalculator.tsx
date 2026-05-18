'use client'

import { useState } from 'react'

type Props = { locale: string }

const COUNTRIES = [
  { value: 'uae',    label: 'UAE',          currency: 'AED' },
  { value: 'saudi',  label: 'Saudi Arabia', currency: 'SAR' },
  { value: 'qatar',  label: 'Qatar',        currency: 'QAR' },
  { value: 'kuwait', label: 'Kuwait',       currency: 'KWD' },
  { value: 'bahrain',label: 'Bahrain',      currency: 'BHD' },
  { value: 'oman',   label: 'Oman',         currency: 'OMR' },
]

function calcGratuity(basicSalary: number, yearsOfService: number, country: string): number {
  if (yearsOfService < 1) return 0

  if (country === 'uae') {
    // UAE: 21 days/year for first 5 years, 30 days/year after
    const dailyRate = basicSalary / 30
    let gratuity = 0
    if (yearsOfService <= 5) {
      gratuity = dailyRate * 21 * yearsOfService
    } else {
      gratuity = dailyRate * 21 * 5 + dailyRate * 30 * (yearsOfService - 5)
    }
    // Cap: 2 years basic salary
    return Math.min(gratuity, basicSalary * 24)
  }

  if (country === 'saudi') {
    // KSA: 0.5 month for first 5 years, 1 month after
    const halfMonth = basicSalary / 2
    if (yearsOfService <= 5) return halfMonth * yearsOfService
    return halfMonth * 5 + basicSalary * (yearsOfService - 5)
  }

  if (country === 'qatar') {
    // Qatar: 3 weeks per year
    return (basicSalary / 4) * 3 * yearsOfService
  }

  // Default: UAE formula
  const dailyRate = basicSalary / 30
  if (yearsOfService <= 5) return dailyRate * 21 * yearsOfService
  return dailyRate * 21 * 5 + dailyRate * 30 * (yearsOfService - 5)
}

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function GratuityCalculator({ locale }: Props) {
  const isAr = locale === 'ar'

  const [basicSalary, setBasicSalary] = useState('')
  const [years, setYears] = useState('')
  const [months, setMonths] = useState('0')
  const [country, setCountry] = useState('uae')
  const [result, setResult] = useState<number | null>(null)

  const selectedCountry = COUNTRIES.find(c => c.value === country)!

  function calculate() {
    const salary = parseFloat(basicSalary)
    const y = parseFloat(years) || 0
    const m = parseFloat(months) || 0
    if (!salary || salary <= 0) return
    const totalYears = y + m / 12
    setResult(calcGratuity(salary, totalYears, country))
  }

  function reset() {
    setBasicSalary('')
    setYears('')
    setMonths('0')
    setCountry('uae')
    setResult(null)
  }

  const L = isAr
    ? {
        basic: 'الراتب الأساسي الشهري',
        country: 'الدولة',
        years: 'سنوات الخدمة',
        months: 'أشهر إضافية',
        calculate: 'احسب المكافأة',
        reset: 'إعادة تعيين',
        result: 'مكافأة نهاية الخدمة المستحقة',
        note: 'تُحسب المكافأة على الراتب الأساسي فقط، لا تشمل البدلات.',
        lessThanYear: 'لا تستحق مكافأة لمن خدم أقل من سنة.',
        enterAmount: 'أدخل المبلغ',
      }
    : {
        basic: 'Basic Monthly Salary',
        country: 'Country',
        years: 'Years of Service',
        months: 'Additional Months',
        calculate: 'Calculate Gratuity',
        reset: 'Reset',
        result: 'Your Gratuity Entitlement',
        note: 'Gratuity is calculated on basic salary only, not allowances.',
        lessThanYear: 'No gratuity for less than 1 year of service.',
        enterAmount: 'Enter amount',
      }

  const totalYears = (parseFloat(years) || 0) + (parseFloat(months) || 0) / 12

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Basic salary */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {L.basic}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
              {selectedCountry.currency}
            </span>
            <input
              type="number"
              min="0"
              value={basicSalary}
              onChange={e => setBasicSalary(e.target.value)}
              placeholder={L.enterAmount}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
            />
          </div>
        </div>

        {/* Country */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {L.country}
          </label>
          <select
            value={country}
            onChange={e => setCountry(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          >
            {COUNTRIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Years */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {L.years}
          </label>
          <input
            type="number"
            min="0"
            max="40"
            value={years}
            onChange={e => setYears(e.target.value)}
            placeholder="0"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          />
        </div>

        {/* Months */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {L.months}
          </label>
          <select
            value={months}
            onChange={e => setMonths(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i}>{i} {isAr ? 'أشهر' : 'months'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Note */}
      <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-4 py-2.5">
        ⚠️ {L.note}
      </p>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={calculate}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {L.calculate}
        </button>
        <button
          onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors"
        >
          {L.reset}
        </button>
      </div>

      {/* Result */}
      {result !== null && (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
          <p className="text-sm text-gray-500 mb-2">{L.result}</p>
          {totalYears < 1 ? (
            <p className="text-amber-600 font-semibold">{L.lessThanYear}</p>
          ) : (
            <>
              <div className="text-3xl font-black text-emerald-600 mb-4">
                {fmt(result, selectedCountry.currency)}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="text-gray-400 mb-0.5">{isAr ? 'مدة الخدمة' : 'Service Period'}</div>
                  <div className="font-semibold text-gray-900">
                    {Math.floor(totalYears)} {isAr ? 'سنة' : 'yrs'}{' '}
                    {Math.round((totalYears % 1) * 12)} {isAr ? 'شهر' : 'mo'}
                  </div>
                </div>
                <div className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="text-gray-400 mb-0.5">{isAr ? 'معادل أشهر' : 'Equivalent'}</div>
                  <div className="font-semibold text-gray-900">
                    {(result / (parseFloat(basicSalary) || 1)).toFixed(1)} {isAr ? 'راتب شهري' : 'months salary'}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
