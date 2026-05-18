'use client'

import { useState } from 'react'

type Props = { locale: string }

// Approximate nisab values — in production, fetch live gold/silver prices
const NISAB_GOLD_USD  = 5600  // ~85g gold at ~$66/g
const NISAB_SILVER_USD = 530  // ~595g silver at ~$0.89/g

const CURRENCIES = [
  { value: 'AED', label: 'AED — UAE Dirham',          rate: 3.67 },
  { value: 'SAR', label: 'SAR — Saudi Riyal',         rate: 3.75 },
  { value: 'QAR', label: 'QAR — Qatari Riyal',        rate: 3.64 },
  { value: 'KWD', label: 'KWD — Kuwaiti Dinar',       rate: 0.31 },
  { value: 'BHD', label: 'BHD — Bahraini Dinar',      rate: 0.38 },
  { value: 'OMR', label: 'OMR — Omani Rial',          rate: 0.38 },
  { value: 'EGP', label: 'EGP — Egyptian Pound',      rate: 48.5 },
  { value: 'USD', label: 'USD — US Dollar',            rate: 1    },
]

function fmt(n: number, currency: string) {
  return `${currency} ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function ZakatCalculator({ locale }: Props) {
  const isAr = locale === 'ar'

  const [currency, setCurrency] = useState('AED')
  const [nisabType, setNisabType] = useState<'gold' | 'silver'>('silver')

  // Asset fields
  const [cash, setCash] = useState('')
  const [savings, setSavings] = useState('')
  const [gold, setGold] = useState('')
  const [silver, setSilver] = useState('')
  const [investments, setInvestments] = useState('')
  const [businessAssets, setBusinessAssets] = useState('')
  const [receivables, setReceivables] = useState('')
  const [liabilities, setLiabilities] = useState('')

  const [result, setResult] = useState<{
    totalWealth: number
    nisab: number
    zakatableWealth: number
    zakat: number
    currency: string
    meetsNisab: boolean
  } | null>(null)

  function calculate() {
    const selectedCurrency = CURRENCIES.find(c => c.value === currency)!
    const rate = selectedCurrency.rate

    // Nisab in selected currency
    const nisabUSD = nisabType === 'gold' ? NISAB_GOLD_USD : NISAB_SILVER_USD
    const nisab = nisabUSD * rate

    const total =
      (parseFloat(cash) || 0) +
      (parseFloat(savings) || 0) +
      (parseFloat(gold) || 0) +
      (parseFloat(silver) || 0) +
      (parseFloat(investments) || 0) +
      (parseFloat(businessAssets) || 0) +
      (parseFloat(receivables) || 0)

    const zakatableWealth = Math.max(0, total - (parseFloat(liabilities) || 0))
    const meetsNisab = zakatableWealth >= nisab
    const zakat = meetsNisab ? zakatableWealth * 0.025 : 0

    setResult({ totalWealth: total, nisab, zakatableWealth, zakat, currency, meetsNisab })
  }

  function reset() {
    setCash(''); setSavings(''); setGold(''); setSilver('')
    setInvestments(''); setBusinessAssets(''); setReceivables(''); setLiabilities('')
    setResult(null)
  }

  const L = isAr
    ? {
        currency: 'العملة',
        nisabType: 'نوع النصاب',
        gold: 'نصاب الذهب (~85 جم)',
        silver: 'نصاب الفضة (~595 جم) — الأشمل',
        assets: 'أصولك الزكوية',
        cash: 'النقد في اليد',
        savings: 'المدخرات والودائع البنكية',
        goldVal: 'قيمة الذهب',
        silverVal: 'قيمة الفضة',
        investments: 'الأسهم والاستثمارات',
        business: 'أصول الأعمال والمخزون',
        receivables: 'الديون المستحقة لك',
        liabilities: 'الديون عليك (مطروحة)',
        calculate: 'احسب الزكاة',
        reset: 'إعادة تعيين',
        totalWealth: 'إجمالي الثروة',
        nisab: 'قيمة النصاب',
        zakatableWealth: 'الثروة الزكوية الصافية',
        zakat: 'الزكاة الواجبة (2.5%)',
        belowNisab: 'ثروتك دون النصاب — لا تجب عليك الزكاة.',
        enterAmount: 'أدخل المبلغ',
        optional: 'اختياري',
      }
    : {
        currency: 'Currency',
        nisabType: 'Nisab Type',
        gold: 'Gold Nisab (~85g)',
        silver: 'Silver Nisab (~595g) — Recommended',
        assets: 'Your Zakatable Assets',
        cash: 'Cash on Hand',
        savings: 'Bank Savings & Deposits',
        goldVal: 'Gold Value',
        silverVal: 'Silver Value',
        investments: 'Stocks & Investments',
        business: 'Business Assets & Inventory',
        receivables: 'Money Owed to You',
        liabilities: 'Debts Owed by You (deducted)',
        calculate: 'Calculate Zakat',
        reset: 'Reset',
        totalWealth: 'Total Wealth',
        nisab: 'Nisab Threshold',
        zakatableWealth: 'Zakatable Wealth (net)',
        zakat: 'Zakat Due (2.5%)',
        belowNisab: 'Your wealth is below Nisab — no Zakat is due.',
        enterAmount: 'Enter amount',
        optional: 'Optional',
      }

  const inputClass = "w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-gray-900 placeholder:text-gray-300"

  return (
    <div className="space-y-6">
      {/* Settings row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.currency}</label>
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className={inputClass + ' bg-white'}
          >
            {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">{L.nisabType}</label>
          <div className="flex rounded-xl overflow-hidden border border-gray-200">
            {(['silver', 'gold'] as const).map(type => (
              <button
                key={type}
                onClick={() => setNisabType(type)}
                className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                  nisabType === type
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {type === 'silver' ? L.silver.split(' ')[0] : L.gold.split(' ')[0]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {nisabType === 'silver' ? L.silver : L.gold}
          </p>
        </div>
      </div>

      {/* Asset inputs */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
          {L.assets}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: L.cash,        value: cash,         set: setCash },
            { label: L.savings,     value: savings,      set: setSavings },
            { label: L.goldVal,     value: gold,         set: setGold },
            { label: L.silverVal,   value: silver,       set: setSilver },
            { label: L.investments, value: investments,  set: setInvestments },
            { label: L.business,    value: businessAssets, set: setBusinessAssets },
            { label: L.receivables, value: receivables,  set: setReceivables },
          ].map(({ label, value, set }) => (
            <div key={label}>
              <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
              <input
                type="number"
                min="0"
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={L.enterAmount}
                className={inputClass}
              />
            </div>
          ))}

          {/* Liabilities — negative */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              {L.liabilities}
            </label>
            <input
              type="number"
              min="0"
              value={liabilities}
              onChange={e => setLiabilities(e.target.value)}
              placeholder={L.enterAmount}
              className={inputClass + ' border-red-100 focus:ring-red-400'}
            />
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={calculate}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {L.calculate}
        </button>
        <button
          onClick={reset}
          className="px-6 py-3 border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold rounded-xl transition-colors"
        >
          {L.reset}
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
          {result.meetsNisab ? (
            <>
              {/* Hero zakat amount */}
              <div className="bg-emerald-600 rounded-xl p-4 text-white">
                <div className="text-sm opacity-80 mb-1">{L.zakat}</div>
                <div className="text-3xl font-black">{fmt(result.zakat, result.currency)}</div>
              </div>
              {/* Breakdown */}
              <div className="space-y-2.5 text-sm">
                {[
                  { label: L.totalWealth,    value: fmt(result.totalWealth, result.currency) },
                  { label: L.nisab,          value: fmt(result.nisab, result.currency) },
                  { label: L.zakatableWealth,value: fmt(result.zakatableWealth, result.currency) },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-4">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900">{value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="text-3xl mb-2">📊</div>
              <p className="font-semibold text-gray-700">{L.belowNisab}</p>
              <p className="text-sm text-gray-400 mt-1">
                {isAr ? 'النصاب:' : 'Nisab threshold:'} {fmt(result.nisab, result.currency)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
