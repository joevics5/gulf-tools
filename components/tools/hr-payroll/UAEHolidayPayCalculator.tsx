'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }
type Mode = 'vacation' | 'encashment' | 'accrual' | 'holiday'

function formatAED(n: number) {
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function parseDate(val: string): Date | null {
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function getServiceMonths(start: Date, end: Date): number {
  const years = end.getFullYear() - start.getFullYear()
  const months = end.getMonth() - start.getMonth()
  return Math.max(0, years * 12 + months)
}

function calcAccruedDays(totalMonths: number): { days: number; rate: string } {
  if (totalMonths < 6) return { days: 0, rate: '< 6 months — no entitlement' }
  if (totalMonths < 12) return { days: Math.floor(totalMonths * 2), rate: '2 days/month (< 1 year)' }
  const fullYears = Math.floor(totalMonths / 12)
  const remMonths = totalMonths % 12
  const days = fullYears * 30 + Math.floor(remMonths * 2.5)
  return { days, rate: '30 days/year + 2.5 days/month (partial year)' }
}

// ── Results types ──────────────────────────────────────────────────────────
type VacationResult = {
  basicDaily: number; fullDaily: number
  basicPay: number; fullPay: number; days: number
}
type EncashmentResult = {
  basicDaily: number; unusedDays: number; encashment: number
  note: string
}
type AccrualResult = {
  totalMonths: number; accrued: number; taken: number
  unused: number; carryForward: number; rate: string
}
type HolidayResult = {
  basicDaily: number; option: 'off' | 'pay'
  compensatoryValue: number; cashValue: number
}

export default function UAEHolidayPayCalculator({ locale }: Props) {
  const isAr = locale === 'ar'
  const tr = useTranslations('tool')
  const [mode, setMode] = useState<Mode>('vacation')

  // Shared inputs
  const [basicSalary, setBasicSalary] = useState('')
  const [grossSalary, setGrossSalary] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // Mode-specific inputs
  const [leaveDays, setLeaveDays] = useState('')
  const [takenDays, setTakenDays] = useState('')
  const [unpaidDays, setUnpaidDays] = useState('')
  const [holidayHours, setHolidayHours] = useState('8')
  const [holidayComp, setHolidayComp] = useState<'off' | 'pay'>('pay')

  // Results
  const [vacResult, setVacResult] = useState<VacationResult | null>(null)
  const [encResult, setEncResult] = useState<EncashmentResult | null>(null)
  const [accResult, setAccResult] = useState<AccrualResult | null>(null)
  const [holResult, setHolResult] = useState<HolidayResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  // Clear results when mode changes
  useEffect(() => {
    setVacResult(null); setEncResult(null); setAccResult(null); setHolResult(null); setErrors([])
  }, [mode])

  function validate(): { basic: number; gross: number; ok: boolean } {
    const errs: string[] = []
    const basic = parseFloat(basicSalary)
    const gross = parseFloat(grossSalary) || basic
    if (!basic || basic <= 0) errs.push(tr('inline.enter_a_valid_basic_salary'))
    setErrors(errs)
    return { basic, gross, ok: errs.length === 0 }
  }

  function calculate() {
    const { basic, gross, ok } = validate()
    if (!ok) return

    const basicDaily = basic / 30
    const fullDaily = gross / 30

    if (mode === 'vacation') {
      const days = parseFloat(leaveDays) || 0
      if (days <= 0) { setErrors([tr('inline.enter_leave_days')]); return }
      setVacResult({
        basicDaily, fullDaily,
        basicPay: basicDaily * days,
        fullPay: fullDaily * days,
        days,
      })
    }

    if (mode === 'encashment') {
      const start = parseDate(startDate)
      const end = parseDate(endDate)
      const taken = parseFloat(takenDays) || 0
      const unpaid = parseFloat(unpaidDays) || 0
      if (!start || !end || end <= start) {
        setErrors([tr('inline.enter_valid_employment_dates')]); return
      }
      const totalMonths = getServiceMonths(start, end) - Math.floor(unpaid / 30)
      const { days: accrued, rate } = calcAccruedDays(totalMonths)
      const unused = Math.max(0, accrued - taken)
      setEncResult({
        basicDaily,
        unusedDays: unused,
        encashment: basicDaily * unused,
        note: rate,
      })
    }

    if (mode === 'accrual') {
      const start = parseDate(startDate)
      const end = parseDate(endDate)
      if (!start || !end || end <= start) {
        setErrors([tr('inline.enter_valid_dates')]); return
      }
      const totalMonths = getServiceMonths(start, end)
      const { days: accrued, rate } = calcAccruedDays(totalMonths)
      const taken = parseFloat(takenDays) || 0
      const unused = Math.max(0, accrued - taken)
      const carryForward = Math.min(unused, 15) // max ~15 days carry-forward
      setAccResult({ totalMonths, accrued, taken, unused, carryForward, rate })
    }

    if (mode === 'holiday') {
      const compensatoryValue = fullDaily
      const cashValue = basicDaily * 1.5 // regular daily + 50% of basic
      setHolResult({ basicDaily, option: holidayComp, compensatoryValue, cashValue })
    }
  }

  function reset() {
    setBasicSalary(''); setGrossSalary(''); setStartDate(''); setEndDate('')
    setLeaveDays(''); setTakenDays(''); setUnpaidDays(''); setHolidayHours('8')
    setVacResult(null); setEncResult(null); setAccResult(null); setHolResult(null); setErrors([])
  }

  const ic = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm"
  const lc = "block text-sm font-semibold text-gray-700 mb-1.5"

  const MODES: { key: Mode; label: string; labelAr: string }[] = [
    { key: 'vacation',    label: 'Vacation Pay',    labelAr: 'راتب الإجازة' },
    { key: 'encashment',  label: 'Unused Leave',    labelAr: 'استرداد الإجازة' },
    { key: 'accrual',     label: 'Leave Balance',   labelAr: 'رصيد الإجازة' },
    { key: 'holiday',     label: 'Public Holiday',  labelAr: 'عطلة رسمية' },
  ]

  const T = {
    salary: tr('T.salary'),
    gross: tr('T.gross'),
    grossHint: tr('T.grossHint'),
    startDate: tr('T.startDate'),
    endDate: tr('T.endDate'),
    leaveDays: tr('T.leaveDays'),
    takenDays: tr('T.takenDays'),
    unpaidDays: tr('T.unpaidDays'),
    holidayComp: tr('T.holidayComp'),
    optionPay: tr('T.optionPay'),
    optionOff: tr('T.optionOff'),
    calc: tr('T.calc'),
    reset: tr('T.reset'),
    dailyBasic: tr('T.dailyBasic'),
    dailyFull: tr('T.dailyFull'),
    vacBasic: tr('T.vacBasic'),
    vacFull: tr('T.vacFull'),
    vacNote: tr('T.vacNote'),
    encashmentAmt: tr('T.encashmentAmt'),
    unusedDays: tr('T.unusedDays'),
    accrued: tr('T.accrued'),
    taken: tr('T.taken'),
    unused: tr('T.unused'),
    carry: tr('T.carry'),
    holComp: tr('T.holComp'),
    holCash: tr('T.holCash'),
    holNote: tr('T.holNote'),
    enterAmount: tr('T.enterAmount'),
    disclaimer: tr('T.disclaimer'),
  }

  return (
    <div className="space-y-6">
      {/* Mode tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-gray-100 rounded-xl p-1">
        {MODES.map(m => (
          <button key={m.key} onClick={() => setMode(m.key)}
            className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${mode === m.key ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {isAr ? m.labelAr : m.label}
          </button>
        ))}
      </div>

      {/* Shared salary inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className={lc}>{T.salary}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={basicSalary} onChange={e => setBasicSalary(e.target.value)}
              placeholder={T.enterAmount}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm" />
          </div>
        </div>

        {(mode === 'vacation') && (
          <div className="sm:col-span-2">
            <label className={lc}>{T.gross}
              <span className="ml-1 text-xs font-normal text-gray-500">— {T.grossHint}</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
              <input type="number" min="0" value={grossSalary} onChange={e => setGrossSalary(e.target.value)}
                placeholder={T.enterAmount}
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition text-sm" />
            </div>
          </div>
        )}

        {/* Dates — shown for encashment and accrual modes */}
        {(mode === 'encashment' || mode === 'accrual') && <>
          <div>
            <label className={lc}>{T.startDate}</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={ic} />
          </div>
          <div>
            <label className={lc}>{T.endDate}</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={ic} />
          </div>
        </>}

        {/* Vacation mode */}
        {mode === 'vacation' && (
          <div className="sm:col-span-2">
            <label className={lc}>{T.leaveDays}</label>
            <input type="number" min="1" max="30" value={leaveDays} onChange={e => setLeaveDays(e.target.value)}
              placeholder="e.g. 14" className={ic} />
          </div>
        )}

        {/* Encashment mode */}
        {mode === 'encashment' && <>
          <div>
            <label className={lc}>{T.takenDays}</label>
            <input type="number" min="0" value={takenDays} onChange={e => setTakenDays(e.target.value)} placeholder="0" className={ic} />
          </div>
          <div>
            <label className={lc}>{T.unpaidDays}</label>
            <input type="number" min="0" value={unpaidDays} onChange={e => setUnpaidDays(e.target.value)} placeholder="0" className={ic} />
          </div>
        </>}

        {/* Accrual mode */}
        {mode === 'accrual' && (
          <div className="sm:col-span-2">
            <label className={lc}>{T.takenDays}</label>
            <input type="number" min="0" value={takenDays} onChange={e => setTakenDays(e.target.value)} placeholder="0" className={ic} />
          </div>
        )}

        {/* Public holiday mode */}
        {mode === 'holiday' && (
          <div className="sm:col-span-2">
            <label className={lc}>{T.holidayComp}</label>
            <div className="flex gap-3">
              {(['pay', 'off'] as const).map(opt => (
                <button key={opt} onClick={() => setHolidayComp(opt)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${holidayComp === opt ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {opt === 'pay' ? T.optionPay : T.optionOff}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          {errors.map((e, i) => <p key={i} className="text-sm text-red-600">{e}</p>)}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={calculate}
          className="flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm">
          {T.calc}
        </button>
        <button onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm">
          {T.reset}
        </button>
      </div>

      {/* ── Vacation Pay Results ── */}
      {vacResult && (
        <ResultShell title={tr('inline.annual_leave_pay')}>
          <HeroCard label={T.vacFull} value={formatAED(vacResult.fullPay)} />
          <Divider />
          <InfoLine label={T.dailyBasic} value={formatAED(vacResult.basicDaily)}
            sub={`AED ${parseFloat(basicSalary).toFixed(0)} ÷ 30`} />
          <InfoLine label={T.dailyFull} value={formatAED(vacResult.fullDaily)}
            sub={`AED ${(parseFloat(grossSalary) || parseFloat(basicSalary)).toFixed(0)} ÷ 30`} />
          <InfoLine label={tr('inline.leave_days')} value={`${vacResult.days} days`} />
          <Divider />
          <InfoLine label={T.vacFull} value={formatAED(vacResult.fullPay)} highlight />
          <InfoLine label={T.vacBasic} value={formatAED(vacResult.basicPay)} />
          <Note text={T.vacNote} />
          <Disclaimer text={T.disclaimer} />
        </ResultShell>
      )}

      {/* ── Encashment Results ── */}
      {encResult && (
        <ResultShell title={tr('inline.unused_leave_encashment')}>
          <HeroCard label={T.encashmentAmt} value={formatAED(encResult.encashment)} />
          <Divider />
          <InfoLine label={T.dailyBasic} value={formatAED(encResult.basicDaily)}
            sub={`AED ${parseFloat(basicSalary).toFixed(0)} ÷ 30`} />
          <InfoLine label={tr('inline.accrual_rate')} value={encResult.note} />
          <InfoLine label={T.unusedDays} value={`${encResult.unusedDays} days`} highlight />
          <Divider />
          <InfoLine label={T.encashmentAmt}
            value={formatAED(encResult.encashment)}
            sub={`${formatAED(encResult.basicDaily)} × ${encResult.unusedDays} days`}
            highlight />
          <Note text={tr('inline.basic_salary_only_is_used_for_encashment')} />
          <Disclaimer text={T.disclaimer} />
        </ResultShell>
      )}

      {/* ── Accrual Balance Results ── */}
      {accResult && (
        <ResultShell title={tr('inline.annual_leave_balance')}>
          <HeroCard label={tr('inline.remaining_balance')} value={`${accResult.unused} ${tr('inline.days')}`} isText />
          <Divider />
          <InfoLine label={tr('inline.service_duration')}
            value={`${Math.floor(accResult.totalMonths / 12)}y ${accResult.totalMonths % 12}m`} />
          <InfoLine label={tr('inline.accrual_rate')} value={accResult.rate} />

          {/* Visual bar */}
          <div className="py-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{tr('inline.used')}: {accResult.taken}</span>
              <span>{tr('inline.accrued')}: {accResult.accrued}</span>
            </div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-3 bg-violet-500 rounded-full transition-all"
                style={{ width: accResult.accrued > 0 ? `${Math.min(100, (accResult.taken / accResult.accrued) * 100)}%` : '0%' }} />
            </div>
          </div>

          <InfoLine label={T.accrued} value={`${accResult.accrued} days`} />
          <InfoLine label={T.taken} value={`${accResult.taken} days`} negative />
          <InfoLine label={T.unused} value={`${accResult.unused} days`} highlight />
          <InfoLine label={T.carry} value={`${accResult.carryForward} days`} />
          <Disclaimer text={T.disclaimer} />
        </ResultShell>
      )}

      {/* ── Public Holiday Results ── */}
      {holResult && (
        <ResultShell title={tr('inline.public_holiday_work_compensation')}>
          <HeroCard
            label={holidayComp === 'pay' ? T.holCash : T.holComp}
            value={formatAED(holidayComp === 'pay' ? holResult.cashValue : holResult.compensatoryValue)}
          />
          <Divider />
          <InfoLine label={T.dailyBasic} value={formatAED(holResult.basicDaily)}
            sub={`AED ${parseFloat(basicSalary).toFixed(0)} ÷ 30`} />
          <Divider />
          <InfoLine label={T.holComp} value={formatAED(holResult.compensatoryValue)}
            sub={tr('inline.an_additional_paid_day_off')}
            highlight={holidayComp === 'off'} />
          <InfoLine label={T.holCash} value={formatAED(holResult.cashValue)}
            sub={`${formatAED(holResult.basicDaily)} × 1.5`}
            highlight={holidayComp === 'pay'} />
          <Note text={T.holNote} />
          <Disclaimer text={T.disclaimer} />
        </ResultShell>
      )}
    </div>
  )
}

// ── Shared sub-components ───────────────────────────────────────────────────

function ResultShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-2xl p-6 space-y-3 border border-gray-100">
      <h3 className="font-bold text-gray-900">{title}</h3>
      {children}
    </div>
  )
}

function HeroCard({ label, value, isText }: { label: string; value: string; isText?: boolean }) {
  return (
    <div className="bg-violet-600 rounded-xl p-5 text-white">
      <div className="text-sm opacity-80 mb-1">{label}</div>
      <div className={`font-black ${isText ? 'text-4xl' : 'text-3xl'}`}>{value}</div>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-200 my-1" />
}

function InfoLine({ label, value, sub, highlight, negative }: {
  label: string; value: string; sub?: string; highlight?: boolean; negative?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-gray-600">{label}</div>
        {sub && <div className="text-xs text-gray-500 font-mono mt-0.5">{sub}</div>}
      </div>
      <span className={`text-sm font-semibold whitespace-nowrap ${highlight ? 'text-violet-600' : negative ? 'text-red-500' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}

function Note({ text }: { text: string }) {
  return (
    <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
      {text}
    </div>
  )
}

function Disclaimer({ text }: { text: string }) {
  return (
    <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-3">{text}</p>
  )
}
