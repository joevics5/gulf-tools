'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { isRtl } from '@/lib/i18n/locales'

type Props = { locale: string }

type ContractType = 'limited' | 'unlimited'
type SeparationReason = 'resignation' | 'termination' | 'expiry' | 'misconduct'

type Inputs = {
  basicSalary: string
  grossSalary: string
  startDate: string
  endDate: string
  contractType: ContractType
  separationReason: SeparationReason
  accruedLeaveDays: string
  usedLeaveDays: string
  unpaidAbsenceDays: string
  noticeInContract: string
  noticeServed: 'yes' | 'no'
  airTicket: 'yes' | 'no'
  airTicketAmount: string
  pendingOvertimeDays: string
  deductions: string
}

type SettlementResult = {
  serviceDuration: { years: number; months: number; days: number; totalDays: number; adjustedDays: number }
  dailyBasicRate: number
  dailyGrossRate: number
  gratuity: number
  leavePay: number
  unpaidSalary: number
  noticeCompensation: number
  airTicketAmount: number
  overtimePay: number
  deductions: number
  total: number
  isGratuityEligible: boolean
  isMisconduct: boolean
  cappedGratuity: boolean
  reductionApplied: boolean
  reductionLabel: string
}

function diffDates(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const totalDays = Math.floor((e.getTime() - s.getTime()) / 86400000)
  let years = e.getFullYear() - s.getFullYear()
  let months = e.getMonth() - s.getMonth()
  let days = e.getDate() - s.getDate()
  if (days < 0) { months--; days += 30 }
  if (months < 0) { years--; months += 12 }
  return { years, months, days, totalDays }
}

function calcSettlement(inputs: Inputs): SettlementResult | null {
  const basic = parseFloat(inputs.basicSalary) || 0
  const gross = parseFloat(inputs.grossSalary) || basic
  if (basic <= 0 || !inputs.startDate || !inputs.endDate) return null
  if (new Date(inputs.endDate) <= new Date(inputs.startDate)) return null

  const dur = diffDates(inputs.startDate, inputs.endDate)
  const unpaidDays = parseFloat(inputs.unpaidAbsenceDays) || 0
  const adjustedDays = Math.max(dur.totalDays - unpaidDays, 0)
  const totalYears = adjustedDays / 365.25

  const dailyBasicRate = basic / 30
  const dailyGrossRate = gross / 30

  const isMisconduct = inputs.separationReason === 'misconduct'
  const isGratuityEligible = totalYears >= 1 && !isMisconduct

  // ── Gratuity ──────────────────────────────────────────────────────────────
  let gratuity = 0
  let cappedGratuity = false
  let reductionApplied = false
  let reductionLabel = 'Full entitlement'

  if (isGratuityEligible) {
    const yearsFirst5 = Math.min(totalYears, 5)
    const yearsAfter5 = Math.max(totalYears - 5, 0)
    const raw = dailyBasicRate * 21 * yearsFirst5 + dailyBasicRate * 30 * yearsAfter5

    // Unlimited + resignation reductions (legacy)
    let factor = 1
    if (inputs.contractType === 'unlimited' && inputs.separationReason === 'resignation') {
      if (totalYears < 3) { factor = 1 / 3; reductionLabel = '1/3 (resignation 1–3 yrs, unlimited)' }
      else if (totalYears < 5) { factor = 2 / 3; reductionLabel = '2/3 (resignation 3–5 yrs, unlimited)' }
      else reductionLabel = 'Full (5+ yrs unlimited, resignation)'
      if (factor < 1) reductionApplied = true
    }

    const afterReduction = raw * factor
    const cap = basic * 24
    if (afterReduction > cap) { gratuity = cap; cappedGratuity = true }
    else gratuity = afterReduction
  }

  // ── Unused Leave ──────────────────────────────────────────────────────────
  const accrued = parseFloat(inputs.accruedLeaveDays) || 0
  const used = parseFloat(inputs.usedLeaveDays) || 0
  const unusedDays = Math.max(accrued - used, 0)
  const leavePay = dailyBasicRate * unusedDays

  // ── Unpaid Salary (pending days in last month) ────────────────────────────
  // Estimate: fractional days in the last partial month
  const lastMonthDays = dur.days > 0 ? dur.days : 0
  const unpaidSalary = dailyGrossRate * lastMonthDays

  // ── Notice Compensation ───────────────────────────────────────────────────
  const noticeDays = parseFloat(inputs.noticeInContract) || 0
  let noticeCompensation = 0
  if (inputs.noticeServed === 'no' && noticeDays > 0) {
    noticeCompensation = dailyGrossRate * noticeDays
  }

  // ── Air Ticket ────────────────────────────────────────────────────────────
  const airTicketAmt = inputs.airTicket === 'yes' ? (parseFloat(inputs.airTicketAmount) || 0) : 0

  // ── Overtime ──────────────────────────────────────────────────────────────
  const overtimeDays = parseFloat(inputs.pendingOvertimeDays) || 0
  const overtimePay = dailyGrossRate * overtimeDays

  // ── Deductions ────────────────────────────────────────────────────────────
  const deductionsAmt = parseFloat(inputs.deductions) || 0

  const total = gratuity + leavePay + unpaidSalary + noticeCompensation + airTicketAmt + overtimePay - deductionsAmt

  return {
    serviceDuration: { ...dur, adjustedDays },
    dailyBasicRate,
    dailyGrossRate,
    gratuity,
    leavePay,
    unpaidSalary,
    noticeCompensation,
    airTicketAmount: airTicketAmt,
    overtimePay,
    deductions: deductionsAmt,
    total: Math.max(total, 0),
    isGratuityEligible,
    isMisconduct,
    cappedGratuity,
    reductionApplied,
    reductionLabel,
  }
}

