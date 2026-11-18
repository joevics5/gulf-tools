'use client'

import { useState, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import { isRtl } from '@/lib/i18n/locales'

type Props = { locale: string }

type EmploymentType = 'salaried' | 'self-employed'
type CarType = 'new' | 'used'
type EligibilityStatus = 'eligible' | 'borderline' | 'ineligible'

// ─── Pure calculation utils ──────────────────────────────────────────────────

function calculateEMI(principal: number, annualRate: number, months: number): number {
  if (principal <= 0 || months <= 0) return 0
  if (annualRate === 0) return principal / months
  const r = annualRate / 12 / 100
  return (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

function maxAffordableLoan(
  grossSalary: number,
  existingDebts: number,
  annualRate: number,
  months: number,
): number {
  // Back-calculate: max EMI = 50% of salary - existing debts
  const maxEMI = grossSalary * 0.5 - existingDebts
  if (maxEMI <= 0 || months <= 0) return 0
  if (annualRate === 0) return maxEMI * months
  const r = annualRate / 12 / 100
  return maxEMI * (Math.pow(1 + r, months) - 1) / (r * Math.pow(1 + r, months))
}

function getEligibilityStatus(
  dbr: number,
  salary: number,
  downPaymentPct: number,
  isUAEResident: boolean,
  age: number,
  tenure: number,
): EligibilityStatus {
  if (!isUAEResident) return 'ineligible'
  if (age < 21 || age + tenure / 12 > 65) return 'ineligible'
  if (downPaymentPct < 20) return 'ineligible'
  if (dbr > 60 || salary < 3000) return 'ineligible'
  if (dbr > 50 || salary < 5000) return 'borderline'
  return 'eligible'
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FieldLabel({ text, tip }: { text: string; tip?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className="text-sm font-semibold text-gray-700">{text}</span>
      {tip && (
        <div className="relative">
          <button
            onMouseEnter={() => setShow(true)}
            onMouseLeave={() => setShow(false)}
            onClick={() => setShow(v => !v)}
            className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center hover:bg-gray-300 transition"
          >
            ?
          </button>
          {show && (
            <div className="absolute left-0 bottom-6 z-10 w-56 bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-xl leading-relaxed">
              {tip}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultCard({
  label,
  value,
  sub,
  accent = 'gray',
}: {
  label: string
  value: string
  sub?: string
  accent?: 'gray' | 'blue' | 'amber' | 'red' | 'green'
}) {
  const colors: Record<string, string> = {
    gray: 'text-gray-900',
    blue: 'text-blue-700',
    amber: 'text-amber-600',
    red: 'text-red-600',
    green: 'text-emerald-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-black leading-tight ${colors[accent]}`}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CarLoanEligibilityCalculator({ locale }: Props) {
  const tt = useTranslations('tool')

  // Inputs
  const [salary, setSalary] = useState('')
  const [employmentType, setEmploymentType] = useState<EmploymentType>('salaried')
  const [age, setAge] = useState('')
  const [isUAEResident, setIsUAEResident] = useState(true)
  const [existingDebts, setExistingDebts] = useState('')
  const [carPrice, setCarPrice] = useState('')
  const [downPaymentPct, setDownPaymentPct] = useState('20')
  const [downPaymentAmt, setDownPaymentAmt] = useState('')
  const [carType, setCarType] = useState<CarType>('new')
  const [tenure, setTenure] = useState(48)
  const [annualRate, setAnnualRate] = useState('3.99')

  // Sync down payment
  const carPriceNum = parseFloat(carPrice) || 0
  const handlePriceChange = (val: string) => {
    setCarPrice(val)
    const p = parseFloat(val) || 0
    const pct = parseFloat(downPaymentPct) || 20
    setDownPaymentAmt(String(Math.round(p * pct / 100)))
  }
  const handlePctChange = (val: string) => {
    const pct = Math.max(20, Math.min(100, parseFloat(val) || 20))
    setDownPaymentPct(String(pct))
    setDownPaymentAmt(String(Math.round(carPriceNum * pct / 100)))
  }
  const handleAmtChange = (val: string) => {
    setDownPaymentAmt(val)
    const amt = parseFloat(val) || 0
    if (carPriceNum > 0) setDownPaymentPct(String(Math.round((amt / carPriceNum) * 100)))
  }

  // Derived
  const salaryNum = parseFloat(salary) || 0
  const ageNum = parseFloat(age) || 0
  const debtsNum = parseFloat(existingDebts) || 0
  const rateNum = parseFloat(annualRate) || 3.99
  const downAmt = parseFloat(downPaymentAmt) || 0
  const downPct = parseFloat(downPaymentPct) || 20

  const loanAmount = useMemo(() => {
    if (carPriceNum <= 0) return 0
    const maxByLTV = carPriceNum * 0.80
    const byDownPayment = carPriceNum - downAmt
    return Math.min(byDownPayment, maxByLTV)
  }, [carPriceNum, downAmt])

  const result = useMemo(() => {
    const emi = calculateEMI(loanAmount, rateNum, tenure)
    const totalMonthlyDebt = debtsNum + emi
    const dbr = salaryNum > 0 ? (totalMonthlyDebt / salaryNum) * 100 : 0
    const maxLoan = maxAffordableLoan(salaryNum, debtsNum, rateNum, tenure)
    const maxCarPrice = maxLoan / 0.8 // assuming 20% down
    const totalInterest = emi * tenure - loanAmount
    const totalRepayable = emi * tenure
    const status = getEligibilityStatus(dbr, salaryNum, downPct, isUAEResident, ageNum, tenure)
    const remainingDBRCapacity = Math.max(0, salaryNum * 0.5 - debtsNum)
    const requiredDownPayment = Math.max(carPriceNum * 0.2, carPriceNum - maxLoan)

    // Recommendations
    const recs: string[] = []
    if (!isUAEResident) recs.push('A valid UAE residence visa is required for car finance.')
    if (ageNum < 21) recs.push('Minimum age for car finance is 21 years.')
    if (ageNum + tenure / 12 > 65) recs.push(`Reduce tenure — loan must be repaid before age 65. Max tenure for you: ${Math.floor((65 - ageNum) * 12)} months.`)
    if (downPct < 20) recs.push('Increase down payment to at least 20% (CBUAE minimum).')
    if (dbr > 50 && salaryNum > 0) recs.push(`Your DBR is ${fmt(dbr, 1)}%. Pay off AED ${fmt((totalMonthlyDebt - salaryNum * 0.5), 0)}/month of existing debt or increase your down payment.`)
    if (salaryNum > 0 && salaryNum < 5000) recs.push('Most UAE banks require a minimum monthly salary of AED 5,000–8,000 for car loans.')
    if (status !== 'eligible' && maxLoan > 0) recs.push(`Maximum affordable loan at your income: AED ${fmt(maxLoan, 0)} (for a car up to AED ${fmt(maxCarPrice, 0)}).`)
    if (carType === 'used') recs.push('Used car loans may have slightly stricter terms — some banks cap finance at 75% for older models.')
    if (employmentType === 'self-employed') recs.push('Self-employed applicants typically need 6–12 months of bank statements and may face higher scrutiny.')

    return {
      emi,
      loanAmount,
      dbr,
      totalInterest,
      totalRepayable,
      maxLoan,
      maxCarPrice,
      status,
      remainingDBRCapacity,
      requiredDownPayment,
      recommendations: recs,
    }
  }, [loanAmount, rateNum, tenure, salaryNum, debtsNum, downPct, isUAEResident, ageNum, carType, employmentType, carPriceNum])

  const hasInputs = salaryNum > 0 && carPriceNum > 0

  // Labels

  const verdictConfig = {
    eligible: {
      bg: 'bg-emerald-600',
      icon: '✅',
      border: 'border-emerald-200',
      text: tt('eligible'),
    },
    borderline: {
      bg: 'bg-amber-500',
      icon: '⚠️',
      border: 'border-amber-200',
      text: tt('borderline'),
    },
    ineligible: {
      bg: 'bg-red-600',
      icon: '❌',
      border: 'border-red-200',
      text: tt('ineligible'),
    },
  }

  const verdict = hasInputs ? verdictConfig[result.status] : null

  return (
    <div className="space-y-6" dir={isRtl(locale) ? 'rtl' : 'ltr'}>

      {/* Section: Personal & Employment */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          {tt('inline.personal_employment')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Salary */}
          <div className="sm:col-span-2">
            <FieldLabel text={tt('salary')} tip={tt('salaryTip')} />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
              <input
                type="number"
                min="0"
                value={salary}
                onChange={e => setSalary(e.target.value)}
                placeholder={tt('enterAmount')}
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
            {salaryNum > 0 && salaryNum < 5000 && (
              <p className="text-xs text-amber-600 mt-1 font-medium">⚠ {tt('minSalaryWarning')}</p>
            )}
          </div>

          {/* Employment Type */}
          <div>
            <FieldLabel text={tt('employment')} />
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              {(['salaried', 'self-employed'] as EmploymentType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setEmploymentType(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    employmentType === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {t === 'salaried' ? tt('salaried') : tt('selfEmployed')}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div>
            <FieldLabel text={tt('age')} tip={tt('ageTip')} />
            <input
              type="number"
              min="18"
              max="70"
              value={age}
              onChange={e => setAge(e.target.value)}
              placeholder="e.g. 32"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {/* UAE Resident */}
          <div>
            <FieldLabel text={tt('resident')} />
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              {[true, false].map(v => (
                <button
                  key={String(v)}
                  onClick={() => setIsUAEResident(v)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isUAEResident === v ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {v ? tt('yes') : tt('no')}
                </button>
              ))}
            </div>
            {!isUAEResident && (
              <p className="text-xs text-red-500 mt-1 font-medium">⚠ {tt('nonResidentWarning')}</p>
            )}
          </div>

          {/* Existing Debts */}
          <div>
            <FieldLabel text={tt('existingDebts')} tip={tt('debtsTip')} />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
              <input
                type="number"
                min="0"
                value={existingDebts}
                onChange={e => setExistingDebts(e.target.value)}
                placeholder="0"
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section: Vehicle Details */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          {tt('inline.vehicle_details')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Car Type Toggle */}
          <div className="sm:col-span-2">
            <FieldLabel text={tt('carType')} />
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
              {(['new', 'used'] as CarType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setCarType(t)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    carType === t ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {t === 'new' ? tt('newCar') : tt('usedCar')}
                </button>
              ))}
            </div>
          </div>

          {/* Car Price */}
          <div className="sm:col-span-2">
            <FieldLabel text={tt('carPrice')} />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
              <input
                type="number"
                min="0"
                value={carPrice}
                onChange={e => handlePriceChange(e.target.value)}
                placeholder="e.g. 120000"
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>

          {/* Down Payment % */}
          <div>
            <FieldLabel text={tt('downPct')} />
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
                  className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-500">% (min 20%)</span>
              </div>
            </div>
          </div>

          {/* Down Payment AED */}
          <div>
            <FieldLabel text={tt('downAmt')} />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">AED</span>
              <input
                type="number"
                min="0"
                value={downPaymentAmt}
                onChange={e => handleAmtChange(e.target.value)}
                placeholder="e.g. 24000"
                className="w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Section: Loan Parameters */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
          {tt('inline.loan_parameters')}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Tenure */}
          <div>
            <FieldLabel text={`${tt('tenure')}: `} />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-blue-600 font-bold">{tenure}</span>
              <span className="text-sm text-gray-500">{tt('inline.months')}</span>
            </div>
            <input
              type="range"
              min="12"
              max="60"
              step="12"
              value={tenure}
              onChange={e => setTenure(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>12</span><span>24</span><span>36</span><span>48</span><span>60</span>
            </div>
          </div>

          {/* Rate */}
          <div>
            <FieldLabel text={tt('rate')} />
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
            <p className="text-xs text-gray-500 mt-1">
              {tt('inline.typical_range_2_15_5_reducing_balance')}
            </p>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasInputs && (
        <div className="space-y-4">

          {/* Eligibility Verdict */}
          <div className={`${verdict!.bg} rounded-2xl p-5 text-white`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{verdict!.icon}</span>
              <div>
                <div className="text-xs opacity-75 uppercase tracking-widest mb-0.5">{tt('verdict')}</div>
                <div className="text-xl font-black">{verdict!.text}</div>
              </div>
            </div>
          </div>

          {/* Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ResultCard
              label={tt('emi')}
              value={result.emi > 0 ? `AED ${fmt(result.emi, 0)}` : '—'}
              sub={tt('inline.month')}
              accent="blue"
            />
            <ResultCard
              label={tt('loanAmt')}
              value={result.loanAmount > 0 ? `AED ${fmt(result.loanAmount, 0)}` : '—'}
            />
            <ResultCard
              label={tt('dbrLabel')}
              value={salaryNum > 0 ? `${fmt(result.dbr, 1)}%` : '—'}
              sub={tt('inline.max_allowed_50')}
              accent={result.dbr > 50 ? 'red' : result.dbr > 40 ? 'amber' : 'green'}
            />
            <ResultCard
              label={tt('maxLoan')}
              value={result.maxLoan > 0 ? `AED ${fmt(result.maxLoan, 0)}` : '—'}
              sub={tt('inline.based_on_your_income')}
              accent="green"
            />
            <ResultCard
              label={tt('totalInterest')}
              value={result.totalInterest > 0 ? `AED ${fmt(result.totalInterest, 0)}` : '—'}
              accent="amber"
            />
          </div>

          {/* DBR Visual Bar */}
          {salaryNum > 0 && (
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <div className="flex justify-between text-xs font-semibold text-gray-500 mb-2">
                <span>{tt('inline.your_dbr')}: {fmt(result.dbr, 1)}%</span>
                <span>{tt('inline.max')}: 50%</span>
              </div>
              <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
                {/* Existing debts */}
                <div
                  className="absolute left-0 top-0 h-full bg-amber-400 transition-all"
                  style={{ width: `${Math.min(100, (debtsNum / salaryNum) * 100)}%` }}
                />
                {/* New EMI */}
                <div
                  className="absolute top-0 h-full bg-blue-500 transition-all"
                  style={{
                    left: `${Math.min(100, (debtsNum / salaryNum) * 100)}%`,
                    width: `${Math.min(100 - Math.min(100, (debtsNum / salaryNum) * 100), (result.emi / salaryNum) * 100)}%`,
                  }}
                />
                {/* 50% marker */}
                <div className="absolute top-0 h-full w-0.5 bg-red-500" style={{ left: '50%' }} />
              </div>
              <div className="flex gap-4 text-xs text-gray-500 mt-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />{tt('inline.existing_debts')}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />{tt('inline.car_emi')}</span>
                <span className="flex items-center gap-1"><span className="w-0.5 h-3 bg-red-500 inline-block" />{tt('inline.50_limit')}</span>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-2">
              <div className="text-sm font-bold text-blue-800 mb-3">💡 {tt('recommendations')}</div>
              {result.recommendations.map((rec, i) => (
                <div key={i} className="flex gap-2 text-sm text-blue-700">
                  <span className="mt-0.5 text-blue-400 shrink-0">→</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}

          {/* Bank Reference Note */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <div className="text-xs font-semibold text-gray-600 mb-1">
              {tt('inline.major_uae_bank_reference_approximate')}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-gray-500">
              {[
                { bank: 'FAB', min: '7,000' },
                { bank: 'Emirates NBD', min: '7,000' },
                { bank: 'ADCB', min: '8,000' },
                { bank: 'DIB', min: '5,000' },
                { bank: 'Mashreq', min: '7,000' },
                { bank: 'RAKBank', min: '5,000' },
              ].map(b => (
                <div key={b.bank} className="flex justify-between bg-white rounded-lg px-2.5 py-1.5 border border-gray-100">
                  <span className="font-medium text-gray-700">{b.bank}</span>
                  <span>AED {b.min}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {tt('inline.approximate_minimum_salary_subject_to_ch')}
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-4 border border-gray-100 leading-relaxed">
        ⚠️ <strong>{tt('inline.disclaimer')}:</strong> {tt('disclaimer')}
      </div>
    </div>
  )
}
