# Plan — bundles at checkout (missing checks, stock, packaging)

Status: **planned** (2026-10-25), nothing implemented. All decisions made (end of file). Origin:
review of how checkout handles `kind: 'bundle'` variants.

Spans core-front (cart validation, webhook, shipping calc, product page/markup) and, from phase 2/3,
core-back (order snapshot schema, maybe a bundle packaging field). Read core-back's `CLAUDE.md`
before touching it. Affects every shop that sells bundles (Tinhof too), not only Jurtschitsch. When
this ships, move the durable parts into `.claude/architecture/commerce-and-netlify.md` + core-back's
docs, add `CHANGELOG.md` entries, and delete this file.

## Current state (verified 2026-10-25)

- `validateCart` (`src/netlify/lib/cart-validator.ts`) checks a bundle only as a variant: exists,
  `status === 'active'`, has a price, quantity capped to the **bundle's own** `stock` (empty → no
  limit). The bundle's items are used only for weight and the `bundleItems` snapshot.
- The checkout query (`src/netlify/services/sanity.ts`, `bundleItems[]{ quantity, "variant":
  product->{…} }`) fetches item `stock` but not `status`. A `null` item (dangling/unpublished ref)
  throws on `bi.variant.kind` → checkout 500.
- Stock is reduced in `payment-webhooks.ts` (`handlePaymentSucceeded`) from `orderDoc.orderItems`
  only — the bundle variant, never its items. The order line stores only `bundle: { itemCount }`
  (`order-builder.ts`), so the webhook has no item list to work from.
- Build: the variant query keeps everything `status != 'archived'`, so a bundle with an inactive item
  still renders as buyable; `offerAvailability` (`src/schema/shipping.ts`) ignores items.
- Packaging (`calcWinePackagingCost`): bundle wine bottles are pooled with loose bottles, then boxed.
  Checked with boxes 1/3/6 places at €8/€10/€12: 1 bundle of 3 → 3-box €10; 2 bundles of 3 → one
  6-box €12; bundle of 3 + 3 loose → one 6-box €12; bundle of 2 wine + 300 g physical item → 3-box
  €10 **+ weight rate €5**. Consistent with the packaging-groups plan, but:
  - a bundle's own carton (gift box / 3-pack) isn't modelled;
  - non-wine items inside a wine bundle add a separate weight-rate parcel;
  - `resolveBundleWeight` ignores a wine item's explicit weight (`resolveVariantWeight` doesn't) —
    the "Separate, later" note from `wine-packaging-groups.md`.

## Phase 1 — Crash and status bugs (core-front only)

Phases 1 and 1b ship **before Jurtschitsch's production go-live** (in the core versions it goes live
with). Before 1b's error goes live, check the datasets for bundles that already contain
inactive/archived items (read-only GROQ — not run yet).

1. Guard `null` items: bundle → unavailable instead of a 500.
2. Add `status` to the bundle-item projection of the checkout query; any item not `active` → bundle
   unavailable.
3. Product page agrees with checkout: `offerAvailability` and the product page treat a bundle with an
   inactive/missing item as unavailable (resolved `bundleItems[].variant` needs `status`).
4. Tests in `src/netlify/__tests__/cart-validator.test.ts` (+ `src/schema/__tests__/schema.test.ts`).

### Phase 1b — Studio (core-back, no decisions)

Today nothing in the Studio reacts when a bundle item's variant leaves `active` (statuses: `active` /
`comingSoon` / `soldOut` / `archived`, set by hand; products have no status). The Product Manager's
`BundleTab.tsx` only offers active variants, but the `bundleItem` reference picker
(`schemas/objects/bundleItem.ts`) only excludes bundles and the own product — archived/inactive
variants can be picked. Strong refs block deleting/unpublishing a used variant, not a status change.
Archived variants are dropped from the build data, so their line silently disappears from the
bundle's item list on the product page while the bundle stays buyable.

1. Conditional validation **error** on the bundle variant's `bundleItems`: only while the bundle is
   `active` and an item is missing or not `active`. Not a plain error — it would block publishing the
   fix (setting the bundle to `soldOut`/`archived`, swapping the item). Validation only runs on the
   edited doc, so it can't stop the item's status change itself — checkout (phase 1) is the real
   guard, 1b.3 is what the editor sees at the moment of the change.
2. `bundleItem` reference filter: exclude non-active variants (like `BundleTab.tsx`) — at least
   `archived`.
