import { describe, it, expect } from 'vitest'
import { evaluateDiscounts, waivesShipping } from '../discounts/apply'
import { areCompatible } from '../discounts/combine'
import type { PipelineInput } from '../discounts/types'
import { bundleFreeShipping, discount, line } from './discounts-fixtures'

const now = new Date('2026-11-20T12:00:00Z')
const delivery = (price: number) => ({ price, methodType: 'delivery' as const })
const pickup = (price: number) => ({ price, methodType: 'pickup' as const })
const run = (input: Partial<PipelineInput>) => evaluateDiscounts({ lines: [], now, ...input })
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

describe('code discount (cases of the old validateCoupon)', () => {
  it('unknown code → not found', () => {
    const r = run({ lines: [line(1000)], couponCode: ' UNKNOWN ', codeDiscount: null })
    expect(r.couponError).toEqual({ code: 'UNKNOWN', errorCode: 'COUPON_NOT_FOUND' })
    expect(r.applied).toEqual([])
  })

  it('disabled / expired / not yet valid / exhausted / below minimum', () => {
    const cases = [
      [{ enabled: false }, 'COUPON_DISABLED'],
      [{ validTo: '2026-11-19T00:00:00Z' }, 'COUPON_EXPIRED'],
      [{ validFrom: '2026-11-21T00:00:00Z' }, 'COUPON_NOT_YET_VALID'],
      [{ maxRedemptions: 5, redemptionCount: 5 }, 'COUPON_EXHAUSTED'],
      [{ minSubtotal: 5000 }, 'COUPON_BELOW_MINIMUM'],
    ] as const
    for (const [overrides, errorCode] of cases) {
      const r = run({ lines: [line(4999)], couponCode: 'X', codeDiscount: discount(overrides) })
      expect(r.couponError?.errorCode).toBe(errorCode)
      expect(r.itemsOrderTotal).toBe(0)
    }
  })

  it('percent: floor of the eligible gross', () => {
    const r = run({ lines: [line(333)], couponCode: 'X', codeDiscount: discount({ value: 10 }) })
    expect(r.couponError).toBeNull()
    expect(r.itemsOrderTotal).toBe(33)
    expect(r.applied[0].amount).toBe(33)
  })

  it('order + fixed, capped at the subtotal', () => {
    expect(run({ lines: [line(1000)], couponCode: 'X', codeDiscount: discount({ valueType: 'fixed', value: 250 }) }).itemsOrderTotal).toBe(250)
    expect(run({ lines: [line(1000)], couponCode: 'X', codeDiscount: discount({ valueType: 'fixed', value: 5000 }) }).itemsOrderTotal).toBe(1000)
  })

  it('free shipping code: amount = the selected price; 0 when already free', () => {
    const code = discount({ target: 'shipping', valueType: 'free', value: null, appliesToPickup: true })
    const paid = run({ lines: [line(1000)], couponCode: 'X', codeDiscount: code, shipping: delivery(700) })
    expect(paid.shipping?.amount).toBe(700)
    expect(paid.itemsOrderTotal).toBe(0)
    expect(paid.applied).toHaveLength(1)
    const free = run({ lines: [line(1000)], couponCode: 'X', codeDiscount: code, shipping: delivery(0) })
    expect(free.shipping?.amount).toBe(0)
    expect(free.applied).toHaveLength(1) // still applied (shown as applied, counted)
  })
})

