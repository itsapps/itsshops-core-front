import type {
  SanityShippingMethodResult,
  SanityShippingRateResult,
  SanityPackagingGroupResult,
  SanityPackagingGroupPackageResult,
  AvailableShippingMethod,
  ValidatedCartItem,
  LocaleString,
} from '../types/checkout'
import { log } from '../utils/logger'

/** What the shipping calculation reads from a cart line — checkout passes full `ValidatedCartItem`s,
 *  the schema.org markup builds these from resolved variants (`src/schema/shipping.ts`). */
export type ShippingCartItem = Pick<ValidatedCartItem, 'kind' | 'quantity' | 'weight' | 'wine' | 'bundleItems'>

/**
 * Resolve a localized string array to a single string for the given locale.
 */
export function resolveLocalizedTitle(
  title: LocaleString[] | null,
  locale: string,
  defaultLocale = 'de',
): string {
  if (!title || title.length === 0) return ''
  const match = title.find(t => t.language === locale) ?? title.find(t => t.language === defaultLocale)
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

type WeightKind = 'wine' | 'physical' | 'digital' | 'bundle'

/**
 * Shipping weight (grams) of a single physical or wine variant: explicit weight on the variant or
 * its product; wines without one are estimated from the bottle volume. Other kinds → null.
 */
export function resolveVariantWeight(v: {
  kind: WeightKind
  weight?: number | null
  productWeight?: number | null
  wine?: { volume?: number | null } | null
}): number | null {
  if (v.kind === 'physical') return v.weight ?? v.productWeight ?? null
  if (v.kind === 'wine') {
    return v.weight ?? v.productWeight
      ?? (v.wine?.volume ? estimateWineBottleWeight(v.wine.volume) : null)
  }
  return null
}

/**
 * Total shipping weight (grams) of a bundle: children's weights × child quantity, null when 0.
 * A wine child is always estimated from its volume (its explicit weight is ignored — unlike
 * `resolveVariantWeight`; kept as is, see the plan's "Separate, later").
 */
export function resolveBundleWeight(children: Array<{
  kind: WeightKind
  quantity: number
  weight?: number | null
  productWeight?: number | null
  wine?: { volume?: number | null } | null
}>): number | null {
  let total = 0
  for (const child of children) {
    let grams = 0
    if (child.kind === 'physical') {
      grams = child.weight ?? child.productWeight ?? 0
    } else if (child.kind === 'wine' && child.wine?.volume) {
      grams = estimateWineBottleWeight(child.wine.volume)
    }
    total += grams * child.quantity
  }
  return total > 0 ? total : null
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
export function calculateCartWeight(items: ShippingCartItem[]): number {
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
  /** Bottle sizes (ml) of the packaging group, largest first — the box type's label. */
  volumes: number[]
  /** Places of the box. */
  packSize: number
  quantity: number
  price: number
}

/**
 * Minimum-cost boxes for N places using available box sizes.
 *
 * Uses DP over places 0..N+maxBoxSize so we can cover cases where
 * exact coverage isn't possible (e.g. only 6-place boxes for 5 places).
 * Returns null if no combination can cover N places (no boxes configured).
 * Also reconstructs which boxes were chosen for the fulfillment snapshot.
 */
export function calcMinPackagingCost(
  places: number,
  packages: SanityPackagingGroupPackageResult[],
): { cost: number; lines: Array<{ packSize: number; quantity: number; price: number }> } | null {
  if (packages.length === 0 || places <= 0) return null
  const maxPkg = Math.max(...packages.map(p => p.places))
  const limit = places + maxPkg - 1
  const dp = new Array<number>(limit + 1).fill(Infinity)
  const parent = new Array<number>(limit + 1).fill(-1)
  dp[0] = 0
  for (let i = 1; i <= limit; i++) {
    for (const pkg of packages) {
      if (pkg.places <= i && dp[i - pkg.places] + pkg.price < dp[i]) {
        dp[i] = dp[i - pkg.places] + pkg.price
        parent[i] = pkg.places
      }
    }
  }

  // Find minimum-cost endpoint covering >= places
  let bestI = places
  for (let i = places + 1; i <= limit; i++) {
    if (dp[i] < dp[bestI]) bestI = i
  }
  if (dp[bestI] === Infinity) return null

  // Reconstruct which boxes were used
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
    price: packages.find(p => p.places === packSize)!.price,
  }))

  return { cost: dp[bestI], lines }
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b))
const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b

/**
 * Calculate total packaging cost for a cart using the method's packaging groups.
 *
 * A group is a box type: its boxes (places, price) and the bottle sizes that go in them, each with
 * `perPlace` bottles per place (e.g. 2 × 375 ml in one 750 ml place). Wine bottles (incl. bundle
 * children) are mapped to their group; per group the places are summed and rounded up once
 * (4 × 750 + 3 × 375 = 5.5 → 6), then the cheapest boxes are picked.
 *
 * A bottle size no group lists goes into the group of the smallest listed size ≥ it, one per
 * place (500 ml → the 750 ml group). If no listed size is that large, or a wine has no volume,
 * returns null (method not applicable). Non-wine items are returned as grams for the weight rates.
 */
