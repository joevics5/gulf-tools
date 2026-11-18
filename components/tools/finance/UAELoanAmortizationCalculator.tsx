'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { isRtl } from '@/lib/i18n/locales'

type Props = { locale: string }

type LoanType = 'personal' | 'auto' | 'mortgage'
type RateType = 'reducing' | 'flat'
type NationalityType = 'expat' | 'national'

interface MonthRow {
  month: number
  beginBalance: number
  emi: number
  principal: number
  interest: number
  endBalance: number
}

interface YearRow {
  year: number
  principalPaid: number
  interestPaid: number
  endBalance: number
}

interface EarlyRepayment {
  month: number
  outstandingBalance: number
  penalty: number
  interestSaved: number
  totalCostEarly: number
  totalCostFull: number
  netSavings: number
}

interface Results {
  emi: number
  totalInterest: number
  totalRepayment: number
  effectiveRate: number | null
  dbr: number | null
  dbrOk: boolean | null
  monthlySchedule: MonthRow[]
  yearlySchedule: YearRow[]
  earlyRepayment: EarlyRepayment | null
  flatRateConverted: boolean
  reducingRate: number
}

const LOAN_TYPES: { value: LoanType; label: string; labelAr: string }[] = [
  { value: 'personal', label: 'Personal Loan', labelAr: 'قرض شخصي' },
  { value: 'auto',     label: 'Auto Loan',     labelAr: 'قرض سيارة' },
  { value: 'mortgage', label: 'Mortgage',      labelAr: 'قرض عقاري' },
]

const RATE_TYPES: { value: RateType; label: string; labelAr: string }[] = [
  { value: 'reducing', label: 'Reducing Balance', labelAr: 'رصيد متناقص' },
  { value: 'flat',     label: 'Flat Rate',         labelAr: 'سعر ثابت' },
]

const NATIONALITIES: { value: NationalityType; label: string; labelAr: string }[] = [
  { value: 'expat',    label: 'Expatriate',    labelAr: 'وافد' },
  { value: 'national', label: 'UAE National',  labelAr: 'مواطن إماراتي' },
]