describe('eligibility and exclusions', () => {
  const exclusions = { include: { kinds: ['bundle'] } }
  const wine = line(2000, 1, { variantId: 'w', kind: 'wine' })
  const bundle = line(4990, 1, { variantId: 'b', kind: 'bundle' }, [3590, 1400])

  it('excluded lines get 0 and are listed as not discounted', () => {
    const r = run({ lines: [wine, bundle], couponCode: 'X', codeDiscount: discount({ value: 10 }), exclusions })
    expect(r.lines[0].discount).toBe(200)
    expect(r.lines[1]).toEqual({ discount: 0, children: [0, 0] })
    expect(r.itemsOrderTotal).toBe(200)
    expect(r.notDiscountedLines).toEqual([1])
  })

  it('only excluded lines → not applicable', () => {
    const r = run({ lines: [bundle], couponCode: 'X', codeDiscount: discount(), exclusions })
    expect(r.couponError?.errorCode).toBe('COUPON_NOT_APPLICABLE')
  })

  it('ignoreShopExclusions discounts the bundle and splits it over its items', () => {
    const r = run({ lines: [wine, bundle], couponCode: 'X', codeDiscount: discount({ value: 10, ignoreShopExclusions: true }), exclusions })
    expect(r.lines[1].discount).toBe(499)
    expect(r.lines[1].children).toEqual([359, 140])
    expect(r.notDiscountedLines).toEqual([])
  })

  it('appliesTo limits the lines', () => {
    const r = run({
      lines: [wine, line(1000, 1, { variantId: 'j', kind: 'physical' })],
      couponCode: 'X',
      codeDiscount: discount({ target: 'items', value: 50, appliesTo: { include: { kinds: ['wine'] } } }),
    })
    expect(r.lines.map(l => l.discount)).toEqual([1000, 0])
  })

  it('items + fixed is per unit, capped at the line', () => {
    const r = run({
      lines: [line(1000, 3), line(150, 2)],
      couponCode: 'X',
      codeDiscount: discount({ target: 'items', valueType: 'fixed', value: 200 }),
    })
    expect(r.lines.map(l => l.discount)).toEqual([600, 300])
  })

  it('percent allocation sums exactly over many lines', () => {
    const lines = [line(333), line(333), line(334, 3), line(1)]
    const r = run({ lines, couponCode: 'X', codeDiscount: discount({ value: 7 }) })
    const base = 333 + 333 + 334 * 3 + 1
    expect(r.itemsOrderTotal).toBe(Math.floor((base * 7) / 100))
    expect(sum(r.lines.map(l => l.discount))).toBe(r.itemsOrderTotal)
  })
})

describe('apply order: items → order → shipping, each on what is left', () => {
  it('an order discount applies to what the items discount left', () => {
    const items = discount({ _id: 'a1', trigger: 'automatic', target: 'items', value: 50, combinesWith: { order: true } })
    const order = discount({ _id: 'c', target: 'order', value: 10, combinesWith: { items: true } })
    const r = run({ lines: [line(1000)], couponCode: 'X', codeDiscount: order, automaticDiscounts: [items] })
    expect(r.applied.map(a => [a.discount._id, a.amount])).toEqual([['a1', 500], ['c', 50]])
    expect(r.lines[0].discount).toBe(550)
  })

  it('never goes below 0', () => {
    const a = discount({ _id: 'a', trigger: 'automatic', target: 'items', valueType: 'fixed', value: 800, combinesWith: { order: true } })
    const c = discount({ _id: 'c', target: 'order', valueType: 'fixed', value: 800, combinesWith: { items: true } })
    const r = run({ lines: [line(1000)], couponCode: 'X', codeDiscount: c, automaticDiscounts: [a] })
    expect(r.lines[0].discount).toBe(1000)
    expect(r.applied.map(x => x.amount)).toEqual([800, 200])
  })
})

