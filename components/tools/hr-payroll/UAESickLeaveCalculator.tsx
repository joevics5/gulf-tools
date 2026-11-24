'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }
type Mode = 'sick' | 'maternity'
type ProbationStatus = 'completed' | 'probation'

type SickResult = {
  dailyRate: number
  fullPayDays: number
  halfPayDays: number
  unpaidDays: number
  fullPayAmount: number
  halfPayAmount: number
  totalPayable: number
  remainingFull: number
  remainingHalf: number
  remainingTotal: number
  exceedsMax: boolean
  inProbation: boolean
}

type MaternityResult = {
  dailyRate: number
  fullPayDays: number  // 45
  halfPayDays: number  // 15
  fullPayAmount: number
  halfPayAmount: number
  totalPayable: number
  extraUnpaidDays: number
  totalLeave: number
}

function formatAED(n: number) {
  return `AED ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function calcSick(basicSalary: number, totalDays: number, inProbation: boolean, usedDaysThisYear: number): SickResult {
  const dailyRate = basicSalary / 30

  if (inProbation) {
    return {
      dailyRate, fullPayDays: 0, halfPayDays: 0, unpaidDays: totalDays,
      fullPayAmount: 0, halfPayAmount: 0, totalPayable: 0,
      remainingFull: 0, remainingHalf: 0, remainingTotal: 0,
      exceedsMax: totalDays > 90, inProbation: true,
    }
  }

  // Remaining entitlement after already-used days
  const alreadyFullPay = Math.min(usedDaysThisYear, 15)
  const alreadyHalfPay = Math.max(0, Math.min(usedDaysThisYear - 15, 30))

  const remainingFull = Math.max(0, 15 - alreadyFullPay)
  const remainingHalf = Math.max(0, 30 - alreadyHalfPay)
  const remainingTotal = remainingFull + remainingHalf

  // How current request maps to remaining tiers
  const fullPayDays = Math.min(totalDays, remainingFull)
  const halfPayDays = Math.max(0, Math.min(totalDays - fullPayDays, remainingHalf))
  const unpaidDays = Math.max(0, totalDays - fullPayDays - halfPayDays)

  const fullPayAmount = dailyRate * fullPayDays
  const halfPayAmount = (dailyRate * 0.5) * halfPayDays
  const totalPayable = fullPayAmount + halfPayAmount

  return {
    dailyRate, fullPayDays, halfPayDays, unpaidDays,
    fullPayAmount, halfPayAmount, totalPayable,
    remainingFull: Math.max(0, remainingFull - fullPayDays),
    remainingHalf: Math.max(0, remainingHalf - halfPayDays),
    remainingTotal: Math.max(0, remainingTotal - totalDays),
    exceedsMax: (usedDaysThisYear + totalDays) > 90,
    inProbation: false,
  }
}

function calcMaternity(basicSalary: number, extraUnpaidDays: number): MaternityResult {
  const dailyRate = basicSalary / 30
  const fullPayDays = 45
  const halfPayDays = 15
  const fullPayAmount = dailyRate * fullPayDays
  const halfPayAmount = (dailyRate * 0.5) * halfPayDays
  const totalPayable = fullPayAmount + halfPayAmount
  const totalLeave = 60 + Math.min(extraUnpaidDays, 45)

  return { dailyRate, fullPayDays, halfPayDays, fullPayAmount, halfPayAmount, totalPayable, extraUnpaidDays: Math.min(extraUnpaidDays, 45), totalLeave }
}

export default function UAESickLeaveCalculator(_props: Props) {
  const tr = useTranslations('tool')

  const [mode, setMode] = useState<Mode>('sick')
  const [basicSalary, setBasicSalary] = useState('')
  const [probation, setProbation] = useState<ProbationStatus>('completed')
  const [sickDays, setSickDays] = useState('')
  const [usedDays, setUsedDays] = useState('')
  const [workInjury, setWorkInjury] = useState(false)
  const [extraUnpaidDays, setExtraUnpaidDays] = useState('')
  const [sickResult, setSickResult] = useState<SickResult | null>(null)
  const [maternityResult, setMaternityResult] = useState<MaternityResult | null>(null)
  const [errors, setErrors] = useState<string[]>([])

  function calculate() {
    const errs: string[] = []
    const salary = parseFloat(basicSalary)
    if (!salary || salary <= 0) errs.push(tr('inline.enter_a_valid_basic_salary'))

    if (mode === 'sick') {
      const days = parseFloat(sickDays)
      if (!days || days <= 0) errs.push(tr('inline.enter_the_number_of_sick_leave_days'))
      if (errs.length) { setErrors(errs); return }
      setErrors([])
      const used = parseFloat(usedDays) || 0
      setSickResult(calcSick(salary, days, probation === 'probation', used))
      setMaternityResult(null)
    } else {
      if (errs.length) { setErrors(errs); return }
      setErrors([])
      const extra = parseFloat(extraUnpaidDays) || 0
      setMaternityResult(calcMaternity(salary, extra))
      setSickResult(null)
    }
  }

  function reset() {
    setBasicSalary(''); setSickDays(''); setUsedDays(''); setExtraUnpaidDays('')
    setProbation('completed'); setWorkInjury(false)
    setSickResult(null); setMaternityResult(null); setErrors([])
  }

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition text-sm"
  const labelClass = "block text-sm font-semibold text-gray-700 mb-1.5"

  const T = {
    modeSick: tr('T.modeSick'),
    modeMat: tr('T.modeMat'),
    salary: tr('T.salary'),
    probation: tr('T.probation'),
    probCompleted: tr('T.probCompleted'),
    probIn: tr('T.probIn'),
    sickDays: tr('T.sickDays'),
    usedDays: tr('T.usedDays'),
    workInjury: tr('T.workInjury'),
    extraUnpaid: tr('T.extraUnpaid'),
    calc: tr('T.calc'),
    reset: tr('T.reset'),
    results: tr('T.results'),
    matResults: tr('T.matResults'),
    dailyRate: tr('T.dailyRate'),
    fullPay: tr('T.fullPay'),
    halfPay: tr('T.halfPay'),
    unpaidDays: tr('T.unpaidDays'),
    totalPayable: tr('T.totalPayable'),
    remaining: tr('T.remaining'),
    enterAmount: tr('T.enterAmount'),
    disclaimer: tr('T.disclaimer'),
    warnProbation: tr('T.warnProbation'),
    warnExceeds: tr('T.warnExceeds'),
    warnInjury: tr('T.warnInjury'),
    noteReport: tr('T.noteReport'),
    matNote: tr('T.matNote'),
    matExtra: tr('T.matExtra'),
    totalLeave: tr('T.totalLeave'),
  }

  const BAR_SEGMENTS = [
    { label: tr('inline.full'), days: 15, color: 'bg-rose-500' },
    { label: tr('inline.half'), days: 30, color: 'bg-amber-400' },
    { label: tr('inline.unpaid'), days: 45, color: 'bg-gray-200' },
  ]

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
        {(['sick', 'maternity'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setSickResult(null); setMaternityResult(null); setErrors([]) }}
            className={`flex-1 py-2.5 text-sm font-semibold transition-colors ${mode === m ? 'bg-rose-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            {m === 'sick' ? T.modeSick : T.modeMat}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Salary */}
        <div className="sm:col-span-2">
          <label className={labelClass}>{T.salary}</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">AED</span>
            <input type="number" min="0" value={basicSalary} onChange={e => setBasicSalary(e.target.value)}
              placeholder={T.enterAmount}
              className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition text-sm" />
          </div>
        </div>

        {mode === 'sick' && <>
          {/* Probation */}
          <div className="sm:col-span-2">
            <label className={labelClass}>{T.probation}</label>
            <div className="flex gap-3">
              {(['completed', 'probation'] as ProbationStatus[]).map(p => (
                <button key={p} onClick={() => setProbation(p)}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${probation === p ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p === 'completed' ? T.probCompleted : T.probIn}
                </button>
              ))}
            </div>
          </div>

          {/* Sick days */}
          <div>
            <label className={labelClass}>{T.sickDays}</label>
            <input type="number" min="1" max="90" value={sickDays} onChange={e => setSickDays(e.target.value)}
              placeholder="e.g. 20" className={inputClass} />
          </div>

          {/* Used this year */}
          <div>
            <label className={labelClass}>{T.usedDays}</label>
            <input type="number" min="0" max="90" value={usedDays} onChange={e => setUsedDays(e.target.value)}
              placeholder="0" className={inputClass} />
          </div>

          {/* Work injury */}
          <div className="sm:col-span-2 flex items-center gap-3">
            <input type="checkbox" id="workInjury" checked={workInjury} onChange={e => setWorkInjury(e.target.checked)}
              className="w-4 h-4 accent-rose-600" />
            <label htmlFor="workInjury" className="text-sm text-gray-700">{T.workInjury}</label>
          </div>
        </>}

        {mode === 'maternity' && (
          <div className="sm:col-span-2">
            <label className={labelClass}>{T.extraUnpaid} <span className="text-xs font-normal text-gray-500">(max 45)</span></label>
            <input type="number" min="0" max="45" value={extraUnpaidDays} onChange={e => setExtraUnpaidDays(e.target.value)}
              placeholder="0" className={inputClass} />
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-4 space-y-1">
          {errors.map((e, i) => <p key={i} className="text-sm text-red-600">{e}</p>)}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button onClick={calculate}
          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors text-sm">
          {T.calc}
        </button>
        <button onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors text-sm">
          {T.reset}
        </button>
      </div>

      {/* ── Sick Leave Results ── */}
      {sickResult && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-5 border border-gray-100">
          <h3 className="font-bold text-gray-900">{T.results}</h3>

          {/* Warnings */}
          {workInjury && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">{T.warnInjury}</div>
          )}
          {sickResult.exceedsMax && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-700">{T.warnExceeds}</div>
          )}
          {sickResult.inProbation && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-700">{T.warnProbation}</div>
          )}

          {/* Hero total */}
          <div className="bg-rose-600 rounded-xl p-5 text-white">
            <div className="text-sm opacity-80 mb-1">{T.totalPayable}</div>
            <div className="text-3xl font-black">{formatAED(sickResult.totalPayable)}</div>
          </div>

          {/* 90-day progress bar */}
          {!sickResult.inProbation && (
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                {tr('inline.90_day_entitlement_map')}
              </div>
              <div className="flex rounded-lg overflow-hidden h-6 text-xs">
                {BAR_SEGMENTS.map(seg => (
                  <div key={seg.label}
                    className={`${seg.color} flex items-center justify-center text-white font-semibold`}
                    style={{ width: `${(seg.days / 90) * 100}%` }}>
                    {seg.label}
                  </div>
                ))}
              </div>
              <div className="flex text-xs text-gray-500 mt-1 justify-between">
                <span>1</span><span>15</span><span>45</span><span>90</span>
              </div>
            </div>
          )}

          {/* Breakdown rows */}
          {!sickResult.inProbation && (
            <div className="space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{tr('inline.day_amount_breakdown')}</div>

              <PayRow
                label={T.fullPay}
                days={sickResult.fullPayDays}
                amount={sickResult.fullPayAmount}
                color="text-rose-600"
                formula={`${formatAED(sickResult.dailyRate)}/day × ${sickResult.fullPayDays} days × 100%`}
              />
              <PayRow
                label={T.halfPay}
                days={sickResult.halfPayDays}
                amount={sickResult.halfPayAmount}
                color="text-amber-500"
                formula={`${formatAED(sickResult.dailyRate)}/day × ${sickResult.halfPayDays} days × 50%`}
              />
              <PayRow
                label={T.unpaidDays}
                days={sickResult.unpaidDays}
                amount={0}
                color="text-gray-500"
                formula={tr('inline.no_pay')}
              />

              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{T.remaining}</div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{tr('inline.full_pay_days_left')}</span>
                  <span className="font-semibold text-gray-900">{sickResult.remainingFull} {tr('inline.days')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{tr('inline.half_pay_days_left')}</span>
                  <span className="font-semibold text-gray-900">{sickResult.remainingHalf} {tr('inline.days')}</span>
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700">{T.noteReport}</div>
          <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-4">{T.disclaimer}</p>
        </div>
      )}

      {/* ── Maternity Results ── */}
      {maternityResult && (
        <div className="bg-gray-50 rounded-2xl p-6 space-y-5 border border-gray-100">
          <h3 className="font-bold text-gray-900">{T.matResults}</h3>

          <div className="bg-rose-600 rounded-xl p-5 text-white">
            <div className="text-sm opacity-80 mb-1">{T.totalPayable}</div>
            <div className="text-3xl font-black">{formatAED(maternityResult.totalPayable)}</div>
            <div className="text-sm opacity-70 mt-1">{T.totalLeave}: {maternityResult.totalLeave} {tr('inline.days')}</div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-500">{tr('inline.day_amount_breakdown')}</div>

            <PayRow
              label={tr('inline.full_pay_days_1_45')}
              days={maternityResult.fullPayDays}
              amount={maternityResult.fullPayAmount}
              color="text-rose-600"
              formula={`${formatAED(maternityResult.dailyRate)}/day × 45 days × 100%`}
            />
            <PayRow
              label={tr('inline.half_pay_days_46_60')}
              days={maternityResult.halfPayDays}
              amount={maternityResult.halfPayAmount}
              color="text-amber-500"
              formula={`${formatAED(maternityResult.dailyRate)}/day × 15 days × 50%`}
            />
            {maternityResult.extraUnpaidDays > 0 && (
              <PayRow
                label={tr('inline.extra_unpaid_leave')}
                days={maternityResult.extraUnpaidDays}
                amount={0}
                color="text-gray-500"
                formula={tr('inline.employer_approval_required_up_to_45_days')}
              />
            )}
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm text-blue-700 space-y-1">
            <p>{T.matNote}</p>
            <p>{T.matExtra}</p>
          </div>

          <p className="text-xs text-gray-500 leading-relaxed border-t border-gray-100 pt-4">{T.disclaimer}</p>
        </div>
      )}
    </div>
  )
}

function PayRow({ label, days, amount, color, formula }: {
  label: string; days: number; amount: number; color: string; formula: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="text-sm text-gray-700">{label}</div>
        <div className="text-xs text-gray-500 font-mono mt-0.5">{formula}</div>
        <div className={`text-xs font-semibold mt-0.5 ${color}`}>{days} days</div>
      </div>
      <div className={`text-sm font-bold whitespace-nowrap ${color}`}>
        {amount > 0 ? formatAED(amount) : '—'}
      </div>
    </div>
  )
}
