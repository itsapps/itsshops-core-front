import type {
  SanityVariantResult,
  SanityBundleItemResult,
  SanityOptionResult,
  SanityTaxRuleResult,
  ValidatedCartItem,
  ValidatedBundleItem,
} from '../types/checkout'
import type { CheckoutCartItem } from '../types/api'
import { findTaxRate, extractVat, splitBundlePrice } from './tax'
import { resolveLocalizedTitle, resolveVariantWeight, resolveBundleWeight } from './shipping'
import { composeSubtitle, type SubtitleFormat } from './order-item-display'

const MAX_DISPLAY_LEN = 300

function sanitize(s: string | undefined): string | null {
  if (!s) return null
  // Strip control chars + clamp length. The string is otherwise opaque to us.
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/[\x00-\x1F\x7F]/g, '').trim()
  if (!cleaned) return null
  return cleaned.slice(0, MAX_DISPLAY_LEN)
}

export type CartValidationResult = {
  items: ValidatedCartItem[]
  unavailableItems: string[]
}

/**
 * Validate cart items against fetched Sanity variant data.
 * - Filters out unavailable variants (not found, not active)
 * - Caps quantities to stock levels
 * - Resolves all fields needed for order creation
 */
export function validateCart(
  cartItems: CheckoutCartItem[],
  variants: SanityVariantResult[],
  taxRules: SanityTaxRuleResult[],
  locale: string,
  defaultLocale = 'de',
  hasStockFeature = true,
  defaultTaxCategoryCode?: string | null,
  volumeUnit = 'l',
): CartValidationResult {
  const format = { volumeUnit, locale }
  const variantMap = new Map(variants.map(v => [v._id, v]))
  const validatedItems: ValidatedCartItem[] = []
  const unavailableItems: string[] = []

  for (const cartItem of cartItems) {
    const variant = variantMap.get(cartItem.variantId)

    if (!variant || variant.status !== 'active') {
      unavailableItems.push(cartItem.variantId)
      continue
    }

    const price = variant.price ?? variant.productPrice
    if (price === null || price === undefined) {
      unavailableItems.push(cartItem.variantId)
      continue
    }

    // Cap quantity to stock if stock tracking is enabled
    let quantity = cartItem.quantity
    if (hasStockFeature && variant.stock !== null && variant.stock !== undefined) {
      quantity = Math.min(quantity, Math.max(0, variant.stock))
      if (quantity === 0) {
        unavailableItems.push(cartItem.variantId)
        continue
      }
    }

    const title = resolveLocalizedTitle(variant.title, locale, defaultLocale)
      || resolveLocalizedTitle(variant.productTitle, locale, defaultLocale)
    const options = localizeOptions(variant.options, locale, defaultLocale)
    const wine = variant.wine ? {
      vintage: variant.wine.vintage ?? null,
      volume: variant.wine.volume ?? null,
    } : null

    let taxCategoryCode: string
    let vatRate: number
    let vatAmount: number
    let weight: number | null
    let bundleItems: ValidatedBundleItem[] | null = null
    let subtitle: string | null

    if (variant.kind === 'bundle') {
      // A bundle is taxed by its items: its price is split over them by their single sale
      // prices, each share at the item's own rate. Unavailable when it has no items, an item is
      // missing (dangling reference) or not active, or an item has no price (no ratio possible).
      bundleItems = validateBundleItems(variant.bundleItems, price, quantity, taxRules, locale, defaultLocale, defaultTaxCategoryCode, format)
      if (!bundleItems) {
        unavailableItems.push(cartItem.variantId)
        continue
      }
      taxCategoryCode = ''
      vatAmount = bundleItems.reduce((sum, bi) => sum + bi.vatAmount, 0)
      // Display only: the rate of the largest part.
      vatRate = bundleItems.reduce((best, bi) => (bi.price > best.price ? bi : best)).vatRate
      weight = resolveBundleWeight(variant.bundleItems!.map(bi => ({ ...bi.variant!, quantity: bi.quantity })))
      // Always from the current items — the cart's subtitle was frozen at add-to-cart time.
      subtitle = composeSubtitle('bundle', null, null, bundleItems, format)
    } else {
      taxCategoryCode = variant.taxCategoryCode ?? variant.productTaxCategoryCode ?? ''
      vatRate = findTaxRate(taxRules, taxCategoryCode, defaultTaxCategoryCode)
      vatAmount = extractVat(price * quantity, vatRate)
      // physical / wine: see `resolveVariantWeight` (wine falls back to the bottle-volume
      // estimate); digital: null (skipped by the shipping calculator).
      weight = resolveVariantWeight(variant)
      // Client-supplied subtitle is canonical; composed default as a fallback.
      subtitle = sanitize(cartItem.subtitle) ?? composeSubtitle(variant.kind, wine, options, null, format)
    }

    const item: ValidatedCartItem = {
      variantId: variant._id,
      productId: variant.productId ?? '',
      kind: variant.kind,
      title: sanitize(cartItem.title) || title,
      subtitle,
      sku: variant.sku,
      price,
      weight,
      quantity,
      taxCategoryCode,
      vatRate,
      vatAmount,
      wine,
      options,
      bundleItems,
    }

    validatedItems.push(item)
  }

  return { items: validatedItems, unavailableItems }
}