3. Item variant: "used in N bundles" warning (badge or custom input listing the bundles) when its
   status is not `active`. Stays a warning — a wine's status change must never be blocked by a
   bundle.

## Phase 2 — Stock (decision A: both stocks)

No shop enables stock today (`features.shop.stock` is off in every backend, so `stock` is hidden and
empty = unlimited). Built anyway (decided 2026-10-25), ready for when a shop turns stock on.

1. Total demand per variant across the cart: loose qty + bundle qty × item qty, against each
   variant's stock. Cap/reject bundles whose items don't fit. The bundle's own `stock` (if set) is
   checked as well, as today — e.g. a limited number of gift boxes.
2. Reduce stock on paid orders: the bundle's own stock (as today) **and** each item's stock by
   bundle qty × item qty. Keep the items (variantId, quantity) in `orderMeta` / the order line so
   `commitOrderTransaction` reduces them in the same transaction.
3. Product page: bundle shows out of stock when its own stock or an item's stock can't fill one
   bundle.
4. Tests: stock across loose and bundle lines; webhook reductions.

## Phase 3 — Bundle contents on the order (core-back schema + core-front; decision C)

1. Order snapshot: `orderItemBundle` gets `items[]{ variantRef, title, sku, quantity }`.
2. Show the items in the order email and the Studio order view (packer needs them).
3. wc-api: copy WooCommerce Product Bundles' order format (decision C): the bundle line as today
   plus `bundled_items` (ids of its child lines); one child line per item right after it with
   `bundled_by` (parent line id), its own `product_id`/`variation_id`/`sku`, quantity = bundle qty ×
   item qty, price/totals/taxes €0 — VAT and totals stay on the parent, so the rounding and
   tax-line invariants in `wc-api.md` hold. Child line ids: stable hash of order number + bundle
   line `_key` + item variant id. Document in `wc-api.md`; tests in `wc-api.test.ts`.

## Phase 4 — Packaging (decisions B, D)

1. ~~Bundle with its own carton~~ — not needed: Jurtschitsch bundles are re-boxed with the rest of
   the cart, which is today's calculation. Revisit only if another shop ships bundles in their own
   carton.
2. ~~Non-wine items packed with wine ride free~~ — parked (decision D): unchanged for now, non-wine
   weight keeps paying the weight rates on top of the boxes.
3. `resolveBundleWeight`: use an item's explicit weight first. Checkout and markup share the
   function, so they stay in sync.

## Out of scope

Stock is checked at payment creation but reduced in the webhook, so concurrent payments can still
oversell — affects all items, not only bundles; separate item.

## Open decisions

Decided 2026-10-25:
- **A — Stock model:** both — items' stock is checked and reduced, and the bundle's own `stock` (if
  set) is checked and reduced too.
- **B — Packaging:** Jurtschitsch bundles are re-boxed with the cart (today's calculation).
- **C — wineNET:** copy the Product Bundles format (parent + €0 child lines linked by
  `bundled_by`/`bundled_items`; https://woocommerce.com/document/bundles/bundles-rest-api-reference/).
  An ERP with WC bundle support won't count the bottles twice; a simple one at least sees them.
  Still confirm with wineNET whether it reads `bundled_by`.
  **No switch — for every shop** (decided 2026-10-25): only new orders containing a bundle change
  (older orders have no stored item list and stay one line; non-bundle orders are identical), and a
  shop only gets it when its core pin is bumped. wc-api users: Tinhof (live, wineNET — has no bundle
  products, so its output doesn't change), Jurtschitsch (will use the wc-api; no `wc_api` function
  yet). grass-art has a `wc_api.mts` but won't use the wc-api or wineNET — ignore it. wineNET
  must confirm the format before Jurtschitsch goes live with it / before Tinhof adds a bundle.
- **D — Non-wine with wine:** unchanged for now — non-wine weight (loose or in a bundle) pays the
  weight rates on top of the boxes. Errs on the safe side (overcharges a mixed cart a little, never
  undercharges) and matches the product-page markup. Revisit when Jurtschitsch sells a mixed bundle
  (only Jurtschitsch allows both: `productKinds: ['wine', 'bundle', 'physical']`); then choose
  "free in the wine box" vs "free only inside bundles" in `calcWinePackagingCost`. Don't restrict
  bundle contents to wine — grass-art has physical-only bundles (`['physical', 'bundle']`).
