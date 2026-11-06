# Plan — bundles at checkout (missing checks, order contents, packaging) + cart changes at checkout

Status: **planned** (2026-10-25, reviewed 2026-11-02, refined against the code 2026-11-06, eight
times — 7th: phase 6 locale-independent bundle contents key, stale-response guard, notice placement;
8th: phases 1–5 code re-read in full — Jurtschitsch `unavailable` branch, bundle item `price`
semantics, no duplicate subtitle under the item list),
nothing implemented, no decision open (F, G, H, I decided 2026-11-06; Tinhof's tax advisor confirms F
before phase 5 ships). Phase 6 (checkout reports cart changes, every product kind) added
2026-11-06 — owner: ship it together with the bundle work. Origin: review of how checkout handles `kind: 'bundle'`
variants. **Stock** (bundle items' stock, the `stock` field, webhook reductions) was split off on
2026-11-06 into `stock-tracking.md` (parked — no shop uses stock).

Spans core-front (cart validation, order builder, mails, wc-api, shipping calc, product page/markup)
and core-back (Studio validation, order snapshot schema). Phase 5 (VAT from the items) is needed
first by **Tinhof** (bundles mixing wine 13 % and Traubensaft 20 %), but applies to every shop. Read core-back's `CLAUDE.md`
before touching it. Affects every shop that sells bundles — Jurtschitsch, grass-art, Tinhof, and
more customers are expected to (owner, 2026-11-06) — so everything here is generic core behaviour,
no per-shop switch. When
this ships, move the durable parts into `.claude/architecture/commerce-and-netlify.md` + core-back's
docs, add `CHANGELOG.md` entries, and delete this file.

## Current state (verified 2026-10-25, re-checked 2026-11-06)

- `validateCart` (`src/netlify/lib/cart-validator.ts`) checks a bundle only as a variant: exists,
  `status === 'active'`, has a price (and its own stock — see `stock-tracking.md`). The bundle's
  items are used only for weight and the `bundleItems` snapshot.
- The checkout query (`src/netlify/services/sanity.ts`, `bundleItems[]{ quantity, "variant":
  product->{…} }`) doesn't fetch item `status`. A `null` item (dangling/unpublished ref)
  throws on `bi.variant.kind` → checkout 500.
- The order line stores only `bundle: { itemCount }` (`order-builder.ts`): mails, the Studio and
  the wc-api can't say what's in a bundle.
- Build: the variant query keeps everything `status != 'archived'`, so a bundle with an inactive item
  still renders as buyable; `offerAvailability` (`src/schema/shipping.ts`) ignores items. The
  resolver (`src/data/resolve/variants.ts`, `bundleItems` `flatMap`) silently drops an item whose
  variant isn't in `rawVariantMap` (archived or dangling), so the resolved bundle can't tell it lost
  an item.
- A bundle with empty/`null` `bundleItems` passes validation (weight `null`). The Studio already
  requires `bundleItems` on a bundle (`validateRequiredArrayIfKind('bundle')`,
  core-back `productVariant.ts`), so this only hits old or API-written data.
- The product page, cards and variant pickers decide "buyable" from `status` alone
  (`core/components/product/card.njk`, `product/container.njk`, `macros/product.njk`); the resolver
  sets `status` in three places (`variants.ts`: siblings `s.status`, option targets
  `productVariants[].status`, the variant itself). Resolved `bundleItems[].variant` carries no
  `status`.
- Packaging (`calcWinePackagingCost`): bundle wine bottles are pooled with loose bottles, then boxed.
  Checked with boxes 1/3/6 places at €8/€10/€12: 1 bundle of 3 → 3-box €10; 2 bundles of 3 → one
  6-box €12; bundle of 3 + 3 loose → one 6-box €12; bundle of 2 wine + 300 g physical item → 3-box
  €10 **+ weight rate €5**. Consistent with the packaging-groups plan, but:
  - a bundle's own carton (gift box / 3-pack) isn't modelled;
  - non-wine items inside a wine bundle add a separate weight-rate parcel;
  - `resolveBundleWeight` ignores a wine item's explicit weight (`resolveVariantWeight` doesn't) —
    noted in its doc comment (`shipping.ts`); fixed in phase 4.3.

## Phase 1 — Crash and status bugs (core-front only)

Phases 1 and 1b ship **before Jurtschitsch's production go-live** (in the core versions it goes live
with). Step 0 (dataset check) runs before 1b's error goes live — not run yet.

