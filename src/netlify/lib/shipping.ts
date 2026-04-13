import type {
  SanityShippingMethodResult,
  SanityShippingRateResult,
  SanityWinePackagingConfigResult,
  SanityWinePackageResult,
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

export type PackagingLine = {
  volume: number
  packSize: number
  quantity: number
  price: number
}

/**
 * Minimum-cost packaging for N bottles using available package sizes.
 *
 * Uses DP over bottle-slots 0..N+maxPackageSize so we can cover cases where
 * exact coverage isn't possible (e.g. only 6-packs available for 5 bottles).
 * Returns null if no combination can cover N bottles (no packages configured).
 * Also reconstructs which packages were chosen for the fulfillment snapshot.
 */
export function calcMinPackagingCost(
  bottleCount: number,
  packages: SanityWinePackageResult[],
): { cost: number; lines: Array<{ packSize: number; quantity: number; price: number }> } | null {
  if (packages.length === 0 || bottleCount <= 0) return null
  const maxPkg = Math.max(...packages.map(p => p.count))
  const limit = bottleCount + maxPkg - 1
  const dp = new Array<number>(limit + 1).fill(Infinity)
  const parent = new Array<number>(limit + 1).fill(-1)
  dp[0] = 0
  for (let i = 1; i <= limit; i++) {
    for (const pkg of packages) {
      if (pkg.count <= i && dp[i - pkg.count] + pkg.price < dp[i]) {
        dp[i] = dp[i - pkg.count] + pkg.price
        parent[i] = pkg.count
      }
    }
  }

  // Find minimum-cost endpoint covering >= bottleCount bottles
  let bestI = bottleCount
  for (let i = bottleCount + 1; i <= limit; i++) {
    if (dp[i] < dp[bestI]) bestI = i
  }
  if (dp[bestI] === Infinity) return null

  // Reconstruct which packages were used
  const used = new Map<number, number>()
  let cur = bestI
  while (cur > 0) {
    const packSize = parent[cur]
    used.set(packSize, (used.get(packSize) ?? 0) + 1)
    cur -= packSize
  }

  const lines = Array.from(used.entries()).map(([packSize, quantity]) => ({
    packSize,
    quantity,
    price: packages.find(p => p.count === packSize)!.price,
  }))

  return { cost: dp[bestI], lines }
}

/**
 * Calculate total packaging cost for a cart using wine packaging configs.
 *
 * Groups wine items by volume, looks up each volume's config, sums costs.
 * Non-wine items are returned separately as grams for weight-based fallback.
 * Returns null if any wine volume has no matching config (method not applicable).
 */
export function calcWinePackagingCost(
  items: ValidatedCartItem[],
  configs: SanityWinePackagingConfigResult[],
): { packagingCost: number; nonWineWeightGrams: number; packagingLines: PackagingLine[] } | null {
  const configByVolume = new Map(configs.map(c => [c.volume, c.packages]))

  const bottlesByVolume = new Map<number, number>()
  let nonWineWeightGrams = 0

  for (const item of items) {
    if (item.kind === 'wine') {
      const volume = item.wine?.volume
      if (!volume) return null
      bottlesByVolume.set(volume, (bottlesByVolume.get(volume) ?? 0) + item.quantity)
    } else {
      if (item.weight) nonWineWeightGrams += item.weight * item.quantity
    }
  }

  let packagingCost = 0
  const packagingLines: PackagingLine[] = []

  for (const [volume, count] of bottlesByVolume) {
    const packages = configByVolume.get(volume)
    if (!packages) {
      // No packaging config for this volume — fall back to weight-based shipping
      nonWineWeightGrams += estimateWineBottleWeight(volume) * count
      continue
    }
    const result = calcMinPackagingCost(count, packages)
    if (!result) return null
    packagingCost += result.cost
    for (const line of result.lines) {
      packagingLines.push({ volume, ...line })
    }
  }

  return { packagingCost, nonWineWeightGrams, packagingLines }
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

    // Delivery method — packaging-based or weight-based pricing
    let price: number
    let packagingLines: PackagingLine[] | undefined

    if (method.packagingConfigs?.length) {
      const packaging = calcWinePackagingCost(items, method.packagingConfigs)
      if (!packaging) continue // volume not covered — method not applicable
      packagingLines = packaging.packagingLines

      if (packaging.nonWineWeightGrams > 0 && method.rates?.length) {
        const nonWineWeightKg = packaging.nonWineWeightGrams / 1000
        const rate = findShippingRate(method.rates, nonWineWeightKg)
        if (!rate) continue
        price = packaging.packagingCost + rate.price
      } else {
        price = packaging.packagingCost
      }
    } else {
      const rate = findShippingRate(method.rates ?? [], cartWeightKg)
      if (!rate) continue
      price = rate.price
    }

    const free = isFreeShipping(method.freeShippingThreshold, subtotal, discount, freeShippingCalculation)

    available.push({
      _id: method._id,
      title,
      methodType: 'delivery',
      price: free ? 0 : price,
      isFree: free,
      taxCategoryCode: method.taxCategoryCode,
      ...(packagingLines && { packagingLines }),
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
