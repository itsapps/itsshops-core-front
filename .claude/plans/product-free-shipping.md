# Plan — products that make the whole order ship free

Status: **released** (2026-11-13: core-front 5.1.0, core-back 6.1.0; Tinhof frontend 1.16.0 /
backend 1.12.0 — staging tests skipped by the owner). Open: rollout step 5 content (flag on the
production bundles + Deploy, Rich Results Test, tell the owner). Planned 2026-11-12. Refined 2026-11-12 against core-front 5.0.0 /
core-back 6.0.0 (paths, reason flow via `orderMeta`, product-page tax line, pickup check); second
refine same day (typegen step, card-note gating, flag-off behaviour, test fixtures).
Spans **core-back** (variant field, feature flag, order snapshot field, Studio display) and
**core-front** (shipping logic, cart validation, order snapshot, product note, shipping info text).
Tinhof is the first user (bundles go on sale soon). The trigger is generic, so it lives in core:
any variant, not just bundles (gift boxes, promo sets, campaigns). Jurtschitsch has bundles too.

## Decisions (owner, 2026-11-12)

- **A boolean on `productVariant`**, `grantsFreeShipping`, behind a core-back feature flag. It is
  not a shop setting "bundles ship free" (that would tie the rule to one kind) and not an
  automatic-promotions engine (too big for now; this flag can later become one condition type
  inside one).
- **Whole order:** one such line in the cart → every **delivery** method costs 0 for the whole
  order, including any other items. Accepted that extra bottles ship free too.
- **Store why shipping was free** on the order: `fulfillment.freeShippingReason`.
- **"Versandkostenfrei" note** on the product page/card of such a variant.
- **Every delivery method and country** (AT and DE for Tinhof). No per-method opt-out now; if
  a shop ever needs one, add a shipping-method switch "Produkte können diese Versandart
  kostenfrei machen" (default on).
- **Checkout unchanged:** a free method still shows "—" (as for the threshold and coupons
  today). No reason text in checkout.
- **Mails and invoice unchanged** (€0,00 shipping line). The reason shows in the Studio only.

Refinement decisions (owner, 2026-11-12):

- **Full reason** (`product` / `threshold` / `coupon`, helper `freeShippingReason()`), not
  product-only.
- **"Versand & Zahlung" sentence follows the data** (`hasFreeShippingProducts`: any active
  flagged variant), no core-front feature flag.
- **The flag requires checkout**, and `shop.coupons` gets the same checkout condition.

## Behaviour

- Applies to `methodType: 'delivery'` only. **Pickup is out of scope** — confirmed by the code
  (2026-11-12): core-back's `shippingMethod.methodType` list offers only `delivery` (`pickup` and
  `pickupFee` are commented out in `schemas/documents/shippingMethod.ts`), so no shop can create a
  pickup method in the Studio. core-front only carries leftovers: the pickup branch in
  `resolveShippingMethods` (price = `pickupFee`), the `shippingInfoModule` pickup row,
  `order-thanks.ts` / `OrderEmail.tsx` hiding the address, the Studio `pickupLocation` field and
  `OrderActions` skipping the tracking prompt. The pickup branch stays untouched and never gets a
  reason (`freeShippingReason` is only written for delivery, step 10). Revisit when pickup is
  properly supported.
