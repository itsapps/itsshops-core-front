import type { DiscountInput, DiscountLine, SelectorLine } from '../discounts/types'

export function sel(overrides: Partial<SelectorLine> = {}): SelectorLine {
  return {
    variantId: 'v1',
    productId: 'p1',
    kind: 'wine',
    categoryIds: [],
    manufacturerIds: [],
    hasCompareAtPrice: false,
    ...overrides,
  }
}

export function line(unitPrice: number, quantity = 1, selector: Partial<SelectorLine> = {}, childPrices?: number[]): DiscountLine {
  return { selector: sel(selector), unitPrice, quantity, childPrices: childPrices ?? null }
}

export function discount(overrides: Partial<DiscountInput> = {}): DiscountInput {
  return {
    _id: 'd1',
    title: 'Aktion',
    trigger: 'code',
    code: 'SUMMER25',
    enabled: true,
    target: 'order',
    valueType: 'percent',
    value: 10,
    appliesTo: null,
    combinesWith: { shipping: true },
    minSubtotalBasis: 'wholeCart',
    redemptionCount: 0,
    ...overrides,
  }
}

/** A migrated product free-shipping rule: automatic, cart contains a bundle. */
export function bundleFreeShipping(overrides: Partial<DiscountInput> = {}): DiscountInput {
  return discount({
    _id: 'auto-ship',
    title: 'Versandkostenfrei mit Weinpaket',
    trigger: 'automatic',
    code: null,
    target: 'shipping',
    valueType: 'free',
    value: null,
    appliesTo: { include: { kinds: ['bundle'] } },
    appliesToPickup: false,
    combinesWith: { items: true, order: true },
    ...overrides,
  })
}
