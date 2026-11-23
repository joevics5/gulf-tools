'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { isRtl } from '@/lib/i18n/locales'

type Props = { locale: string }

type LoanMode = 'conventional' | 'islamic'

type AmortizationRow = {
  month: number
  beginningBalance: number
  interest: number
  principal: number
  installment: number
  endingBalance: number
}

type Result = {
  installment: number
  loanAmount: number
  totalInterest: number
  totalRepayable: number
  amortization: AmortizationRow[]
  dbr: number | null
}

// ─── Pure math utils ────────────────────────────────────────────────────────

function calculateEMI(principal: number, annualRate: number, months: number): number {
  if (annualRate === 0) return principal / months
  const r = annualRate / 12 / 100
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  months: number,
  installment: number,
): AmortizationRow[] {
  const r = annualRate / 12 / 100
  const rows: AmortizationRow[] = []
  let balance = principal

  for (let i = 1; i <= months; i++) {
    const interest = balance * r
    const principalPaid = installment - interest
    const endBalance = Math.max(0, balance - principalPaid)
    rows.push({
      month: i,
      beginningBalance: balance,
      interest,
      principal: principalPaid,
      installment,
      endingBalance: endBalance,
    })
    balance = endBalance
  }
  return rows
}

function calculateDBR(installment: number, income: number, existingDebts: number): number {
  if (income <= 0) return 0
  return ((installment + existingDebts) / income) * 100
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtAED(n: number) {
  return `AED ${fmt(n, 0)}`
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CarLoanEMICalculator({ locale }: Props) {
  const tl = useTranslations('tool')

  // Inputs
  const [carPrice, setCarPrice] = useState('100000')
  const [downPaymentPct, setDownPaymentPct] = useState('20')
  const [downPaymentAmt, setDownPaymentAmt] = useState('20000')
  const [annualRate, setAnnualRate] = useState('3.99')
  const [tenure, setTenure] = useState(48)
  const [mode, setMode] = useState<LoanMode>('conventional')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [existingDebts, setExistingDebts] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [schedulePage, setSchedulePage] = useState(0)
  const ROWS_PER_PAGE = 12

  // Derived
  const carPriceNum = parseFloat(carPrice) || 0
  const downAmtNum = parseFloat(downPaymentAmt) || 0
  const loanAmount = Math.max(0, carPriceNum - downAmtNum)
  const rateNum = parseFloat(annualRate) || 0
  const incomeNum = parseFloat(monthlyIncome) || 0
  const debtsNum = parseFloat(existingDebts) || 0

  // Sync down payment amount <-> percentage
  const handlePriceChange = useCallback((val: string) => {
    setCarPrice(val)
    const p = parseFloat(val) || 0
    const pct = parseFloat(downPaymentPct) || 20
    setDownPaymentAmt(String(Math.round(p * pct / 100)))
  }, [downPaymentPct])

  const handlePctChange = useCallback((val: string) => {
    const pct = Math.max(20, Math.min(100, parseFloat(val) || 20))
    setDownPaymentPct(String(pct))
    setDownPaymentAmt(String(Math.round(carPriceNum * pct / 100)))
  }, [carPriceNum])

  const handleAmtChange = useCallback((val: string) => {
    setDownPaymentAmt(val)
    const amt = parseFloat(val) || 0
    if (carPriceNum > 0) {
      setDownPaymentPct(String(Math.round((amt / carPriceNum) * 100)))
    }
  }, [carPriceNum])

  const ltv = carPriceNum > 0 ? (loanAmount / carPriceNum) * 100 : 0
  const ltvWarning = ltv > 80

  // Calculations
  const result = useMemo<Result | null>(() => {
    if (loanAmount <= 0 || rateNum < 0 || tenure <= 0) return null
    const installment = calculateEMI(loanAmount, rateNum, tenure)
    const totalRepayable = installment * tenure
    const totalInterest = totalRepayable - loanAmount
    const amortization = generateAmortizationSchedule(loanAmount, rateNum, tenure, installment)
    const dbr = incomeNum > 0 ? calculateDBR(installment, incomeNum, debtsNum) : null
    return { installment, loanAmount, totalInterest, totalRepayable, amortization, dbr }
  }, [loanAmount, rateNum, tenure, incomeNum, debtsNum])

  const paginatedRows = result
    ? result.amortization.slice(schedulePage * ROWS_PER_PAGE, (schedulePage + 1) * ROWS_PER_PAGE)
    : []
  const totalPages = result ? Math.ceil(result.amortization.length / ROWS_PER_PAGE) : 0

  const principalPct = result
    ? Math.round((result.loanAmount / result.totalRepayable) * 100)
    : 0
  const interestPct = 100 - principalPct

  // Labels
  const L = {
    title: tl('L.title'),
    carPrice: tl('L.carPrice'),
    downPayment: tl('L.downPayment'),
    pct: tl('L.pct'),
    amount: tl('L.amount'),
    loanAmount: tl('L.loanAmount'),
    rate: mode === 'islamic' ? tl('L.rate_if') : tl('L.rate_else'),
    tenure: tl('L.tenure'),
    mode: tl('L.mode'),
    conventional: tl('L.conventional'),
    islamic: tl('L.islamic'),
    income: tl('L.income'),
    debts: tl('L.debts'),
    installment: mode === 'islamic' ? tl('L.installment_if') : tl('L.installment_else'),
    totalInterest: mode === 'islamic' ? tl('L.totalInterest_if') : tl('L.totalInterest_else'),
    totalRepayable: tl('L.totalRepayable'),
    schedule: tl('L.schedule'),
    hideSchedule: tl('L.hideSchedule'),
    showSchedule: tl('L.showSchedule'),
    month: tl('L.month'),
    openBal: tl('L.openBal'),
    interest: mode === 'islamic' ? tl('L.interest_if') : tl('L.interest_else'),
    principal: tl('L.principal'),
    emi: tl('L.emi'),
    closeBal: tl('L.closeBal'),
    dbrWarning: tl('L.dbrWarning'),
    dbrOk: tl('L.dbrOk'),
    disclaimer: tl('L.disclaimer'),
    ltvWarning: tl('L.ltvWarning'),
    prev: tl('L.prev'),
    next: tl('L.next'),
    principal2: tl('L.principal2'),
    interest2: mode === 'islamic' ? tl('L.interest2_if') : tl('L.interest2_else'),
  }

  return (
    <div className="space-y-6 font-sans" dir={isRtl(locale) ? 'rtl' : 'ltr'}>

      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        {(['conventional', 'islamic'] as LoanMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === m
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'conventional' ? L.conventional : L.islamic}
          </button>
        ))}
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Car Price */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.carPrice}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
            <input
              type="number"
              min="0"
              value={carPrice}
              onChange={e => handlePriceChange(e.target.value)}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Down Payment % */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.downPayment} — {L.pct}</label>
          <div className="space-y-2">
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              value={downPaymentPct}
              onChange={e => handlePctChange(e.target.value)}
              className="w-full accent-blue-600"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="20"
                max="100"
                value={downPaymentPct}
                onChange={e => handlePctChange(e.target.value)}
                className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">% (min 20%)</span>
            </div>
          </div>
        </div>

        {/* Down Payment AED */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.downPayment} — {L.amount}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
            <input
              type="number"
              min="0"
              value={downPaymentAmt}
              onChange={e => handleAmtChange(e.target.value)}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
          {ltvWarning && (
            <p className="text-xs text-amber-600 mt-1 font-medium">
              ⚠ {L.ltvWarning}
            </p>
          )}
        </div>

        {/* Loan Amount (read-only) */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.loanAmount}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
            <input
              type="text"
              readOnly
              value={fmt(loanAmount, 0)}
              className="w-full pl-14 pr-4 py-3 border border-gray-100 rounded-xl text-gray-700 bg-gray-50 font-semibold cursor-not-allowed"
            />
          </div>
        </div>

        {/* Interest/Profit Rate */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.rate}</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              step="0.01"
              value={annualRate}
              onChange={e => setAnnualRate(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">%</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">UAE banks: typically 2.15% – 5%+ (reducing balance)</p>
        </div>

        {/* Tenure */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            {L.tenure}: <span className="text-blue-600 font-bold">{tenure}</span>
          </label>
          <input
            type="range"
            min="12"
            max="60"
            step="12"
            value={tenure}
            onChange={e => setTenure(Number(e.target.value))}
            className="w-full accent-blue-600 mt-2"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>12</span><span>24</span><span>36</span><span>48</span><span>60</span>
          </div>
        </div>

        {/* Monthly Income */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.income}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
            <input
              type="number"
              min="0"
              value={monthlyIncome}
              onChange={e => setMonthlyIncome(e.target.value)}
              placeholder="e.g. 15000"
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>

        {/* Existing Debts */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.debts}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
            <input
              type="number"
              min="0"
              value={existingDebts}
              onChange={e => setExistingDebts(e.target.value)}
              placeholder="e.g. 2000"
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">

          {/* Hero installment */}
          <div className="bg-blue-600 rounded-2xl p-6 text-white">
            <div className="text-sm opacity-80 mb-1">{L.installment}</div>
            <div className="text-4xl font-black tracking-tight">
              AED {fmt(result.installment, 0)}
              <span className="text-lg font-medium opacity-70"> / month</span>
            </div>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card label={L.loanAmount} value={fmtAED(result.loanAmount)} />
            <Card label={L.totalInterest} value={fmtAED(result.totalInterest)} accent="amber" />
            <Card label={L.totalRepayable} value={fmtAED(result.totalRepayable)} accent="blue" />
          </div>

          {/* Simple pie-style bar */}
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
              <span>📦 {L.principal2}: {principalPct}%</span>
              <span>💰 {L.interest2}: {interestPct}%</span>
            </div>
            <div className="flex h-4 rounded-full overflow-hidden">
              <div
                className="bg-blue-600 transition-all"
                style={{ width: `${principalPct}%` }}
              />
              <div
                className="bg-amber-400 transition-all"
                style={{ width: `${interestPct}%` }}
              />
            </div>
          </div>

          {/* DBR Warning */}
          {result.dbr !== null && (
            <div className={`rounded-xl p-4 flex items-start gap-3 ${
              result.dbr > 50 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
            }`}>
              <span className="text-xl">{result.dbr > 50 ? '⚠️' : '✅'}</span>
              <div>
                <div className={`text-sm font-bold ${result.dbr > 50 ? 'text-red-700' : 'text-green-700'}`}>
                  {result.dbr > 50 ? L.dbrWarning : L.dbrOk}: {fmt(result.dbr, 1)}%
                </div>
                <div className={`text-xs mt-0.5 ${result.dbr > 50 ? 'text-red-600' : 'text-green-600'}`}>
                  {result.dbr > 50
                    ? 'This exceeds CBUAE\'s 50% Debt Burden Ratio (DBR) limit. You may not qualify.'
                    : 'Within CBUAE\'s 50% DBR guideline. You may qualify for this loan.'}
                </div>
              </div>
            </div>
          )}

          {/* Schedule Toggle */}
          <button
            onClick={() => { setShowSchedule(v => !v); setSchedulePage(0) }}
            className="w-full py-3 border border-blue-200 text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition-colors text-sm"
          >
            {showSchedule ? `▲ ${L.hideSchedule}` : `▼ ${L.showSchedule}`}
          </button>

          {/* Amortization Table */}
          {showSchedule && (
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 font-semibold">
                  <tr>
                    {[L.month, L.openBal, L.principal, L.interest, L.emi, L.closeBal].map(h => (
                      <th key={h} className="px-3 py-3 text-right first:text-left whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedRows.map(row => (
                    <tr key={row.month} className="hover:bg-gray-50 transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-gray-700">{row.month}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmt(row.beginningBalance, 0)}</td>
                      <td className="px-3 py-2.5 text-right text-blue-600 font-medium">{fmt(row.principal, 0)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-600">{fmt(row.interest, 0)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900">{fmt(row.installment, 0)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{fmt(row.endingBalance, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                  <button
                    onClick={() => setSchedulePage(p => Math.max(0, p - 1))}
                    disabled={schedulePage === 0}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-200 rounded-lg transition"
                  >
                    {L.prev}
                  </button>
                  <span className="text-xs text-gray-500">
                    Page {schedulePage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setSchedulePage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={schedulePage === totalPages - 1}
                    className="px-3 py-1.5 text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-200 rounded-lg transition"
                  >
                    {L.next}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-4 border border-gray-100 leading-relaxed">
        ⚠️ <strong>Disclaimer:</strong> {L.disclaimer}
      </div>
    </div>
  )
}

function Card({
  label,
  value,
  accent = 'gray',
}: {
  label: string
  value: string
  accent?: 'gray' | 'blue' | 'amber'
}) {
  const colors = {
    gray: 'text-gray-900',
    blue: 'text-blue-700',
    amber: 'text-amber-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-black ${colors[accent]}`}>{value}</div>
    </div>
  )
}
