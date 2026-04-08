import type {
  SanityShippingMethodResult,
  SanityShippingRateResult,
  AvailableShippingMethod,
  ValidatedCartItem,
  LocaleString,
} from '../types/checkout'

/**
 * Resolve a localized string array to a single string for the given locale.
 */
export function resolveLocalizedTitle(
  title: LocaleString[] | null,
  locale: string,
  defaultLocale = 'de',
): string {
  if (!title || title.length === 0) return ''
  const match = title.find(t => t._key === locale) ?? title.find(t => t._key === defaultLocale)
  return match?.value ?? title[0]?.value ?? ''
}

/**
 * Estimate the shipping weight of a wine bottle from its volume (ml).
 *
 * Wine itself is ~1 g/ml. Glass adds a roughly fixed overhead per bottle —
 * a standard 0.75 l bottle is ~500 g of glass, half bottles ~350 g, magnums
 * scale up but not linearly. We approximate with a piecewise floor that
 * undershoots slightly for very large bottles rather than overcharging
 * standard formats.
 */
export function estimateWineBottleWeight(volumeMl: number): number {
  if (volumeMl <= 0) return 0
  let glass: number
  if (volumeMl <= 375) glass = 350
  else if (volumeMl <= 750) glass = 500
  else if (volumeMl <= 1000) glass = 600
  else glass = 800
  return Math.round(volumeMl + glass)
}

/**
 * Calculate total weight of cart items in kilograms.
 *
 * `item.weight` is resolved per kind during cart validation
 * (see `cart-validator.ts`):
 * - physical → variant/product `weight` (grams)
 * - wine     → estimated from `wine.volume` via `estimateWineBottleWeight`
 * - bundle   → sum of children's resolved weights × child quantity
 * - digital  → null
 *
 * This function just sums the pre-resolved grams.
 */
export function calculateCartWeight(items: ValidatedCartItem[]): number {
  let totalGrams = 0
  for (const item of items) {
    if (item.weight) totalGrams += item.weight * item.quantity
  }
  return totalGrams / 1000
}

/**
 * Find the applicable shipping rate for a given weight.
 * Rates are sorted by maxWeight ascending; the first rate whose maxWeight >= cartWeight applies.
 */
export function findShippingRate(
  rates: SanityShippingRateResult[],
  cartWeightKg: number,
): SanityShippingRateResult | null {
  if (rates.length === 0) return null
  const sorted = [...rates].sort((a, b) => a.maxWeight - b.maxWeight)
  return sorted.find(r => r.maxWeight >= cartWeightKg) ?? null
}

/**
 * Check if free shipping applies based on threshold and subtotal.
 */
export function isFreeShipping(
  threshold: number | null,
  subtotal: number,
  discount: number,
  freeShippingCalculation: 'beforeDiscount' | 'afterDiscount',
): boolean {
  if (threshold === null || threshold <= 0) return false
  const compareAmount = freeShippingCalculation === 'afterDiscount'
    ? subtotal - discount
    : subtotal
  return compareAmount >= threshold
}

/**
 * Resolve available shipping methods for a given country and cart.
 * Returns methods with their calculated prices.
 */
export function resolveShippingMethods(
  methods: SanityShippingMethodResult[],
  items: ValidatedCartItem[],
  subtotal: number,
  discount: number,
  freeShippingCalculation: 'beforeDiscount' | 'afterDiscount',
  locale: string,
): AvailableShippingMethod[] {
  const cartWeightKg = calculateCartWeight(items)
  const available: AvailableShippingMethod[] = []

  for (const method of methods) {
    const title = resolveLocalizedTitle(method.title, locale)

    if (method.methodType === 'pickup') {
      available.push({
        _id: method._id,
        title,
        methodType: 'pickup',
        price: method.pickupFee ?? 0,
        isFree: (method.pickupFee ?? 0) === 0,
        taxCategoryCode: method.taxCategoryCode,
      })
      continue
    }

    // Delivery method — find rate by weight
    const rate = findShippingRate(method.rates ?? [], cartWeightKg)
    if (!rate) continue // skip if no rate covers the cart weight

    const free = isFreeShipping(method.freeShippingThreshold, subtotal, discount, freeShippingCalculation)

    available.push({
      _id: method._id,
      title,
      methodType: 'delivery',
      price: free ? 0 : rate.price,
      isFree: free,
      taxCategoryCode: method.taxCategoryCode,
    })
  }

  return available
}

/**
 * Select a shipping method: prefer the requested one, otherwise cheapest delivery.
 */
export function selectShippingMethod(
  methods: AvailableShippingMethod[],
  requestedId?: string,
): AvailableShippingMethod | null {
  if (methods.length === 0) return null
  if (requestedId) {
    const requested = methods.find(m => m._id === requestedId)
    if (requested) return requested
  }
  // Prefer cheapest delivery method
  const delivery = methods.filter(m => m.methodType === 'delivery')
  if (delivery.length > 0) {
    return delivery.sort((a, b) => a.price - b.price)[0]
  }
  return methods[0]
}
