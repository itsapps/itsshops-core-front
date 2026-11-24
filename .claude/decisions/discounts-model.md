# One discount model: codes + automatic discounts, one line-level pipeline

Status: accepted (built 2026-11-20, not released yet)
Date: 2026-11-20

## Context

A shop wanted bundles (already reduced) excluded from coupon discounts. After product free
shipping (`product-free-shipping-variant-flag.md`) that was the second one-off rule in the
checkout math, each a full plan. The coupon math used one global discount factor over the cart —
with exclusions a discount no longer reduces every line and VAT rate by the same factor, and the
wc-api spread the discount proportionally again on its own.

## Decision

- **One model** (owner, 2026-11-20): a `discount` document (core-back) with trigger `code` |
  `automatic`, target `items` | `order` | `shipping`, value `percent` | `fixed` | `free`, a
  `productSelector` (`appliesTo`), conditions, `combinesWith`, plus shop-wide exclusions
  (`shopSettings.discountExclusions`). Replaces `coupon` and the variant flag
  `grantsFreeShipping` (now an automatic shipping discount "cart contains kind bundle").
- **No "is reduced" concept** — a criterion "has compare-at price" next to kind / category /
  product; bundles are excluded by **kind = bundle** (a bundle isn't reduced by definition).
- **One pure pipeline** (`src/shared/discounts/`) for checkout and build; the allocation per line
  and per bundle item is **stored** on the order (`orderItem.discount`, `orderItemBundleItem.discount`)
  and read by VAT, mails and the wc-api — never recomputed.
- **At most one code**, plus automatic discounts; an incompatible pair → the larger saving wins,
  tie → the code.
- **The free-shipping threshold stays on the shipping method** (per method and country; the
  model has no country condition, and the build shows no conditional discounts). Threshold first,
  shipping discounts after the method is selected on real prices.
- **Old data is migrated** (structure, never amounts — `itsshops sanity migrate-discounts`); the
  old wc-api line algorithm is reproduced once for migrated orders so the ERP sees the same
  numbers. Only the webhook reads an old-shape `orderMeta`, for 30 days.
- core-front gets **no** `automaticDiscounts` flag — the data is the switch (core-back gates the
  Studio options).

## Consequences

- Tiered discounts, buy-X-get-Y, new conditions (login, country) are extension points
  (`conditions.ts`, `apply.ts`, `selector.ts`), not built.
- Per-line integer allocation can move a rate's VAT by a cent against the old fractional factor —
  accepted; tests follow the new rule.
- The shipping VAT basis stays the undiscounted gross per rate (tax advisor to confirm).
- Release needs a tight window: old frontend + new data (or the reverse) loses codes and bundle
  free shipping (plan → Rollout 4).
- Supersedes `product-free-shipping-variant-flag.md`.
