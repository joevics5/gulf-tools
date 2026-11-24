'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

type FreeZone =
  | 'standard'   // JAFZA, DMCC, DAFZA, SAIF, DDA, most others
  | 'difc'       // DEWS scheme

type LeaveReason = 'resignation' | 'termination' | 'contract_end'

interface Inputs {
  freeZone: FreeZone
  basicSalary: number
  startDate: Date
  endDate: Date
  leaveReason: LeaveReason
  deductions: number
}

interface BreakdownRow {
  label: string
  value: string
  highlight?: boolean
  negative?: boolean
  sub?: boolean
}

interface CalcResult {
  eligible: boolean
  totalYears: number
  serviceSummary: string
  totalGratuity: number
  netGratuity: number
  cappedAt2Years: boolean
  breakdown: BreakdownRow[]
  mode: 'standard' | 'difc'
  note: string
}

function diffDays(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}

function serviceSummary(days: number, isAr: boolean) {
  const y = Math.floor(days / 365)
  const rem = days - y * 365
  const m = Math.floor(rem / 30)
  const d = rem - m * 30
  return [
    y > 0 ? `${y} ${isAr ? (y === 1 ? 'سنة' : 'سنوات') : y === 1 ? 'year' : 'years'}` : '',
    m > 0 ? `${m} ${isAr ? (m === 1 ? 'شهر' : 'أشهر') : m === 1 ? 'month' : 'months'}` : '',
    d > 0 ? `${d} ${isAr ? (d === 1 ? 'يوم' : 'أيام') : d === 1 ? 'day' : 'days'}` : '',
  ].filter(Boolean).join(', ') || (isAr ? '0 أيام' : '0 days')
}