- Ignored on `digital` variants (they don't ship; the field is hidden there).
- **The data is the switch in core-front.** core-front reads `grantsFreeShipping` whatever the
  core-back flag says. Turning `shop.productFreeShipping` off only hides the field — variants that
  still carry `true` keep waiving shipping. To switch the rule off: unset the field on every
  variant first (`*[_type == "productVariant" && grantsFreeShipping == true]`, patch `unset`),
  then turn the flag off.
- **Checkout vs. static pages:** checkout reads published variants live (`CHECKOUT_QUERY`), so
  shipping is free as soon as the variant is published; the card note, the product-page tax line,
  the "Versand & Zahlung" sentence and schema.org change only with the next build (Studio
  "Deploy").
- Quantity doesn't matter: one line with qty ≥ 1 is enough.
- **Packaging is still computed**: `packagingLines` stay on the order (fulfillment needs the boxes),
  only the price is 0. A method that can't pack the cart (size not covered) is still not offered.
- **Reason** (only when a delivery method ends up at 0), one value, by precedence:
  `product` > `threshold` > `coupon`. Precedence runs from the reason that holds whatever the
  cart total, to the one that depends on the cart total, to the coupon. A `freeShipping` coupon in
  a cart that already ships free stays applied with 0 discount, the same as today with the
  threshold (`validateCoupon` sets `zeroShipping = shippingCost > 0`, so it is `false` there and the
  coupon reason can't win by accident).
- `freeShippingCalculation` (`beforeDiscount` / `afterDiscount`) has no effect on the product
  rule. `payment-create.ts` pass 2 re-runs `resolveShippingMethods` with the same items, so it keeps
  `product`.
- Shipping VAT: 0 (`totals.shipping` 0 → no shipping VAT line in `totals.ts`). Nothing changes.
- wc-api / wineNET: shipping line 0, nothing new.
- schema.org: `buildShippingDetails` prices each offer through `resolveShippingMethods`, so the
  flag must reach `variantToCartItem` (`src/schema/shipping.ts`). The offer then publishes
  shipping €0, which matches checkout as Google requires.
- **Price info on the product page:** core's `product.taxShippingInfoText` ("Inkl. MwSt. / Exkl.
  Versandkosten") would contradict the note. On a flagged variant the line reads
  `product.taxFreeShippingInfoText` ("Inkl. MwSt. / Versandkostenfrei") instead — this line *is*
  the product-page note (no second "Versandkostenfrei" next to it). Cards have no tax line and get
  the separate note (step 12).

## Steps — core-back

1. **Feature flag** `shop.productFreeShipping`:
   - `types/schema.ts`: add `'shop.productFreeShipping'` to `ITSFeatureKey`.
   - `types/config.ts`: `productFreeShipping?: boolean` in `FeatureConfig['shop']` (doc comment:
     "variants can make the whole order ship free, default false") and `productFreeShipping:
     boolean` in `ITSFeatureConfig['shop']`.
   - `config/mapper.ts`: `allFeatures()` → `productFreeShipping: true`; `normalizeFeatures()` →
     `productFreeShipping: input?.shop?.productFreeShipping ?? false`.
   - `config/features.ts`: `'shop.productFreeShipping': shopEnabled &&
     config.features.shop?.checkout !== false && !!config.features.shop?.productFreeShipping`
     (no checkout → no shipping to waive).
   - Same file, same release: `'shop.coupons'` gets the checkout condition too (`shopEnabled &&
     config.features.shop?.checkout !== false && !!config.features.shop?.coupons`) — coupons only
     work in checkout. No active shop changes: Tinhof and Jurtschitsch have coupons with
     checkout, Rosi Schuster has `checkout: false` and no coupons (checked 2026-11-12).
     CHANGELOG: "coupons now need checkout".
2. **Variant field** `grantsFreeShipping` (`boolean`, `initialValue: false`) in
   `schemas/documents/productVariant.ts`: next to `stockEnabled` (line ~26) add `const
   freeShippingOn = ctx.featureRegistry.isFeatureEnabled('shop.productFreeShipping')`; in the
   `pricing` group's `fields` array, after the `compareAtPrice` `priceField`, spread
   `...(freeShippingOn ? [f('grantsFreeShipping', 'boolean', { initialValue: false, hidden: ({
   document }) => document?.kind === 'digital' })] : [])` (the group wrapper assigns the group,
   as for `compareAtPrice`).
   Title/description in `localization/resources/fields_de.ts` / `fields_en.ts` under
   `productVariant.fields` (variant-only field, so not in the shared top-level `fields` where
   `compareAtPrice` lives): "Versandkostenfrei" / "Macht die ganze
   Bestellung versandkostenfrei (alle Versandarten)." — en "Free shipping" / "Makes the whole order
   ship free (all delivery methods)." No preview-subtitle change (not in the decisions).
3. **Order snapshot** `fulfillment.freeShippingReason` in `schemas/objects/orders/fulfillment.ts`:
   `f('freeShippingReason', 'string', { options: { list: [{ value: 'product' }, { value:
   'threshold' }, { value: 'coupon' }] }, hidden: lockSnapshot })` — hidden outside dev like the
   other snapshot fields (`methodType`, `shippingCost`, …); the order view shows it (step 4).
   Field title/list labels in `fields_de/en.ts` under `fulfillment.fields` ("Grund für
   Gratis-Versand": Produkt / Bestellwert / Gutschein). Not gated by the flag: the
   threshold and coupon reasons apply to every shop. `orderMeta` shares the `fulfillment` object
   type, so it needs no extra change.
4. **Studio order view** (`components/OrderView.tsx`): add `freeShippingReason?: 'product' |
   'threshold' | 'coupon'` to the local `Fulfillment` type; in the totals card, directly after the
   `order.shipping` `TotalRow` (line ~421), when `totals.shipping === 0` and
   `fulfillment?.freeShippingReason` is set, render a muted `TotalRow` with label
   `t('order.freeShippingReason.<reason>')` and an empty value. Keys in
   `localization/resources/components_de.ts` / `components_en.ts`: `product` "Versandkostenfrei
   durch Produkt" / "Free shipping (product)", `threshold` "Versandkostenfrei ab Bestellwert" /
   "Free shipping (order value)", `coupon` "Versandkostenfrei durch Gutschein" / "Free shipping
   (coupon)". Orders without the field show as before.
5. Regenerate core-back's types: `npm run types` (extract + typegen → `src/types/sanity.types.ts`;
   the root workspace runs with the full feature superset, so `allFeatures()` from step 1 puts the
   field in). core-front has **no** generated types file — its types are hand-written (steps 6, 7,
   10).

## Steps — core-front

6. **Data:**
   - Server cart query `CHECKOUT_QUERY` (`netlify/services/sanity.ts`): add `grantsFreeShipping`
     to the top-level variant projection only (not to `bundleItems[].variant`: a bundle's
     children don't count, the bundle's own flag does). Add `grantsFreeShipping?: boolean | null`
     to `SanityVariantResult` (`netlify/types/checkout.ts`).
   - Build: `grantsFreeShipping` in `buildVariantQuery` (`src/data/queries.ts`); in
     `src/data/resolve/variants.ts` (the `ResolvedVariant` object, next to `weight`):
     `grantsFreeShipping: kind !== 'digital' && variant.grantsFreeShipping === true`;
     `grantsFreeShipping: boolean` on `ResolvedVariant` (`src/types/data.ts`).
   - Missing field → `false` everywhere, so core-front needs **no flag of its own**.
7. **Cart validator** (`netlify/lib/cart-validator.ts` `validateCart`): `grantsFreeShipping:
   variant.kind !== 'digital' && variant.grantsFreeShipping === true` on the pushed item, from the
   server variant only (`CartItem` from the client has no such field and none is read). Add
   `grantsFreeShipping: boolean` to `ValidatedCartItem` (`netlify/types/checkout.ts`).
8. **Shipping** (`netlify/lib/shipping.ts`):
   - `ShippingCartItem`: add `'grantsFreeShipping'` to the `Pick<ValidatedCartItem, …>`.
   - `AvailableShippingMethod` (`netlify/types/checkout.ts`): `freeReason?: 'product' |
     'threshold'` (server only).
   - `resolveShippingMethods`: `const productFree = items.some(i => i.grantsFreeShipping)` once
     before the loop. Delivery branch: `const thresholdFree = isFreeShipping(…)` (unchanged),
     `const free = productFree || thresholdFree`, push `price: free ? 0 : price`, `isFree: free`,
     `...(free && { freeReason: productFree ? 'product' : 'threshold' })`. Pickup branch untouched.
     Keep `isFreeShipping` as is (threshold only).
   - New pure helper `freeShippingReason(selected: AvailableShippingMethod, couponZeroShipping:
     boolean): 'product' | 'threshold' | 'coupon' | undefined` — `selected.methodType !==
     'delivery'` → `undefined`; else `selected.freeReason ?? (couponZeroShipping ? 'coupon' :
     undefined)`. Lives here so it is unit-tested (`payment-create.ts` has no unit tests).
9. **payment-create.ts:** after pass 2, before `buildOrderMeta`: `const shippingReason =
   freeShippingReason(selectedShipping, !!couponDiscount?.zeroShipping)` and pass it as
   `freeShippingReason` in the `buildOrderMeta` input. The client response stays as is: the
   `shippingMethods.map` there picks fields explicitly, so `freeReason` never reaches the client
   (checkout shows no reason).
10. **Order builder** (`netlify/lib/order-builder.ts`): `BuildOrderMetaInput.freeShippingReason?:
    'product' | 'threshold' | 'coupon'`; `buildFulfillment` gets it as a 4th parameter and adds
    `...(reason && selectedShipping.methodType === 'delivery' && shippingCost === 0 && {
    freeShippingReason: reason })` (`shippingCost` = `totals.shipping`, already passed). Add
    `freeShippingReason?: …` to `Fulfillment` (`netlify/types/checkout.ts`). The order copies
    `orderMeta.fulfillment` in `buildOrder`, so the webhook needs no change.
11. **schema.org** (`src/schema/shipping.ts` `variantToCartItem`): return `grantsFreeShipping:
    variant.grantsFreeShipping` (already false for digital from step 6; `buildShippingDetails`
    returns `[]` for digital anyway).
12. **Card note:** macro `productFreeShipping(product, class="product__free-shipping")` in
    `templates/macros/product.njk` (add to the usage comment at the top): when
    `product.grantsFreeShipping`, `<p class="{{ class }}">{{ 'product.freeShipping' | trans({ lng:
    product.locale }) }}</p>`. Plain text, not icon-only; an added icon is `aria-hidden`. Use it
    in `core/components/product/card.njk` (add `productFreeShipping` to its `{% from
    "macros/product.njk" import … %}` line) inside the `product_card_price` block, after
    `productPrice`: `{% if coreConfig.features.shop.checkout %}{{ productFreeShipping(product,
    class="product-card__free-shipping") }}{% endif %}` — gated at the call site because the macros
    are imported without context (no `coreConfig` inside), and a shop without checkout has no
    shipping to waive. Customer cards that `extend` core and
    don't override that block (Tinhof's) get it with no change. It sits inside the card link, so
    it becomes part of the link name ("… €49,00 Versandkostenfrei") — fine.
13. **Product page:** in `core/components/product/container.njk` (line ~35) the tax line becomes
    `{{ ('product.taxFreeShippingInfoText' if product.grantsFreeShipping else
    'product.taxShippingInfoText') | trans }}` (see "Behaviour"). Customers with a full
    `overridable/product/container.njk` override must change the same line (CHANGELOG note).
14. **Shipping info module** (`core/modules/shippingInfoModule.njk`): after the method loop inside
    `shipping-info__shipping`, one paragraph `<p class="shipping-info__product-free">{{
    'shippingInfo.productFreeShipping' | trans }}</p>` ("Als versandkostenfrei gekennzeichnete
    Produkte machen die ganze Bestellung versandkostenfrei." / "Products marked as free shipping
    make the whole order ship free.") when `cms[_locale].hasFreeShippingProducts`. That boolean is
    a new `CmsLocaleData` field (`src/types/data.ts`), set in `src/data/resolver.ts` next to
    `shippingMethods`: `products.some(v => v.grantsFreeShipping && v.status === 'active')` — it
    follows the content, not a config flag.
15. **Translations** in `i18n/translations/de_11ty.ts` / `en_11ty.ts`: `product.freeShipping`
    ("Versandkostenfrei" / "Free shipping"), `product.taxFreeShippingInfoText` ("Inkl. MwSt. /
    Versandkostenfrei" / "Incl. VAT / Free shipping"), `shippingInfo.productFreeShipping` (step 14).
    Neutral texts: no entries in the `.informal` files.

## Tests (vitest)

- `netlify/__tests__/shipping.test.ts`: one flagged item → all delivery methods price 0, `isFree`,
  `freeReason: 'product'`, `packagingLines` still set; uncoverable size → method still missing;
  threshold only → `'threshold'`; both → `'product'`; unflagged under threshold → no `freeReason`;
  pickup method → unchanged, no `freeReason`. `freeShippingReason()`: method reason wins over a
  coupon; no method reason + `zeroShipping` → `'coupon'`; neither → `undefined`; pickup →
  `undefined`.
- `netlify/__tests__/cart-validator.test.ts`: flag taken from the server variant, digital → false;
  flagged bundle → line flagged, an unflagged bundle with a flagged child → not.
- `netlify/__tests__/coupon.test.ts`: `freeShipping` coupon with `shippingCost` 0 → `zeroShipping`
  false, discount 0 (documents the precedence; may already be covered — add only if missing).
- `netlify/__tests__/order-builder.test.ts`: `buildOrderMeta` stores the reason only for
  delivery at shipping 0; no reason input → no field.
- `src/schema/__tests__/schema.test.ts`: flagged variant → shipping rate 0 for every delivery
  method.
- Data layer (`src/data/__tests__/bundle-status.test.ts` already calls `resolveVariants` — add the
  cases there or in a new `variants.test.ts` with the same setup): resolved `grantsFreeShipping`
  false for digital / missing. `hasFreeShippingProducts` is one inline expression in `resolver.ts`
  (no unit test; checked on staging, rollout step 4).
- Fixtures: `grantsFreeShipping` is required on `ValidatedCartItem` (and so on `ShippingCartItem`),
  so the item helpers in `shipping.test.ts`, `totals.test.ts`, `tax.test.ts` and
  `order-builder.test.ts` get `grantsFreeShipping: false` (vitest doesn't type-check, but keep them
  valid for the editor). Production code that builds these items: only `cart-validator.ts` (step 7)
  and `src/schema/shipping.ts` (step 11) — tsup's `dts` build fails if one is missed.

## Docs

core-front `commerce-and-netlify.md` → "Free shipping" (product rule, reason + precedence,
`freeShippingReason` helper, snapshot via `orderMeta`), `templates-and-assets.md` (card macro, tax
line switch, schema.org note), `filters-and-shortcodes.md` / `ui-contracts.md` only if they list
the product macros; core-back `schemas.md` (variant field, fulfillment field) and
`plugin-and-config.md` (flag), `studio-components.md` (order view line); both `CHANGELOG.md`s
(minor; for customers with a full `product/container.njk` override: switch the tax line; with a
card override that replaces `product_card_price`: add `productFreeShipping`). Tinhof frontend +
backend `CLAUDE.md` when it ships (flag on, which variants carry it).

## Rollout (Tinhof)

1. core-back + core-front: build, test, push `main` (own user). Order doesn't matter: core-front
   treats a missing field as `false`; core-back first lets editors set the flag before the
   frontend uses it.
2. Tinhof backend: `features.shop.productFreeShipping: true`; pin core-back (commit for staging).
   Set the flag on each bundle in **development** for staging, then trigger the staging build.
3. Tinhof frontend: in its full override `overridable/product/container.njk` (line ~66) switch the
   tax line as in step 13. `overridable/product/card.njk` extends core and leaves
   `product_card_price` alone → gets the note automatically; style `.product-card__free-shipping`
   (AA contrast: no brand gold for text). The Wein page grid (`overridable/modules/
   orderedCategoryGrid.njk`) has its own card without price — add `productFreeShipping` there only
   if bundles are shown in it. Pin core-front (commit for staging).
4. Staging (`release tinhof staging`): bundle alone (AT + DE) → shipping 0, reason `product` in the
   Studio order view, boxes in `packagingLines`; bundle + loose wines → 0; loose wines over the
   threshold → 0, reason `threshold`; under it → normal price; `freeShipping` coupon on normal
   wines → reason `coupon`; Apple Pay / express checkout shows shipping 0; wc-api shipping line 0;
   product page tax line "Inkl. MwSt. / Versandkostenfrei"; "Versand & Zahlung" shows the sentence.
5. Production (`release tinhof`): core semver tags + CHANGELOGs, pin tags, set the flag on the
   bundles in **production** and run the Studio "Deploy" (static pages change only with a
   build); Rich Results Test on a bundle page (shipping €0); tell the owner how
   the flag works (per variant, whole order, every delivery method).

## Open decisions

None. The pickup question (checked 2026-11-12, see "Behaviour"): pickup can't be configured in the
Studio today, so leaving it out and never writing a reason for it is correct — report this to the
owner with the plan; if they want pickup supported first, that is a separate plan.

Everything else was decided on 2026-11-12, see "Decisions".
