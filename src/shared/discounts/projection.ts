import type { DiscountInput, ProductSelector } from './types'

/** One selector side with its references flattened to id arrays (`SelectorCriteria`). */
const CRITERIA_PROJECTION = `{
  kinds,
  "categoryIds": categories[]._ref,
  "manufacturerIds": manufacturers[]._ref,
  "productIds": products[]._ref,
  "variantIds": variants[]._ref,
  hasCompareAtPrice
}`

/** A `productSelector` field → `ProductSelector`. Use as `"appliesTo": appliesTo${…}`. */
export const SELECTOR_PROJECTION = `{
  "include": include${CRITERIA_PROJECTION},
  "exclude": exclude${CRITERIA_PROJECTION}
}`

/**
 * GROQ projection of a `discount` document → `RawDiscount`. Shared by checkout's
 * `CHECKOUT_QUERY` and the build query, so both sides read one shape.
 */
export const DISCOUNT_PROJECTION = `{
  _id,
  title,
  trigger,
  code,
  enabled,
  target,
  valueType,
  value,
  "appliesTo": appliesTo${SELECTOR_PROJECTION},
  ignoreShopExclusions,
  minSubtotal,
  minSubtotalBasis,
  minQuantity,
  validFrom,
  validTo,
  maxRedemptions,
  maxPerEmail,
  redemptionCount,
  combinesWith{ items, order, shipping },
  appliesToPickup
}`

export type LocaleValue = { language?: string; _key?: string; value?: string }

/** What `DISCOUNT_PROJECTION` returns: `DiscountInput` with the i18n title unresolved. */
export type RawDiscount = Omit<DiscountInput, 'title'> & { title?: LocaleValue[] | null }

/** `RawDiscount` → `DiscountInput`, the title resolved by the caller's locale rule. */
export function toDiscountInput(
  raw: RawDiscount,
  resolveTitle: (title: LocaleValue[] | null | undefined) => string,
): DiscountInput {
  return { ...raw, title: resolveTitle(raw.title) || raw.code || '' }
}

export type { ProductSelector }