function fmt(n: number) {
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type RowProps = { label: string; value: string; sub?: boolean; negative?: boolean; highlight?: boolean; note?: string }
function Row({ label, value, sub, negative, highlight, note }: RowProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${sub ? 'pl-4' : ''}`}>
      <div>
        <span className={`text-sm ${sub ? 'text-gray-500' : 'text-gray-700'}`}>{label}</span>
        {note && <p className="text-xs text-gray-500 mt-0.5">{note}</p>}
      </div>
      <span className={`text-sm font-semibold whitespace-nowrap ${highlight ? 'text-emerald-600 text-base' : negative ? 'text-red-500' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}

type SectionProps = { title: string; children: React.ReactNode }
function Section({ title, children }: SectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">{title}</h4>
      {children}
    </div>
  )
}

export default function UAEFinalSettlementCalculator({ locale }: Props) {
  const isAr = locale === 'ar'
  const t = useTranslations('tool')

  const [inputs, setInputs] = useState<Inputs>({
    basicSalary: '',
    grossSalary: '',
    startDate: '',
    endDate: '',
    contractType: 'limited',
    separationReason: 'resignation',
    accruedLeaveDays: '',
    usedLeaveDays: '',
    unpaidAbsenceDays: '0',
    noticeInContract: '30',
    noticeServed: 'yes',
    airTicket: 'no',
    airTicketAmount: '',
    pendingOvertimeDays: '0',
    deductions: '0',
  })
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<keyof Inputs, string>>>({})

  const result = useMemo(() => (submitted ? calcSettlement(inputs) : null), [inputs, submitted])

  function set<K extends keyof Inputs>(key: K, val: Inputs[K]) {
    setInputs(p => ({ ...p, [key]: val }))
    if (submitted) setErrors(e => ({ ...e, [key]: '' }))
  }

  function validate() {
    const e: Partial<Record<keyof Inputs, string>> = {}
    if (!inputs.basicSalary || parseFloat(inputs.basicSalary) <= 0) e.basicSalary = t('inline.enter_a_valid_basic_salary')
    if (!inputs.startDate) e.startDate = t('inline.select_joining_date')
    if (!inputs.endDate) e.endDate = t('inline.select_last_working_day')
    if (inputs.startDate && inputs.endDate && new Date(inputs.endDate) <= new Date(inputs.startDate))
      e.endDate = t('inline.end_date_must_be_after_start_date')
    if (parseFloat(inputs.usedLeaveDays) > parseFloat(inputs.accruedLeaveDays))
      e.usedLeaveDays = t('inline.used_leave_cannot_exceed_accrued')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function calculate() { if (validate()) setSubmitted(true) }
  function reset() {
    setInputs({ basicSalary: '', grossSalary: '', startDate: '', endDate: '', contractType: 'limited', separationReason: 'resignation', accruedLeaveDays: '', usedLeaveDays: '', unpaidAbsenceDays: '0', noticeInContract: '30', noticeServed: 'yes', airTicket: 'no', airTicketAmount: '', pendingOvertimeDays: '0', deductions: '0' })
    setSubmitted(false)
    setErrors({})
  }

  const inputCls = (field: keyof Inputs) =>
    `w-full px-4 py-3 border rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition text-sm ${errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-200'}`

  const dur = result?.serviceDuration

  return (
    <div className="space-y-6" dir={isRtl(locale) ? 'rtl' : 'ltr'}>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>⚠ {t('inline.legal_disclaimer')}:</strong>{' '}
        {t('inline.this_tool_provides_estimates_based_on_ua')}
      </div>

      {/* ── SECTION 1: Employment ── */}
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
          {t('inline.1_employment_details')}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.joining_date')}</label>
          <input type="date" value={inputs.startDate} onChange={e => set('startDate', e.target.value)} className={inputCls('startDate')} />
          {errors.startDate && <p className="text-xs text-red-500 mt-1">{errors.startDate}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.last_working_day')}</label>
          <input type="date" value={inputs.endDate} onChange={e => set('endDate', e.target.value)} className={inputCls('endDate')} />
          {errors.endDate && <p className="text-xs text-red-500 mt-1">{errors.endDate}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.contract_type')}</label>
          <select value={inputs.contractType} onChange={e => set('contractType', e.target.value as ContractType)} className={inputCls('contractType')}>
            <option value="limited">{t('inline.limited_fixed_term')}</option>
            <option value="unlimited">{t('inline.unlimited_legacy')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.reason_for_separation')}</label>
          <select value={inputs.separationReason} onChange={e => set('separationReason', e.target.value as SeparationReason)} className={inputCls('separationReason')}>
            <option value="resignation">{t('inline.resignation')}</option>
            <option value="termination">{t('inline.termination_by_employer')}</option>
            <option value="expiry">{t('inline.contract_expiry')}</option>
            <option value="misconduct">{t('inline.misconduct_article_44')}</option>
          </select>
        </div>
      </div>

      {/* ── SECTION 2: Salary ── */}
      <div className="space-y-1 pt-2">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
          {t('inline.2_salary_details')}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t('inline.basic_monthly_salary_aed')}
          </label>
          <p className="text-xs text-gray-500 mb-1.5">{t('inline.basic_only_exclude_allowances')}</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={inputs.basicSalary} onChange={e => set('basicSalary', e.target.value)} placeholder="e.g. 10000" className={`${inputCls('basicSalary')} pl-12`} />
          </div>
          {errors.basicSalary && <p className="text-xs text-red-500 mt-1">{errors.basicSalary}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            {t('inline.gross_monthly_salary_optional')}
          </label>
          <p className="text-xs text-gray-500 mb-1.5">{t('inline.used_for_unpaid_salary_notice_compensati')}</p>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={inputs.grossSalary} onChange={e => set('grossSalary', e.target.value)} placeholder={t('inline.defaults_to_basic_if_blank')} className={`${inputCls('grossSalary')} pl-12`} />
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Leave ── */}
      <div className="space-y-1 pt-2">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
          {t('inline.3_leave_absences')}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.accrued_leave_days')}</label>
          <input type="number" min="0" value={inputs.accruedLeaveDays} onChange={e => set('accruedLeaveDays', e.target.value)} placeholder="e.g. 30" className={inputCls('accruedLeaveDays')} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.used_leave_days')}</label>
          <input type="number" min="0" value={inputs.usedLeaveDays} onChange={e => set('usedLeaveDays', e.target.value)} placeholder="e.g. 10" className={inputCls('usedLeaveDays')} />
          {errors.usedLeaveDays && <p className="text-xs text-red-500 mt-1">{errors.usedLeaveDays}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.unpaid_absence_days')}</label>
          <input type="number" min="0" value={inputs.unpaidAbsenceDays} onChange={e => set('unpaidAbsenceDays', e.target.value)} placeholder="0" className={inputCls('unpaidAbsenceDays')} />
        </div>
      </div>

      {/* ── SECTION 4: Notice & Other ── */}
      <div className="space-y-1 pt-2">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
          {t('inline.4_notice_period_other_entitlements')}
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.notice_period_in_contract_days')}</label>
          <input type="number" min="0" value={inputs.noticeInContract} onChange={e => set('noticeInContract', e.target.value)} placeholder="30" className={inputCls('noticeInContract')} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.notice_period_served')}</label>
          <select value={inputs.noticeServed} onChange={e => set('noticeServed', e.target.value as 'yes' | 'no')} className={inputCls('noticeServed')}>
            <option value="yes">{t('inline.yes_fully_served')}</option>
            <option value="no">{t('inline.no_compensation_due')}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.air_ticket_entitlement')}</label>
          <select value={inputs.airTicket} onChange={e => set('airTicket', e.target.value as 'yes' | 'no')} className={inputCls('airTicket')}>
            <option value="no">{t('inline.no')}</option>
            <option value="yes">{t('inline.yes')}</option>
          </select>
        </div>
        {inputs.airTicket === 'yes' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.air_ticket_value_aed')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">AED</span>
              <input type="number" min="0" value={inputs.airTicketAmount} onChange={e => set('airTicketAmount', e.target.value)} placeholder="e.g. 2000" className={`${inputCls('airTicketAmount')} pl-12`} />
            </div>
          </div>
        )}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.pending_overtime_days')}</label>
          <input type="number" min="0" value={inputs.pendingOvertimeDays} onChange={e => set('pendingOvertimeDays', e.target.value)} placeholder="0" className={inputCls('pendingOvertimeDays')} />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{t('inline.deductions_loans_advances_aed')}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={inputs.deductions} onChange={e => set('deductions', e.target.value)} placeholder="0" className={`${inputCls('deductions')} pl-12`} />
          </div>
        </div>
      </div>

      {/* Misconduct warning */}
      {inputs.separationReason === 'misconduct' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          {t('inline.termination_for_misconduct_article_44_ma')}
        </div>
      )}

      {/* Unlimited + resignation note */}
      {inputs.contractType === 'unlimited' && inputs.separationReason === 'resignation' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
          {t('inline.unlimited_contract_resignation_legacy_pa')}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3 pt-2">
        <button onClick={calculate} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
          {t('inline.calculate_final_settlement')}
        </button>
        <button onClick={reset} className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
          {t('inline.reset')}
        </button>
      </div>

      {/* ── RESULTS ── */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-5 border border-gray-100">
          <h3 className="font-bold text-gray-900">{t('inline.estimated_final_settlement')}</h3>

          {/* Hero */}
          <div className="bg-emerald-600 rounded-xl p-5 text-white">
            <div className="text-sm opacity-80 mb-1">{t('inline.total_settlement_amount')}</div>
            <div className="text-3xl font-black">{fmt(result.total)}</div>
            <div className="text-xs opacity-70 mt-1">{t('inline.must_be_paid_within_14_days_of_last_work')}</div>
          </div>

          {/* Service Duration */}
          <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{t('inline.service_duration')}</p>
            <p className="text-gray-900 font-semibold text-sm">
              {dur && `${dur.years} ${t('inline.yr_s')}, ${dur.months} ${t('inline.mo_s')}, ${dur.days} ${t('inline.day_s')}`}
              {(parseFloat(inputs.unpaidAbsenceDays) || 0) > 0 && (
                <span className="text-gray-500 text-xs ml-2">
                  ({isAr ? 'بعد خصم أيام الغياب' : `adjusted for ${inputs.unpaidAbsenceDays} unpaid days`})
                </span>
              )}
            </p>
          </div>

          {/* Breakdown */}
          <div className="space-y-4">

            <Section title={t('inline.end_of_service_gratuity')}>
              {!result.isGratuityEligible ? (
                <p className="text-sm text-red-600">
                  {result.isMisconduct
                    ? (t('inline.gratuity_may_be_forfeited_due_to_miscond'))
                    : (t('inline.not_eligible_minimum_1_year_of_continuou'))}
                </p>
              ) : (
                <>
                  <Row label={t('inline.daily_basic_rate')} value={fmt(result.dailyBasicRate)} sub />
                  {result.reductionApplied && <Row label={t('inline.entitlement_type')} value={result.reductionLabel} sub />}
                  {result.cappedGratuity && <Row label={t('inline.2_year_cap_applied')} value="⚠" sub note={t('inline.gratuity_capped_at_2_years_basic_salary')} />}
                  <Row label={t('inline.gratuity_amount')} value={fmt(result.gratuity)} />
                </>
              )}
            </Section>

            <div className="border-t border-gray-200" />

            <Section title={t('inline.leave_pending_pay')}>
              <Row
                label={isAr ? `إجازة غير مستخدمة (${Math.max((parseFloat(inputs.accruedLeaveDays) || 0) - (parseFloat(inputs.usedLeaveDays) || 0), 0)} أيام)` : `Unused Leave (${Math.max((parseFloat(inputs.accruedLeaveDays) || 0) - (parseFloat(inputs.usedLeaveDays) || 0), 0)} days)`}
                value={fmt(result.leavePay)}
                note={t('inline.based_on_basic_salary')}
              />
              {result.unpaidSalary > 0 && (
                <Row label={t('inline.pending_salary_partial_month')} value={fmt(result.unpaidSalary)} note={t('inline.based_on_gross_salary')} />
              )}
            </Section>

            {(result.noticeCompensation > 0 || result.airTicketAmount > 0 || result.overtimePay > 0) && (
              <>
                <div className="border-t border-gray-200" />
                <Section title={t('inline.other_entitlements')}>
                  {result.noticeCompensation > 0 && (
                    <Row label={isAr ? `تعويض إشعار (${inputs.noticeInContract} أيام)` : `Notice Compensation (${inputs.noticeInContract} days)`} value={fmt(result.noticeCompensation)} note={t('inline.based_on_gross_salary')} />
                  )}
                  {result.airTicketAmount > 0 && (
                    <Row label={t('inline.air_ticket')} value={fmt(result.airTicketAmount)} />
                  )}
                  {result.overtimePay > 0 && (
                    <Row label={t('inline.pending_overtime')} value={fmt(result.overtimePay)} />
                  )}
                </Section>
              </>
            )}

            {result.deductions > 0 && (
              <>
                <div className="border-t border-gray-200" />
                <Section title={t('inline.deductions')}>
                  <Row label={t('inline.advances_loans_other')} value={`− ${fmt(result.deductions)}`} negative />
                </Section>
              </>
            )}

            <div className="border-t-2 border-gray-300 pt-4">
              <Row label={t('inline.total_final_settlement')} value={fmt(result.total)} highlight />
            </div>
          </div>

          {/* Payment note */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm text-emerald-800">
            ✓ {t('inline.employer_must_settle_all_dues_within_14_')}
          </div>
        </div>
      )}
    </div>
  )
}
