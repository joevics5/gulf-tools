'use client'

import { useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

type ContractType = 'limited' | 'unlimited'
type TerminationReason = 'resignation' | 'termination' | 'mutual'

type Result = {
  serviceYears: number
  serviceMonths: number
  serviceDays: number
  accrualRate: string
  accruedLeaveDays: number
  unusedLeaveDays: number
  dailyBasicRate: number
  leaveEncashment: number
  gratuityDays: number
  gratuityAmount: number
  totalSettlement: number
  noticePay: number
  breakdown: {
    label: string
    labelAr: string
    amount: number
    formula: string
  }[]
}

function formatAED(n: number) {
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseDate(val: string): Date | null {
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function diffDays(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
}

function calcServicePeriod(startDate: Date, endDate: Date, unpaidLeaveDays: number) {
  const totalDays = diffDays(startDate, endDate) - unpaidLeaveDays
  const years = Math.floor(totalDays / 365)
  const remainingDays = totalDays - years * 365
  const months = Math.floor(remainingDays / 30)
  const days = remainingDays - months * 30
  return { totalDays, years, months, days }
}

function calcAccruedLeave(totalServiceDays: number, unpaidLeaveDays: number): { days: number; rate: string } {
  const effectiveDays = totalServiceDays
  const totalMonths = effectiveDays / 30

  if (totalMonths < 6) return { days: 0, rate: '0 (< 6 months service)' }
  if (effectiveDays < 365) {
    // 2 days per month of service
    const days = Math.floor(totalMonths * 2)
    return { days, rate: '2 days/month (< 1 year)' }
  }
  // 2.5 days per month = 30 days per year
  const days = Math.floor(totalMonths * 2.5)
  return { days, rate: '2.5 days/month (30 days/year)' }
}

function calcGratuity(basicSalary: number, totalServiceDays: number): { days: number; amount: number } {
  const dailyRate = basicSalary / 30
  const years = totalServiceDays / 365

  if (years < 1) return { days: 0, amount: 0 }

  let gratuityDays = 0
  if (years <= 5) {
    gratuityDays = 21 * years
  } else {
    gratuityDays = 21 * 5 + 30 * (years - 5)
  }

  const cap = basicSalary * 24 // 2 years' basic salary cap
  const raw = dailyRate * gratuityDays
  const amount = Math.min(raw, cap)

  return { days: gratuityDays, amount }
}

export default function UAELeaveSettlementCalculator({ locale }: Props) {
  const isAr = locale === 'ar'
  const tr = useTranslations('tool')

  const [basicSalary, setBasicSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [takenLeaveDays, setTakenLeaveDays] = useState('')
  const [unpaidLeaveDays, setUnpaidLeaveDays] = useState('')
  const [contractType, setContractType] = useState<ContractType>('unlimited')
  const [terminationReason, setTerminationReason] = useState<TerminationReason>('resignation')
  const [noticePeriodDays, setNoticePeriodDays] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  const calculate = useCallback(() => {
    const errs: string[] = []
    const salary = parseFloat(basicSalary)
    const start = parseDate(startDate)
    const end = parseDate(endDate)
    const taken = parseFloat(takenLeaveDays) || 0
    const unpaid = parseFloat(unpaidLeaveDays) || 0
    const noticeDays = parseFloat(noticePeriodDays) || 0

    if (!salary || salary <= 0) errs.push(tr('inline.enter_a_valid_basic_salary'))
    if (!start) errs.push(tr('inline.enter_a_valid_start_date'))
    if (!end) errs.push(tr('inline.enter_a_valid_end_date'))
    if (start && end && end <= start) errs.push(tr('inline.end_date_must_be_after_start_date'))

    if (errs.length) { setErrors(errs); return }
    setErrors([])

    const { totalDays, years, months, days } = calcServicePeriod(start!, end!, unpaid)
    const { days: accrued, rate: accrualRate } = calcAccruedLeave(totalDays, unpaid)
    const unused = Math.max(0, accrued - taken)
    const dailyRate = salary / 30
    const leaveEncashment = dailyRate * unused
    const { days: gratuityDays, amount: gratuityAmount } = calcGratuity(salary, totalDays)
    const noticePay = dailyRate * noticeDays
    const totalSettlement = leaveEncashment + gratuityAmount + noticePay

    const breakdown = [
      {
        label: 'Leave Encashment',
        labelAr: 'مكافأة الإجازة',
        amount: leaveEncashment,
        formula: `AED ${salary.toFixed(0)} ÷ 30 × ${unused} days`,
      },
      {
        label: 'End-of-Service Gratuity',
        labelAr: 'مكافأة نهاية الخدمة',
        amount: gratuityAmount,
        formula: `${gratuityDays.toFixed(1)} gratuity days × AED ${dailyRate.toFixed(2)}/day`,
      },
      ...(noticeDays > 0
        ? [{
            label: 'Notice Period Pay',
            labelAr: 'راتب فترة الإشعار',
            amount: noticePay,
            formula: `AED ${dailyRate.toFixed(2)}/day × ${noticeDays} days`,
          }]
        : []),
    ]

    setResult({
      serviceYears: years,
      serviceMonths: months,
      serviceDays: days,
      accrualRate,
      accruedLeaveDays: accrued,
      unusedLeaveDays: unused,
      dailyBasicRate: dailyRate,
      leaveEncashment,
      gratuityDays,
      gratuityAmount,
      totalSettlement,
      noticePay,
      breakdown,
    })
  }, [basicSalary, startDate, endDate, takenLeaveDays, unpaidLeaveDays, noticePeriodDays, tr])

  function reset() {
    setBasicSalary(''); setStartDate(''); setEndDate('')
    setTakenLeaveDays(''); setUnpaidLeaveDays(''); setNoticePeriodDays('')
    setContractType('unlimited'); setTerminationReason('resignation')
    setResult(null); setErrors([])
  }

  const l = {
    title: tr('l.title'),
    basicSalary: tr('l.basicSalary'),
    startDate: tr('l.startDate'),
    endDate: tr('l.endDate'),
    takenLeave: tr('l.takenLeave'),
    unpaidLeave: tr('l.unpaidLeave'),
    contractType: tr('l.contractType'),
    terminationReason: tr('l.terminationReason'),
    noticePeriod: tr('l.noticePeriod'),
    limited: tr('l.limited'),
    unlimited: tr('l.unlimited'),
    resignation: tr('l.resignation'),
    termination: tr('l.termination'),
    mutual: tr('l.mutual'),
    advanced: tr('l.advanced'),
    calculate: tr('l.calculate'),
    reset: tr('l.reset'),
    results: tr('l.results'),
    servicePeriod: tr('l.servicePeriod'),
    leaveEntitlement: tr('l.leaveEntitlement'),
    accruedDays: tr('l.accruedDays'),
    takenDays: tr('l.takenDays'),
    unusedDays: tr('l.unusedDays'),
    dailyRate: tr('l.dailyRate'),
    total: tr('l.total'),
    disclaimer: tr('l.disclaimer'),
    enterAmount: tr('l.enterAmount'),
    years: tr('l.years'),
    months: tr('l.months'),
    days: tr('l.days'),
  }

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm"
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5"

  return (
    <div className="space-y-6">
      {/* Core Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Basic Salary */}
        <div className="sm:col-span-2">
          <label className={labelClass}>{l.basicSalary}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input
              type="number" min="0" value={basicSalary}
              onChange={e => setBasicSalary(e.target.value)}
              placeholder={l.enterAmount}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition text-sm"
            />
          </div>
        </div>

        {/* Dates */}
        <div>
          <label className={labelClass}>{l.startDate}</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>{l.endDate}</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClass} />
        </div>

        {/* Leave taken */}
        <div>
          <label className={labelClass}>{l.takenLeave}</label>
          <input type="number" min="0" value={takenLeaveDays} onChange={e => setTakenLeaveDays(e.target.value)}
            placeholder="0" className={inputClass} />
        </div>

        {/* Unpaid leave */}
        <div>
          <label className={labelClass}>{l.unpaidLeave}
            <span className="ml-1 text-xs font-normal text-gray-500" title="Unpaid leave days are excluded from service period per UAE law">ⓘ</span>
          </label>
          <input type="number" min="0" value={unpaidLeaveDays} onChange={e => setUnpaidLeaveDays(e.target.value)}
            placeholder="0" className={inputClass} />
        </div>
      </div>

      {/* Advanced Toggle */}
      <div>
        <button
          onClick={() => setShowAdvanced(v => !v)}
          className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center gap-1"
        >
          <span>{showAdvanced ? '▾' : '▸'}</span> {l.advanced}
        </button>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>{l.contractType}</label>
              <select value={contractType} onChange={e => setContractType(e.target.value as ContractType)} className={inputClass}>
                <option value="unlimited">{l.unlimited}</option>
                <option value="limited">{l.limited}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{l.terminationReason}</label>
              <select value={terminationReason} onChange={e => setTerminationReason(e.target.value as TerminationReason)} className={inputClass}>
                <option value="resignation">{l.resignation}</option>
                <option value="termination">{l.termination}</option>
                <option value="mutual">{l.mutual}</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>{l.noticePeriod}</label>
              <input type="number" min="0" value={noticePeriodDays} onChange={e => setNoticePeriodDays(e.target.value)}
                placeholder="0" className={inputClass} />
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
          {errors.map((e, i) => (
            <p key={i} className="text-sm text-red-600">{e}</p>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={calculate}
          className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm">
          {l.calculate}
        </button>
        <button onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm">
          {l.reset}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-5 border border-gray-100">
          <h3 className="font-bold text-gray-900 text-base">{l.results}</h3>

          {/* Total — hero */}
          <div className="bg-teal-600 rounded-xl p-5 text-white">
            <div className="text-sm opacity-80 mb-1">{l.total}</div>
            <div className="text-3xl font-black">{formatAED(result.totalSettlement)}</div>
          </div>

          {/* Service Period */}
          <Section title={l.servicePeriod}>
            <InfoRow
              label={tr('inline.total_service')}
              value={`${result.serviceYears} ${l.years} ${result.serviceMonths} ${l.months} ${result.serviceDays} ${l.days}`}
            />
            <InfoRow
              label={isAr ? 'معدل الراتب اليومي' : l.dailyRate}
              value={formatAED(result.dailyBasicRate)}
              sub={tr('inline.aed_30', { p0: String(formatAED(parseFloat(basicSalary))), p1: String(parseFloat(basicSalary).toFixed(0)) })}
            />
          </Section>

          {/* Leave Entitlement */}
          <Section title={l.leaveEntitlement}>
            <InfoRow
              label={tr('inline.accrual_rate')}
              value={result.accrualRate}
            />
            <InfoRow label={l.accruedDays} value={`${result.accruedLeaveDays} ${tr('inline.days')}`} />
            <InfoRow label={l.takenDays} value={`${takenLeaveDays || 0} ${tr('inline.days')}`} negative />
            <InfoRow label={l.unusedDays} value={`${result.unusedLeaveDays} ${tr('inline.days')}`} highlight />
          </Section>

          {/* Breakdown */}
          <Section title={tr('inline.amount_breakdown')}>
            {result.breakdown.map((row, i) => (
              <div key={i} className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-sm text-gray-600">{isAr ? row.labelAr : row.label}</span>
                  <div className="text-xs text-gray-500 mt-0.5 font-mono">{row.formula}</div>
                </div>
                <span className="text-sm font-semibold text-gray-900 whitespace-nowrap">{formatAED(row.amount)}</span>
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3">
              <InfoRow
                label={l.total}
                value={formatAED(result.totalSettlement)}
                highlight
              />
            </div>
          </Section>

          {/* Disclaimer */}
          <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-4">
            {l.disclaimer}
          </p>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</div>
      {children}
    </div>
  )
}

function InfoRow({ label, value, negative, highlight, sub }: {
  label: string; value: string; negative?: boolean; highlight?: boolean; sub?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <span className="text-sm text-gray-600">{label}</span>
        {sub && <div className="text-xs text-gray-500 font-mono mt-0.5">{sub}</div>}
      </div>
      <span className={`text-sm font-semibold whitespace-nowrap ${highlight ? 'text-teal-600' : negative ? 'text-red-500' : 'text-gray-900'}`}>
        {negative && value !== '0 days' ? `− ${value}` : value}
      </span>
    </div>
  )
}
