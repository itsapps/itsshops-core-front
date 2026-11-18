# Free shipping granted by a variant flag, for the whole order

Status: accepted
Date: 2026-11-12

## Context

Tinhof's bundles should ship free. Options: a shop setting "bundles ship free", an
automatic-promotions engine (conditions → effects), or a flag on the variant. Open questions were
the scope (only the flagged item's share or the whole order), pickup, and whether core-front needs
its own feature flag.

## Decision

- A boolean `grantsFreeShipping` on `productVariant` (core-back flag `shop.productFreeShipping`
  shows the field). A shop setting would tie the rule to one product kind; a promotions engine is
  too big for now — this flag can later become one condition type inside one.
- One flagged line makes **every delivery method free for the whole order**, other items included
  (owner accepted that extra bottles ship free too). Only the line's own flag counts, never a
  bundle child's. Packaging is still computed (fulfilment needs the boxes); a method that can't
  pack the cart is still not offered. Pickup is out of scope (not configurable in the Studio).
- **Why a core-back flag at all** (owner, 2026-11-17; not recorded at first): without it every
  variant of every checkout shop would carry the "Versandkostenfrei" checkbox. Shops that never use
  it would get editor clutter with a costly failure mode — one stray tick makes whole orders ship
  free. Contrast: store pickup has no flag (plan `store-pickup.md`), since it only adds a list
  entry to the shipping method type and nothing can be switched on by accident.
- **The data is the switch in core-front:** it reads the field whatever the core-back flag says
  (missing → false). Turning the flag off only hides the field; unset the field on every variant
  first.
- The order stores why shipping was free (`fulfillment.freeShippingReason`), one value by
  precedence `product` > `threshold` > `coupon`: from the reason that holds whatever the cart
  total, to the one that depends on it, to the coupon. Studio only — checkout, mails and invoice
  stay unchanged ("—" / €0,00).

## Consequences

- No per-method opt-out; if a shop needs one, add a shipping-method switch (default on).
- Static pages (card note, tax line, shipping-info sentence, schema.org) change only with a build;
  checkout reads the flag live.
- `freeReason` on `AvailableShippingMethod` must stay server-only (`payment-create.ts` maps the
  client response field by field).
