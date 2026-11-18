'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// ─── UAE Country Rule Object ───────────────────────────────────────────────────
// Structured for future GCC/Egypt registry extension

const UAE_LOAN_REPAYMENT = {
  currency: 'AED',
  defaultRateBasis: 'reducing' as const,
  compoundInterestAllowed: false, // UAE Supreme Court prohibition
  disclosureBasis: 'reducing-balance per annum + separate APR',
  earlySettlementBasis: 'outstanding-principal-plus-fee', // not future unearned interest
  notes: 'UAE law prohibits compound interest. Banks disclose on reducing-balance basis. APR shown separately when fees present.',
}

// ─── Pure Calculation Engine ───────────────────────────────────────────────────

type AmortRow = {
  month: number
  openingBalance: number
  emi: number
  interest: number
  principal: number
  closingBalance: number
  cumulativeInterest: number
  cumulativePrincipal: number
}

/** Standard reducing-balance EMI formula */
function calcEmi(principal: number, annualRate: number, months: number): number {
  const r = annualRate / 12 / 100
  if (r === 0) return principal / months
  const factor = Math.pow(1 + r, months)
  return (principal * r * factor) / (factor - 1)
}

/** Flat-rate → reducing-balance approximation: r_red ≈ 2·n·r_flat / (n+1) */
function flatToReducing(flatRate: number, months: number): number {
  return (2 * months * flatRate) / (months + 1)
}

/** Reducing → flat approximation: r_flat ≈ r_red·(n+1) / (2·n) */
function reducingToFlat(reducingRate: number, months: number): number {
  return reducingRate * (months + 1) / (2 * months)
}

/** Build month-by-month amortisation schedule.
 *  Never compounds unpaid interest into principal (UAE law). */
function buildSchedule(
  principal: number,
  annualRate: number,
  months: number,
  emi: number,
  extraMonthly: number = 0,
): AmortRow[] {
  const r = annualRate / 12 / 100
  const rows: AmortRow[] = []
  let balance = principal
  let cumInterest = 0
  let cumPrincipal = 0

  for (let m = 1; m <= months && balance > 0.005; m++) {
    const interest = Math.round(balance * r * 100) / 100
    const isLastMonth = m === months || (balance - (emi - interest + extraMonthly)) < 0.005
    let principalComp: number

    if (isLastMonth) {
      principalComp = balance // absorb rounding residual
    } else {
      principalComp = Math.round((emi - interest + extraMonthly) * 100) / 100
      if (principalComp > balance) principalComp = balance
    }

    const closing = Math.max(0, Math.round((balance - principalComp) * 100) / 100)
    cumInterest   = Math.round((cumInterest + interest) * 100) / 100
    cumPrincipal  = Math.round((cumPrincipal + principalComp) * 100) / 100

    rows.push({
      month: m,
      openingBalance: balance,
      emi: isLastMonth ? Math.round((interest + principalComp) * 100) / 100 : emi + extraMonthly,
      interest,
      principal: principalComp,
      closingBalance: closing,
      cumulativeInterest: cumInterest,
      cumulativePrincipal: cumPrincipal,
    })

    balance = closing
  }
  return rows
}

/** Early settlement: outstanding principal on a given month + fee */
function earlySettlement(schedule: AmortRow[], settleMonth: number, feePct: number): {
  outstandingPrincipal: number
  fee: number
  totalSettlement: number
  interestSaved: number
  totalScheduledInterest: number
} {
  const row = schedule.find(r => r.month === settleMonth)
  if (!row) return { outstandingPrincipal: 0, fee: 0, totalSettlement: 0, interestSaved: 0, totalScheduledInterest: 0 }
  const outstanding = row.closingBalance
  const fee = Math.round(outstanding * (feePct / 100) * 100) / 100
  const totalScheduledInterest = schedule[schedule.length - 1].cumulativeInterest
  const interestPaidSoFar = row.cumulativeInterest
  const interestSaved = Math.round((totalScheduledInterest - interestPaidSoFar) * 100) / 100
  return { outstandingPrincipal: outstanding, fee, totalSettlement: outstanding + fee, interestSaved, totalScheduledInterest }
}