function localizeOptions(
  options: SanityOptionResult[] | null | undefined,
  locale: string,
  defaultLocale: string,
): { groupTitle: string; optionTitle: string }[] | null {
  return options?.map(o => ({
    groupTitle: resolveLocalizedTitle(o.groupTitle, locale, defaultLocale),
    optionTitle: resolveLocalizedTitle(o.title, locale, defaultLocale),
  })) ?? null
}

/**
 * Validate a bundle's items and split its unit `price` over them. `null` → the bundle can't be
 * sold: no items, a dangling item reference, an item that isn't `active`, or no price to split
 * by (an item without its own and its product's price).
 */
function validateBundleItems(
  raw: SanityBundleItemResult[] | null,
  price: number,
  bundleQuantity: number,
  taxRules: SanityTaxRuleResult[],
  locale: string,
  defaultLocale: string,
  defaultTaxCategoryCode: string | null | undefined,
  format: SubtitleFormat,
): ValidatedBundleItem[] | null {
  if (!raw?.length) return null
  const weights: number[] = []
  for (const bi of raw) {
    const v = bi.variant
    if (!v || v.status !== 'active') return null
    const itemPrice = v.price ?? v.productPrice
    if (itemPrice === null || itemPrice === undefined) return null
    weights.push(itemPrice * bi.quantity)
  }
  const shares = splitBundlePrice(price, weights)
  if (!shares) return null

  return raw.map((bi, i) => {
    const v = bi.variant!
    const title = resolveLocalizedTitle(v.title, locale, defaultLocale)
      || resolveLocalizedTitle(v.productTitle ?? null, locale, defaultLocale)
    const wine = v.wine ? { vintage: v.wine.vintage ?? null, volume: v.wine.volume ?? null } : null
    const vatRate = findTaxRate(taxRules, v.taxCategoryCode ?? v.productTaxCategoryCode ?? '', defaultTaxCategoryCode)
    return {
      key: bi._key ?? `${i}`,
      variantId: v._id,
      productId: v.productId ?? '',
      title,
      subtitle: composeSubtitle(v.kind, wine, localizeOptions(v.options, locale, defaultLocale), null, format),
      sku: v.sku ?? null,
      quantity: bi.quantity,
      kind: v.kind,
      weight: resolveVariantWeight(v),
      wine: v.wine ? { volume: v.wine.volume ?? null } : null,
      price: shares[i],
      vatRate,
      vatAmount: extractVat(shares[i] * bundleQuantity, vatRate),
    }
  })
}
