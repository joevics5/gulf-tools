'use client'

import { useState, useEffect, useMemo } from 'react'
import { FALLBACK_GOLD_USD_PER_GRAM, FALLBACK_SILVER_USD_PER_GRAM } from '@/lib/constants/metalPrices'
import { useTranslations } from 'next-intl'
import { isRtl } from '@/lib/i18n/locales'

type Props = { locale: string }

// ── Constants ────────────────────────────────────────────────────────────────
const NISAB_GOLD_GRAMS   = 87.48
const NISAB_SILVER_GRAMS = 612.36
const ZAKAT_RATE         = 0.025
const TROY_OZ_TO_GRAM    = 31.1035

const CURRENCIES = [
  { value: 'AED', label: 'UAE — AED',         flag: '🇦🇪' },
  { value: 'SAR', label: 'Saudi Arabia — SAR', flag: '🇸🇦' },
  { value: 'QAR', label: 'Qatar — QAR',        flag: '🇶🇦' },
  { value: 'KWD', label: 'Kuwait — KWD',       flag: '🇰🇼' },
  { value: 'BHD', label: 'Bahrain — BHD',      flag: '🇧🇭' },
  { value: 'OMR', label: 'Oman — OMR',         flag: '🇴🇲' },
  { value: 'EGP', label: 'Egypt — EGP',        flag: '🇪🇬' },
  { value: 'USD', label: 'USD',                flag: '🌍' },
  { value: 'GBP', label: 'GBP',                flag: '🇬🇧' },
  { value: 'EUR', label: 'EUR',                flag: '🇪🇺' },
]

type NisabBasis = 'silver' | 'gold' | 'custom'

interface PriceData {
  goldPerGram: number   // USD
  silverPerGram: number // USD
  rates: Record<string, number>
  live: boolean
  updatedAt: string
}

async function fetchPrices(): Promise<PriceData> {
  try {
    const [metalRes, fxRes] = await Promise.all([
      fetch('https://api.metals.live/v1/spot/gold,silver', { cache: 'no-store' }),
      fetch('https://api.frankfurter.app/latest?from=USD&to=AED,SAR,QAR,KWD,BHD,OMR,EGP,GBP,EUR'),
    ])
    const metalData = await metalRes.json()
    const fxData    = await fxRes.json()
    const goldOz    = metalData.find((d: { metal: string; price: number }) => d.metal === 'gold')?.price   ?? FALLBACK_GOLD_USD_PER_GRAM * TROY_OZ_TO_GRAM
    const silverOz  = metalData.find((d: { metal: string; price: number }) => d.metal === 'silver')?.price ?? FALLBACK_SILVER_USD_PER_GRAM * TROY_OZ_TO_GRAM
    return {
      goldPerGram:   goldOz   / TROY_OZ_TO_GRAM,
      silverPerGram: silverOz / TROY_OZ_TO_GRAM,
      rates: { USD: 1, ...fxData.rates },
      live: true,
      updatedAt: new Date().toLocaleTimeString(),
    }
  } catch {
    return {
      goldPerGram:   FALLBACK_GOLD_USD_PER_GRAM,
      silverPerGram: FALLBACK_SILVER_USD_PER_GRAM,
      rates: { USD: 1, AED: 3.67, SAR: 3.75, QAR: 3.64, KWD: 0.307, BHD: 0.376, OMR: 0.385, EGP: 48.5, GBP: 0.79, EUR: 0.92 },
      live: false,
      updatedAt: 'cached',
    }
  }
}

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

function num(s: string): number { return parseFloat(s) || 0 }

// ── Step types ───────────────────────────────────────────────────────────────
type Step = 'setup' | 'assets' | 'debts' | 'result'

