# schema.org merchant listings: checkout-priced shipping per offer, no invented data

Status: Accepted
Date: 2026-10-19

## Context

After Tinhof's sitemap upload, Search Console reported merchant-listing and product-snippet warnings
(no brand/GTIN, no `shippingDetails`, no `hasMerchantReturnPolicy`, `validFrom`, reviews). Google
also offers a shop-wide shipping policy on the Organization (`hasShippingService` with conditions by
destination, weight, item count, order value).

## Decision

- **Shipping per offer, priced by checkout's own `resolveShippingMethods`** (qty 1, one entry per
  delivery method with all its countries). The Organization-level `ShippingService` can't express
  packaging groups (2 × 375 ml per place, own boxes for magnums) without approximations that undercut
  what checkout charges, and product-level markup overrides it anyway. Rebuilding the pricing in the
  schema code was rejected so markup and checkout can't drift.
- **Return policy on the Organization and on every offer.** Google documents the Organization
  policy as the default, but the Rich Results Test on live tinhof.at (2026-10-19) still flagged
  offers without `hasMerchantReturnPolicy`.
- **Never a `Product` without offers** (Google: invalid item, a critical error). Category pages list
  plain `ListItem`s; a variant without a price gets no product markup.
- **No invented data:** no `priceValidUntil`/`validFrom` (`_updatedAt` changes on any edit), no
  `handlingTime` (unknown; the delivery-time text is the total, published as `transitTime`), no
  ratings. Brand = manufacturer → `siteTitle` → `company.name` instead of a GTIN.
- **Variants as a multi-page `ProductGroup`** (each variant has its own page); several offers with
  different prices on one `Product` would read as one item offered at several prices.

## Consequences

Remaining warnings are optional and accepted: `handlingTime`, `aggregateRating`/`review`, possibly
`validFrom`; sold-out offers have no shipping details. Shipping details only count when a method's
delivery time contains the days as numbers ("2 – 5 Werktage") — a per-shop data requirement (go-live
checklist). Mechanism: `templates-and-assets.md` → "schema.org".
