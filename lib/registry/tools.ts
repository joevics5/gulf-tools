export type ToolSchema =
  | 'calculator'
  | 'converter'
  | 'generator'
  | 'checker'
  | 'estimator'
  | 'planner'

export type Tool = {
  slug: string
  category: string
  schema: ToolSchema
  featured: boolean
  countries: string[]
  relatedTools: string[]
  relatedArticles: string[]
  hasCountryVariants: boolean
  requiresApi: boolean
  launchDate: string
}

export const TOOLS: Tool[] = [

  // ─── FINANCE ──────────────────────────────────────────────
  {
    slug: 'salary-calculator',
    category: 'finance',
    schema: 'calculator',
    featured: true,
    countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt'],
    relatedTools: ['loan-emi-calculator', 'gratuity-calculator', 'savings-goal-calculator'],
    relatedArticles: ['how-to-calculate-salary-uae', 'salary-guide-gulf-2024'],
    hasCountryVariants: true,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
{
  slug: 'loan-emi-calculator',
  category: 'finance',
  schema: 'calculator',
  featured: false,
  countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt'],
  relatedTools: ['salary-calculator', 'saudi-loan-calculator', 'profit-margin-calculator'],
  relatedArticles: [],
  hasCountryVariants: true,
  requiresApi: false,
  launchDate: '2025-01-01',
},
  {
    slug: 'compound-interest-calculator',
    category: 'finance',
    schema: 'calculator',
    featured: false,
    countries: ['uae', 'saudi', 'qatar', 'kuwait'],
    relatedTools: ['savings-goal-calculator', 'retirement-planner'],
    relatedArticles: ['power-of-compound-interest'],
    hasCountryVariants: false,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
{
  slug: 'savings-goal-calculator',
  category: 'finance',
  schema: 'planner',
  featured: false,
  countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman'],
  relatedTools: ['compound-interest-calculator', 'salary-calculator'],
  relatedArticles: ['how-to-save-money-gulf'],
  hasCountryVariants: false,
  requiresApi: false,
  launchDate: '2025-01-01',
},

// ─── MORTGAGE  ─────────────────────────────────────────

{
  slug: 'uae-mortgage-calculator',
  category: 'finance',
  schema: 'calculator',
  featured: true,
  countries: ['uae'],
  relatedTools: ['salary-calculator', 'loan-emi-calculator', 'profit-margin-calculator'],
  relatedArticles: [],
  hasCountryVariants: false,
  requiresApi: false,
  launchDate: '2025-01-01',
},
{
  slug: 'dubai-mortgage-calculator-non-residents',
  category: 'finance',
  schema: 'calculator',
  featured: true,
  countries: ['uae'],
  relatedTools: ['uae-mortgage-calculator', 'salary-calculator', 'loan-emi-calculator'],
  relatedArticles: [],
  hasCountryVariants: false,
  requiresApi: false,
  launchDate: '2025-01-01',
},
{
  slug: 'home-loan-calculator-dubai',
  category: 'finance',
  schema: 'calculator',
  featured: true,
  countries: ['uae'],
  relatedTools: ['uae-mortgage-calculator', 'dubai-mortgage-calculator-non-residents', 'salary-calculator'],
  relatedArticles: [],
  hasCountryVariants: false,
  requiresApi: false,
  launchDate: '2025-01-01',
},
  
// ─── HR & PAYROLL ─────────────────────────────────────────
  {
    slug: 'gratuity-calculator',
    category: 'hr-payroll',
    schema: 'calculator',
    featured: true,
    countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman'],
    relatedTools: ['salary-calculator', 'notice-period-calculator', 'leave-encashment-calculator'],
    relatedArticles: ['uae-gratuity-law-explained', 'end-of-service-guide-gulf'],
    hasCountryVariants: true,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
  {
    slug: 'leave-encashment-calculator',
    category: 'hr-payroll',
    schema: 'calculator',
    featured: false,
    countries: ['uae', 'saudi', 'qatar'],
    relatedTools: ['gratuity-calculator', 'salary-calculator'],
    relatedArticles: ['annual-leave-uae-law'],
    hasCountryVariants: true,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
  {
    slug: 'notice-period-calculator',
    category: 'hr-payroll',
    schema: 'calculator',
    featured: false,
    countries: ['uae', 'saudi', 'qatar', 'kuwait'],
    relatedTools: ['gratuity-calculator', 'salary-calculator'],
    relatedArticles: ['notice-period-uae-labour-law'],
    hasCountryVariants: true,
    requiresApi: false,
    launchDate: '2025-01-01',
  },

  // ─── ISLAMIC TOOLS ────────────────────────────────────────
  {
    slug: 'zakat-calculator',
    category: 'islamic-tools',
    schema: 'calculator',
    featured: true,
    countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt'],
    relatedTools: ['hijri-gregorian-converter', 'prayer-time-calculator'],
    relatedArticles: ['how-to-calculate-zakat', 'nisab-2024-gold-silver'],
    hasCountryVariants: false,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
  {
    slug: 'hijri-gregorian-converter',
    category: 'islamic-tools',
    schema: 'converter',
    featured: true,
    countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt'],
    relatedTools: ['zakat-calculator', 'prayer-time-calculator'],
    relatedArticles: ['hijri-calendar-guide'],
    hasCountryVariants: false,
    requiresApi: false,
    launchDate: '2025-01-01',
  },

  // ─── TAX & VAT ────────────────────────────────────────────
  {
    slug: 'uae-vat-calculator',
    category: 'tax-vat',
    schema: 'calculator',
    featured: true,
    countries: ['uae'],
    relatedTools: ['ksa-vat-calculator', 'invoice-generator'],
    relatedArticles: ['uae-vat-guide-2024', 'vat-registration-uae'],
    hasCountryVariants: false,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
  {
    slug: 'ksa-vat-calculator',
    category: 'tax-vat',
    schema: 'calculator',
    featured: false,
    countries: ['saudi'],
    relatedTools: ['uae-vat-calculator', 'invoice-generator'],
    relatedArticles: ['ksa-vat-guide-2024'],
    hasCountryVariants: false,
    requiresApi: false,
    launchDate: '2025-01-01',
  },

  // ─── BUSINESS ─────────────────────────────────────────────
  {
    slug: 'invoice-generator',
    category: 'business',
    schema: 'generator',
    featured: true,
    countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt'],
    relatedTools: ['uae-vat-calculator', 'profit-margin-calculator'],
    relatedArticles: ['how-to-invoice-uae', 'freelance-invoicing-gulf'],
    hasCountryVariants: false,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
  {
    slug: 'profit-margin-calculator',
    category: 'business',
    schema: 'calculator',
    featured: false,
    countries: ['uae', 'saudi', 'qatar', 'kuwait', 'bahrain', 'oman', 'egypt'],
    relatedTools: ['invoice-generator', 'break-even-calculator'],
    relatedArticles: ['profit-margin-guide-gulf'],
    hasCountryVariants: false,
    requiresApi: false,
    launchDate: '2025-01-01',
  },
]

// ─── Utility Functions ─────────────────────────────────────────────────────────

export function getToolBySlug(slug: string): Tool | undefined {
  return TOOLS.find(t => t.slug === slug)
}

export function getToolsByCategory(categorySlug: string): Tool[] {
  return TOOLS.filter(t => t.category === categorySlug)
}

export function getFeaturedTools(): Tool[] {
  return TOOLS.filter(t => t.featured)
}

export function getToolsByCountry(country: string): Tool[] {
  return TOOLS.filter(t => t.countries.includes(country))
}

export function getRelatedTools(tool: Tool): Tool[] {
  return tool.relatedTools
    .map(slug => getToolBySlug(slug))
    .filter(Boolean) as Tool[]
}