// ── Component ────────────────────────────────────────────────────────────────
export default function CashZakatCalculator({ locale }: Props) {
  const tr = useTranslations('tool')

  // ── Global settings ────────────────────────────────────────────────────────
  const [step,          setStep]          = useState<Step>('setup')
  const [currency,      setCurrency]      = useState('AED')
  const [nisabBasis,    setNisabBasis]    = useState<NisabBasis>('silver')
  const [customNisab,   setCustomNisab]   = useState('')
  const [hawlConfirmed, setHawlConfirmed] = useState(false)

  // ── Assets ─────────────────────────────────────────────────────────────────
  const [cashInHand,     setCashInHand]     = useState('')
  const [currentAccount, setCurrentAccount] = useState('')
  const [savingsAccount, setSavingsAccount] = useState('')
  const [fixedDeposits,  setFixedDeposits]  = useState('')
  const [moneyMarket,    setMoneyMarket]    = useState('')
  const [receivables,    setReceivables]    = useState('')
  const [otherLiquid,    setOtherLiquid]    = useState('')

  // ── Debts ──────────────────────────────────────────────────────────────────
  const [creditCards,   setCreditCards]   = useState('')
  const [loansImminent, setLoansImminent] = useState('')
  const [overdueBills,  setOverdueBills]  = useState('')
  const [otherDebts,    setOtherDebts]    = useState('')

  // ── Prices ─────────────────────────────────────────────────────────────────
  const [prices,  setPrices]  = useState<PriceData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPrices().then(p => { setPrices(p); setLoading(false) })
  }, [])

  // ── Derived calculations ───────────────────────────────────────────────────
  const rate = prices?.rates[currency] ?? 1

  const nisabValue = useMemo(() => {
    if (!prices) return 0
    if (nisabBasis === 'silver') return NISAB_SILVER_GRAMS * prices.silverPerGram * rate
    if (nisabBasis === 'gold')   return NISAB_GOLD_GRAMS   * prices.goldPerGram   * rate
    return num(customNisab)
  }, [prices, nisabBasis, customNisab, rate, currency])

  const totalAssets = useMemo(() =>
    num(cashInHand) + num(currentAccount) + num(savingsAccount) +
    num(fixedDeposits) + num(moneyMarket) + num(receivables) + num(otherLiquid),
    [cashInHand, currentAccount, savingsAccount, fixedDeposits, moneyMarket, receivables, otherLiquid]
  )

  const totalDebts = useMemo(() =>
    num(creditCards) + num(loansImminent) + num(overdueBills) + num(otherDebts),
    [creditCards, loansImminent, overdueBills, otherDebts]
  )

  const netZakatable  = Math.max(0, totalAssets - totalDebts)
  const eligible      = hawlConfirmed && netZakatable >= nisabValue && nisabValue > 0
  const zakatDue      = eligible ? netZakatable * ZAKAT_RATE : 0
  const progressPct   = nisabValue > 0 ? Math.min(100, (netZakatable / nisabValue) * 100) : 0

  function reset() {
    setStep('setup')
    setCashInHand(''); setCurrentAccount(''); setSavingsAccount('')
    setFixedDeposits(''); setMoneyMarket(''); setReceivables(''); setOtherLiquid('')
    setCreditCards(''); setLoansImminent(''); setOverdueBills(''); setOtherDebts('')
    setHawlConfirmed(false); setNisabBasis('silver'); setCustomNisab('')
  }

  // ── Labels ─────────────────────────────────────────────────────────────────
  const L = {
    title: tr('L.title'),
    subtitle: tr('L.subtitle'),
    step0: tr('L.step0'),
    step1: tr('L.step1'),
    step2: tr('L.step2'),
    step3: tr('L.step3'),
    currency: tr('L.currency'),
    nisabBasis: tr('L.nisabBasis'),
    silver: tr('L.silver'),
    gold: tr('L.gold'),
    custom: tr('L.custom'),
    customNisab: tr('L.customNisab'),
    currentNisab: tr('L.currentNisab'),
    liveRate: tr('L.liveRate'),
    cachedRate: tr('L.cachedRate'),
    hawl: tr('L.hawl'),
    assetsTitle: tr('L.assetsTitle'),
    cashInHand: tr('L.cashInHand'),
    currentAccount: tr('L.currentAccount'),
    savingsAccount: tr('L.savingsAccount'),
    fixedDeposits: tr('L.fixedDeposits'),
    moneyMarket: tr('L.moneyMarket'),
    receivables: tr('L.receivables'),
    otherLiquid: tr('L.otherLiquid'),
    totalAssets: tr('L.totalAssets'),
    debtsTitle: tr('L.debtsTitle'),
    debtsNote: tr('L.debtsNote'),
    creditCards: tr('L.creditCards'),
    loansImminent: tr('L.loansImminent'),
    overdueBills: tr('L.overdueBills'),
    otherDebts: tr('L.otherDebts'),
    totalDebts: tr('L.totalDebts'),
    resultTitle: tr('L.resultTitle'),
    zakatDue: tr('L.zakatDue'),
    notEligible: tr('L.notEligible'),
    notEligibleDesc: tr('L.notEligibleDesc'),
    netZakatable: tr('L.netZakatable'),
    nisabLabel: tr('L.nisabLabel'),
    progressLabel: tr('L.progressLabel'),
    belowNisab: tr('L.belowNisab'),
    noHawl: tr('L.noHawl'),
    disclaimer: tr('L.disclaimer'),
    next: tr('L.next'),
    back: tr('L.back'),
    calculate: tr('L.calculate'),
    reset: tr('L.reset'),
    enterAmount: tr('L.enterAmount'),
    assetsTip: tr('L.assetsTip'),
    receivablesTip: tr('L.receivablesTip'),
    debtsTip: tr('L.debtsTip'),
  }

  const STEPS: Step[] = ['setup', 'assets', 'debts', 'result']
  const stepIdx = STEPS.indexOf(step)

  // ── Shared input style ─────────────────────────────────────────────────────
  const inputCls = 'w-full pl-14 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white'
  const inputCls2 = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white'

  function AmountField({ label, value, onChange, tip }: { label: string; value: string; onChange: (v: string) => void; tip?: string }) {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
        {tip && <p className="text-xs text-gray-500 mb-1">{tip}</p>}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">{currency}</span>
          <input
            type="number" min="0" value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={L.enterAmount}
            className={inputCls}
          />
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5" dir={isRtl(locale) ? 'rtl' : 'ltr'}>

      {/* Disclaimer */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2 items-start">
        <span className="text-amber-500 shrink-0 mt-0.5">⚠️</span>
        <p className="text-xs text-amber-800">{L.disclaimer}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 flex-1">
            <button
              onClick={() => i < stepIdx && setStep(s)}
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors
                ${i < stepIdx ? 'bg-emerald-600 text-white cursor-pointer hover:bg-emerald-700' :
                  i === stepIdx ? 'bg-emerald-600 text-white' :
                  'bg-gray-100 text-gray-500'}`}
            >
              {i < stepIdx ? '✓' : i + 1}
            </button>
            <span className={`text-xs font-medium hidden sm:block ${i === stepIdx ? 'text-emerald-700' : 'text-gray-500'}`}>
              {[L.step0, L.step1, L.step2, L.step3][i]}
            </span>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 ${i < stepIdx ? 'bg-emerald-400' : 'bg-gray-100'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Setup ───────────────────────────────────────────────────── */}
      {step === 'setup' && (
        <div className="space-y-4">
          {/* Currency */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.currency}</label>
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls2}>
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>{c.flag} {c.label}</option>
              ))}
            </select>
          </div>

          {/* Nisab basis */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.nisabBasis}</label>
            <div className="grid grid-cols-3 rounded-xl border border-gray-200 overflow-hidden">
              {(['silver', 'gold', 'custom'] as NisabBasis[]).map(b => (
                <button
                  key={b}
                  onClick={() => setNisabBasis(b)}
                  className={`py-2.5 text-xs font-semibold transition-colors ${nisabBasis === b ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  {b === 'silver' ? L.silver : b === 'gold' ? L.gold : L.custom}
                </button>
              ))}
            </div>
          </div>

          {/* Custom nisab */}
          {nisabBasis === 'custom' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{L.customNisab}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">{currency}</span>
                <input type="number" min="0" value={customNisab} onChange={e => setCustomNisab(e.target.value)}
                  placeholder={L.enterAmount} className={inputCls} />
              </div>
            </div>
          )}

          {/* Live nisab display */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-xs text-emerald-600 font-medium">{L.currentNisab}</div>
              <div className="text-xl font-black text-emerald-800">
                {loading ? '…' : fmt(nisabValue, currency)}
              </div>
              <div className="text-xs text-emerald-500 mt-0.5">
                {nisabBasis === 'silver' ? `${NISAB_SILVER_GRAMS}g silver` :
                 nisabBasis === 'gold'   ? `${NISAB_GOLD_GRAMS}g gold` : 'custom'}
              </div>
            </div>
            <span className="text-xs text-emerald-400">{prices?.live ? L.liveRate : L.cachedRate}</span>
          </div>

          {/* Hawl */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={hawlConfirmed} onChange={e => setHawlConfirmed(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-emerald-600 rounded shrink-0" />
            <span className="text-sm text-gray-700">{L.hawl}</span>
          </label>

          <button onClick={() => setStep('assets')}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors">
            {L.next} →
          </button>
        </div>
      )}

      {/* ── STEP 2: Assets ──────────────────────────────────────────────────── */}
      {step === 'assets' && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-0.5">{L.assetsTitle}</h3>
            <p className="text-xs text-gray-500 mb-3">{L.assetsTip}</p>
          </div>

          <AmountField label={L.cashInHand}     value={cashInHand}     onChange={setCashInHand} />
          <AmountField label={L.currentAccount} value={currentAccount} onChange={setCurrentAccount} />
          <AmountField label={L.savingsAccount} value={savingsAccount} onChange={setSavingsAccount} />
          <AmountField label={L.fixedDeposits}  value={fixedDeposits}  onChange={setFixedDeposits} />
          <AmountField label={L.moneyMarket}    value={moneyMarket}    onChange={setMoneyMarket} />
          <AmountField label={L.receivables}    value={receivables}    onChange={setReceivables} tip={L.receivablesTip} />
          <AmountField label={L.otherLiquid}    value={otherLiquid}    onChange={setOtherLiquid} />

          {/* Running total */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-emerald-800">{L.totalAssets}</span>
            <span className="text-lg font-black text-emerald-700">{fmt(totalAssets, currency)}</span>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('setup')}
              className="px-5 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
              ← {L.back}
            </button>
            <button onClick={() => setStep('debts')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors">
              {L.next} →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Debts ───────────────────────────────────────────────────── */}
      {step === 'debts' && (
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-0.5">{L.debtsTitle}</h3>
            <p className="text-xs text-gray-500 mb-3">{L.debtsTip}</p>
          </div>

          <AmountField label={L.creditCards}   value={creditCards}   onChange={setCreditCards} />
          <AmountField label={L.loansImminent} value={loansImminent} onChange={setLoansImminent} />
          <AmountField label={L.overdueBills}  value={overdueBills}  onChange={setOverdueBills} />
          <AmountField label={L.otherDebts}    value={otherDebts}    onChange={setOtherDebts} />

          {/* Running total */}
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-red-700">{L.totalDebts}</span>
            <span className="text-lg font-black text-red-600">− {fmt(totalDebts, currency)}</span>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('assets')}
              className="px-5 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
              ← {L.back}
            </button>
            <button onClick={() => setStep('result')}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors">
              {L.calculate}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Result ──────────────────────────────────────────────────── */}
      {step === 'result' && (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900">{L.resultTitle}</h3>

          {/* Hero */}
          {eligible ? (
            <div className="bg-emerald-600 rounded-xl p-5 text-white">
              <div className="text-sm opacity-80 mb-1">{L.zakatDue}</div>
              <div className="text-4xl font-black">{fmt(zakatDue, currency)}</div>
              <div className="text-sm opacity-70 mt-1">2.5% × {fmt(netZakatable, currency)}</div>
            </div>
          ) : (
            <div className="bg-gray-100 rounded-xl p-5 text-gray-700">
              <div className="text-xl font-bold">{L.notEligible}</div>
              <div className="text-sm mt-1 text-gray-500">{L.notEligibleDesc}</div>
              {!hawlConfirmed && <div className="text-xs mt-2 text-gray-500">→ {L.noHawl}</div>}
              {netZakatable < nisabValue && nisabValue > 0 && (
                <div className="text-xs mt-1 text-gray-500">→ {L.belowNisab}: {fmt(netZakatable, currency)} / {fmt(nisabValue, currency)}</div>
              )}
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1.5">
              <span>{L.progressLabel}</span>
              <span className="font-semibold">{fmt(netZakatable, currency)} / {fmt(nisabValue, currency)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${progressPct >= 100 ? 'bg-emerald-500' : 'bg-emerald-300'}`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Full breakdown */}
          <div className="bg-gray-50 rounded-2xl p-5 space-y-3 border border-gray-100">
            {/* Assets */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{L.assetsTitle}</p>
            {[
              [L.cashInHand,     cashInHand],
              [L.currentAccount, currentAccount],
              [L.savingsAccount, savingsAccount],
              [L.fixedDeposits,  fixedDeposits],
              [L.moneyMarket,    moneyMarket],
              [L.receivables,    receivables],
              [L.otherLiquid,    otherLiquid],
            ].filter(([, v]) => num(v as string) > 0).map(([label, value]) => (
              <BRow key={label as string} label={label as string} value={fmt(num(value as string), currency)} />
            ))}
            <BRow label={L.totalAssets} value={fmt(totalAssets, currency)} highlight />

            <div className="border-t border-gray-200" />

            {/* Debts */}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{L.debtsTitle}</p>
            {[
              [L.creditCards,   creditCards],
              [L.loansImminent, loansImminent],
              [L.overdueBills,  overdueBills],
              [L.otherDebts,    otherDebts],
            ].filter(([, v]) => num(v as string) > 0).map(([label, value]) => (
              <BRow key={label as string} label={label as string} value={`− ${fmt(num(value as string), currency)}`} negative />
            ))}
            {totalDebts === 0 && <p className="text-xs text-gray-500 italic">—</p>}
            <BRow label={L.totalDebts} value={`− ${fmt(totalDebts, currency)}`} negative />

            <div className="border-t border-gray-200" />

            {/* Net + nisab */}
            <BRow label={L.netZakatable} value={fmt(netZakatable, currency)} highlight />
            <BRow label={L.nisabLabel}   value={fmt(nisabValue,   currency)} />
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-500">{L.disclaimer}</p>

          {/* Actions */}
          <div className="flex gap-3">
            <button onClick={() => setStep('debts')}
              className="px-5 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
              ← {L.back}
            </button>
            <button onClick={reset}
              className="flex-1 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors">
              {L.reset}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function BRow({ label, value, negative = false, highlight = false }: { label: string; value: string; negative?: boolean; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-gray-600">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-emerald-600' : negative ? 'text-red-500' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  )
}
