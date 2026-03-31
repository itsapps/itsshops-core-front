import { describe, it, expect } from 'vitest'
import { findTaxRate, extractVat, extractNet, buildVatBreakdown } from '../lib/tax'
import type { SanityTaxRuleResult } from '../types/checkout'

const rules: SanityTaxRuleResult[] = [
  { taxCategoryCode: 'standard', rate: 20, exciseDuty: null },
  { taxCategoryCode: 'food', rate: 10, exciseDuty: null },
  { taxCategoryCode: 'books', rate: 10, exciseDuty: null },
  { taxCategoryCode: 'exempt', rate: 0, exciseDuty: null },
]

describe('findTaxRate', () => {
  it('finds rate for matching category', () => {
    expect(findTaxRate(rules, 'standard')).toBe(20)
    expect(findTaxRate(rules, 'food')).toBe(10)
  })

  it('returns 0 for unknown category', () => {
    expect(findTaxRate(rules, 'unknown')).toBe(0)
  })

  it('returns 0 for null category', () => {
    expect(findTaxRate(rules, null)).toBe(0)
  })

  it('returns 0 for empty rules', () => {
    expect(findTaxRate([], 'standard')).toBe(0)
  })
})

describe('extractVat', () => {
  it('extracts 20% VAT from 1200 cents (= 200)', () => {
    // 1200 / 1.20 = 1000 net → vat = 200
    expect(extractVat(1200, 20)).toBe(200)
  })

  it('extracts 10% VAT from 1100 cents (= 100)', () => {
    // 1100 / 1.10 = 1000 net → vat = 100
    expect(extractVat(1100, 10)).toBe(100)
  })

  it('handles rounding correctly', () => {
    // 999 cents at 20%: 999 / 1.20 = 832.5 → net = 833, vat = 166
    expect(extractVat(999, 20)).toBe(167) // 999 - 832 = 167
  })

  it('returns 0 for 0% rate', () => {
    expect(extractVat(1000, 0)).toBe(0)
  })

  it('returns 0 for negative rate', () => {
    expect(extractVat(1000, -5)).toBe(0)
  })
})

describe('extractNet', () => {
  it('extracts net from gross at 20%', () => {
    expect(extractNet(1200, 20)).toBe(1000)
  })

  it('returns gross when rate is 0', () => {
    expect(extractNet(1000, 0)).toBe(1000)
  })
})

describe('buildVatBreakdown', () => {
  it('groups items by rate', () => {
    const result = buildVatBreakdown([
      { grossTotal: 1200, vatRate: 20 },
      { grossTotal: 600, vatRate: 20 },
      { grossTotal: 1100, vatRate: 10 },
    ])
    expect(result).toHaveLength(2)
    // 10% group
    expect(result[0].rate).toBe(10)
    expect(result[0].vat).toBe(100) // 1100 / 1.10 = 1000, vat = 100
    expect(result[0].net).toBe(1000)
    // 20% group
    expect(result[1].rate).toBe(20)
    expect(result[1].vat).toBe(300) // 1800 / 1.20 = 1500, vat = 300
    expect(result[1].net).toBe(1500)
  })

  it('handles 0% rate items', () => {
    const result = buildVatBreakdown([
      { grossTotal: 500, vatRate: 0 },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].rate).toBe(0)
    expect(result[0].vat).toBe(0)
    expect(result[0].net).toBe(500)
    expect(result[0].label).toBe('VAT exempt')
  })

  it('returns sorted by rate ascending', () => {
    const result = buildVatBreakdown([
      { grossTotal: 100, vatRate: 20 },
      { grossTotal: 100, vatRate: 10 },
      { grossTotal: 100, vatRate: 0 },
    ])
    expect(result.map(r => r.rate)).toEqual([0, 10, 20])
  })

  it('returns empty array for empty input', () => {
    expect(buildVatBreakdown([])).toEqual([])
  })
})
