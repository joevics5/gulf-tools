'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'

type Props = { locale: string }

// ─── Constants (update annually) ──────────────────────────────────────────────

const TAX_BRACKETS = [
  { min: 0,       max: 40000,    rate: 0.000 },
  { min: 40000,   max: 55000,    rate: 0.100 },
  { min: 55000,   max: 70000,    rate: 0.150 },
  { min: 70000,   max: 200000,   rate: 0.200 },
  { min: 200000,  max: 400000,   rate: 0.225 },
  { min: 400000,  max: 1200000,  rate: 0.250 },
  { min: 1200000, max: Infinity, rate: 0.275 },
]

const SI_EMPLOYEE_RATE    = 0.11     // 11% employee pension/sickness/unemployment
const SI_EMPLOYER_RATE    = 0.1875   // 18.75% employer share
const HEALTH_EMPLOYEE     = 0.01     // 1% employee health insurance
const HEALTH_EMPLOYER     = 0.0325   // 3.25% employer health insurance
const MARTYRS_RATE        = 0.0005   // 0.05% Martyrs' Families Fund

const SI_MIN_MONTHLY      = 2700     // insurable wage floor (EGP, 2026)
const SI_MAX_MONTHLY      = 16700    // insurable wage ceiling (EGP, 2026)
const PERSONAL_EXEMPTION  = 20000    // annual personal exemption (EGP)

// Preset examples
const PRESETS = [
  { key: 'entry',  gross: 8000 },
  { key: 'mid',    gross: 25000 },
  { key: 'senior', gross: 60000 },
] as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface PayrollOptions {
  dependents?: number
  nonTaxableAllowances?: number
}

interface PayrollResult {
  grossMonthly: number
  grossAnnual: number

  // Social insurance
  insurableWage: number       // capped between min and max
  siEmployee: number          // monthly 11%
  healthEmployee: number      // monthly 1%
  martyrsFund: number         // monthly 0.05%
  totalSIEmployee: number

  siEmployer: number
  healthEmployer: number
  totalSIEmployer: number

  // Tax
  annualTaxableIncome: number
  annualTax: number
  monthlyTax: number
  effectiveRate: number       // as decimal

  // Breakdown by bracket
  bracketBreakdown: { min: number; max: number; taxable: number; rate: number; tax: number }[]

  // Net
  totalDeductionsMonthly: number
  netMonthly: number
  netAnnual: number

  // Employer total cost
  employerTotalMonthly: number
}

// ─── Core calculation engine ──────────────────────────────────────────────────

function calcAnnualTax(annualTaxable: number): { total: number; breakdown: PayrollResult['bracketBreakdown'] } {
  let remaining = Math.max(0, annualTaxable)
  let total = 0
  const breakdown: PayrollResult['bracketBreakdown'] = []

  for (const b of TAX_BRACKETS) {
    if (remaining <= 0) break
    const slice = Math.min(remaining, b.max === Infinity ? remaining : b.max - b.min)
    const tax = slice * b.rate
    if (slice > 0) {
      breakdown.push({
        min: b.min,
        max: b.max,
        taxable: slice,
        rate: b.rate,
        tax,
      })
    }
    total += tax
    remaining -= slice
  }

  return { total, breakdown }
}