/** Effective APR including fees (approximate IRR via Newton's method) */
function calcApr(principal: number, emi: number, months: number, totalFees: number): number {
  const netPrincipal = principal - totalFees
  // Monthly IRR via Newton-Raphson
  let r = 0.007
  for (let i = 0; i < 100; i++) {
    const factor = Math.pow(1 + r, months)
    const f  = netPrincipal - emi * (factor - 1) / (r * factor)
    const df = -emi * ((months * r * Math.pow(1 + r, months - 1) * r * factor - (factor - 1) * (r * months * Math.pow(1 + r, months - 1))) / Math.pow(r * factor, 2))
    const rNew = r - f / df
    if (Math.abs(rNew - r) < 1e-9) break
    r = rNew
  }
  return Math.round(r * 12 * 10000) / 100
}

// ─── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtCompact(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}
function fmtPct(n: number, dp = 2) {
  return `${n.toFixed(dp)}%`
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type RateType  = 'reducing' | 'flat'
type ScheduleView = 'none' | 'summary' | 'full'

type Result = {
  // Primary
  reducingRate: number
  emi: number
  totalPayment: number
  totalInterest: number
  schedule: AmortRow[]
  // Flat comparison
  flatRate: number
  flatEmi: number
  flatTotalInterest: number
  // APR
  apr: number | null
  totalFees: number
  // Early settlement
  earlySettlementData: ReturnType<typeof earlySettlement> | null
  // Meta
  rateEnteredType: RateType
  disclosureMethod: string
  extraMonthly: number
  actualMonths: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function UAELoanRepaymentCalculator({ locale }: Props) {
  const isAr = locale === 'ar'
  const t = useTranslations('tool')

  // Inputs
  const [principal,     setPrincipal]     = useState('')
  const [rateInput,     setRateInput]     = useState('7.0')
  const [rateType,      setRateType]      = useState<RateType>('reducing')
  const [termMonths,    setTermMonths]    = useState('24')
  const [processingFee, setProcessingFee] = useState('')
  const [otherFees,     setOtherFees]     = useState('')
  const [extraMonthly,  setExtraMonthly]  = useState('')
  const [settleMonth,   setSettleMonth]   = useState('')
  const [settleFee,     setSettleFee]     = useState('1')

  // UI state
  const [result,        setResult]        = useState<Result | null>(null)
  const [scheduleView,  setScheduleView]  = useState<ScheduleView>('none')
  const [showEarly,     setShowEarly]     = useState(false)

  function calculate() {
    const p    = parseFloat(principal)
    const rate = parseFloat(rateInput)
    const n    = parseInt(termMonths)
    const extra = parseFloat(extraMonthly) || 0
    const pFee  = parseFloat(processingFee) || 0
    const oFee  = parseFloat(otherFees) || 0
    const totalFees = pFee + oFee

    if (!p || p <= 0 || !rate || rate <= 0 || !n || n <= 0) return

    // Determine reducing rate (legal basis) and flat equivalent
    let reducingRate: number
    let flatRate: number

    if (rateType === 'flat') {
      flatRate     = rate
      reducingRate = flatToReducing(rate, n)
    } else {
      reducingRate = rate
      flatRate     = reducingToFlat(rate, n)
    }

    // Primary: reducing-balance
    const emi = Math.round(calcEmi(p, reducingRate, n) * 100) / 100
    const schedule = buildSchedule(p, reducingRate, n, emi, extra)
    const actualMonths = schedule.length
    const totalPayment = Math.round(schedule.reduce((s, r) => s + r.emi, 0) * 100) / 100
    const totalInterest = Math.round(schedule[schedule.length - 1].cumulativeInterest * 100) / 100

    // Flat comparison
    const flatEmi = Math.round(calcEmi(p, flatRate, n) * 100) / 100
    const flatSchedule = buildSchedule(p, flatRate, n, flatEmi)
    const flatTotalInterest = Math.round(flatSchedule[flatSchedule.length - 1].cumulativeInterest * 100) / 100

    // APR
    const apr = totalFees > 0 ? calcApr(p, emi, actualMonths, totalFees) : null

    // Early settlement
    const sm = parseInt(settleMonth)
    const sf = parseFloat(settleFee) || 0
    const earlySettlementData = (sm > 0 && sm < actualMonths)
      ? earlySettlement(schedule, sm, sf)
      : null

    const disclosureMethod = rateType === 'flat'
      ? (t('inline.reducing_balance_converted_from_flat_rat'))
      : (t('inline.reducing_balance_uae_legal_disclosure_st'))

    setResult({
      reducingRate, emi, totalPayment, totalInterest, schedule,
      flatRate, flatEmi, flatTotalInterest,
      apr, totalFees,
      earlySettlementData,
      rateEnteredType: rateType,
      disclosureMethod,
      extraMonthly: extra,
      actualMonths,
    })
    setScheduleView('none')
    setShowEarly(false)
  }

  function reset() {
    setPrincipal(''); setRateInput('7.0'); setRateType('reducing')
    setTermMonths('24'); setProcessingFee(''); setOtherFees('')
    setExtraMonthly(''); setSettleMonth(''); setSettleFee('1')
    setResult(null); setScheduleView('none'); setShowEarly(false)
  }

  // i18n

  // Yearly summary: take every 12th row + last
  const yearlySummary = result?.schedule.filter((r, i) =>
    (i + 1) % 12 === 0 || i === result.schedule.length - 1
  ) ?? []

  return (
    <div className="space-y-6">

      {/* Legal note banner */}
      <div className="text-xs text-gray-500 bg-blue-50 rounded-lg px-3 py-2 border border-blue-100 flex items-start gap-2">
        <span className="text-blue-400 mt-0.5">ℹ</span>
        <span>{t('legalNote')}</span>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Principal */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('principal')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={principal} onChange={e => setPrincipal(e.target.value)}
              placeholder={t('enterAmount')}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
          </div>
        </div>

        {/* Rate type toggle */}
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('rateType')}</label>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
            {(['reducing', 'flat'] as RateType[]).map(rt => (
              <button key={rt} onClick={() => setRateType(rt)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors ${
                  rateType === rt ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {rt === 'reducing' ? t('reducing') : t('flat')}
              </button>
            ))}
          </div>
          {rateType === 'flat' && (
            <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
              <span>⚠</span><span>{t('flatNote')}</span>
            </p>
          )}
        </div>

        {/* Rate */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('rate')}</label>
          <div className="relative">
            <input type="number" min="0.1" max="30" step="0.1" value={rateInput}
              onChange={e => setRateInput(e.target.value)}
              className="w-full pr-10 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
          </div>
        </div>

        {/* Term */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('term')}</label>
          <input type="number" min="1" max="360" value={termMonths}
            onChange={e => setTermMonths(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
        </div>

        {/* Processing fee */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('processingFee')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={processingFee} onChange={e => setProcessingFee(e.target.value)}
              placeholder="0"
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
          </div>
        </div>

        {/* Other fees */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('otherFees')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={otherFees} onChange={e => setOtherFees(e.target.value)}
              placeholder="0"
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
          </div>
        </div>

        {/* Extra monthly payment */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('extraMonthly')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={extraMonthly} onChange={e => setExtraMonthly(e.target.value)}
              placeholder="0"
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
          </div>
        </div>

        {/* Early settlement month */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('settleMonth')}</label>
          <input type="number" min="1" value={settleMonth} onChange={e => setSettleMonth(e.target.value)}
            placeholder={t('inline.e_g_12')}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
        </div>

        {/* Settlement fee % */}
        {settleMonth && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('settleFee')}</label>
            <div className="relative">
              <input type="number" min="0" max="5" step="0.1" value={settleFee}
                onChange={e => setSettleFee(e.target.value)}
                className="w-full pr-10 px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">%</span>
            </div>
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={calculate}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
          {t('calculate')}
        </button>
        <button onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
          {t('reset')}
        </button>
      </div>

      {/* ── Results ─────────────────────────────────────────────────────── */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-4 border border-gray-100">

          {/* Disclosure method badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            {result.disclosureMethod}
          </div>

          {/* Hero EMI */}
          <div className="bg-blue-600 rounded-xl p-4 text-white">
            <div className="text-sm opacity-80 mb-1">{t('emi')}</div>
            <div className="text-3xl font-black">{fmt(result.emi)}</div>
            <div className="text-xs opacity-70 mt-1">
              {isAr ? `× ${result.actualMonths} شهراً` : `× ${result.actualMonths} months`}
            </div>
          </div>

          {/* Core breakdown */}
          <div className="space-y-3">
            <Row label={t('inline.loan_amount')} value={fmt(parseFloat(principal))} />
            <Row label={t('totalInterest')}   value={fmt(result.totalInterest)} negative />
            {result.totalFees > 0 && (
              <Row label={t('totalFees')}     value={fmt(result.totalFees)} negative />
            )}
            <div className="border-t border-gray-200 pt-3">
              <Row label={t('totalPayment')}  value={fmt(result.totalPayment)} highlight />
            </div>
          </div>

          {/* Rate summary */}
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <Row label={t('reducingRateUsed')} value={fmtPct(result.reducingRate)} />
            {result.apr !== null && (
              <Row label={t('apr')} value={fmtPct(result.apr)} />
            )}
            {result.extraMonthly > 0 && (
              <Row label={t('actualTerm')}
                value={`${result.actualMonths} ${t('months')}`} />
            )}
          </div>

          {/* ── Flat vs Reducing comparison panel ── */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wide">
              {t('comparisonPanel')}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-gray-500">{t('inline.rate')}</span>
              <span className="text-gray-500 text-right">{t('inline.flat')}</span>
              <span className="font-semibold text-gray-900">{t('reducing')}</span>
              <span className="font-semibold text-right">{t('flat')}</span>

              <span className="text-gray-600">{t('inline.annual_rate')}</span>
              <span className="text-gray-600 text-right"> </span>
              <span className="font-semibold text-blue-700">{fmtPct(result.reducingRate)}</span>
              <span className="font-semibold text-right text-amber-700">{fmtPct(result.flatRate)}</span>

              <span className="text-gray-600">{t('inline.monthly_emi')}</span>
              <span className="text-gray-600 text-right"> </span>
              <span className="font-semibold text-blue-700">{fmt(result.emi)}</span>
              <span className="font-semibold text-right text-amber-700">{fmt(result.flatEmi)}</span>

              <span className="text-gray-600">{t('inline.total_interest')}</span>
              <span className="text-gray-600 text-right"> </span>
              <span className="font-semibold text-blue-700">{fmt(result.totalInterest)}</span>
              <span className="font-semibold text-right text-amber-700">{fmt(result.flatTotalInterest)}</span>
            </div>
            <p className="text-xs text-amber-600 mt-1">
              {result.rateEnteredType === 'flat'
                ? (t('inline.you_entered_a_flat_rate_reducing_balance'))
                : (t('inline.flat_rate_above_is_approximate_for_compa'))}
            </p>
          </div>

          {/* ── Early settlement panel ── */}
          {result.earlySettlementData && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
                {t('earlyTitle')} — {t('inline.month')} {settleMonth}
              </p>
              <Row label={t('outstandingPrincipal')} value={fmt(result.earlySettlementData.outstandingPrincipal)} />
              <Row label={t('settleFeeAmt')}         value={fmt(result.earlySettlementData.fee)} negative />
              <div className="border-t border-emerald-200 pt-2">
                <Row label={t('totalSettlement')}    value={fmt(result.earlySettlementData.totalSettlement)} highlight />
                <Row label={t('interestSaved')}      value={fmt(result.earlySettlementData.interestSaved)}
                  highlight />
              </div>
              <p className="text-xs text-emerald-600">
                {t('inline.settlement_outstanding_principal_fee_onl')}
              </p>
            </div>
          )}

          {/* Schedule toggles */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setScheduleView(v => v === 'summary' ? 'none' : 'summary')}
              className="w-full text-sm text-blue-700 font-semibold py-2 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors">
              {scheduleView === 'summary' ? t('hideSchedule') : t('showSummary')}
            </button>
            <button
              onClick={() => setScheduleView(v => v === 'full' ? 'none' : 'full')}
              className="w-full text-sm text-blue-700 font-semibold py-2 border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors">
              {scheduleView === 'full' ? t('hideSchedule') : t('showFull')}
            </button>
          </div>

          {/* ── Schedule table ── */}
          {(scheduleView === 'full' || scheduleView === 'summary') && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs text-gray-700">
                <thead className="bg-gray-100 text-gray-500 font-semibold">
                  <tr>
                    {[t('month'), t('opening'), t('interest'), t('principalCol'), t('closing'), t('cumInterest')].map(h => (
                      <th key={h} className="px-3 py-2 text-right whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(scheduleView === 'summary' ? yearlySummary : result.schedule).map((row, i) => (
                    <tr key={row.month} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-1.5 text-right font-semibold">{row.month}</td>
                      <td className="px-3 py-1.5 text-right">{fmtCompact(row.openingBalance)}</td>
                      <td className="px-3 py-1.5 text-right text-red-500">{fmtCompact(row.interest)}</td>
                      <td className="px-3 py-1.5 text-right text-blue-600">{fmtCompact(row.principal)}</td>
                      <td className="px-3 py-1.5 text-right">{fmtCompact(row.closingBalance)}</td>
                      <td className="px-3 py-1.5 text-right text-red-400">{fmtCompact(row.cumulativeInterest)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Row({ label, value, negative = false, highlight = false }: {
  label: string; value: string; negative?: boolean; highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${
        highlight ? 'text-blue-600' : negative ? 'text-red-500' : 'text-gray-900'
      }`}>{value}</span>
    </div>
  )
}
