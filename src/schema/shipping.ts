import type { ResolvedVariant, ResolvedShippingMethod } from '../types/data'
import type { SanityShippingMethodResult } from '../netlify/types/checkout'
import {
  resolveShippingMethods as priceShippingMethods,
  resolveVariantWeight,
  resolveBundleWeight,
  type ShippingCartItem,
} from '../netlify/lib/shipping'

// schema.org shipping + availability for product offers. Prices come from checkout's own
// shipping calculation (`netlify/lib/shipping.ts`), so the markup shows what checkout charges.

export type ShippingContext = {
  methods: ResolvedShippingMethod[]
  freeShippingCalculation: 'beforeDiscount' | 'afterDiscount'
}

type Kind = ShippingCartItem['kind']

const KINDS: readonly Kind[] = ['wine', 'physical', 'digital', 'bundle']

function narrowKind(kind: string): Kind {
  return (KINDS as readonly string[]).includes(kind) ? kind as Kind : 'physical'
}

/** Mirrors checkout (`cart-validator.ts`): only active variants are buyable; stock only counts
 *  when the stock feature is on. */
export function offerAvailability(variant: ResolvedVariant, hasStockFeature: boolean): 'InStock' | 'OutOfStock' {
  if (variant.status !== 'active') return 'OutOfStock'
  if (hasStockFeature && typeof variant.stock === 'number') return variant.stock > 0 ? 'InStock' : 'OutOfStock'
  return 'InStock'
}

/** One unit of the variant as checkout's shipping calculation sees it. */
export function variantToCartItem(variant: ResolvedVariant): ShippingCartItem {
  const kind = narrowKind(variant.kind)
  const children = kind === 'bundle'
    ? (variant.bundleItems ?? []).map(bi => {
        const childKind = narrowKind(bi.variant.kind)
        return {
          variantId: bi.variant._id,
          quantity:  bi.quantity,
          kind:      childKind,
          weight:    bi.variant.weight,
          wine:      childKind === 'wine' || bi.variant.volume != null ? { volume: bi.variant.volume } : null,
        }
      })
    : null
  const wine = variant.wine ? { vintage: variant.wine.vintage ?? null, volume: variant.wine.volume ?? null } : null

  return {
    kind,
    quantity: 1,
    weight: children ? resolveBundleWeight(children) : resolveVariantWeight({ kind, weight: variant.weight, wine }),
    wine,
    // Same per-child weights as checkout's `bundleItems[].weight` (explicit first, wine estimated)
    bundleItems: children?.map(c => ({ ...c, weight: resolveVariantWeight(c) })) ?? null,
  }
}

/** Resolved method → the raw shape checkout prices. Rates without `maxWeight` are dropped: checkout
 *  would only match them for a 0 kg cart, so publishing them as "any weight" would undercut it. */
function toCheckoutMethod(method: ResolvedShippingMethod, locale: string): SanityShippingMethodResult {
  return {
    _id:                   method._id,
    title:                 [{ language: locale, value: method.title }],
    deliveryTime:          method.deliveryTime ? [{ language: locale, value: method.deliveryTime }] : null,
    methodType:            method.methodType,
    pickupFee:             method.pickupFee,
    freeShippingThreshold: method.freeShippingThreshold,
    taxCategoryCode:       null,
    rates:                 method.rates.flatMap(r => r.maxWeight == null ? [] : [{ maxWeight: r.maxWeight, price: r.price }]),
    packagingGroups:       method.packagingGroups,
  }
}

/** "2 – 5 Werktage" → { min: 2, max: 5 }; one number → min = max; none (or min > max) → null. */
export function parseDeliveryDays(text: string | null): { min: number; max: number } | null {
  const numbers = (text ?? '').match(/\d+/g)?.map(Number) ?? []
  if (numbers.length === 0) return null
  const [min, max = min] = numbers
  return min <= max ? { min, max } : null
}

/**
 * One `OfferShippingDetails` per delivery method that can ship this variant alone (qty 1):
 * checkout's price for it, all the method's countries, and the delivery time when parseable.
 * Digital variants and methods without countries get none.
 */
export function buildShippingDetails(variant: ResolvedVariant, shipping: ShippingContext, locale: string): object[] {
  if (variant.kind === 'digital') return []
  const methods = shipping.methods.filter(m => m.methodType === 'delivery' && m.countries.length > 0)
  if (methods.length === 0) return []

  const byId = new Map(methods.map(m => [m._id, m]))
  const priced = priceShippingMethods(
    methods.map(m => toCheckoutMethod(m, locale)),
    [variantToCartItem(variant)],
    variant.price,
    0,
    shipping.freeShippingCalculation,
    locale,
    { quiet: true },
  )

  return priced.flatMap(p => {
    const method = byId.get(p._id)
    if (!method || p.methodType !== 'delivery') return []
    const days = parseDeliveryDays(method.deliveryTime)
    return [{
      '@type': 'OfferShippingDetails',
      shippingRate: {
        '@type':  'MonetaryAmount',
        value:    Number((p.price / 100).toFixed(2)),
        currency: 'EUR',
      },
      shippingDestination: method.countries.map(country => ({
        '@type':        'DefinedRegion',
        addressCountry: country,
      })),
      ...(days && {
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          transitTime: {
            '@type':  'QuantitativeValue',
            minValue: days.min,
            maxValue: days.max,
            unitCode: 'DAY',
          },
        },
      }),
    }]
  })
}