describe('combinability', () => {
  it('needs both directions; two shipping discounts never', () => {
    const a = discount({ target: 'order', combinesWith: { shipping: true } })
    const s = bundleFreeShipping()
    expect(areCompatible(a, s)).toBe(true)
    expect(areCompatible(a, bundleFreeShipping({ combinesWith: { items: true } }))).toBe(false)
    expect(areCompatible(s, bundleFreeShipping({ _id: 'other', combinesWith: { shipping: true } }))).toBe(false)
  })

  it('migrated code + migrated bundle free shipping = today: both apply', () => {
    const r = run({
      lines: [line(2000, 1, { kind: 'wine' }), line(4990, 1, { kind: 'bundle' }, [3590, 1400])],
      couponCode: 'X',
      codeDiscount: discount({ value: 10 }),
      automaticDiscounts: [bundleFreeShipping()],
      shipping: delivery(700),
    })
    expect(r.couponError).toBeNull()
    expect(r.applied.map(a => a.discount._id)).toEqual(['d1', 'auto-ship'])
    expect(r.itemsOrderTotal).toBe(699) // 10 % of 6990, floor
    expect(r.shipping?.amount).toBe(700)
  })

  it('code not combinable, automatic saves more → automatic wins, code reported', () => {
    const auto = discount({ _id: 'auto', title: 'Herbstaktion', trigger: 'automatic', code: null, value: 20, combinesWith: {} })
    const r = run({ lines: [line(1000)], couponCode: 'TEN', codeDiscount: discount({ value: 10, combinesWith: {} }), automaticDiscounts: [auto] })
    expect(r.applied.map(a => a.discount._id)).toEqual(['auto'])
    expect(r.itemsOrderTotal).toBe(200)
    expect(r.couponError).toEqual({ code: 'TEN', errorCode: 'COUPON_NOT_COMBINABLE', discountTitle: 'Herbstaktion' })
    expect(r.notDiscountedLines).toEqual([])
  })

  it('code not combinable, code saves more → code wins', () => {
    const auto = discount({ _id: 'auto', trigger: 'automatic', code: null, value: 5, combinesWith: {} })
    const r = run({ lines: [line(1000)], couponCode: 'TEN', codeDiscount: discount({ value: 10, combinesWith: {} }), automaticDiscounts: [auto] })
    expect(r.applied.map(a => a.discount._id)).toEqual(['d1'])
    expect(r.couponError).toBeNull()
  })

  it('tie → the code set', () => {
    const auto = discount({ _id: 'auto', trigger: 'automatic', code: null, value: 10, combinesWith: {} })
    const r = run({ lines: [line(1000)], couponCode: 'TEN', codeDiscount: discount({ value: 10, combinesWith: {} }), automaticDiscounts: [auto] })
    expect(r.applied.map(a => a.discount._id)).toEqual(['d1'])
    expect(r.couponError).toBeNull()
  })

  it('shipping saving counts in the comparison', () => {
    // code 5 % of 1000 = 50 vs automatic free shipping 700 → automatic wins
    const r = run({
      lines: [line(1000, 1, { kind: 'bundle' }, [1000])],
      couponCode: 'FIVE',
      codeDiscount: discount({ value: 5, combinesWith: {}, ignoreShopExclusions: true }),
      automaticDiscounts: [bundleFreeShipping({ combinesWith: {} })],
      shipping: delivery(700),
    })
    expect(r.applied.map(a => a.discount._id)).toEqual(['auto-ship'])
    expect(r.couponError?.errorCode).toBe('COUPON_NOT_COMBINABLE')
    expect(r.couponError?.discountTitle).toBe('Versandkostenfrei mit Weinpaket')
  })

  it('two automatic discounts: compatible both apply, incompatible the larger one', () => {
    const a = discount({ _id: 'a', trigger: 'automatic', code: null, target: 'items', value: 10, combinesWith: { order: true } })
    const b = discount({ _id: 'b', trigger: 'automatic', code: null, target: 'order', value: 20, combinesWith: { items: true } })
    expect(run({ lines: [line(1000)], automaticDiscounts: [a, b] }).applied.map(x => x.discount._id)).toEqual(['a', 'b'])
    const bAlone = { ...b, combinesWith: {} }
    expect(run({ lines: [line(1000)], automaticDiscounts: [a, bAlone] }).applied.map(x => x.discount._id)).toEqual(['b'])
  })

  it('two automatic shipping discounts: only one applies', () => {
    const r = run({
      lines: [line(4990, 1, { kind: 'bundle' }, [4990])],
      automaticDiscounts: [bundleFreeShipping(), bundleFreeShipping({ _id: 'auto-ship-2', appliesTo: null })],
      shipping: delivery(700),
    })
    expect(r.applied).toHaveLength(1)
    expect(r.applied[0].discount._id).toBe('auto-ship') // tie on saving → lower _id
  })

  it('automatic discounts failing a condition are dropped silently', () => {
    const r = run({ lines: [line(1000)], automaticDiscounts: [discount({ _id: 'a', trigger: 'automatic', code: null, minSubtotal: 5000 })] })
    expect(r.applied).toEqual([])
    expect(r.couponError).toBeNull()
  })

  it('ignores entries that are not automatic in the automatic list', () => {
    const r = run({ lines: [line(1000)], automaticDiscounts: [discount({ _id: 'c', trigger: 'code' })] })
    expect(r.applied).toEqual([])
  })
})