export function calcWinePackagingCost(
  items: ShippingCartItem[],
  groups: SanityPackagingGroupResult[],
  options: { quiet?: boolean } = {},
): { packagingCost: number; nonWineWeightGrams: number; packagingLines: PackagingLine[] } | null {
  const bottlesByVolume = new Map<number, number>()
  let nonWineWeightGrams = 0

  for (const item of items) {
    if (item.kind === 'wine') {
      const volume = item.wine?.volume
      if (!volume) return null
      bottlesByVolume.set(volume, (bottlesByVolume.get(volume) ?? 0) + item.quantity)
    } else if (item.kind === 'bundle') {
      if (item.bundleItems && item.bundleItems.length > 0) {
        for (const bi of item.bundleItems) {
          if (bi.kind === 'wine') {
            const volume = bi.wine?.volume
            if (!volume) return null
            bottlesByVolume.set(volume, (bottlesByVolume.get(volume) ?? 0) + bi.quantity * item.quantity)
          } else {
            if (bi.weight) nonWineWeightGrams += bi.weight * bi.quantity * item.quantity
          }
        }
      } else {
        if (item.weight) nonWineWeightGrams += item.weight * item.quantity
      }
    } else {
      if (item.weight) nonWineWeightGrams += item.weight * item.quantity
    }
  }

  // Listed bottle sizes → group + bottles per place
  const listed = new Map<number, { group: number; perPlace: number }>()
  groups.forEach((group, i) => {
    for (const bottle of group.bottles ?? []) {
      if (bottle.volume && !listed.has(bottle.volume)) {
        listed.set(bottle.volume, { group: i, perPlace: Math.max(1, Math.floor(bottle.perPlace ?? 1)) })
      }
    }
  })
  const listedVolumes = [...listed.keys()].sort((a, b) => a - b)

  // Per group: bottle counts by perPlace, and the sizes in it (for the snapshot label)
  const perGroup = new Map<number, { counts: Array<{ count: number; perPlace: number }>; volumes: Set<number> }>()
  for (const [volume, count] of bottlesByVolume) {
    let target = listed.get(volume)
    if (!target) {
      const larger = listedVolumes.find(v => v >= volume)
      if (larger === undefined) return null
      if (!options.quiet) log.warn('Packaging: bottle size not in any packaging group, using the next larger size', { volume, larger })
      target = { group: listed.get(larger)!.group, perPlace: 1 }
    }
    const entry = perGroup.get(target.group) ?? { counts: [], volumes: new Set<number>() }
    entry.counts.push({ count, perPlace: target.perPlace })
    entry.volumes.add(volume)
    perGroup.set(target.group, entry)
  }

  let packagingCost = 0
  const packagingLines: PackagingLine[] = []

  for (const [groupIndex, { counts, volumes }] of perGroup) {
    const group = groups[groupIndex]
    // Exact round-up in integer units: one place = `unit` units, a bottle = unit / perPlace.
    const unit = counts.reduce((acc, c) => lcm(acc, c.perPlace), 1)
    const units = counts.reduce((sum, c) => sum + c.count * (unit / c.perPlace), 0)
    const places = Math.ceil(units / unit)
    const packages = (group.packages ?? []).filter(p => p.places > 0)
    const result = calcMinPackagingCost(places, packages)
    if (!result) return null
    packagingCost += result.cost
    for (const b of group.bottles ?? []) if (b.volume) volumes.add(b.volume)
    const groupVolumes = [...volumes].sort((a, b) => b - a)
    for (const line of result.lines) {
      packagingLines.push({ volumes: groupVolumes, ...line })
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
 * Returns methods with their calculated prices. `quiet` silences the per-call packaging warning
 * (the schema.org markup prices every product page × method × locale at build time).
 */
export function resolveShippingMethods(
  methods: SanityShippingMethodResult[],
  items: ShippingCartItem[],
  subtotal: number,
  discount: number,
  freeShippingCalculation: 'beforeDiscount' | 'afterDiscount',
  locale: string,
  options: { quiet?: boolean } = {},
): AvailableShippingMethod[] {
  const cartWeightKg = calculateCartWeight(items)
  const available: AvailableShippingMethod[] = []

  for (const method of methods) {
    const title = resolveLocalizedTitle(method.title, locale)
    const deliveryTime = resolveLocalizedTitle(method.deliveryTime ?? null, locale) || undefined

    if (method.methodType === 'pickup') {
      available.push({
        _id: method._id,
        title,
        ...(deliveryTime && { deliveryTime }),
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

    if (method.packagingGroups?.length) {
      const packaging = calcWinePackagingCost(items, method.packagingGroups, options)
      if (!packaging) continue // bottle size not covered — method not applicable
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
      ...(deliveryTime && { deliveryTime }),
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