0. Dataset check (read-only, before 1b's error goes live), from each customer frontend that sells
   bundles (Jurtschitsch, grass-art; Tinhof has none), once per dataset (`-e` for production):
   `itsshops sanity query '*[_type == "productVariant" && kind == "bundle" && status == "active" && !(_id in path("drafts.**")) && (!defined(bundleItems) || count(bundleItems) == 0 || count(bundleItems[!defined(product->_id) || product->status != "active"]) > 0)]{_id, title, "items": bundleItems[]{"id": product._ref, "status": product->status}}'`
   — hits become editor to-dos (set the bundle to `soldOut` or swap the item), listed in the
   customer's `CLAUDE.md`.
   Same for 1b.4 (every shop, all kinds) — active variants without any price:
   `itsshops sanity query '*[_type == "productVariant" && status == "active" && !defined(price) && !defined(product->price) && !(_id in path("drafts.**"))]{_id, title, kind}'`
   — hits get a price (or another status) before 1b ships.
1. `validateCart`: for `kind === 'bundle'`, before the weight/`bundleItems` mapping — no items
   (`!variant.bundleItems?.length`) or any `bi.variant == null` → `unavailableItems`, `continue`.
2. Checkout query (`CHECKOUT_QUERY` in `src/netlify/services/sanity.ts`): add `status` inside the
   bundle item's `"variant": product->{…}` sub-projection (there `product` is the bundleItem's
   reference to the item **variant**; the item's own product is `product->product`);
   `SanityBundleItemResult.variant` gets `status`. Same guard as 1: any item `status !== 'active'`
   → bundle unavailable. The client already handles `unavailableItems` (no UI change).
3. Product page agrees with checkout — **effective status in the resolver**, so cards, product page,
   variant pickers, search and `offerAvailability` all follow with no template change (customer
   overrides too). In `resolveVariants` (`src/data/resolve/variants.ts`), before the passes: an
   exported pure helper `effectiveStatus(raw, rawVariantMap, productMap)` (`productMap` for the
   inherited product price, see "No price" below) — a raw bundle whose `status` is
   `active` and that has no items, or an item id missing from `rawVariantMap` (archived/dangling),
   or an item whose `stegaClean(status)` isn't `active`, becomes `soldOut`; everything else keeps
   its status. Use it at all three status sites (siblings, `productVariants[]` option targets, the
   variant). The label "Ausverkauft" comes from the existing `product.states.soldOut`.
   **No price** (any kind, not only bundles): today an `active` variant whose variant and product
   have no `price` resolves to `price: 0` (`variants.ts`, `?? 0`) → page shows €0,00 with a buy
   button, checkout then drops it. The same helper turns such a variant into a new resolved-only
   status `unavailable` (not a schema value; extend both unions in `src/types/data.ts` —
   `ResolvedVariant['status']` and the `variantAxes[].options[].status` literal; `siblings[].status`
   is already `string`), label `product.states.unavailable` (new key next to `soldOut` in
   `src/i18n/translations/de_11ty.ts` / `en_11ty.ts`, de "Derzeit nicht erhältlich" / en "Currently
   unavailable"; no `.informal` overlay needed — no form of address). schema.org already emits no
   offer for `price` 0 (`src/schema/index.ts`), nothing to change there. Going through `status` is required, not optional: the customer
   overrides of `product/container.njk` (Tinhof, Jurtschitsch, grass-art) and
   `product/card.njk` (Jurtschitsch) check `status == "active"` themselves (rosi_schuster's
   container only writes `data-status`; no change). Price macro (`macros/product.njk`,
   `productPrice`): render nothing when `product.price` is 0/empty, so no "€0,00". **Customer
   change (Jurtschitsch frontend):** `overridable/product/card.njk` prints `{{ product.price |
   formatPrice }}` directly (not via the macro) — wrap that price block in `{% if product.price %}`
   in the same release (its `container.njk` already uses `productPrice`). Same release, same repo:
   Jurtschitsch's `container.njk` and `card.njk` actions only branch `soldOut` (label) / `active`
   (buttons), so an `unavailable` variant would show **neither** a button nor a reason — change
   both `soldOut` branches to `{% elif product.status in ['soldOut', 'unavailable'] %}` (container:
   `{% if … %}`) and print `('product.states.' + product.status) | trans`. Tinhof and grass-art
   need nothing (their non-active branch already shows the status label).
   (`stock-tracking.md` later folds stock into the same helper.)
4. Tests: `src/netlify/__tests__/cart-validator.test.ts` (null item, no items, inactive item →
   unavailable; active bundle unchanged), and a new `src/data/__tests__/bundle-status.test.ts`:
   `effectiveStatus` (no items, archived/dangling item, inactive item, stega-encoded status →
   `soldOut`; no own and no product price → `unavailable`; inherited product price → unchanged),
   plus one `resolveVariants` case checking the bundle's status, a sibling's and a
   `variantAxes` option's all follow it. (`offerAvailability` only reads `status`, no new test.)
5. Ship: core-front minor release, `CHANGELOG.md` ("a bundle with an inactive/missing item is sold
   out on the page and refused at checkout").

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
   guard, 1b.3 is what the editor sees at the moment of the change. Mechanism: chain an async
   `rule.custom` after the existing `validateRequiredArrayIfKind('bundle')` (keep the required
   check); skip unless `document.kind === 'bundle' && document.status === 'active'`; fetch
   `*[_id in $ids]{_id, status}` (published ids of `value[].product._ref`) via
   `context.getClient({ apiVersion: ctx.config.apiVersion })`; message names the offending items
   (new key, de + en). Pattern to copy: the async code check in `schemas/documents/coupon.ts`
   (`t.default('coupon.validation.codeInUse', fallback)`) — keys here
   `productVariant.validation.<name>`.
   **Duplicate items**, in the same `rule.custom`, **before** the active-only skip (it applies to
   every status and needs no query): error when two entries of `value` have the same
   `product._ref` (compare published ids, `_ref` without a `drafts.` prefix); message names the
   variant and says to raise its quantity instead (new key `productVariant.validation.duplicateItem`,
   de + en). An error is fine here — the editor fixes it in the same edit (delete one entry, raise
   the other's quantity). Today only the Product Manager prevents duplicates (`BundleTab.tsx`
   hides picked variants and ignores a second add); the document form and API writes don't.
   Dataset check for old data (step 0 style, read-only, each bundle shop + `-e` production):
   `itsshops sanity query '*[_type == "productVariant" && kind == "bundle" && !(_id in path("drafts.**")) && count(bundleItems) != count(array::unique(bundleItems[].product._ref))]{_id, title}'`
   — hits become editor to-dos in the customer's `CLAUDE.md`. Checkout and the wc-api stay safe
   either way (line ids use the bundle item's `_key`, phase 5.2).
2. `bundleItem` reference filter (`schemas/objects/bundleItem.ts`): add `&& status == "active"` to
   the existing filter — same rule as `BundleTab.tsx`'s query.
3. Item variant: async `rule.custom(...).warning()` on the variant's `status` field — when the value
   isn't `active`, query `*[_type == "productVariant" && kind == "bundle" && status == "active" &&
   references($id) && !(_id in path("drafts.**"))]{title}` (`$id` = published id) and warn
   "used in N active bundles: …" (new `schemaT` key, de + en). A warning never blocks publishing —
   a wine's status change must never be blocked by a bundle.
   Add the rule only when `ctx.featureRegistry.isFeatureEnabled('shop.productKind.bundle')` (the
   `status` field is built for every shop; without the gate a shop without bundles, e.g.
   rosi_schuster `['wine']`, runs a useless query on every validation). 1b.1 and 1b.2 need no gate:
   they sit in `getBundleFields` / the `bundleItem` type, which exist only when bundles are on.
4. **Price required** (decision H; every kind, not only bundles): async `rule.custom` on the
   variant's `price` — error when `document.status === 'active'`, the variant has no `price` and
   its product (published id of `document.product._ref`, fetched via `context.getClient`) has none
   either. Inherited product price is enough; `comingSoon`/`soldOut`/`archived` publish without a
   price; drafts can always be saved. Keep `Rule.positive()`. New `schemaT` key, de + en.
   **Product Manager bypasses this:** it writes **published**, `status: 'active'` variants directly
   (`baseVariant` in `src/lib/shop/productVariant.tx.ts`, `tx.create` with non-draft ids), so no
   schema validation runs. Its `canSubmit` (Wine/PhysicalDigital/Bundle tabs) already requires
   "global price or every row's price" — but only when `!hideProductSection`; in
   `AddVariantsAction.tsx` (adding variants to an existing product) the check is skipped. Fix: the
   dialog's existing product fetch (`"product": *[_type == "product" && _id == $productId][0]{ _id,
   kind }`) adds `price` (`ProductWithKind` gets `price?: number`), and its `globalProps` passes
   `globalPrice: product?.price` instead of the hard-coded `undefined`. The add-variants submit
   handlers never write `globalPrice`, so this only feeds the check and the rows' existing
   `globalPrice` prop (Wine/Bundle rows). The three `canSubmit`s (`WineTab.tsx`,
   `PhysicalDigitalTab.tsx`, `BundleTab.tsx`) check `!globalPrice && rows.some(r => !r.price)`
   regardless of `hideProductSection` (title check stays inside it). Tax is unchanged for
   wine/physical/digital: product tax + optional per-row override is exactly what checkout reads
   (`variant ?? product ?? shop default`).
5. Product side (validation only runs on the edited doc, so 4 can't catch a product price being
   removed later): `rule.custom(...).warning()` on the product's `price` — when it's empty, count
   `*[_type == "productVariant" && product._ref == $id && status == "active" && !defined(price)
   && !(_id in path("drafts.**"))]` and warn "N active variants have no price of their own". A
   warning, never blocks publishing; phase 1.3 keeps the page and checkout safe meanwhile.
6. Ship: core-back minor release + `CHANGELOG.md` (incl. "an active variant needs a price — own or
   the product's"; existing unpriced active variants show the error on their next edit; "a bundle can't list the same variant twice — raise its quantity"); update
   core-back's schema docs (`.claude/architecture/schemas.md`, bundle and price parts).

(Phase 2 — stock — moved to `stock-tracking.md`; phase numbers kept, other docs point at
"phase 3".)

## Phase 3 — Bundle contents on the order (core-back schema + core-front)

1. Order snapshot: `orderItemBundle` gets `items[]` of a new object type `orderItemBundleItem`
   `{ variantId, productId, title, sku, quantity }` — plain strings like `orderItem.variantId` /
   `productId` (no reference, so deleting a variant never breaks an order), `readOnly:
   !ctx.config.isDev` like `orderItem`; `itemCount` stays. Steps:
   - core-back: `schemas/objects/orders/orderItemBundleItem.ts`, `items` array on
     `orderItemBundle`, register in `schemas/objects.ts`, regenerate `sanity.types.ts` (both repos).
     `orderMeta` reuses `orderItem`, so it's covered.
   - Snapshot fields (final list for phase 3; phase 5.2 adds `price`, `vatRate`, `vatAmount`):
     `{ variantId, productId, title, subtitle, sku, quantity }` — `subtitle` as on
     a loose line (vintage · volume, or options), else "2 × Blaufränkisch" can't tell vintages apart.
     The `{ … }` list above is superseded by this one. Same `feature: 'shop'` as `orderItemBundle`.
   - Checkout query, inside the bundle item's `"variant": product->{…}` sub-projection (next to the
     existing `"productWeight": product->weight`): add `sku`, `"productId": product._ref`,
     `"productTitle": product->title`, `options[]->{ title, "groupTitle": group->title }`
     (`wine` is already there). Extend `SanityBundleItemResult.variant`.
   - `validateCart`: `bundleItems[]` gains `title` (`resolveLocalizedTitle(bi.variant.title, locale,
     defaultLocale) || resolveLocalizedTitle(bi.variant.productTitle, locale, defaultLocale)`, order
     locale, like the parent), `subtitle`
     (`composeSubtitle(kind, wine, options)` from `order-item-display.ts`, as the parent's
     fallback), `sku`, `productId`; extend the `ValidatedCartItem.bundleItems` type.
   - `buildOrderItems`: write `bundle.items` (`_key`, `_type: 'orderItemBundleItem'`, `quantity` =
     per bundle, not × bundle qty). It travels via `orderMeta.orderItems` into the order
     (`stock-tracking.md` reduces item stock from it later).
2. Show the items (quantity × title – subtitle, per bundle) under the bundle line in both mails —
   one change in `ItemRow` (`src/netlify/templates/email/OrderEmail.tsx`; `ShopOrderEmail.tsx`, the
   packer's copy, imports it) — and in the Studio order view. The mail rows come from one pure helper `bundleItemLines(orderItem)` in
   `src/netlify/lib/order-item-display.ts` → `[{ quantity, totalQuantity, title, subtitle }]`
   (`quantity` per bundle, `totalQuantity` = × the line's quantity; `[]` without `bundle.items`);
   the mails print `quantity` (under "2x Box" the box's contents, "2 × Wein"), the invoice
   (phase 5.2) prints `totalQuantity`. Test it in a new `src/netlify/__tests__/order-item-display.test.ts`.
   Studio order view: core-back `components/OrderView.tsx` (type `bundle?: { itemCount; items? }`),
   same per-bundle quantities. The item list is a nested
   list under the line (`<ul>` in the mail, not a layout table), so screen readers read it as the
   bundle's contents. Test: `order-email.test.tsx` (bundle with items renders them; without
   `items` unchanged). **No duplicate contents:** a bundle line's `subtitle` is the "2× A, 1× B"
   list (from phase 6 always the server's), so where the item list is shown the subtitle is not:
   `ItemRow` and — from phase 5.2 — the invoice (`InvoicePdf.tsx`, `orderItems.map` row) print
   `item.subtitle` only when `bundleItemLines(item)` is empty; core-back's `OrderItemRow` in
   `OrderView.tsx` (can't import core-front's helper) only when `!item.bundle?.items?.length`.
   Older orders keep their subtitle. Invoice PDF stays one priced line. Older orders without `items` render as
   today. Mails read the stored doc (`fetchOrderById` = `getDocument`), so no projection change.
3. wc-api: each bundle is **replaced by its items as ordinary line items** (decision C) — built in
   phase 5.2, because the item lines need the price shares stored there.

## Phase 4 — Packaging (decisions B, D)

1. ~~Bundle with its own carton~~ — not needed: Jurtschitsch bundles are re-boxed with the rest of
   the cart, which is today's calculation. Revisit only if another shop ships bundles in their own
   carton.
2. ~~Non-wine items packed with wine ride free~~ — parked (decision D): unchanged for now, non-wine
   weight keeps paying the weight rates on top of the boxes.
3. `resolveBundleWeight`: use an item's explicit weight first. Checkout and markup share the
   function, so they stay in sync. This also removes a mismatch within one cart item: the per-item
   `bundleItems[].weight` (used for non-wine packaging weight) already uses the explicit weight, the
   bundle's line weight doesn't. Drop the "see the plan's 'Separate, later'" note in its doc comment
   (`src/netlify/lib/shipping.ts`) and the matching caveat in `commerce-and-netlify.md`
   (packaging/weight part).

## Phase 5 — VAT and wc-api lines from the bundle's items (core-front + core-back; decisions C, F, G)

Today a bundle is taxed by its own tax category (variant → product → shop default), like any
variant, and every order line carries **one** `vatRate`: `calculateTotals` (discount factor,
`buildVatBreakdown`), `dominantItemVatRate` (shipping VAT), wc-api (`lines`, `tax_lines` from
`orderItems[].vatRate`), the Studio order view (core-back `OrderView.tsx`, `item.vatRate` per line),
the order schema (`orderItem.vatRate`/`vatAmount` required). Mails and the invoice PDF show only
`totals.vatBreakdown`, no per-line rate. Coupons are order-wide (`coupon.ts` has no product
restrictions) and spread over lines by gross value. Example (Tinhof): €30 box = 2 × €12 wine (13 %)
+ €6 juice (20 %) → today 13 % on all = €3.45 VAT; split = €2.76 + €1.00 = €3.76.

1. **Item prices and rates at checkout.** Checkout query, same `"variant": product->{…}`
   sub-projection as phase 3.1 (fields relative to the item variant): add `price`,
   `"productPrice": product->price`, `"taxCategoryCode": taxCategory->code.current`,
   `"productTaxCategoryCode": product->taxCategory->code.current`. `validateCart` resolves each
   item's rate exactly like a loose line (`findTaxRate(rules, item ?? product category,
   defaultTaxCategoryCode)` — so Tatschler Weißburgunder's variant override counts). The bundle's
   own tax category is no longer used; core-back hides `taxCategory` on `kind: 'bundle'` variants
   (and on products whose `kind` is `bundle`): `hidden: ({ document }) => document?.kind ===
   'bundle'` on the `taxCategory` field in `schemas/documents/productVariant.ts` and
   `product.ts`. Existing values stay in the data, unused (no migration).
   **Product Manager** (core-back `components/products/productManager/`, ships in the same core-back
   release, not before — until phase 5 the bundle's own rate is what checkout uses): today it asks
   for a tax category on a bundle twice and writes both — the product's (`GlobalDefaults` in
   `MainProduct.tsx`, **pre-filled with `shopSettings.defaultTaxCategory`**, so every bundle
   product gets one silently) and each variant row's (`TaxCategoryField` in `BundleTab.tsx`).
   Changes: `GlobalDefaults` renders `TaxCategoryField` only when `kind !== 'bundle'` (grid
   columns adjust); `BundleTab.tsx` drops the row's `TaxCategoryField` (price field alone);
   `BundleVariantRow` loses `taxCategoryId` (`ProductCreator.types.ts`; `emptyBundleRow` in
   `BundleTab.tsx`);
   `addBundleVariantToTx` (`src/lib/shop/productVariant.tx.ts`) passes no tax id to `baseVariant`;
   `handleBundleSubmit` in `ProductCreator.tsx` passes no `taxId` to `addProductToTx`
   (`AddVariantsAction.tsx`'s bundle path only adds variants, covered by the row change). Add a
   one-line hint under the bundle price (new `componentT` key, de + en): "VAT is taken from the
   items" — editors otherwise wonder where the rate went.
2. **Split every bundle** (decision F: by single sale prices) — one rate or mixed, one code path. At checkout,
   split the bundle's **unit** price over its items in the ratio of their own gross prices (item
   price ?? product price, × item qty), in cents, the last item takes the remainder (so the parts
   × bundle qty always add up to the line exactly); works when the bundle is cheaper than its
   items. An item without a price (own and product's) → bundle unavailable at checkout (same
   guard as 1.1/1.2) + Studio error on the bundle (no ratio possible): 1b.1's async check fetches
   `*[_id in $ids]{_id, status, price, "productPrice": product->price}` and also flags items with
   neither price (one message key per cause). 1b.4 already prevents this for edited items; this
   catches old data. The Product Manager writes bundles without validation (see 1b.4), so
   `BundleTab.tsx`'s item query (`kind != "bundle" && status == "active"`) also gets
   `&& (defined(price) || defined(product->price))` — unpriced variants can't be picked as items.
   Same filter on the `bundleItem` reference picker (1b.2). **Page agrees:** extend phase 1.3's `effectiveStatus` — an `active` bundle with
   an item whose raw variant (`rawVariantMap`) has no `price` and whose product
   (`productMap.get(rawV.productId)`) has none either → `unavailable` (same label as an unpriced
   variant); otherwise the page offers a bundle that checkout refuses. Test in
   `bundle-status.test.ts`.
   - Data: each `orderItemBundleItem` (phase 3.1) also stores `price` (its gross share of **one**
     bundle, for all its `quantity` units together — e.g. 2 × wine in a €30 box → 2400, not 1200 per
     bottle; documented on the schema field, since a loose line's `price` is per unit),
     `vatRate`, `vatAmount` (`extractVat(price × bundle qty, vatRate)`). The parent keeps the required
     fields: `vatAmount` = sum of the parts, `vatRate` = the rate of the largest part (display
     only; documented on the schema field). `ValidatedCartItem.bundleItems[]` gets the same fields.
     The split is stored, never recomputed — later price changes don't touch old orders.
   - One helper `vatParts(item)` in `src/netlify/lib/tax.ts` → `[{ gross, vatRate }]`: a bundle's
     parts (share × line qty), else the line itself. Used by `calculateTotals` (discount factor and
     `buildVatBreakdown` over the parts — the discount is proportional, so splitting before or
     after it gives the same result) and `dominantItemVatRate` — both take `ValidatedCartItem`s.
     The wc-api reads the stored order, not cart items, so it doesn't use `vatParts`; its own
     expansion (next bullet) works on the stored `bundle.items`.
   - **wc-api** (decision C): a bundle line is replaced by one ordinary line per item — no parent
     line, no €0 lines, no `bundled_by`/`bundled_items`. Per item line: `product_id` /
     `variation_id` = `stableId(item.productId)` / `stableId(item.variantId)` (same as when the
     wine is bought loose, so wineNET's learned product-id mapping suggests the article), `sku`,
     `name` = `title - subtitle` (the item's, built like a loose line's), `quantity` = bundle qty × item qty, gross = share × bundle qty, its own
     `taxes`; `meta_data` adds `_bundle_title`, `_bundle_sku`, `_bundle_variant_id` next to
     `_sanity_product_id`/`_sanity_variant_id`. Line `id`: `stableId(`${orderNumber}:${line._key}:${bundleItem._key}`)`
     — the bundle item's `_key`, not its variant id (old or API-written data can hold the same
     variant twice in one bundle; the Studio blocks it from phase 1b.1). Ids must be unique within the order (32-bit djb2 mod 2e9 can
     clash): keep a `Set` of used ids while building `line_items`; on a clash re-hash with
     `:1`, `:2`, … appended until free — deterministic, so the same order always gets the same ids. Expand in the `orderItems[]` projection's consumer **before** `lines` is
     built, so the coupon allocation (same factor per line, discounted gross rounded per line, the
     last line of the order takes the remainder), `price` (= net after discount ÷ quantity,
     unrounded), `subtotal`/`total`/`total_tax`, the `rates` set and `tax_lines` all run over the
     expanded list. One change in `mapOrder`: it computes a line's gross as `item.price *
     item.quantity`, but an item line's gross (share × bundle qty) isn't a whole-cent unit price ×
     its quantity (bundle qty × item qty) — so each line carries `lineGross` (expanded: share ×
     bundle qty; ordinary: `price × quantity`) and both `discountedGrossPerItem` and `lines` read
     `lineGross`. Everything else unchanged. Projection: add `bundle{ items[]{ _key, variantId, productId, sku, subtitle,
     title, quantity, price, vatRate } }`. Older bundle orders (no `items`) stay one line. Example
     (10 % coupon, the €30 box): wine qty 2, gross 24.00 → 21.60, `total` 19.12, `total_tax` 2.48,
     `price` 9.5575…; juice qty 1, 6.00 → 5.40, `total` 4.50, `total_tax` 0.90; sum €27.00.
   - Studio order view: a mixed bundle shows its parts' rates ("13 % / 20 %") instead of the parent
     rate; the bundle item list (phase 3.2) shows each item's rate.
   - Invoice PDF (`src/netlify/templates/pdf/InvoicePdf.tsx`, decision F): under a bundle line, one unpriced
     line per item — quantity per bundle × bundle qty, title, its VAT rate (e.g. "2 × Wein,
     13 %"); the per-rate breakdown is already correct from the totals. Mails keep the item list
     from phase 3.2 (no rates). Older orders without `items` render as today. The rows come from
     phase 3.2's `bundleItemLines(orderItem)`, extended with `vatRate` (`null` on orders from
     between phases 3 and 5); the PDF prints `totalQuantity`, `ItemRow` ignores `vatRate` — no
     PDF render test exists, the helper is what gets tested.
3. Tests: `validateCart` (rate from items, variant override, one-rate and mixed split, remainder
   on the last item, missing price); `totals.test.ts` (percent and fixed coupon on a mixed bundle +
   loose item: VAT per rate, grand total to the cent); `order-item-display.test.ts` (from 3.2:
   `bundleItemLines` `quantity` per bundle, `totalQuantity` × bundle qty, rates, old order → `[]`); `tax.test.ts` (`dominantItemVatRate` over
   parts); `wc-api.test.ts` (bundle → item lines, no parent; same `product_id` as the loose wine;
   unique line ids, also with the same variant twice in one bundle; item qty 3 in a bundle of qty 2 → `quantity` 6, `subtotal` = share × 2 exactly;
   with a coupon, line totals + shipping = grand total and `tax_lines` match;
   old order without `items` unchanged). Update `wc-api.md` (replace "Bundles are one plain line").
4. Ship: core-back (schema fields, hidden tax field, validation) before core-front; `CHANGELOG.md`
   in both. **Before release:** Tinhof's tax advisor confirms the split by single sale prices and
   the invoice layout (decision F). Tinhof: tell the owner how bundle VAT works (taken from the wines/juice, split by
   single prices) and that a bundle's items need prices; tell wineNET (Andi) that bundles arrive
   as their single wines. No interim guard: Tinhof starts creating bundles only when told to,
   after phase 5 is live (owner's call, 2026-11-06).

## Phase 6 — Checkout reports cart changes (core-front; every kind, not only bundles)

Why: checkout reads Sanity live, the site only changes on a deploy (Studio `DeployDialog` or a push
— no per-publish build hook, `netlify-plans.md`). Between a publish and the next deploy, product
page, cards, search, the add-to-cart button's `data-price`/`data-subtitle` and schema.org still show
the old data, so the cart (localStorage, `src/scripts/cart-store.ts`: `id, title, subtitle, price,
quantity, imageUrl, url`) is filled with it. Today (verified 2026-11-06):
- price changed → charged at the new price, `syncPricesFromServer` updates the cart **silently**
  (`checkout.ts`, `calculate()`);
- variant gone / not `active` / no price → dropped from the summary, generic
  `checkout.itemsUnavailable` ("… wurden entfernt") — but **not** removed from the cart (sidebar,
  badge, every later request still carry it), and the message doesn't say which;
- stock below the quantity → line note "(N verfügbar)" (`checkout-summary.ts`), cart keeps the old
  quantity;
- bundle contents changed → the cart's frozen subtitle ("2× A, 1× B", built by
  `addToCartButton` in `macros/product.njk`) is canonical: `validateCart` takes the client subtitle,
  the summary prefers `local.subtitle`, the order line stores it — old contents in the summary,
  mails and invoice;
- submit: `createPayment` re-validates and the client calls `confirmPayment` right away — a change
  between the last calculate and the click is paid without being shown (AT/DE: the final price
  must be visible before ordering). Same in the express flow (`mountExpressCheckout`, its
  `createPayment` callback).

Steps:
1. **Bundle subtitle from the server.** `composeSubtitle` (`src/netlify/lib/order-item-display.ts`)
   gains an optional 4th parameter `bundleItems: { quantity: number; title: string }[] | null` and
   a bundle branch: `${quantity}× ${title}` per item, joined `, ` — the macro's format
   (`addToCartButton`: `item.quantity + '× ' + item.variant.title`; the resolver's item title is
   variant title || product title, same as phase 3.1's), item titles from phase 3.1 (order
   locale). Its only caller is `validateCart`. `validateCart`: for `kind === 'bundle'` always use it,
   ignore the client subtitle (other kinds unchanged). Update the helper's doc comment ("canonical
   wording comes from the client" — not for bundles). Titles stay client-canonical for every kind
   (`sanitize(cartItem.title) || title`) — a renamed product keeps its old title on the order until
   the next deploy; out of scope.
   **Contents key (locale-independent).** The subtitle is in the page's language, but the cart
   (localStorage per host) is shared across locales: a bundle added on `/en/…` and checked out on
   the German checkout would get a different server subtitle (localized item titles, e.g.
   grass-art's physical items) and a false "contents changed" notice. So "contents changed" is
   decided by a key, not by the subtitle: `addToCartButton` writes `data-bundle-key` for bundles
   (`variant._id + ':' + quantity` per resolved `bundleItems[]` entry, sorted by id, joined `,`);
   `cart-ui.ts` (the `addItem` call reading `btn.dataset`) stores it as optional
   `CartItem.bundleKey`; `ValidatedCartItemResponse` gets `bundleKey: string | null` (same format,
   built in `payment-create.ts`'s response mapping from `item.bundleItems`). Step 2 reports
   `contents` only when both keys exist and differ; a differing subtitle alone (locale switch, a
   renamed item) updates the cart's subtitle silently. Carts from before the release have no key →
   no contents notice, subtitle still updated.
   Side effect: `addToCartButton` takes an optional `subtitle` argument; a template that passes a
   custom one for a bundle would now get a "contents changed" notice (step 3) on every checkout,
   because the server's composed subtitle never matches it. No customer does today (checked
   2026-11-06: Jurtschitsch passes `product | wineSubtitle`, which returns `''` for a bundle — no
   `wine` — so the macro composes the default). Say in the `CHANGELOG.md` entry and the macro's doc
   comment: don't pass a custom `subtitle` for bundles.
2. **One cart sync after every calculate and create** (`cart-store.ts`): replace
   `syncPricesFromServer` with `syncCartFromServer(response)` → returns the changes
   `{ removed: CartItem[], price: {item, from, to}[], quantity: {item, from, to}[], contents:
   CartItem[] }`, compared against the stored cart **before** writing: remove every id in
   `unavailableItems`; set `price`, `quantity` (when `quantity < requestedQuantity` **and** the
   stored quantity still equals `requestedQuantity` — otherwise the customer changed it while the
   request was in flight and the next calculate decides) and, for bundles, `subtitle` + `bundleKey`
   from the response items (`contents` reported per step 1's key rule); one `save()` → one
   `cart:updated`. **Stale responses:** `calculate()` has no request ordering today (country
   change, shipping select, the 400 ms qty debounce and coupon apply can overlap, and the last one
   to *arrive* wins `lastResponse`). Now that a response writes the cart, add a counter in
   `checkout.ts` (`let calcSeq = 0`; each `calculate()` takes `const seq = ++calcSeq` and, after
   the `await`, returns without sync/render/`lastResponse` when `seq !== calcSeq`; the `finally`
   only clears loading for the latest). `checkout.ts`
   then updates `cartItems` and `localCartMap` from the stored cart (they're built once at init
   today) before `summary.renderItems`, so the summary shows server data. Empty cart after removal
   → the existing empty-cart path (as when the last item is removed by hand).
   **All items gone:** then the server answers not with a `CalculateResponse` but with a
   `CART_EMPTY` validation error (`payment-create.ts`, `validatedItems.length === 0`) whose
   `details.unavailable` is the comma-joined ids — so the sync never runs, and today
   `handleError` passes that `details` entry to `form.showErrors` as a field named `unavailable`.
   In `handleError` (reached from `calculate` and the manual submit — **not** from the express
   path today: its `onCreatePayment` catches every error and only returns `{ error }`, so in that `catch`,
   for `CART_EMPTY` only, call `handleError(err)` before the return — other express errors keep
   today's behaviour, their field `details` belong to the wallet address, not the page form): for
   `err.code === 'CART_EMPTY'` split `details.unavailable` on `', '` (the server joins with
   `', '`), remove those ids from the cart
   (reported as `removed`), show the notice (step 3), then the empty-cart path; skip
   `form.showErrors` for this code.
3. **Tell the customer what changed** — one notice above the summary, new
   `<div data-checkout-changes class="checkout__changes" role="status" tabindex="-1">` in
   `core/components/checkout.njk`, inside the summary `<fieldset>` right after its `<legend>`,
   before `data-checkout-items` (styles in `src/assets/css/checkout.css`, next to
   `.checkout__error`; `:focus-visible` outline kept)
   (polite: information, not an error — the existing `role="alert"` error stays for errors). The
   region is **always in the DOM and not `hidden`**, empty when there is nothing to report (no
   padding/border while `:empty`): a polite live region that is unhidden and filled in the same
   step is often not announced (VoiceOver/NVDA register the region only once it's in the
   accessibility tree). Fill it by replacing its children; clear it by emptying it. Content: a short intro
   plus a `<ul>`, one `<li>` per change, item titles from the stored cart (the server never sees a
   removed item's title):
   - removed: "X ist nicht mehr erhältlich und wurde aus dem Warenkorb entfernt."
   - price: "Der Preis von X hat sich geändert: €a → €b." (both directions — transparent, one rule)
   - quantity: "Von X sind nur noch N verfügbar."
   - contents: "Der Inhalt von X hat sich geändert: <new subtitle>."
   Labels via `data-t-*` on the checkout root like `data-t-cart-empty`, placeholders filled
   in JS; new keys in `de_11ty.ts` / `en_11ty.ts` (+ `de_11ty.informal.ts` only where the wording
   addresses the customer). The generic `checkout.itemsUnavailable` message is replaced by this
   notice: remove the key (de/en), the `data-t-items-unavailable` attribute and `t.itemsUnavailable`
   in `checkout.ts` — no customer uses it (grep of every customer frontend's `src/`, 2026-11-06). The notice stays until the next calculate without changes. The line's stock note
   ("(N verfügbar)") only shows on the render that capped the quantity — after the sync the cart
   holds N, so the next response has `requestedQuantity === quantity`; the notice carries it. Dispatch `checkout:cart-changed` with the change list (customers/analytics).
4. **Stop before paying when something changed** (`checkout.ts` submit handler and the express
   `createPayment` callback): after `createPayment`, run step 2's sync; if it reports any change, or
   the grand total differs from the one the customer saw, **don't** call
   `confirmPayment` — and do this check **before** `saveOrderSnapshot`/`savePendingPayment` (both
   run right after `createPayment` today), so a blocked attempt leaves no thanks-page snapshot or
   pending payment behind. The decision is one pure exported helper
   `mustReconfirm(changes, shownGrandTotal, newGrandTotal): boolean` (new
   `src/scripts/checkout-changes.ts`, next to the notice rendering) — `initCheckout` is one big
   closure with no test harness, so the helper is what gets unit-tested. On a block (manual
   submit): set `lastResponse = response` (the `createPayment` response spreads the full
   `CalculateResponse`) — otherwise the next click compares against the old total again and is
   blocked forever — then render items/totals/shipping as `calculate()` does,
   `stripeCheckout.updateAmount(...)`, show the notice
   (plus "Bitte prüfen Sie die Bestellung und bestätigen Sie erneut." — informal overlay), re-enable
   submit, clear `aria-busy`, move focus to the notice (its `tabindex="-1"`) so keyboard and screen
   reader users land on it. The total "the customer saw": manual submit →
   `lastResponse.totals.grandTotal`; express → the last calculation the wallet sheet showed, which
   is **not** `lastResponse` (`onAddressChange`/`onRateChange` return their own
   `calculatePayment` result for the wallet's country/rate and don't store it). The element's
   `click`/`cancel` events are handled inside `CheckoutExpress` (`src/scripts/checkout-express.ts`),
   not in `checkout.ts`, so track it there: a private `shownGrandTotal: number | null`, set from
   `calc.totals.grandTotal` in `handleShippingAddressChange` and `handleShippingRateChange` after a
   successful resolve, reset to `null` on `cancel` (next to `lastAddress = null`); `handleConfirm`
   passes it as a new `shownGrandTotal` field of the `onCreatePayment` input (type
   `ExpressCheckoutConfig.onCreatePayment`). `checkout.ts` compares the `createPayment` result
   against it (`null` — no wallet calculation seen — counts as changed). Accepted: the wallet
   calculations don't sync the cart, so a price that changed after the page's last calculate but
   was already shown correctly in the sheet still counts as a change and blocks once (errs safe,
   rare). Express on a change: show the notice in `checkout.ts`
   **first**, then return `{ error: <same text> }`, then `calculate({ shippingMethodId:
   shipping.getSelectedId() })` — don't render the express `createPayment` response into the page:
   it is priced for the wallet's address and rate, not the page form's country/method. The next
   wallet session recalculates through `shippingaddresschange` anyway. `CheckoutExpress.handleConfirm` drops the
   returned text (it only calls `event.paymentFailed({ reason: 'fail' })`, no `onError`), so the page must
   not rely on it. Check manually (Stripe test mode, Apple Pay/Google Pay) that the sheet closes
   and focus lands on the notice. Re-submitting is safe: `orderMetaId` is kept and `payment-create` updates
   the existing PaymentIntent + orderMeta (`req.orderMetaId` branch) — no duplicate.
5. Tests: `cart-validator.test.ts` (bundle ignores client subtitle, uses current items; physical
   keeps the client subtitle); a jsdom test for `syncCartFromServer` (removed / price / quantity /
   contents / no change → empty lists, one `cart:updated`; same `bundleKey` but another subtitle →
   subtitle updated, no `contents`; no stored key → no `contents`; stored quantity ≠
   `requestedQuantity` → quantity left alone); the `CART_EMPTY` path, manual and express (all ids removed
   from the cart, no field errors — test the id-splitting/removal as a helper in `cart-store.ts`,
   e.g. `removeItems(ids)`); `mustReconfirm` (change list non-empty → true; same total, no change →
   false; total differs → true; `shownGrandTotal` `null` → true); a jsdom `CheckoutExpress` test
   (new `checkout-express.test.ts`, mock element emitting `shippingaddresschange` →
   `confirm`): `onCreatePayment` receives the address-change calculation's total, and `null`
   after `cancel`. Manual (Stripe test mode): manual submit with a price changed in the Studio
   between calculate and click doesn't charge and shows the notice; the second click then pays. Manual a11y check: notice read out once
   (VoiceOver), focus after a blocked submit.
6. Ship: in the same core-front release as phases 3/5; `CHANGELOG.md` ("checkout tells the
   customer about price/availability/stock/contents changes, removes unavailable items from the
   cart and asks to confirm again if the total changed before paying"). The region goes into
   `core/components/checkout.njk` outside any `{% block %}`; customer overrides of
   `overridable/checkout.njk` extend it (Jurtschitsch: `{% extends "core/components/checkout.njk"
   %}` + one block), so they get it without a change — no customer replaces the template today. Update `commerce-and-netlify.md`
   (checkout client part).

## Ship & docs

- Order: core-back before core-front wherever both change (phase 3: the Studio must know
  `orderItemBundleItem` before orders carry it; Sanity accepts unknown fields, so a reversed order
  only shows "unknown field" in the Studio, nothing breaks). Each release: build, `CHANGELOG.md`,
  tag, then pin in the customers (core-front `consuming-core-and-deploy.md`).
- Phases 1/1b go into the core versions Jurtschitsch goes live with (plus its `card.njk` price
  guard and the `unavailable` branch in `card.njk` + `container.njk`, phase 1.3); Tinhof (no bundles) gets them with its next core bump, no visible change.
- When it ships: `commerce-and-netlify.md` ("Known gap" on bundles, the weight caveat, bundle VAT),
  `wc-api.md` ("Bundles are one plain line"), core-back schema docs, Jurtschitsch frontend
  `CLAUDE.md` (wc-api bundle line), Tinhof frontend `CLAUDE.md` (wineNET → bundles), then delete
  this plan.

## Out of scope

Stock (bundle items' stock, the `stock` field, reductions, stock on the product page):
`stock-tracking.md`.


## Open decisions

Decided 2026-11-06:
- **H — Price required:** a bundle's price is the variant's `price`, else the product's — nothing
  is derived from the items (no "sum of the items" default: a bundle is usually meant to be
  cheaper, and editors should see what customers pay). The Studio requires it for `active`
  variants of every kind (phase 1b.4), with a warning on the product when its price is emptied
  (1b.5); the page and checkout treat a missing price as unavailable (phase 1.3).

Decided 2026-11-06 (phase 5):
- **F — VAT split:** a bundle's price is split over its items in the ratio of their single sale
  prices (as far as we know the AT/DE rule for gift sets of goods at different rates); the invoice
  lists each bundle item with its VAT rate under the bundle line. Tinhof's tax advisor confirms
  both before phase 5 ships.
- **G — Coupons on bundles:** allowed — coupons stay order-wide, bundles included, even when the
  bundle is already discounted. No "not on bundles" coupon option unless an owner asks (that would
  be a new coupon feature, not this plan).

Stock decisions (A, and open E) moved to `stock-tracking.md`.

Decided 2026-11-06:
- **I — Site stale between publish and deploy:** nothing built. Editors deploy by hand, as
  today; checkout stays correct and tells the customer meanwhile (phase 6). Rejected: auto-deploy
  on publish (every publish costs a deploy, ~15 credits; ~65 deploys use up Personal,
  `netlify-plans.md`; edit bursts queue builds), live prices on the product page (against the
  static design, a function call per page view), and a Studio "undeployed changes" badge built on
  wrapped publish actions + a marker document (too much machinery for a reminder). Fallback if
  editors forget in practice: `DeployDialog` counts published docs of the build-relevant types
  (`product`, `productVariant`, `category`, `page`, `post`, `menu`, `settings`, …; **not**
  `shopSettings`/`coupon`, which functions write on every order) with `_updatedAt` after the last
  successful build's `created_at`, and shows a badge — one query, no schema change; revisit when
  stock tracking ships (stock writes bump variants).

Decided 2026-10-25:
- **B — Packaging:** Jurtschitsch bundles are re-boxed with the cart (today's calculation).
- **C — wc-api / wineNET** (changed 2026-11-06; was: WooCommerce Product Bundles format, parent +
  €0 child lines linked by `bundled_by`/`bundled_items`): a bundle is sent as **its items, as
  ordinary line items** at their price shares (phase 5.2), with the bundle only in `meta_data`.
  Why: wineNET maps articles by WC `product_id` (Andi, mail: it remembers the product ids and
  suggests the article after the first few orders) — the item lines carry the same `product_id` as
  the loose wine, so a bundle needs no new mapping, no bundle article and no €0 lines in wineNET; no
  ERP can count the bottles twice; each line has one VAT rate. Still a plain WC order (as if the
  wines had been bought one by one) — fits `decisions/wc-api-mirrors-woocommerce.md`.
  **No switch — for every shop** (decided 2026-10-25): only new orders containing a bundle change
  (older orders have no stored item list and stay one line; non-bundle orders are identical), and a
  shop only gets it when its core pin is bumped. wc-api users: Tinhof (live, wineNET — no bundle
  products yet), Jurtschitsch (will use the wc-api; no `wc_api` function yet). grass-art has a
  `wc_api.mts` but won't use the wc-api or wineNET — ignore it. wineNET gets a heads-up, nothing to
  confirm. Separate open point (not bundles): whether wineNET also uses `variation_id` — all
  vintages of a wine share one `product_id` (Tinhof `CLAUDE.md` → wineNET).
- **D — Non-wine with wine:** unchanged for now — non-wine weight (loose or in a bundle) pays the
  weight rates on top of the boxes. Errs on the safe side (overcharges a mixed cart a little, never
  undercharges) and matches the product-page markup. Revisit when Jurtschitsch sells a mixed bundle
  (only Jurtschitsch allows both: `productKinds: ['wine', 'bundle', 'physical']`); then choose
  "free in the wine box" vs "free only inside bundles" in `calcWinePackagingCost`. Don't restrict
  bundle contents to wine — grass-art has physical-only bundles (`['physical', 'bundle']`).