function calculatePayroll(grossMonthly: number, opts: PayrollOptions = {}): PayrollResult {
  const { nonTaxableAllowances = 0 } = opts

  const grossAnnual = grossMonthly * 12

  // Insurable wage: capped at SI_MAX_MONTHLY, floored at SI_MIN_MONTHLY
  const insurableWage = Math.min(Math.max(grossMonthly, SI_MIN_MONTHLY), SI_MAX_MONTHLY)

  // Employee deductions (monthly)
  const siEmployee     = insurableWage * SI_EMPLOYEE_RATE
  const healthEmployee = grossMonthly  * HEALTH_EMPLOYEE
  const martyrsFund    = grossMonthly  * MARTYRS_RATE
  const totalSIEmployee = siEmployee + healthEmployee + martyrsFund

  // Employer contributions (monthly, informational)
  const siEmployer     = insurableWage * SI_EMPLOYER_RATE
  const healthEmployer = grossMonthly  * HEALTH_EMPLOYER
  const totalSIEmployer = siEmployer + healthEmployer

  // Annual taxable income
  const annualSI         = siEmployee * 12
  const taxableGross     = grossAnnual - (nonTaxableAllowances * 12)
  const annualTaxableIncome = Math.max(0, taxableGross - annualSI - PERSONAL_EXEMPTION)

  // Income tax
  const { total: annualTax, breakdown: bracketBreakdown } = calcAnnualTax(annualTaxableIncome)
  const monthlyTax = annualTax / 12
  const effectiveRate = grossAnnual > 0 ? annualTax / grossAnnual : 0

  // Net
  const totalDeductionsMonthly = totalSIEmployee + monthlyTax
  const netMonthly = grossMonthly - totalDeductionsMonthly
  const netAnnual  = netMonthly * 12

  // Employer total
  const employerTotalMonthly = grossMonthly + totalSIEmployer

  return {
    grossMonthly, grossAnnual,
    insurableWage,
    siEmployee, healthEmployee, martyrsFund, totalSIEmployee,
    siEmployer, healthEmployer, totalSIEmployer,
    annualTaxableIncome, annualTax, monthlyTax, effectiveRate,
    bracketBreakdown,
    totalDeductionsMonthly, netMonthly, netAnnual,
    employerTotalMonthly,
  }
}