function fmt(n: number) {
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function calculateStandard(inputs: Inputs, isAr: boolean): CalcResult {
  const { basicSalary, startDate, endDate, deductions } = inputs
  const totalDays = diffDays(startDate, endDate)
  const totalYears = totalDays / 365
  const summary = serviceSummary(totalDays, isAr)
  const dailyRate = basicSalary / 30

  if (totalYears < 1) {
    return {
      eligible: false, totalYears, serviceSummary: summary,
      totalGratuity: 0, netGratuity: 0, cappedAt2Years: false,
      breakdown: [], mode: 'standard',
      note: isAr
        ? `تحتاج ${Math.ceil((365 - totalDays))} يوماً إضافياً لاستيفاء الحد الأدنى (سنة كاملة).`
        : `You need ${Math.ceil((365 - totalDays))} more day(s) to meet the 1-year minimum.`,
    }
  }

  const tier1Years = Math.min(totalYears, 5)
  const tier2Years = Math.max(0, totalYears - 5)

  const tier1Amount = tier1Years * 21 * dailyRate
  const tier2Amount = tier2Years * 30 * dailyRate
  let total = tier1Amount + tier2Amount

  const cap = basicSalary * 24
  const cappedAt2Years = total > cap
  if (cappedAt2Years) total = cap

  const net = Math.max(0, total - Math.max(0, deductions))

  const breakdown: BreakdownRow[] = [
    { label: isAr ? 'الأجر اليومي (الراتب ÷ 30)' : 'Daily Rate (Salary ÷ 30)', value: fmt(dailyRate) },
    { label: isAr ? 'مدة الخدمة' : 'Service Period', value: summary },
    {
      label: isAr
        ? `السنوات 1–5 (21 يوم × ${tier1Years.toFixed(4)} سنة)`
        : `Years 1–5  (21 days × ${tier1Years.toFixed(4)} yrs)`,
      value: fmt(tier1Amount),
    },
  ]

  if (tier2Years > 0) {
    breakdown.push({
      label: isAr
        ? `ما بعد 5 سنوات (30 يوم × ${tier2Years.toFixed(4)} سنة)`
        : `Beyond 5 yrs  (30 days × ${tier2Years.toFixed(4)} yrs)`,
      value: fmt(tier2Amount),
    })
  }

  if (cappedAt2Years) {
    breakdown.push({
      label: isAr ? '⚠ تطبيق الحد الأقصى (سنتان من الراتب الأساسي)' : '⚠ Cap applied (2 years basic salary)',
      value: fmt(cap),
      negative: true,
    })
  }

  if (deductions > 0) {
    breakdown.push({
      label: isAr ? 'خصومات / مبالغ مستحقة' : 'Deductions / Amounts Owed',
      value: `− ${fmt(deductions)}`,
      negative: true,
    })
  }

  breakdown.push({
    label: isAr ? 'صافي المكافأة المقدّرة' : 'Net Estimated Gratuity',
    value: fmt(net),
    highlight: true,
  })

  return {
    eligible: true, totalYears, serviceSummary: summary,
    totalGratuity: total, netGratuity: net, cappedAt2Years,
    breakdown, mode: 'standard',
    note: isAr
      ? 'يستند الحساب إلى المرسوم الاتحادي بقانون رقم 33 لسنة 2021 المطبَّق في معظم المناطق الحرة بما فيها جافزا وdmcc ودافزا وسيف زون.'
      : 'Calculated under Federal Decree-Law No. 33 of 2021 — the standard applied in most free zones including JAFZA, DMCC, DAFZA, SAIF Zone.',
  }
}

function calculateDIFC(inputs: Inputs, isAr: boolean): CalcResult {
  const { basicSalary, startDate, endDate, deductions } = inputs
  const totalDays = diffDays(startDate, endDate)
  const totalYears = totalDays / 365
  const summary = serviceSummary(totalDays, isAr)

  if (totalYears < 0) {
    return {
      eligible: false, totalYears, serviceSummary: summary,
      totalGratuity: 0, netGratuity: 0, cappedAt2Years: false,
      breakdown: [], mode: 'difc',
      note: isAr ? 'تاريخ غير صالح.' : 'Invalid dates.',
    }
  }

  // DEWS: 5.83% of basic for first 5 years, 8.33% thereafter
  // Estimate: monthly contributions accumulated (no investment return for conservative)
  const months = totalDays / 30.44
  const tier1Months = Math.min(months, 60)       // first 5 years
  const tier2Months = Math.max(0, months - 60)   // beyond 5 years

  const monthlyBasic = basicSalary
  const tier1Contribution = tier1Months * monthlyBasic * 0.0583
  const tier2Contribution = tier2Months * monthlyBasic * 0.0833
  const total = tier1Contribution + tier2Contribution
  const net = Math.max(0, total - Math.max(0, deductions))

  const breakdown: BreakdownRow[] = [
    {
      label: isAr ? 'النظام المعمول به' : 'Scheme',
      value: isAr ? 'DEWS — نظام ادخار نهاية الخدمة (DIFC)' : 'DEWS — Workplace Savings Scheme (DIFC)',
    },
    {
      label: isAr ? `أشهر السنوات 1–5 (${tier1Months.toFixed(1)} شهراً × 5.83%)` : `Months 1–60  (${tier1Months.toFixed(1)} mo × 5.83%)`,
      value: fmt(tier1Contribution),
    },
  ]

  if (tier2Months > 0) {
    breakdown.push({
      label: isAr
        ? `ما بعد 5 سنوات (${tier2Months.toFixed(1)} شهراً × 8.33%)`
        : `Beyond 5 yrs  (${tier2Months.toFixed(1)} mo × 8.33%)`,
      value: fmt(tier2Contribution),
    })
  }

  if (deductions > 0) {
    breakdown.push({ label: isAr ? 'خصومات' : 'Deductions', value: `− ${fmt(deductions)}`, negative: true })
  }

  breakdown.push({ label: isAr ? 'إجمالي المساهمات التقديري' : 'Estimated Total Contributions', value: fmt(net), highlight: true })

  return {
    eligible: true, totalYears, serviceSummary: summary,
    totalGratuity: total, netGratuity: net, cappedAt2Years: false,
    breakdown, mode: 'difc',
    note: isAr
      ? 'DIFC يطبّق نظام DEWS (Equiom / Zurich) منذ فبراير 2020. هذا التقدير لا يشمل عوائد الاستثمار. الأرصدة المتراكمة قبل 2020 قد تخضع لأحكام مختلفة.'
      : 'DIFC uses DEWS (via Equiom/Zurich) since February 2020. This estimate excludes investment returns. Pre-2020 accrued gratuity may be subject to separate legacy rules.',
  }
}

const FREE_ZONES: { value: FreeZone; en: string; ar: string; badge?: string }[] = [
  { value: 'standard', en: 'Most Free Zones (JAFZA / DMCC / DAFZA / SAIF / DDA / others)', ar: 'معظم المناطق الحرة (جافزا / dmcc / دافزا / سيف / dda وغيرها)', badge: 'Federal Rules' },
  { value: 'difc',     en: 'DIFC — Dubai International Financial Centre', ar: 'مركز دبي المالي العالمي (DIFC)', badge: 'DEWS Scheme' },
]

const LEAVE_REASONS: { value: LeaveReason; en: string; ar: string }[] = [
  { value: 'contract_end', en: 'Contract completed / mutual end', ar: 'انتهاء العقد / إنهاء بالتراضي' },
  { value: 'termination',  en: 'Employer terminates', ar: 'إنهاء من صاحب العمل' },
  { value: 'resignation',  en: 'Resignation', ar: 'استقالة' },
]

export default function UAEFreeZoneGratuityCalculator({ locale }: Props) {
  const isAr = locale === 'ar'
  const tr = useTranslations('tool')

  const [freeZone, setFreeZone] = useState<FreeZone>('standard')
  const [basicSalary, setBasicSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [leaveReason, setLeaveReason] = useState<LeaveReason>('contract_end')
  const [deductions, setDeductions] = useState('')
  const [result, setResult] = useState<CalcResult | null>(null)
  const [error, setError] = useState('')

  function calculate() {
    setError('')
    const salary = parseFloat(basicSalary)
    if (!salary || salary <= 0) {
      setError(tr('inline.please_enter_a_valid_basic_monthly_salar'))
      return
    }
    if (!startDate || !endDate) {
      setError(tr('inline.please_enter_both_start_and_end_dates'))
      return
    }
    const start = new Date(startDate)
    const end = new Date(endDate)
    if (end <= start) {
      setError(tr('inline.end_date_must_be_after_start_date'))
      return
    }
    const ded = parseFloat(deductions) || 0
    const inputs: Inputs = { freeZone, basicSalary: salary, startDate: start, endDate: end, leaveReason, deductions: ded }
    setResult(freeZone === 'difc' ? calculateDIFC(inputs, isAr) : calculateStandard(inputs, isAr))
  }

  function loadSample() {
    setBasicSalary('12000')
    const s = new Date()
    s.setFullYear(s.getFullYear() - 6)
    s.setMonth(s.getMonth() - 4)
    setStartDate(s.toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
    setLeaveReason('resignation')
    setDeductions('0')
    setResult(null)
    setError('')
  }

  function reset() {
    setBasicSalary('')
    setStartDate('')
    setEndDate('')
    setLeaveReason('contract_end')
    setDeductions('')
    setResult(null)
    setError('')
  }

  const isDIFC = freeZone === 'difc'

  return (
    <div className="space-y-6">
      {/* Disclaimer */}
      <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <span className="text-lg leading-none">⚠️</span>
        <p>
          {tr('inline.estimates_only_final_amounts_depend_on_y')}
        </p>
      </div>

      {/* Free Zone Selector */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          {tr('inline.free_zone')}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {FREE_ZONES.map(fz => (
            <button
              key={fz.value}
              onClick={() => { setFreeZone(fz.value); setResult(null) }}
              className={`relative py-3 px-4 rounded-xl border text-sm font-semibold transition-colors text-left ${
                freeZone === fz.value
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isAr ? fz.ar : fz.en}
              {fz.badge && (
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-md font-normal ${
                  freeZone === fz.value ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {fz.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {isDIFC && (
          <div className="mt-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
            {tr('inline.difc_operates_the_dews_workplace_savings')}
          </div>
        )}
      </div>

      {/* Form Fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Basic Salary */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {tr('inline.basic_monthly_salary_aed')}
          </label>
          <p className="text-xs text-gray-500 mb-1.5">
            {tr('inline.basic_salary_only_exclude_housing_transp')}
          </p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input
              type="number"
              min="0"
              value={basicSalary}
              onChange={e => setBasicSalary(e.target.value)}
              placeholder={tr('inline.e_g_12_000')}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {tr('inline.employment_start_date')}
          </label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {tr('inline.last_working_day_end_date')}
          </label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>

        {/* Leave Reason */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {tr('inline.reason_for_leaving')}
          </label>
          <select
            value={leaveReason}
            onChange={e => setLeaveReason(e.target.value as LeaveReason)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          >
            {LEAVE_REASONS.map(r => (
              <option key={r.value} value={r.value}>{isAr ? r.ar : r.en}</option>
            ))}
          </select>
        </div>

        {/* Deductions */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {tr('inline.deductions_amounts_owed_optional')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input
              type="number"
              min="0"
              value={deductions}
              onChange={e => setDeductions(e.target.value)}
              placeholder="0"
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</p>
      )}

      {/* Buttons */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={calculate}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {tr('inline.calculate_gratuity')}
        </button>
        <button
          onClick={loadSample}
          className="px-4 py-3 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-semibold rounded-xl transition-colors text-sm"
        >
          {tr('inline.try_sample_6_3_yrs_aed_12_000')}
        </button>
        <button
          onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors"
        >
          {tr('inline.reset')}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-gray-900">
              {tr('inline.gratuity_result')}
            </h3>
            <span className="text-xs bg-gray-200 text-gray-600 px-2.5 py-1 rounded-full font-medium">
              {result.mode === 'difc' ? 'DIFC / DEWS' : (tr('inline.federal_law'))}
            </span>
          </div>

          {!result.eligible ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
              {result.note}
            </div>
          ) : (
            <>
              {/* Hero */}
              <div className="bg-emerald-600 rounded-xl p-5 text-white">
                <div className="text-sm opacity-80 mb-1">
                  {isDIFC
                    ? (tr('inline.estimated_dews_contributions'))
                    : (tr('inline.estimated_end_of_service_gratuity'))}
                </div>
                <div className="text-3xl font-black">{fmt(result.netGratuity)}</div>
                {result.cappedAt2Years && (
                  <div className="mt-2 text-xs bg-white/20 rounded-lg px-3 py-1.5">
                    {tr('inline.cap_applied_cannot_exceed_2_years_basic_')}
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700">
                {result.note}
              </div>

              {/* Breakdown */}
              <div className="space-y-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                  {tr('inline.breakdown')}
                </p>
                {result.breakdown.map((row, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 last:border-0 ${row.highlight ? 'pt-3' : ''}`}
                  >
                    <span className={`text-sm ${row.sub ? 'text-gray-500 pl-3' : 'text-gray-600'}`}>{row.label}</span>
                    <span className={`text-sm font-semibold whitespace-nowrap ${
                      row.highlight ? 'text-emerald-600 text-base' : row.negative ? 'text-red-500' : 'text-gray-900'
                    }`}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Payment timeline note */}
              <div className="bg-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500">
                {tr('inline.gratuity_must_be_paid_within_14_days_of_')}
              </div>
            </>
          )}
        </div>
      )}

      {/* Zone authority links */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500 justify-center">
        {[
          { label: 'JAFZA', url: 'https://www.jafza.ae' },
          { label: 'DMCC', url: 'https://www.dmcc.ae' },
          { label: 'DIFC', url: 'https://www.difc.ae' },
          { label: 'MOHRE', url: 'https://www.mohre.gov.ae' },
        ].map(l => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">
            {l.label}
          </a>
        ))}
      </div>

      <p className="text-xs text-gray-500 text-center">
        {tr('inline.source_federal_decree_law_no_33_of_2021_')}
      </p>
    </div>
  )
}
