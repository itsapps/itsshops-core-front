import type {
  SanityVariantResult,
  SanityTaxRuleResult,
  ValidatedCartItem,
  LocaleString,
} from '../types/checkout'
import type { CheckoutCartItem } from '../types/api'
import { findTaxRate, extractVat } from './tax'
import { resolveLocalizedTitle } from './shipping'

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
): CartValidationResult {
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

    const taxCategoryCode = variant.taxCategoryCode ?? variant.productTaxCategoryCode ?? ''
    const vatRate = findTaxRate(taxRules, taxCategoryCode, defaultTaxCategoryCode)
    const vatAmount = extractVat(price * quantity, vatRate)

    const title = resolveLocalizedTitle(variant.productTitle, locale, defaultLocale)
    const variantTitle = resolveLocalizedTitle(variant.title, locale, defaultLocale) || null
    const weight = variant.weight ?? variant.productWeight

    const options = variant.options?.map(o => ({
      groupTitle: resolveLocalizedTitle(o.groupTitle, locale, defaultLocale),
      optionTitle: resolveLocalizedTitle(o.title, locale, defaultLocale),
    })) ?? null

    const bundleItems = variant.bundleItems?.map(bi => ({
      variantId: bi.variant._id,
      quantity: bi.quantity,
    })) ?? null

    validatedItems.push({
      variantId: variant._id,
      productId: '', // filled from GROQ product reference if needed
      kind: variant.kind,
      title,
      variantTitle,
      sku: variant.sku,
      price,
      weight: weight ?? null,
      quantity,
      taxCategoryCode,
      vatRate,
      vatAmount,
      wine: variant.wine ? {
        vintage: variant.wine.vintage ?? null,
        volume: variant.wine.volume ?? null,
      } : null,
      options,
      bundleItems,
    })
  }

  return { items: validatedItems, unavailableItems }
}