// Gross-up: find gross that yields target net, using iterative refinement
function grossUp(targetNet: number, opts: PayrollOptions = {}): number {
  let guess = targetNet * 1.3
  for (let i = 0; i < 50; i++) {
    const r = calculatePayroll(guess, opts)
    const diff = r.netMonthly - targetNet
    if (Math.abs(diff) < 0.5) break
    guess -= diff * 0.8
  }
  return Math.max(0, guess)
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

// Currency label (EGP / ج.م) comes from the tool messages; Row/StatCard read it from context.
const CurrencyCtx = createContext('EGP')

function fmtEgp(n: number, cur: string) {
  return `${cur} ${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pct(n: number) {
  return `${(n * 100).toFixed(2)}%`
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Row({ label, monthly, annual, color, bold }: {
  label: string; monthly: number; annual: number; color?: string; bold?: boolean
}) {
  const cur = useContext(CurrencyCtx)
  const egp = (n: number) => fmtEgp(n, cur)
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      gap: 12,
      padding: '7px 0',
      borderBottom: '0.5px solid var(--color-border-tertiary)',
      fontSize: 13,
    }}>
      <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 500 : 400, color: color ?? 'var(--color-text-primary)', textAlign: 'end', minWidth: 110 }}>{egp(monthly)}</span>
      <span style={{ fontWeight: bold ? 500 : 400, color: color ?? 'var(--color-text-tertiary)', textAlign: 'end', minWidth: 130 }}>{egp(annual)}</span>
    </div>
  )
}

function StatCard({ label, value, sub, accent, warn }: {
  label: string; value: string; sub?: string; accent?: boolean; warn?: boolean
}) {
  const bg = accent ? 'var(--color-background-success)' : warn ? 'var(--color-background-warning)' : 'var(--color-background-secondary)'
  const tc = accent ? 'var(--color-text-success)' : warn ? 'var(--color-text-warning)' : 'var(--color-text-primary)'
  const lc = accent ? 'var(--color-text-success)' : warn ? 'var(--color-text-warning)' : 'var(--color-text-secondary)'
  return (
    <div style={{ background: bg, borderRadius: 'var(--border-radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, color: lc }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 500, color: tc }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: lc }}>{sub}</span>}
    </div>
  )
}

function InputField({ label, value, onChange, prefix, hint }: {
  label: string; value: string; onChange: (v: string) => void; prefix?: string; hint?: string
}) {
  const cur = useContext(CurrencyCtx)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '0.5px solid var(--color-border-secondary)', borderRadius: 'var(--border-radius-md)', overflow: 'hidden', background: 'var(--color-background-primary)' }}>
        <span style={{ padding: '0 10px', fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', borderInlineEnd: '0.5px solid var(--color-border-tertiary)', whiteSpace: 'nowrap' }}>{prefix ?? cur}</span>
        <input
          type="number" min="0" value={value} onChange={e => onChange(e.target.value)}
          placeholder="0"
          style={{ flex: 1, border: 'none', outline: 'none', padding: '9px 12px', fontSize: 14, background: 'transparent', color: 'var(--color-text-primary)' }}
        />
      </div>
      {hint && <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{hint}</span>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EgyptSalaryCalculator(_props: Props) {
  const t = useTranslations('tool')
  const cur = t('currency')
  const egp = (n: number) => fmtEgp(n, cur)
  const [direction, setDirection] = useState<'gross-to-net' | 'net-to-gross'>('gross-to-net')
  const [amount, setAmount] = useState('15000')
  const [nonTaxable, setNonTaxable] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showEmployer, setShowEmployer] = useState(false)
  const [result, setResult] = useState<PayrollResult | null>(null)

  const calculate = useCallback(() => {
    const raw = parseFloat(amount) || 0
    if (raw <= 0) return
    const opts: PayrollOptions = { nonTaxableAllowances: parseFloat(nonTaxable) || 0 }
    const gross = direction === 'net-to-gross' ? grossUp(raw, opts) : raw
    setResult(calculatePayroll(gross, opts))
  }, [amount, direction, nonTaxable])

  useEffect(() => { calculate() }, [calculate])

  function reset() { setAmount(''); setNonTaxable(''); setResult(null) }

  function applyPreset(gross: number) { setAmount(String(gross)); setDirection('gross-to-net') }

  const dirLabel = direction === 'gross-to-net' ? t('labels.grossMonthlyInput') : t('labels.targetNet')

  return (
    <CurrencyCtx.Provider value={cur}>
    <div style={{ fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Direction toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('labels.mode')}</span>
        <div style={{ display: 'flex', background: 'var(--color-background-secondary)', borderRadius: 'var(--border-radius-md)', padding: 3, gap: 2, width: 'fit-content' }}>
          {([['gross-to-net', t('labels.grossToNet')], ['net-to-gross', t('labels.netToGross')]] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setDirection(val)} style={{
              padding: '7px 18px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              borderRadius: 'calc(var(--border-radius-md) - 2px)',
              background: direction === val ? 'var(--color-background-primary)' : 'transparent',
              color: direction === val ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              boxShadow: direction === val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}>{lbl}</button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{t('labels.quickExamples')}</span>
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => applyPreset(p.gross)} style={{
            padding: '5px 12px', fontSize: 12, borderRadius: 'var(--border-radius-md)',
            border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)',
            color: 'var(--color-text-secondary)', cursor: 'pointer',
          }}>{t(`presets.${p.key}`)} ({egp(p.gross)})</button>
        ))}
      </div>

      {/* Main input */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        <InputField label={dirLabel} value={amount} onChange={setAmount} hint={direction === 'net-to-gross' ? t('labels.grossUpHint') : undefined} />
      </div>

      {/* Advanced options */}
      <div>
        <button onClick={() => setShowAdvanced(v => !v)} style={{
          background: 'none', border: 'none', fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
        }}>
          {showAdvanced ? '▾' : '▸'} {t('labels.advanced')}
        </button>
        {showAdvanced && (
          <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <InputField
              label={t('labels.nonTaxable')}
              value={nonTaxable}
              onChange={setNonTaxable}
              hint={t('labels.nonTaxableHint')}
            />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={reset} style={{ padding: '8px 16px', fontSize: 13 }}>{t('labels.reset')}</button>
      </div>

      {/* Results */}
      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {direction === 'net-to-gross' && (
            <div style={{ background: 'var(--color-background-info)', border: '0.5px solid var(--color-border-info)', borderRadius: 'var(--border-radius-md)', padding: '10px 14px', fontSize: 13, color: 'var(--color-text-info)' }}>
              {t('labels.requiredGrossA')} <strong>{egp(result.grossMonthly)}</strong> {t('labels.requiredGrossB')} {egp(result.netMonthly)}.
            </div>
          )}

          {/* Hero stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            <StatCard label={t('labels.grossMonthly')} value={egp(result.grossMonthly)} sub={egp(result.grossAnnual) + ' ' + t('labels.perYear')} />
            <StatCard label={t('labels.totalDeductions')} value={egp(result.totalDeductionsMonthly)} warn />
            <StatCard label={t('labels.netTakeHome')} value={egp(result.netMonthly)} sub={egp(result.netAnnual) + ' ' + t('labels.perYear')} accent />
            <StatCard label={t('labels.effectiveRate')} value={pct(result.effectiveRate)} sub={t('labels.effectiveRateSub')} />
          </div>

          {/* Insurable wage note */}
          {(result.grossMonthly < SI_MIN_MONTHLY || result.grossMonthly > SI_MAX_MONTHLY) && (
            <div style={{ background: 'var(--color-background-warning)', border: '0.5px solid var(--color-border-warning)', borderRadius: 'var(--border-radius-md)', padding: '10px 14px', fontSize: 13, color: 'var(--color-text-warning)' }}>
              {result.grossMonthly < SI_MIN_MONTHLY
                ? t('notes.minWage', { amount: egp(SI_MIN_MONTHLY) })
                : t('notes.maxWage', { amount: egp(SI_MAX_MONTHLY) })}
            </div>
          )}

          {/* Full breakdown table */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, paddingBottom: 8, borderBottom: '0.5px solid var(--color-border-secondary)', marginBottom: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>{t('table.component')}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'end', minWidth: 110 }}>{t('table.monthly')}</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', textAlign: 'end', minWidth: 130 }}>{t('table.annual')}</span>
            </div>

            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('table.earnings')}</p>
            <Row label={t('table.grossSalary')} monthly={result.grossMonthly} annual={result.grossAnnual} bold />

            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('table.siDeductions')}</p>
            <Row label={t('table.pension')} monthly={result.siEmployee} annual={result.siEmployee * 12} color="var(--color-text-danger)" />
            <Row label={t('table.health')} monthly={result.healthEmployee} annual={result.healthEmployee * 12} color="var(--color-text-danger)" />
            <Row label={t('table.martyrs')} monthly={result.martyrsFund} annual={result.martyrsFund * 12} color="var(--color-text-danger)" />
            <Row label={t('table.totalSi')} monthly={result.totalSIEmployee} annual={result.totalSIEmployee * 12} color="var(--color-text-danger)" bold />

            <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-tertiary)', margin: '12px 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('table.incomeTax')}</p>
            <Row label={t('table.taxableIncome')} monthly={result.annualTaxableIncome / 12} annual={result.annualTaxableIncome} />
            <Row label={t('table.incomeTaxProgressive')} monthly={result.monthlyTax} annual={result.annualTax} color="var(--color-text-danger)" bold />

            <div style={{ borderTop: '0.5px solid var(--color-border-secondary)', marginTop: 8, paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{t('table.netPay')}</span>
              <span style={{ fontSize: 15, fontWeight: 500, color: 'var(--color-text-success)', textAlign: 'end', minWidth: 110 }}>{egp(result.netMonthly)}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-success)', textAlign: 'end', minWidth: 130 }}>{egp(result.netAnnual)}</span>
            </div>
          </div>

          {/* Tax bracket breakdown */}
          {result.bracketBreakdown.length > 0 && (
            <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>{t('bracket.title')}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-tertiary)' }}>{t('bracket.bracket')}</span>
                <span style={{ color: 'var(--color-text-tertiary)', textAlign: 'end' }}>{t('bracket.taxable')}</span>
                <span style={{ color: 'var(--color-text-tertiary)', textAlign: 'end' }}>{t('bracket.tax')}</span>
                {result.bracketBreakdown.map((b, i) => (
                  <div key={i} style={{ display: 'contents' }}>
                    <span style={{ color: 'var(--color-text-secondary)', paddingTop: 4 }}>{b.max === Infinity ? t('bracket.over', { from: String(b.min / 1000) }) : t('bracket.range', { from: String(b.min / 1000), to: String(b.max / 1000) })} <span style={{ color: 'var(--color-text-tertiary)' }}>@ {pct(b.rate)}</span></span>
                    <span style={{ textAlign: 'end', paddingTop: 4 }}>{egp(b.taxable)}</span>
                    <span style={{ textAlign: 'end', paddingTop: 4, color: 'var(--color-text-danger)' }}>{egp(b.tax)}</span>
                  </div>
                ))}
                <div style={{ gridColumn: '1/-1', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, paddingTop: 6, fontWeight: 500 }}>
                  <span>{t('bracket.total')}</span>
                  <span style={{ textAlign: 'end' }}>{egp(result.annualTaxableIncome)}</span>
                  <span style={{ textAlign: 'end', color: 'var(--color-text-danger)' }}>{egp(result.annualTax)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Employer cost toggle */}
          <div>
            <button onClick={() => setShowEmployer(v => !v)} style={{
              background: 'none', border: 'none', fontSize: 13, color: 'var(--color-text-secondary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {showEmployer ? '▾' : '▸'} {t('employer.toggle')}
            </button>
            {showEmployer && (
              <div style={{ marginTop: 12, background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
                <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{t('employer.title')}</p>
                <Row label={t('table.grossSalary')} monthly={result.grossMonthly} annual={result.grossAnnual} />
                <Row label={t('employer.si')} monthly={result.siEmployer} annual={result.siEmployer * 12} color="var(--color-text-danger)" />
                <Row label={t('employer.health')} monthly={result.healthEmployer} annual={result.healthEmployer * 12} color="var(--color-text-danger)" />
                <div style={{ borderTop: '0.5px solid var(--color-border-secondary)', marginTop: 8, paddingTop: 10, display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{t('employer.total')}</span>
                  <span style={{ fontSize: 15, fontWeight: 500, textAlign: 'end', minWidth: 110 }}>{egp(result.employerTotalMonthly)}</span>
                  <span style={{ fontSize: 14, fontWeight: 500, textAlign: 'end', minWidth: 130 }}>{egp(result.employerTotalMonthly * 12)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Tax schedule reference */}
          <div style={{ background: 'var(--color-background-primary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 'var(--border-radius-lg)', padding: '16px 20px' }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)', margin: '0 0 10px' }}>{t('schedule.title')}</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 16px', fontSize: 13 }}>
              {TAX_BRACKETS.map((b, i) => {
                const active = result.annualTaxableIncome > b.min
                return (
                  <div key={i} style={{ display: 'contents' }}>
                    <span style={{ color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
                      {b.max === Infinity ? t('schedule.over', { amount: fmtEgp(b.min, cur) }) : t('schedule.range', { from: fmtEgp(b.min, cur), to: b.max.toLocaleString('en-US') })}
                    </span>
                    <span style={{ fontWeight: active ? 500 : 400, color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', textAlign: 'end' }}>
                      {pct(b.rate)}
                    </span>
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 11, color: 'var(--color-text-tertiary)', margin: '12px 0 0' }}>
              {t('schedule.note')}
            </p>
          </div>

          <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0 }}>
            {t('notes.disclaimer')}
          </p>
        </div>
      )}
    </div>
    </CurrencyCtx.Provider>
  )
}