function fmt(n: number) {
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPct(n: number) {
  return `${n.toFixed(2)}%`
}

function maxTenor(loanType: LoanType, nationality: NationalityType): number {
  if (loanType === 'mortgage') return nationality === 'national' ? 360 : 300
  if (loanType === 'auto') return 60
  return nationality === 'national' ? 60 : 48
}

function calcResults(
  principal: number,
  annualRate: number,
  rateType: RateType,
  tenorMonths: number,
  salary: number,
  existingDebts: number,
  earlyMonth: number | null,
): Results {
  // Flat rate → reducing balance conversion (~×1.85 for typical tenors)
  let reducingRate = annualRate
  let flatRateConverted = false
  if (rateType === 'flat') {
    reducingRate = annualRate * 1.85
    flatRateConverted = true
  }

  const r = reducingRate / 12 / 100
  const n = tenorMonths

  // EMI using reducing balance formula
  const emi = r === 0
    ? principal / n
    : (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)

  // Monthly amortization schedule
  const monthlySchedule: MonthRow[] = []
  let balance = principal
  for (let i = 1; i <= n; i++) {
    const interest = balance * r
    const principalPaid = emi - interest
    const endBalance = Math.max(balance - principalPaid, 0)
    monthlySchedule.push({
      month: i,
      beginBalance: balance,
      emi,
      principal: principalPaid,
      interest,
      endBalance,
    })
    balance = endBalance
  }

  // Yearly aggregation
  const yearMap = new Map<number, YearRow>()
  for (const row of monthlySchedule) {
    const year = Math.ceil(row.month / 12)
    const existing = yearMap.get(year) ?? { year, principalPaid: 0, interestPaid: 0, endBalance: 0 }
    yearMap.set(year, {
      year,
      principalPaid: existing.principalPaid + row.principal,
      interestPaid: existing.interestPaid + row.interest,
      endBalance: row.endBalance,
    })
  }
  const yearlySchedule = Array.from(yearMap.values())

  const totalInterest = monthlySchedule.reduce((s, r) => s + r.interest, 0)
  const totalRepayment = emi * n

  // DBR
  let dbr: number | null = null
  let dbrOk: boolean | null = null
  if (salary > 0) {
    dbr = ((emi + existingDebts) / salary) * 100
    dbrOk = dbr <= 50
  }

  // Early repayment
  let earlyRepayment: EarlyRepayment | null = null
  if (earlyMonth && earlyMonth >= 1 && earlyMonth <= n) {
    const rowAtM = monthlySchedule[earlyMonth - 1]
    const outstandingBalance = rowAtM.endBalance
    const penalty = Math.min(outstandingBalance * 0.01, 10000)
    const interestPaidSoFar = monthlySchedule.slice(0, earlyMonth).reduce((s, r) => s + r.interest, 0)
    const interestSaved = totalInterest - interestPaidSoFar
    const totalCostEarly = emi * earlyMonth + outstandingBalance + penalty
    const totalCostFull = totalRepayment
    const netSavings = totalCostFull - totalCostEarly

    earlyRepayment = {
      month: earlyMonth,
      outstandingBalance,
      penalty,
      interestSaved,
      totalCostEarly,
      totalCostFull,
      netSavings,
    }
  }

  return {
    emi,
    totalInterest,
    totalRepayment,
    effectiveRate: flatRateConverted ? reducingRate : null,
    dbr,
    dbrOk,
    monthlySchedule,
    yearlySchedule,
    earlyRepayment,
    flatRateConverted,
    reducingRate,
  }
}

export default function UAELoanAmortizationCalculator({ locale }: Props) {
  const isAr = locale === 'ar'
  const tt = useTranslations('tool')

  const [loanType, setLoanType] = useState<LoanType>('personal')
  const [nationality, setNationality] = useState<NationalityType>('expat')
  const [principal, setPrincipal] = useState('')
  const [annualRate, setAnnualRate] = useState('')
  const [rateType, setRateType] = useState<RateType>('reducing')
  const [tenorMonths, setTenorMonths] = useState('')
  const [salary, setSalary] = useState('')
  const [existingDebts, setExistingDebts] = useState('')
  const [earlyMonth, setEarlyMonth] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [scheduleView, setScheduleView] = useState<'monthly' | 'yearly'>('yearly')
  const [showSchedule, setShowSchedule] = useState(false)

  const maxT = maxTenor(loanType, nationality)

  function validate(): string[] {
    const errs: string[] = []
    const p = parseFloat(principal)
    const r = parseFloat(annualRate)
    const t = parseInt(tenorMonths)
    const em = parseInt(earlyMonth)

    if (!p || p < 1000) errs.push(tt('inline.minimum_loan_amount_is_aed_1_000'))
    if (!r || r < 0.1) errs.push(tt('inline.enter_a_valid_interest_rate'))
    if (r > 14) errs.push(tt('inline.typical_uae_personal_loan_rates_range_5_'))
    if (!t || t < 1) errs.push(tt('inline.enter_a_valid_tenor'))
    if (t > maxT) errs.push(
      isAr
        ? `⚠ الحد الأقصى لمدة ${loanType === 'personal' ? 'القرض الشخصي' : loanType === 'auto' ? 'قرض السيارة' : 'الرهن العقاري'} ${maxT} شهراً وفق لوائح البنك المركزي الإماراتي`
        : `⚠ ${loanType === 'personal' ? 'Personal' : loanType === 'auto' ? 'Auto' : 'Mortgage'} loan tenor capped at ${maxT} months per CBUAE regulations`
    )
    if (earlyMonth && (em < 1 || em > t)) errs.push(tt('inline.early_repayment_month_cannot_exceed_loan'))
    return errs
  }

  function calculate() {
    const errs = validate()
    // Filter out warnings (still calculate if only warnings)
    const hardErrors = errs.filter(e => !e.startsWith('⚠'))
    if (hardErrors.length > 0) {
      setErrors(errs)
      setResults(null)
      return
    }
    setErrors(errs) // keep warnings visible
    const res = calcResults(
      parseFloat(principal),
      parseFloat(annualRate),
      rateType,
      parseInt(tenorMonths),
      parseFloat(salary) || 0,
      parseFloat(existingDebts) || 0,
      earlyMonth ? parseInt(earlyMonth) : null,
    )
    setResults(res)
  }

  function reset() {
    setPrincipal(''); setAnnualRate(''); setTenorMonths('')
    setSalary(''); setExistingDebts(''); setEarlyMonth('')
    setLoanType('personal'); setNationality('expat'); setRateType('reducing')
    setResults(null); setErrors([])
  }


  return (
    <div className="space-y-6" dir={isRtl(locale) ? 'rtl' : 'ltr'}>
      {/* Loan type + nationality */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('loanType')}</label>
          <select value={loanType} onChange={e => setLoanType(e.target.value as LoanType)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            {LOAN_TYPES.map(t => <option key={t.value} value={t.value}>{isAr ? t.labelAr : t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('nationality')}</label>
          <select value={nationality} onChange={e => setNationality(e.target.value as NationalityType)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition">
            {NATIONALITIES.map(n => <option key={n.value} value={n.value}>{isAr ? n.labelAr : n.label}</option>)}
          </select>
        </div>
      </div>

      {/* Principal + Rate */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('principal')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">AED</span>
            <input type="number" min="1000" value={principal} onChange={e => setPrincipal(e.target.value)}
              placeholder="100,000"
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('rate')}</label>
          <div className="relative">
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">%</span>
            <input type="number" min="0.1" max="30" step="0.1" value={annualRate} onChange={e => setAnnualRate(e.target.value)}
              placeholder="7.5"
              className="w-full pl-4 pr-10 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
        </div>
      </div>

      {/* Rate type + tenor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('rateType')}</label>
          <div className="flex rounded-xl border border-gray-200 overflow-hidden">
            {RATE_TYPES.map(rt => (
              <button key={rt.value}
                onClick={() => setRateType(rt.value)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${rateType === rt.value ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                {isAr ? rt.labelAr : rt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {tt('tenor')} <span className="font-normal text-gray-500">(max {maxT})</span>
          </label>
          <input type="number" min="1" max={maxT} value={tenorMonths} onChange={e => setTenorMonths(e.target.value)}
            placeholder={String(loanType === 'mortgage' ? 240 : 36)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
        </div>
      </div>

      {/* Optional fields */}
      <div className="border border-dashed border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Optional — DBR & Early Repayment</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('salary')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">AED</span>
              <input type="number" min="0" value={salary} onChange={e => setSalary(e.target.value)}
                placeholder="20,000"
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('debts')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">AED</span>
              <input type="number" min="0" value={existingDebts} onChange={e => setExistingDebts(e.target.value)}
                placeholder="0"
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{tt('earlyMonth')}</label>
            <input type="number" min="1" value={earlyMonth} onChange={e => setEarlyMonth(e.target.value)}
              placeholder={tt('inline.e_g_24')}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition" />
          </div>
        </div>
      </div>

      {/* Errors / warnings */}
      {errors.length > 0 && (
        <div className="space-y-1">
          {errors.map((e, i) => (
            <p key={i} className={`text-sm px-3 py-2 rounded-lg ${e.startsWith('⚠') || e.startsWith('ℹ') ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'}`}>{e}</p>
          ))}
        </div>
      )}

      {/* Flat rate info */}
      {rateType === 'flat' && annualRate && !isNaN(parseFloat(annualRate)) && (
        <p className="text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
          ℹ {isAr
            ? `سيتم تحويل ${annualRate}% (سعر ثابت) إلى ~${(parseFloat(annualRate) * 1.85).toFixed(2)}% (رصيد متناقص) وفق معيار البنك المركزي الإماراتي`
            : `Converting ${annualRate}% flat rate to ~${(parseFloat(annualRate) * 1.85).toFixed(2)}% reducing balance for accurate calculation (CBUAE APR standard)`}
        </p>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={calculate}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
          {tt('calculate')}
        </button>
        <button onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
          {tt('reset')}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          {/* Primary results */}
          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
            {/* Hero EMI */}
            <div className="bg-blue-600 rounded-xl p-5 text-white">
              <div className="text-sm opacity-80 mb-1">{tt('monthlyEmi')}</div>
              <div className="text-4xl font-black tracking-tight">{fmt(results.emi)}</div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard label={tt('totalInterest')} value={fmt(results.totalInterest)} accent="red" />
              <StatCard label={tt('totalRepayment')} value={fmt(results.totalRepayment)} accent="gray" />
              {results.effectiveRate !== null
                ? <StatCard label={tt('effectiveRate')} value={fmtPct(results.effectiveRate)} accent="indigo" />
                : <StatCard label={tt('inline.annual_percentage_rate')} value={fmtPct(results.reducingRate)} accent="indigo" />
              }
            </div>

            {/* DBR */}
            {results.dbr !== null && (
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${results.dbrOk ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                <span className="text-sm font-semibold text-gray-700">{tt('dbrStatus')}</span>
                <span className={`text-sm font-bold ${results.dbrOk ? 'text-green-700' : 'text-red-700'}`}>
                  {fmtPct(results.dbr)} — {results.dbrOk ? tt('dbrOk') : tt('dbrFail')}
                </span>
              </div>
            )}

            {/* Regulatory notes */}
            <div className="text-xs text-gray-500 space-y-0.5 pt-1 border-t border-gray-100">
              <p>• {tt('inline.processing_fee_capped_at_1_of_loan_amoun')}</p>
              <p>• {tt('inline.total_interest_cannot_exceed_principal_u')}</p>
              <p>• {tt('inline.no_compound_interest_applies_on_loans_ua')}</p>
            </div>
          </div>

          {/* Early repayment */}
          {results.earlyRepayment && (
            <div className="border border-amber-200 bg-amber-50 rounded-2xl p-6 space-y-3">
              <h3 className="font-bold text-gray-900 text-base">{tt('earlyAnalysis')} — {tt('inline.month')} {results.earlyRepayment.month}</h3>
              <div className="space-y-2">
                <EarlyRow label={tt('outstanding')} value={fmt(results.earlyRepayment.outstandingBalance)} />
                <EarlyRow label={tt('penalty')} value={fmt(results.earlyRepayment.penalty)} sub={tt('inline.capped_at_1_or_aed_10_000_whichever_lowe')} />
                <EarlyRow label={tt('interestSaved')} value={fmt(results.earlyRepayment.interestSaved)} positive />
                <div className="border-t border-amber-200 pt-2">
                  <EarlyRow label={tt('inline.total_cost_early_repayment')} value={fmt(results.earlyRepayment.totalCostEarly)} />
                  <EarlyRow label={tt('inline.total_cost_full_tenor')} value={fmt(results.earlyRepayment.totalCostFull)} />
                  <EarlyRow label={tt('netSavings')} value={fmt(results.earlyRepayment.netSavings)} positive bold />
                </div>
              </div>
            </div>
          )}

          {/* Schedule toggle */}
          <div>
            <button
              onClick={() => setShowSchedule(s => !s)}
              className="w-full flex items-center justify-between px-5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">
              <span>{tt('showHide')}</span>
              <span>{showSchedule ? '▲' : '▼'}</span>
            </button>

            {showSchedule && (
              <div className="mt-3 space-y-3">
                {/* Monthly / Yearly tabs */}
                <div className="flex rounded-xl border border-gray-200 overflow-hidden w-fit">
                  {(['yearly', 'monthly'] as const).map(v => (
                    <button key={v} onClick={() => setScheduleView(v)}
                      className={`px-5 py-2 text-sm font-semibold transition-colors ${scheduleView === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                      {v === 'yearly' ? tt('yearly') : tt('monthly')}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  {scheduleView === 'yearly' ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 font-semibold">
                        <tr>
                          <Th>{tt('year')}</Th>
                          <Th>{tt('principalPaid')}</Th>
                          <Th>{tt('interestPaid')}</Th>
                          <Th>{tt('endBal')}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.yearlySchedule.map((row, i) => (
                          <tr key={row.year} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <Td>{row.year}</Td>
                            <Td>{fmt(row.principalPaid)}</Td>
                            <Td className="text-red-500">{fmt(row.interestPaid)}</Td>
                            <Td>{fmt(row.endBalance)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 font-semibold">
                        <tr>
                          <Th>{tt('month')}</Th>
                          <Th>{tt('beginBal')}</Th>
                          <Th>{tt('payment')}</Th>
                          <Th>{tt('principalPaid')}</Th>
                          <Th>{tt('interestPaid')}</Th>
                          <Th>{tt('endBal')}</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.monthlySchedule.map((row, i) => (
                          <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                            <Td>{row.month}</Td>
                            <Td>{fmt(row.beginBalance)}</Td>
                            <Td className="font-semibold">{fmt(row.emi)}</Td>
                            <Td className="text-blue-600">{fmt(row.principal)}</Td>
                            <Td className="text-red-500">{fmt(row.interest)}</Td>
                            <Td>{fmt(row.endBalance)}</Td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: 'red' | 'gray' | 'indigo' }) {
  const colors = {
    red: 'text-red-600',
    gray: 'text-gray-900',
    indigo: 'text-indigo-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-base font-bold ${colors[accent]}`}>{value}</div>
    </div>
  )
}

function EarlyRow({ label, value, positive, negative, sub, bold }: {
  label: string; value: string; positive?: boolean; negative?: boolean; sub?: string; bold?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{label}</span>
        {sub && <p className="text-xs text-gray-500">{sub}</p>}
      </div>
      <span className={`text-sm font-semibold ${positive ? 'text-green-700' : negative ? 'text-red-600' : 'text-gray-900'} ${bold ? 'text-base' : ''}`}>
        {value}
      </span>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 text-left text-xs whitespace-nowrap">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-2.5 whitespace-nowrap tabular-nums ${className}`}>{children}</td>
}