describe('shipping discounts per method', () => {
  it('bundle in the cart → free shipping; without bundle → nothing', () => {
    const withBundle = run({ lines: [line(4990, 1, { kind: 'bundle' }, [4990])], automaticDiscounts: [bundleFreeShipping()], shipping: delivery(700) })
    expect(withBundle.shipping?.amount).toBe(700)
    expect(waivesShipping(withBundle, 'delivery')).toBe(true)
    expect(waivesShipping(withBundle, 'pickup')).toBe(false)
    const without = run({ lines: [line(2000)], automaticDiscounts: [bundleFreeShipping()], shipping: delivery(700) })
    expect(without.shipping).toBeNull()
    expect(waivesShipping(without, 'delivery')).toBe(false)
  })

  it('pickup is waived only with appliesToPickup (default: codes yes, automatic no)', () => {
    const lines = [line(4990, 1, { kind: 'bundle' }, [4990])]
    const auto = run({ lines, automaticDiscounts: [bundleFreeShipping({ appliesToPickup: null })], shipping: pickup(300) })
    expect(auto.shipping?.amount).toBe(0)
    expect(auto.shipping?.appliesToPickup).toBe(false)
    const autoPickup = run({ lines, automaticDiscounts: [bundleFreeShipping({ appliesToPickup: true })], shipping: pickup(300) })
    expect(autoPickup.shipping?.amount).toBe(300)
    const code = discount({ target: 'shipping', valueType: 'free', value: null, appliesToPickup: null })
    const codeRun = run({ lines: [line(1000)], couponCode: 'X', codeDiscount: code, shipping: pickup(300) })
    expect(codeRun.shipping?.amount).toBe(300)
    expect(waivesShipping(codeRun, 'pickup')).toBe(true)
  })

  it('digital lines never make a cart "contain" something for shipping', () => {
    const r = run({
      lines: [line(1000, 1, { kind: 'digital' })],
      couponCode: 'X',
      codeDiscount: discount({ target: 'shipping', valueType: 'free', value: null }),
      shipping: delivery(500),
    })
    expect(r.couponError?.errorCode).toBe('COUPON_NOT_APPLICABLE')
  })

  it('no method selected → applied with amount 0', () => {
    const r = run({ lines: [line(4990, 1, { kind: 'bundle' }, [4990])], automaticDiscounts: [bundleFreeShipping()], shipping: null })
    expect(r.shipping?.amount).toBe(0)
  })
})

describe('per-email limit', () => {
  it('drops the code once the email has used it', () => {
    const code = discount({ _id: 'c', maxPerEmail: 1 })
    expect(run({ lines: [line(1000)], couponCode: 'X', codeDiscount: code }).itemsOrderTotal).toBe(100)
    const r = run({ lines: [line(1000)], couponCode: 'X', codeDiscount: code, emailRedemptions: { c: 1 } })
    expect(r.itemsOrderTotal).toBe(0)
    expect(r.couponError?.errorCode).toBe('COUPON_LIMIT_PER_EMAIL')
  })
})
