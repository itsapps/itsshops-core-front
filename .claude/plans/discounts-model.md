# Plan — discounts model (codes + automatic discounts, one line-level pipeline)

Status: **in progress** — sessions 1 + 2 done (core-back 1–8, core-front 9–20; see Implementation log); Rollout 1–2 open; all decisions taken; refined 2026-11-20 (round 1, 80/100); refined 2026-11-20 (round 2, 86/100); refined 2026-11-20 (round 3, 89/100); refined 2026-11-20 (round 4, 92/100); refined 2026-11-20 (round 5, 95/100). Base: core-front `main` (5.3.0 +
store pickup), core-back `main` (6.3.0). Spans **core-back** (discount document, product selector,
shop-wide exclusions, order snapshot, Studio views, migrations) and **core-front** (one discount
pipeline shared by checkout and build, line-level discounts on the order, checkout UI, mails,
wc-api, schema.org). Tinhof is the first user; the model is generic (every itsshops shop with
checkout).

Trigger: Tinhof wants bundles (already reduced) excluded from coupon discounts. After product free
shipping (`product-free-shipping.md`) this is the second one-off rule in the checkout math; each
one was a full plan. Goal: the usual cases become **data in the Studio**, rare ones a **small
extension at a fixed place**, and the money math (VAT, rounding, order, wineNET) is built and
tested **once**.

## Implementation log

**Session 1 (2026-11-20), uncommitted, on `feat/discounts-model` in core-back and core-front:**
core-back steps 1–8 done (types regenerated, `npm run build` + tests pass, CHANGELOG 7.0.0
"unreleased"); core-front step 9 (`src/shared/discounts/`, 4 test files) and step 19's pure
functions (`src/netlify/lib/discount-migration.ts` + test) done. Deviations / decisions taken
while building:
- **`productSelectorCriteria`** is its own object type (the `include` / `exclude` sides): typegen
  hoisted the inline objects as top-level `Include` / `Exclude` types, and `Exclude` shadows the
  TS utility type. Stored shape unchanged apart from `_type: 'productSelectorCriteria'` on the
  sides; labels under `productSelectorCriteria.fields.*`.
- **History type `system`** added to core-back `orderStatusHistory` (status `discountsMigrated`,
  labels + OrderView case) — the migration's "Format migriert" entry needed a type
  (`discountMigrationHistoryEntry`).
- **`appliesToPickup` has no Studio `initialValue`** (a field can't see the trigger); unset =
  code yes / automatic no, applied by `appliesToPickup()` in `apply.ts` (description says so).
  The migration sets it explicitly. `combinesWith` initial: shipping only.
- `discount` groups: general / discountValue / conditions / combinations. `maxPerEmail` is hidden
  on automatic discounts unless a value is set (then the validation error shows).
- OrderView falls back to legacy `appliedCoupons` (mapped to the new card) on unmigrated orders —
  removed with the old fields (Rollout 6).
- **`coupon.ts` / `coupon.test.ts` not deleted yet**: `payment-create.ts` still imports
  `validateCoupon`; delete them in step 11 together with that import (their cases are already in
  `discounts-apply.test.ts`).
- Pipeline API for steps 10–18: `evaluateDiscounts(input: PipelineInput): DiscountResult`
  (`lines` aligned with the cart; `shipping` = the selected method's price after the threshold
  + its type; re-run after pass 2 and after the per-email fetch with `emailRedemptions`);
  `waivesShipping(result, methodType)` for the method list; `toDiscountInput(raw, resolveTitle)`
  for the projection result; `DISCOUNT_PROJECTION` / `SELECTOR_PROJECTION` (step 10/18);
  `isUnconditional` (step 18). Errors are `DiscountErrorCode` strings equal to `ErrorCode` — add
  the 4 new members to `netlify/types/errors.ts` + server i18n in step 11/17.
- Migration: the product-free-shipping discount has the fixed id
  `discount-product-free-shipping` (idempotent). `convertLegacyOrderMeta` (step 14) also writes
  line discounts with the old algorithm, so an order created from an old `orderMeta` is a
  migrated one. Still open in step 19: the CLI subcommand.
- **wc-api fixture:** `src/netlify/__tests__/fixtures/wc-api-legacy-orders.json` holds 6
  old-shape orders (incl. 000007/000008-like coupon orders, bundles, product / coupon free
  shipping) **with the pre-6.0.0 `mapOrder` output**, generated before step 15. Step 15's test:
  `mapOrder(migrated order)` must equal `wc` byte for byte.

**Session 2 (2026-11-20), uncommitted, same branches:** core-front steps 10–20 done; `npm test`
(833), `tsc`, `npm run build`, `check:functions` pass; Tinhof frontend builds against the linked
core (`development`, read-only — no free-shipping notes until the migration created the
discount). Not done (owner's constraints for this session): commits/pushes, Tinhof pins
(Rollout 1), the migration on `development` and the staging tests (Rollout 2), `TEST_LIVE`
integration tests. Deviations / decisions taken while building:
- `validateCart` takes the category parents as a new last parameter (`categoryParents`);
  `selectorLineFromVariant` is exported from `cart-validator.ts`.
- `coupon.ts` / `coupon.test.ts` deleted; `updateOrderMeta` removed (no other caller).
- `payment-create.ts`: pass 1 resolves once; `run(emailRedemptions?)` = select → pipeline →
  (afterDiscount) pass 2 → pipeline again; the per-email check re-runs it once.
- Webhook increments are de-duplicated per discount id; `existingDiscountDocIds` +
  `countOrdersWithDiscountForEmail` in `services/sanity.ts`.
- Mails/PDF: `discountSummaryLines` (`lib/order-discount-lines.ts`) falls back to one "Rabatt" row
  when the stored entries don't sum to `totals.discount`.
- Client: `shouldClearStoredCode` exported from `checkout-coupon.ts` (tested); `applyCouponState`
  in `checkout.ts` does clearing + render on calculate and both submit paths. Totals row: the code
  slot is left out when the code equals the title (migrated codes have title = code). Wallet line
  name = title (fallback code).
- Hint CSS: never `display: none` (live region), only no margin while `:empty`.
- Build: the fetch is `fetchBuildShippingDiscounts` in its own module `data/build-discounts.ts`
  (testable: plain `client.fetch`, no stega options); `applyBuildShippingDiscounts` +
  `selectorLineFromResolved` in `resolve/variants.ts`.
- Migration runner: `lib/discount-migration-run.ts` (`planDiscountMigration` →
  `describeDiscountMigration` → `applyDiscountMigration`); plans and checks everything before the
  first write; coupons and orders one transaction each, orders with `ifRevisionId`; the
  preflight also blocks `versions.*`. Tested against an in-memory dataset (incl. idempotency).
- New tests: `payment-create-discounts`, `commit-order-transaction`, `discount-migration-run`,
  `scripts/__tests__/checkout-discounts`, wc-api legacy-fixture byte-identity, plus updates.

## Decisions (owner, 2026-11-20)

- **One model for everything discussed**, not a "v1": product selector, discount document with
  code or automatic trigger, targets items / order / shipping, values percent / fixed / free,
  conditions (min subtotal, min quantity, date range, total limit, limit per email), combinability,
  shop-wide exclusions, line-level pipeline, order view, checkout hints, wc-api, migration.
  Tiered discounts, buy-X-get-Y, new conditions are **not built**, only their extension points are
  designed (see "Extension points").
- **At most one code per order, plus automatic discounts**, governed by "combines with".
- **No "is reduced" concept.** The selector gets a criterion **"has compare-at price"**
  (`compareAtPrice > price`) next to kind, category, product. Bundles are excluded via
  **kind = bundle**. Reason: a bundle is not reduced by definition (could be a gift box at the sum
  of its items); explicit criteria are visible in the Studio.
- **`grantsFreeShipping` goes away.** Product free shipping becomes an automatic shipping discount
  ("cart contains kind bundle → shipping free"). The flag stays until this model is live.
- **Old orders are migrated** (structure, never amounts) — no permanent compat code. Only the
  webhook keeps reading an old-shape `orderMeta` for a short transition (see Migration).
- **Feature flags are respected** (see "Feature flags").
- Plan from current `main`; may ship in one release with store pickup (decided before the release).

Verified in Tinhof `production` (2026-11-20): 5 active bundles (Rieden, Eisenstadt, Leithaberg,
Top Rieden, Sprudel Paket), **all** `grantsFreeShipping: true`; **no** variant has a
`compareAtPrice`. So "contains kind bundle → free shipping" equals today's behaviour exactly.

## Further decisions (owner accepted the proposed defaults, 2026-11-20)

1. **Code not combinable with an active automatic discount:** default = the larger saving for the
   customer wins; if that is the automatic one, the code is shown as not applied with the message
   "nicht mit Aktion „X“ kombinierbar". (Alternative: code always wins.)
2. **Min subtotal basis:** per discount `whole cart` | `matching items`, default `whole cart`
   (WooCommerce does the same).
3. **Min quantity counts units of matching lines;** a bundle counts as 1 per quantity (not its
   bottles). A "count bottles" switch is a later extension.
4. **Category criterion:** a bundle matches by its **own** categories only (like category pages),
   not its items' (unlike the shop filters, `mergeBundleFilterAttributes`). A parent category also
   matches its subcategories (with `shop.category.subcategories`).
5. **Shipping discounts and pickup:** field `appliesToPickup` on shipping-target discounts. Code
   discounts default `true` (today a `freeShipping` coupon waives a pickup fee), automatic default
   `false` (today product free shipping ignores pickup). Migration sets it that way.
6. **Product-page hint** "nicht mit Gutscheinen rabattierbar": default **no** (checkout hint only).
7. **Document type:** new `_type: 'discount'` replacing `coupon`. ~~Migration keeps the `_id`s~~
   — superseded by Q1 (below): the new id is always `discount-<old _id>`, no same-`_id` experiment.
   The new id is deterministic, `discount-<old _id>`, so the
   migration (orders) and the webhook transition (old `orderMeta`, step 14) map an old
   `couponRef._ref` without a lookup table. As step 3 of the migration rewrites every order's refs
   anyway, the fallback costs nothing extra.

8. **Free-shipping threshold stays on the shipping method** (owner, 2026-11-20):
   `shippingMethod.freeShippingThreshold` + `shopSettings.freeShippingCalculation` are unchanged
   and not migrated into a discount. Checkout keeps checking it first (pass 1 / pass 2 in
   `payment-create.ts`), shipping discounts come after; reason `threshold`. Why: the threshold is
   per method and country (Tinhof AT €100, DE €150) and the discount model has no country
   condition; it feeds the build ("Versand & Zahlung" `shippingInfoModule.njk`, schema.org
   `schema/shipping.ts`), which takes no conditional discounts; as a discount it would compete
   with a `freeShipping` code under the combinability rule and count redemptions on every order.
   Revisit only once a country condition exists and the build can show conditional discounts.

## Refine log

Round 5 read in full: `data/resolve/variants.ts`, `data/resolver.ts`, `data/queries.ts`,
`netlify/lib/shipping.ts`, `schema/shipping.ts`, core-back `config/structure.ts`,
`config/features.ts`; `payment-create.ts` l. 140–270 again; core-back `mapper.ts` (l. 110–163),
`types/config.ts` (features), `types/schema.ts` (keys), `productVariant.ts` (flag + field) in part.
Steps 1, 3, 6, 12, 18 and "Shipping discounts per method" corrected against them (marked
"(round 5)").

Round 4 read in full: `scripts/checkout.ts`, `scripts/checkout-express.ts`, `services/sanity.ts`,
core-back `OrderView.tsx`, `src/bin/itsshops.ts`; steps 10, 14, 17, 19 checked against them (line
references hold).

Round 3 read in full: `wc-api.ts`, `OrderEmail.tsx`, `InvoicePdf.tsx`, core-back
`shopSettings.ts`, `appliedCoupon.ts`, `fulfillment.ts`, `orderItem.ts`, `orderItemBundleItem.ts`,
`orderTotals.ts`, `orderAndOrderMetaFields.ts`, `utils/fields.ts` (field factory, l. 1–80);
round-2 client additions checked against `checkout.ts` l. 530–612 / 670–720,
`checkout-coupon.ts` `render`, `checkout-changes.ts` `fill`, `order-snapshot.ts` reader,
`order-builder.ts` `buildFulfillment`, `schema/shipping.ts` (all hold). Round 4: read in full
the files the plan changes non-trivially that no round has read whole — `scripts/checkout.ts`,
`scripts/checkout-express.ts`, `services/sanity.ts` (`CHECKOUT_QUERY`, `commitOrderTransaction`),
core-back `OrderView.tsx`, `src/bin/itsshops.ts` (`sanity` group) — and check steps 10, 14, 17,
19 against them.

Round 2 read in full: `payment-create.ts`, `totals.ts`, `coupon.ts`, `tax.ts`,
`cart-validator.ts`, `order-builder.ts`, `checkout-coupon.ts`, `order-totals.ts`,
`macros/cart.njk`, `payment-webhooks.ts` (order path), core-back `coupon.ts`, `appliedCoupon.ts`,
`features.ts`. Only the touched parts of: `wc-api.ts` (types, `expandOrderLines`, line totals,
projection), `scripts/checkout.ts` (labels, calculate, both submit paths),
`checkout-express.ts` (`buildLineItems`), `order-snapshot.ts`, `OrderEmail.tsx` (Summary),
`InvoicePdf.tsx` (grep), `services/sanity.ts` (l. 1–200), `shipping.ts` (l. 280–422),
`schema/shipping.ts` (l. 30–110), `data/resolve/variants.ts` / `resolver.ts` / `queries.ts`
(free-shipping parts), core-back `OrderView.tsx` (totals, coupons card, item row),
`structure.ts` (grep), `productVariant.ts` / `shopSettings.ts` (grep). Round 3: read the rest of
`wc-api.ts` (line/`price` output, `discount_total`), `OrderEmail.tsx` + `InvoicePdf.tsx` in full,
core-back order/fulfillment/orderItem schemas and `shopSettings.ts`, and check the round-2
additions (marked "(round 2)") against them.

## Open questions (refine 2026-11-20 — owner)

- ~~Q1~~ **Decided (owner, 2026-11-20):** no same-`_id` experiment — the migration creates
  `discount-<old _id>` right away and rewrites the order refs (decision 7's fallback is now the
  plan; wherever this plan says "same `_id` … or `discount-<id>`", read `discount-<old _id>`).
- **Q2 — shipping VAT rate with exclusions:** `dominantItemVatRate` uses the **undiscounted** gross
  per rate (shop prices). With exclusions a coupon no longer reduces every rate by the same factor,
  so the discounted gross could name another rate. Decided below.
- ~~Q3~~ **Decided (owner, 2026-11-20):** `maxPerEmail` only for `trigger = code` — hidden on
  automatic discounts, and validation rejects a value there; the migration never sets it on the
  automatic one. The per-email check in the pipeline therefore only ever concerns the code
  discount. Per-customer automatic rules wait for login-based conditions (Extension points).
- ~~Q2~~ **Decided (owner, 2026-11-20):** the shipping VAT rate always uses the **undiscounted**
  gross per rate (as today), independent of `shopSettings.freeShippingCalculation` (that setting
  only governs the free-shipping threshold). Tax advisor to confirm, together with the pickup VAT
  question; if they say "after discount", change it for all shops in core — no new setting.

## Behaviour

### Product selector (`productSelector` object, core-back; `matchesSelector`, core-front)

`include` and `exclude`, each with any of:
- `kinds[]` (from `schemaSettings.productKinds`: wine / physical / digital / bundle)
- `categories[]` (only with `shop.category`; variant categories override product categories, as in
  the data layer `resolve/variants.ts`)
- `manufacturers[]` (only with `shop.manufacturer`)
- `products[]` / `variants[]` (references)
- `hasCompareAtPrice` (boolean)

All selector references (`categories`, `manufacturers`, `products`, `variants`) are **weak**
(`weak: true`, as `appliedCoupon.couponRef` / `fulfillment` refs): a strong ref would block an
editor from deleting an old vintage or a category a discount names. The matcher only compares ids,
so a dangling one simply never matches.

A line matches when (`include` empty **or** any include criterion matches) **and** no exclude
criterion matches. One pure function `matchesSelector(line: SelectorLine, selector)` in
`src/shared/discounts/selector.ts`, used by checkout **and** the build (schema.org, card note).
`SelectorLine = { variantId, productId, kind, categoryIds, manufacturerIds, hasCompareAtPrice }`
— each side builds it with an adapter (checkout: `cart-validator.ts` from the query result; build:
`data/resolve/variants.ts` from the `ResolvedVariant`), so the matcher never sees either shape.
- `categoryIds` = the line's effective categories (variant's if non-empty, else the product's —
  as `resolve/variants.ts` does) **plus all their ancestors**. Categories nest without a depth
  limit (`category.parent`, core-back `category.ts`), so ancestors are computed in JS, not GROQ:
  `CHECKOUT_QUERY` gets a top-level `"categories": *[_type == "category"]{ _id, "parentId":
  parent._ref }` (small) and a helper `withAncestors(ids, parentById)` (cycle-safe: stop at a
  seen id) in `selector.ts`; the build uses the `parentId` already on `ResolvedCategory`. Without
  `shop.category.subcategories` there are no parents, so the helper is a no-op.
- `manufacturerIds`: `coalesce(manufacturers, product->manufacturers)[]._ref` — the field is
  plural on variant **and** product (`resolve/variants.ts` falls back the same way).
- `hasCompareAtPrice`: `coalesce(compareAtPrice, product->compareAtPrice)` > the effective price
  (`price ?? productPrice`), computed in the adapter.
- `kind`: the variant's own `kind` (required on the variant, already in `CHECKOUT_QUERY`).
- Bundle children are **not** matched themselves (decision 4); a bundle line matches by its own
  fields only.

### Discount document (`discount`, core-back)

| Field | Notes |
|---|---|
| `title` (i18nString), `description` (i18nText) | title shown in checkout, mails, order view |
| `enabled` | |
| `trigger` | `code` \| `automatic` (`code` only with `shop.coupons`, `automatic` only with `shop.automaticDiscounts`; one option left → hidden, `initialValue` set) |
| `code` | required + unique when `trigger = code` (existing validation moved over) |
| `target` | `items` \| `order` \| `shipping` |
| `valueType` | `percent` \| `fixed` \| `free` (`free` only for `shipping`; `shipping` only `free`) |
| `value` | percent 0–100 or cents; hidden for `free` |
| `appliesTo` | `productSelector`; for `shipping`: the "cart contains" condition |
| `ignoreShopExclusions` | override the shop-wide exclusions (items/order only) |
| `minSubtotal` + `minSubtotalBasis` | `wholeCart` \| `matching` |
| `minQuantity` | units of matching lines |
| `validFrom`, `validTo` | |
| `maxRedemptions`, `maxPerEmail` | |
| `combinesWith` | `items`, `order`, `shipping` (checkboxes) |
| `appliesToPickup` | shipping target only (decision 5) |
| `redemptionCount` | read-only, incremented by the webhook (as today) |

`title` is required (`i18n: 'atLeastOne'`, as on `coupon`) — for automatic discounts it is the
only customer-facing label. `discount` stays a normal (non-`liveEdit`) document like `coupon`:
checkout reads `published` only (`services/sanity.ts` client `perspective: 'published'`).

Semantics (all amounts integer cents; "remaining" = line gross minus what earlier discounts in
the apply order already took):
- `items` + `percent`: total = `floor(sum of remaining eligible line gross × value / 100)`
  (today's `validateCoupon` rounding), allocated over the eligible lines by largest remainder —
  so each line gets ≈ value %, and a migrated coupon gives exactly today's amount.
- `items` + `fixed`: per eligible line `min(value, remaining unit gross) × quantity` — exact, no
  allocation needed across lines (bundle children still allocated, see Allocation).
- `order` + `percent`: as `items` + `percent` (same base, same rounding); `order` + `fixed`:
  `min(value, remaining eligible sum)`, allocated by largest remainder. The difference to `items`
  is only the combinability class and the display, not the math of percent.
- `shipping` + `free`: the selected method costs 0 (the cart must contain a matching line; empty
  `appliesTo` = always).
- **Eligible lines** for `items`/`order` = matching `appliesTo` and not matched by
  `shopSettings.discountExclusions` (unless `ignoreShopExclusions`). Digital lines are never
  shipping-relevant.

### Shop settings

`shopSettings.discountExclusions` (`productSelector`, only the include part shown — "never
discount"). Applies to every `items`/`order` discount, never to shipping. Tinhof: kind = bundle.

### Pipeline (core-front `src/shared/discounts/`, pure, unit-tested)

```
validated cart → candidate discounts (code + automatic, enabled, in date range)
  → per discount: eligible lines, conditions (min subtotal, min qty, limits)
  → combinability resolution (one code max; decision 1)
  → apply in order: items → order (on what items left) → shipping
  → allocate cents per line (and per bundle child) → shipping discount
  → totals / VAT from the discounted line amounts
```

- **Combinability (exact rule):** two discounts A, B are compatible iff A's `combinesWith`
  contains B's `target` **and** B's contains A's. Two shipping discounts are never both applied
  (shipping can only be waived once). Resolution, all pure:
  1. *Automatic set*: valid automatic discounts sorted by saving (computed alone on the cart,
     desc; ties by `_id`), picked greedily — each one is taken if compatible with all already
     taken.
  2. *Code set* (only if a valid code discount exists): the code first, then the automatic ones
     greedily as in 1, each compatible with the code and with those taken.
  3. Compute the full saving (items + order + shipping amount of the selected method) of both
     sets with the pipeline; the larger wins, **tie → the code set** (the customer typed it).
     Automatic set wins → `couponError` `COUPON_NOT_COMBINABLE` with the title of the
     highest-saving automatic discount the code is incompatible with (decision 1).
  Several discounts on one line apply in the apply order (items → order → shipping), each on
  the remaining amount, never below 0.
- **Allocation** (`allocate.ts`): integer cents by largest remainder, weights = remaining line
  gross; for a bundle line the line's share is split again over its children by their stored
  price shares × line quantity (the VAT split, `commerce-and-netlify.md` → Bundle VAT, the
  `bundleItems[].price` from `validateBundleItems`). Sums equal the discount amount exactly at
  both levels; ties in the remainder go to the earlier line (deterministic).
- **VAT:** `calculateTotals` takes the per-part discounted gross (`vatParts` minus the allocated
  part discount) instead of the global `discountFactor`. Excluded lines keep their full VAT.
  `orderItem.vatAmount` / bundle child `vatAmount` keep their meaning (VAT of the
  **undiscounted** line, as today); the discounted VAT is in `totals.vatBreakdown`. Integer
  per-part amounts instead of today's fractional `part.gross × factor` can move a rate's VAT by
  a cent against the old code — expected; tests compare against the new rule, not old output.
  Shipping VAT rate: see open question Q2.
- **Free-shipping threshold `afterDiscount`:** compares the subtotal minus items + order discounts
  (pass 2 as today). Then shipping discounts.
- **Shipping discounts per method:** a valid shipping discount sets `price: 0` / `isFree: true`
  on every delivery method in the response, and on pickup methods only with `appliesToPickup`
  (today's `couponDiscount?.zeroShipping ? 0 : m.price` in `payment-create.ts` zeroes every
  method). Its `amount` = the **selected** method's price before the waiver; 0 when that is
  already 0 → no totals row (the code still shows as applied in the coupon area, as today).
  (round 5) The waiver is applied **after** `selectShippingMethod` (pass 1 / pass 2 select on the
  real prices), only to the response list and the totals — `resolveShippingMethods` no longer
  zeroes anything for discounts. Today `productFree` zeroes every delivery method **inside**
  `resolveShippingMethods`, so the default pick (cheapest delivery) sees a tie and takes the first
  in query order; afterwards it takes the really cheapest one, whose price is the discount's
  `amount`. Intended (the customer pays 0 either way); tests cover the default pick with a
  waived shipping discount.
- **Per-email limit** needs the email: checked on `createPayment` only (calculate sends no
  address). Express checkout verified: the wallet's `confirm` event carries
  `billingDetails.email` (`emailRequired: true`) and `onCreatePayment` sends it as
  `contactEmail` (`scripts/checkout-express.ts` `handleConfirm`, `scripts/checkout.ts`). One extra
  fetch in `payment-create.ts` only when an applied discount has `maxPerEmail`:
  `count(*[_type == "order" && lower(customer.contactEmail) == lower($email) &&
  $discountId in appliedDiscounts[].discountRef._ref])` (all orders, refunded ones too — simple
  and conservative). Over the limit → the discount is dropped, the pipeline re-runs without it,
  `couponError` `COUPON_LIMIT_PER_EMAIL`. The grand total then differs from what the page showed,
  so the existing reconfirm stops the payment (`mustReconfirm` on the page, `expressMustReconfirm`
  for wallets) — both submit paths must also call `coupon?.render(...)` with the response so the
  reason is shown (today only the calculate path does, `checkout.ts` ~l. 605), **and** apply the
  stored-code clearing rule below to the create response (round 2). Without that the express
  path loops: on reconfirm it calls `calculate(...)` (~l. 551), which sends the stored code
  without an email, gets the discount back, and the next wallet attempt is blocked again. The
  follow-up `calculate` must not wipe the error either: `calculate(options, { keepNotice,
  couponError })` renders the passed error when its own response has none. A race between two
  simultaneous orders is tolerated, as `maxRedemptions` today (checked on create, incremented on
  webhook).
- **Errors** (`ErrorCode` in `netlify/types/errors.ts`, server i18n `api.errors.coupon.<code>` in
  `de/en_server.ts`, a `data-t-coupon-*` attribute per code on the checkout container +
  the label map in `scripts/checkout.ts` ~l. 75–85 / 173–180): existing coupon codes kept, new
  `COUPON_NOT_APPLICABLE` (no eligible line in the cart), `COUPON_LIMIT_PER_EMAIL`,
  `COUPON_BELOW_MIN_QUANTITY`, `COUPON_NOT_COMBINABLE`. The client never shows the server
  `message` (`CheckoutCoupon.render` uses only `labels.errors[errorCode]`), so (round 2):
  `CouponErrorResponse` gets an optional `discountTitle`, set for `COUPON_NOT_COMBINABLE`; the
  label `checkout.coupon.error.notCombinable` reads "Nicht mit Aktion „{title}“ kombinierbar"
  and `render` fills `{title}` with the `fill` helper from `scripts/checkout-changes.ts`
  (export it), result via `textContent`.
- **Stored code cleared:** `checkout.ts` today clears the stored code when `couponError &&
  appliedCoupons.length === 0`. With automatic discounts the list is rarely empty → the condition
  becomes `couponError && !appliedDiscounts.some(d => d.trigger === 'code')`, in `calculate`
  **and** on both submit paths (see Per-email limit).
- **Coupon box state** (round 2): `CheckoutCoupon.render` gets only the `trigger === 'code'`
  entries — passing every applied discount would lock the input and show "Gutschein
  angewendet" for an automatic discount (`isApplied = applied.length > 0`, l. 70).
- **Free-shipping reason** (round 2): `freeShippingReason()` stays delivery-only, as
  `buildFulfillment` stores a reason only for delivery at 0 (a pickup waived by a code has none,
  as today). Priority: `threshold` before `discount` — today `product` beat `threshold`; the
  migration keeps old orders' values. A shipping discount whose selected method is already free
  (threshold) stays in `appliedDiscounts` with `amount: 0` (counted on the webhook, as a
  `freeShipping` coupon is today).

### Order snapshot (core-back schema, core-front `order-builder.ts`)

- `orderItem.discount` (cents, gross, ≥ 0, for the **whole line** = all units) and
  `orderItemBundleItem.discount` (cents, the child's part for the whole line quantity; children
  sum to the line's `discount`) — the stored allocation, never recomputed. Unset = 0 (lines
  without discount carry no field).
- `appliedDiscounts[]` (replaces `appliedCoupons`): `{ _key, discountRef (weak), code?, title
  (snapshot, order locale), trigger, target, valueType, value, amount }`. `amount` = cents saved
  (for shipping: the waived shipping cost, as `freeShipping` coupons store today).
- `fulfillment.freeShippingReason`: `threshold` | `discount` (+ the discount is in
  `appliedDiscounts` with `target: shipping`). Old values `product` / `coupon` migrated.
- `totals.discount` = sum of items + order discounts (unchanged meaning; shipping discount shows in
  `totals.shipping` = 0 as today).

### Display

- **Checkout:** one totals row per applied discount with `amount > 0`: label = the discount's
  title (text), code in the existing `code` slot, value `− €X` (`scripts/order-totals.ts`
  `renderTotals`; values via `textContent`). `macros/cart.njk` `totalsRow` needs no change (it
  already has the label and code slots). Shipping discounts get a row too, as `freeShipping`
  coupons do today (`renderTotals` maps every applied coupon; shipping shows "—") — new for the
  bundle rule, which today shows only "—" (round 2: stated, not a change of the money). The generic
  `data-t-discount` label (fallback when a title is empty) moves **out of** the
  `coreConfig.features.shop.coupons` block in `templates/core/components/checkout.njk` — a shop
  with automatic discounts and no codes needs it too. When the code discount skips cart lines:
  hint "Nicht rabattiert: <item titles>" in a new `<p data-checkout-coupon-hint
  class="checkout-coupon__hint" role="status">` inside the coupon fieldset — always in the DOM,
  empty when nothing to say (a polite live region is only announced reliably when it exists
  before it is filled; same reason as `data-checkout-changes`). Shipping discounts: method shows
  "—"/free as today.
  `CalculateResponse.appliedDiscounts` (title, code?, target, amount) + `notDiscountedVariantIds`
  replace `appliedCoupons`; `checkout-express.ts` builds wallet line items from it (shipping
  discounts not as a line, as today). `order-snapshot.ts` / order-thanks page follow.
- **Mails / invoice PDF:** one summary line per discount (title + amount) instead of one
  "Rabatt" line. Item lines unchanged (original price).
- **Studio order view:** discounts card lists `appliedDiscounts` (title, code, amount — no amount
  shown when unset, e.g. the migrated "Versandkostenfrei durch Produkt" entry; the totals card's
  single `order.discount` row stays, = `totals.discount`); each line
  shows "nach Rabatt €X" when `discount > 0`; free-shipping reason row: "Bestellwert" / the
  discount title.
- **Refunds stay amount-based** (`payment-refund.ts`). The per-line paid amount in the order view
  is what editors read for partial refunds. A "refund these lines" helper is **not** in scope.
- **Card note / product-page tax line / "Versand & Zahlung" sentence / schema.org shipping:**
  today driven by `grantsFreeShipping`. The build fetches the **automatic shipping discounts**
  that are `enabled` and have no condition other than `appliesTo` — no `minSubtotal`,
  `minQuantity`, `validFrom`/`validTo`, `maxRedemptions`, `maxPerEmail` (a dated or limited rule
  would leave a stale "free shipping" claim on pages and in the schema.org shipping details until
  the next deploy) — and sets `ResolvedVariant.grantsFreeShipping = kind !== 'digital' &&
  some(d => matchesSelector(line, d.appliesTo))` (a cart holding just this variant; empty
  `appliesTo` = every non-digital variant). Templates stay unchanged (incl. Tinhof's
  `overridable/product/container.njk`, which reads `product.grantsFreeShipping`);
  `hasFreeShippingProducts` follows. Like today the build snapshot only changes with the next
  deploy, checkout is live.
- **No automatic item/order discount on product pages or in schema.org prices** — checkout only.
  (Showing reduced prices would trigger the EU 30-day lowest-price rule, PAngV § 11.)

### Feature flags

| Flag | Effect |
|---|---|
| `shop.coupons` (existing, needs checkout) | `trigger: code` + the code field in checkout |
| `shop.automaticDiscounts` (new, needs checkout) | `trigger: automatic` offered |
| `shop.discounts` (new, **derived** in core-back `features.ts` = `shop.coupons \|\| shop.automaticDiscounts`; not a config field) | the `discount` doc, the `appliedDiscount` object, `discountExclusions`. Needed because a schema definition's `feature` is a single key (`featureFilter` in `features.ts`) |
| `shop.category` / `.subcategories` | selector criterion "categories" / subcategory matching |
| `shop.manufacturer` | selector criterion "manufacturers" |
| `shop.productKind.*` | kind options in the selector |
| `users` | nothing in this plan; reserved for login-based conditions (extension) |
| `shop.productFreeShipping` | **removed** (after migration) |

core-front: **the data is the switch** (as with product free shipping): it evaluates whatever
discounts are published; `hasCoupons` (server: `resolveServerConfig`, from the customer's
`payment_create.mts` `features.shop.coupons`; templates: `coreConfig.features.shop.coupons`)
only gates the code input + code lookup. core-front gets **no** `automaticDiscounts` flag. A rule using a
criterion whose feature was turned off later: Studio validation **warning** on the discount
("Kriterium Kategorie ist deaktiviert und wird trotzdem ausgewertet"); core-front still evaluates
it (the data exists).

## Extension points (designed, not built)

- **Conditions:** `src/shared/discounts/conditions.ts` — one entry per condition `{ key,
  evaluate(ctx): ok | errorCode }`; core-back adds the field. Later: logged-in only, customer
  group, first order, country.
- **Value types:** `apply.ts` switch on `valueType`. Later: tiers (`[{ minQty, percent }]`).
- **Targets:** later `freeItem` (buy X get Y) = an `items` discount allocating 100 % to one chosen
  unit.
- **Selector criteria:** `selector.ts` + the selector object. Later: tags, wine attributes
  (colour, vintage).
- **Shipping restrictions per product** (separate topic) can reuse `productSelector`.

## Steps — core-back

1. **Flags** (`types/schema.ts` `ITSFeatureKey`, `types/config.ts` (input + resolved),
   `config/mapper.ts` (both the all-features preset ~l. 133 and `normalizeFeatures`),
   `config/features.ts`): add `shop.automaticDiscounts` (needs checkout, like `shop.coupons`) to
   all four — `FeatureConfig.shop` + `ITSFeatureConfig.shop` in `types/config.ts`, `allFeatures()`
   (`true`) + `normalizeFeatures()` (`?? false`) in `mapper.ts`, the key in `ITSFeatureKey`, the
   `featureMap` entry. The derived key `shop.discounts` (see Feature flags) goes **only** into
   `ITSFeatureKey` and `featureMap` (`= featureMap['shop.coupons'] || featureMap['shop.automaticDiscounts']`,
   computed after both) — it is not a config field, so not in `types/config.ts` / `mapper.ts`
   (round 5). Update the `featureMap` comment ("Coupons and product free shipping only work in
   checkout"). Remove `shop.productFreeShipping` from all four files and from `productVariant.ts`
   (its `freeShippingOn`, l. 29) — in the same core-back
   major; the old flag in a customer `sanity.config.ts` then fails type-check, so the customer
   upgrade removes it (Tinhof `productFreeShipping: true`, Lichtenau `productFreeShipping: false`).
   `shopSettings.ts` `discountsEnabled` (today `shop.coupons || shop.vouchers`) also checks
   `shop.automaticDiscounts`.
2. **`productSelector` object** (`schemas/objects/productSelector.ts`, register in
   `schemas/objects.ts`): include/exclude groups with the criteria above, each gated by its flag;
   preview text ("Typ: Paket · ohne Kategorie Raritäten").
3. **`discount` document** (`schemas/documents/discount.ts`, `feature: 'shop.discounts'`; delete
   `coupon.ts` and its registration in `schemas/documents.ts`; structure `config/structure.ts`:
   `mapItems(['manufacturer', 'voucher', 'coupon'])` → `'discount'` (the list title "Rabatte"
   comes from the localization), `CouponIcon` kept): fields + validation from "Discount
   document" (the code-uniqueness query becomes `_type == "discount"`); preview (value, target,
   trigger, badge active/expired/… as today); flag-off warning. Localization `fields_de/en.ts`,
   `components_de/en.ts`, `structure_de/en.ts` (all hold `coupon` keys today; the list title is
   `structure_de.ts` `coupon: { title: 'Rabattcodes' }` → `discount: { title: 'Rabatte' }`, en
   "Discounts" — `fromRegistry` takes the item id from the doc name, round 5).
4. **`shopSettings.discountExclusions`** (`productSelector`): a new group `discounts`
   (`CouponIcon`, added to `groupNames` / `groupIcons` after `shipping`, only with checkout **and**
   `shop.discounts` — not with `discountsEnabled`, which also covers vouchers, and vouchers don't
   go through the pipeline). `freeShippingCalculation` stays in `shipping` under
   `discountsEnabled` (step 1 widens that). Group title + field labels in `fields_de/en.ts`.
5. **Order schema:** `appliedDiscount` object (`schemas/objects/orders/appliedDiscount.ts`,
   `feature: 'shop.discounts'`, `discountRef` weak reference `to: [{ type: 'discount' }]`),
   `orderAndOrderMetaFields.ts` `appliedDiscounts` (group `orderCoupons` → `orderDiscounts`,
   `readOnly: !isDev` and `sortable: false` as `appliedCoupons` today); `discount` on `orderItem`
   and `orderItemBundleItem` (`number`, `min(0).integer()`, `readOnly: !isDev` like the other
   snapshot fields there — they are read-only, not hidden); `fulfillment.freeShippingReason` list
   → `threshold` | `discount` (+ the old `product` / `coupon` until Rollout 6) and its comment
   ("product > threshold > coupon" → "threshold > discount"). Localization `fields_de/en.ts`:
   `appliedDiscounts`, `appliedDiscount` (its fields), `orderItem.discount`,
   `orderItemBundleItem.discount`, the group, the new reason value. Keep `appliedCoupons` /
   `appliedCoupon` / old reason values **readable** (read-only, hidden when empty) until the
   migration ran on every dataset, then remove (next minor, see Rollout 6). (round 2)
   `appliedCoupon.couponRef` is `to: [{ type: 'coupon' }]` — with `coupon` deleted in step 3 that
   is a reference to an unknown type (schema error, the Studio doesn't build): change it to
   `to: [{ type: 'discount' }]` (weak, so dangling old ids are fine) and its `feature` from
   `shop.coupons` to `shop.discounts` (orderMeta docs share these fields).
6. **Remove `grantsFreeShipping`** from `productVariant.ts` in the same 7.0.0 (with step 1's
   `freeShippingOn`; the field block l. 128–136 incl. its comment) and its labels in
   `fields_de/en.ts` (`productVariant` → `grantsFreeShipping`, ~l. 366 / 362) (round 5). Until the migration unsets it, a variant shows it as an unknown field —
   harmless for the minutes of Rollout 4.
7. **OrderView.tsx:** discounts card from `appliedDiscounts` (replaces the `appliedCoupons` card
   ~l. 540–565 and its `AppliedCoupon` type ~l. 144), per-line "nach Rabatt" when `discount > 0`
   (`OrderItemRow`, under the line total; also the field on `OrderItem` / bundle-item types
   l. 47–75), reason row (l. 468: `order.freeShippingReason.threshold|discount`; for `discount`
   the title of the shipping entry in `appliedDiscounts`; the reason type l. 109). New
   `order.freeShippingReason.discount` + discounts-card keys in `components_de/en.ts`.
8. `npm run types`; CHANGELOG (major: 7.0.0).

## Steps — core-front

9. **`src/shared/discounts/`**: `selector.ts` (`matchesSelector`, `withAncestors`),
   `conditions.ts`, `combine.ts` (the combinability rule), `apply.ts` (pipeline),
   `allocate.ts` (largest remainder, line + bundle child), `types.ts` (`SelectorLine`,
   `DiscountInput`, `AppliedDiscountResult`). Pure; exhaustive unit tests in
   `src/shared/__tests__/discounts-*.test.ts`. Delete `src/netlify/lib/coupon.ts` and
   `src/netlify/__tests__/coupon.test.ts` (their cases move into the new tests).
10. **Data for checkout** (`netlify/services/sanity.ts` `CHECKOUT_QUERY` + `fetchCheckoutData`):
    selector fields on the **top-level variant only** (bundle children are never matched,
    decision 4 — their projection stays as is): `"categoryIds": categories[]._ref,
    "productCategoryIds": product->categories[]._ref` (the adapter takes the variant's when
    non-empty, else the product's — as `resolve/variants.ts` l. 267; `coalesce` would keep an
    empty `[]`), `"manufacturerIds": coalesce(manufacturers, product->manufacturers)[]._ref`
    (same `??` semantics as `resolve/variants.ts` l. 440), `compareAtPrice`,
    `"productCompareAtPrice": product->compareAtPrice`; `kind`, `productId`, `price`,
    `productPrice` are already there; drop `grantsFreeShipping` (l. 52). Top-level `categories`
    (id + parentId);
    `"codeDiscount"`: `*[_type == "discount" && trigger == "code" && $couponEnabled &&
    defined($couponCode) && code == $couponCode][0]` — no enabled/date filter (like today's
    `"coupon"`), so `conditions.ts` can still answer `COUPON_DISABLED` / `COUPON_EXPIRED` /
    `COUPON_NOT_YET_VALID`; `"automaticDiscounts"`: `*[_type == "discount" && trigger ==
    "automatic" && enabled == true]` — dates are checked in `conditions.ts` like the code
    discount's (round 2: no `now()` string comparison in GROQ, one date rule for both). Both with selector references flattened to `_ref`
    id arrays, via the shared projection `src/shared/discounts/projection.ts` (step 18). `shopSettings.discountExclusions` in the `shopSettings` projection. Types in `netlify/types/checkout.ts` (replace
    `SanityCouponResult`, `AppliedCouponSnapshot`).
11. **`payment-create.ts`:** replace the coupon block (l. 160–215) with the pipeline; pass 1 /
    pass 2 for `afterDiscount` stay (pass 2 with items + order discount total); shipping
    discounts per method (see Pipeline); per-email check on `createPayment` (one fetch, new
    `services/sanity.ts` `countOrdersWithDiscountForEmail(discountId, email)`); response
    `appliedDiscounts` / `notDiscountedVariantIds` / `couponError`; `freeShippingReason`
    from the pipeline result.
    **Re-submit replaces the `orderMeta`** (round 4): `updateOrderMeta` (`services/sanity.ts`
    l. 129) does `patch().set(doc)`, a merge — a top-level field the new doc lacks survives. Today
    a coupon removed (or rejected) between two submits stays in `appliedCoupons` → the order shows
    it and the webhook increments it; with this plan the same goes for `appliedDiscounts` (e.g. a
    code dropped by the per-email limit on the second submit), and an old-frontend `orderMeta`
    re-submitted by the new frontend after the release would hold both `appliedCoupons` and
    `appliedDiscounts`. `buildOrderMeta` returns the complete document, so the update path in
    `payment-create.ts` (l. 319) uses `createOrderMeta` (`createOrReplace`) instead; remove
    `updateOrderMeta` if nothing else calls it. Test: second submit without the code → the
    `orderMeta` has no `appliedDiscounts` code entry and no `appliedCoupons`.
12. **`netlify/lib/totals.ts`:** `calculateTotals(items, selectedShipping, shippingVatRate,
    result)` takes the pipeline result (per-part discounts, shipping waived) instead of
    `CouponDiscount`; VAT from per-part discounted gross, no global factor. **`netlify/lib/tax.ts`**
    `dominantItemVatRate`: unchanged basis (Q2), fix its comment ("a coupon reduces every item by
    the same factor" is no longer true). **`netlify/lib/shipping.ts`:** drop `grantsFreeShipping`
    from `ShippingCartItem` (its `Pick`, l. 16) and `productFree` (l. 314–315, 372, 381 — the
    function then knows only the threshold; discount waivers come after selection, see Pipeline →
    "Shipping discounts per method"), `freeReason` → only `'threshold'`;
    `freeShippingReason(selected, shippingDiscountApplied)` → `threshold` | `discount`
    (delivery only, threshold first — see Pipeline). `AvailableShippingMethod.freeReason` and
    `FreeShippingReason` in `netlify/types/checkout.ts` follow.
13. **`netlify/lib/order-builder.ts`:** `orderItem.discount`, bundle child `discount`,
    `appliedDiscounts` (in `buildOrderMeta` and `buildOrder`), reason.
    **`netlify/lib/cart-validator.ts`:** no `grantsFreeShipping`; builds `ValidatedCartItem.selector:
    SelectorLine` (adapter, see Product selector).
14. **Webhook** (`payment-webhooks.ts`, `services/sanity.ts` `commitOrderTransaction`):
    `couponIncrements` → `discountIncrements` for every `appliedDiscounts[]` entry **with** a
    `discountRef` (the migrated "Versandkostenfrei durch Produkt" entries have none). Before the
    transaction, keep only ids that still exist (`*[_id in $ids]._id`): a `patch` on a deleted
    discount fails the whole transaction → the webhook errors, Stripe retries, no order is ever
    created (true today for a coupon deleted mid-checkout, more likely with automatic discounts).
    (round 2) `discount` is not `liveEdit`, so an open draft holds a stale `redemptionCount`
    and publishing it would overwrite the webhook's increments — likely now that every bundle
    order increments the automatic discount. The existence query therefore runs with
    `{ perspective: 'raw' }` over `$ids` and `drafts.` + each id, and the transaction increments
    every existing one (published and draft); `setIfMissing({ redemptionCount: 0 })` before
    `inc` (docs created outside the Studio may lack it).
    **Transition:** `buildOrder` accepts an old-shape `orderMeta` and converts it with the
    migration's conversion function (step 19; `couponRef._ref` → `discount-<old _id>`, reason
    `product`/`coupon` → `discount` as in Migration 3). Old shape = has `appliedCoupons` **or** a
    `fulfillment.freeShippingReason` of `product`/`coupon`, and no `appliedDiscounts` (with the
    `createOrReplace` of step 11 a document is never mixed). The log lines in
    `payment-webhooks.ts` (l. 87, l. 103) and `couponIncrements` (l. 112) switch to
    `appliedDiscounts`. Remove it no earlier than
    **`ORDER_META_RETENTION_DAYS` (30) days after the last live shop's release** — an unpaid
    `orderMeta` lives that long, and async methods (e.g. Klarna, SEPA) pay days later; "a few
    days" was too short.
15. **wc-api** (`functions/wc-api.ts`): `ORDER_PROJECTION` (l. 568) gets `discount` on
    `orderItems[]` and `bundle.items[]`; `SanityOrderItem` / `SanityOrderBundleItem` get
    `discount?: number`; `expandOrderLines` carries it as `WcLine.discount` (a bundle child's own
    `discount` — already for the whole line quantity, like its `lineGross = price × quantity` —
    a plain line the item's; unset = 0); `discountedGross = lineGross - discount` replaces
    `discountFactor` and the remainder block (l. 428–442; the allocation already sums exactly).
    Everything after (exact net, per-line tax, `discount_total`, `price`) is unchanged.
    `discount_total` / `discount_tax` unchanged in meaning. Update `wc-api.md`.
16. **Mails / PDF** (`src/netlify/templates/email/OrderEmail.tsx` `TotalsBlock` l. 291–322,
    discount line l. 309 — it takes only `totals`, so it gets an `appliedDiscounts` prop; **both**
    callers pass `order.appliedDiscounts`: `OrderEmail` l. 371 and `ShopOrderEmail.tsx` l. 84,
    which imports `TotalsBlock` and so shows the "Rabatt" line today too;
    `src/netlify/templates/pdf/InvoicePdf.tsx` l. 194–199 reads `order` directly). The type is
    `OrderDocument` in `netlify/types/checkout.ts` (gets `appliedDiscounts`, `OrderItem.discount?`,
    bundle child `discount?`; drops `appliedCoupons`). One summary line per
    `appliedDiscounts` entry with `amount > 0` and `target !== 'shipping'` (label = its `title`,
    falling back to `emails.order.summaryDiscount` when empty; value `-€X`); the lines sum to
    `totals.discount`. Shipping discounts stay visible as shipping 0, as today. The shop mail
    shows the title in the order's locale (the snapshot) — accepted. Mails read the whole order
    doc (`fetchOrderById` = `getDocument`), so no projection change.
17. **Client:** the request field stays `appliedCouponCode` (`scripts/checkout-api.ts`,
    `netlify/types/api.ts` — it is a code, no rename). `shared/checkout-api.ts` types (`AppliedDiscountResponse` = `{ title, code?,
    trigger, target, amount }` replacing `AppliedCouponResponse`; `CouponErrorResponse.discountTitle?`;
    the re-export in `netlify/types/api.ts`), `scripts/checkout-coupon.ts` (code entries only,
    hint, new errors, `{title}`), `scripts/order-totals.ts` (`TotalsData`, rows),
    `scripts/checkout.ts` (label map, stored-code clearing on calculate **and** both submit
    paths, `coupon?.render` on both submit paths, `calculate(…, { couponError })` — see
    Pipeline; on the express path the clearing runs right after `syncFromResponse`, **before**
    the reconfirm `calculate` at l. 551; on the page path inside the `mustReconfirm` branch,
    l. 693–700), `scripts/checkout-express.ts` `buildLineItems` (4th parameter
    `appliedDiscounts: AppliedDiscountResponse[]`; one negative line per entry with `amount > 0`
    and `target !== 'shipping'`, name = title; its three callers l. 102, 113, 220 pass
    `calc.appliedDiscounts`), `scripts/order-snapshot.ts` (`summary.appliedDiscounts`; bump the
    snapshot to `v: 2` — the reader drops other versions (l. 138), so a v1 snapshot saved before
    the release can't crash `renderTotals` on the thanks page), `scripts/order-thanks.ts` (type
    only), `templates/core/components/checkout.njk` (new `data-t-coupon-*` labels, `data-t-discount`
    outside the coupons block, hint element); translations
    `de/en_11ty.ts`, `de/en_server.ts`; hint style in `assets/css/checkout.css`.
    A11y: hint in its own polite region (Display), rows with text labels, no colour-only meaning.
18. **Build data** (round 5: made concrete against `resolver.ts` / `variants.ts` / `queries.ts`):
    - **Shared projection:** `src/shared/discounts/projection.ts` exports the GROQ discount
      projection (fields of "Discount document", selector refs flattened to `_ref` id arrays) —
      used by step 10's `CHECKOUT_QUERY` (its `codeDiscount` / `automaticDiscounts`) and by the
      build query, so both sides read one shape. `isUnconditional(d)` (no `minSubtotal`/`minQuantity` > 0, no `validFrom`/`validTo`,
      no `maxRedemptions`/`maxPerEmail`) in `conditions.ts`.
    - `data/queries.ts`: `buildAutomaticShippingDiscountsQuery()` = `*[_type == "discount" &&
      trigger == "automatic" && target == "shipping" && enabled == true]{ …projection }`; drop
      `grantsFreeShipping` from `buildVariantQuery` (l. 110).
    - `data/resolver.ts`: fetch it in the `Promise.all` (l. 57–71) only with `features.shop.enabled
      && features.shop.checkout` (else `[]`), and with **`client.fetch(query)` directly, not
      `fetchQuery`**: in preview builds `fetchQuery` enables stega, which encodes string values such
      as `appliesTo.kinds` ("bundle" + invisible chars) → `matchesSelector` would never match (the
      variant side is `stegaClean`ed, `variants.ts` l. 293). Keep `isUnconditional` ones.
    - Derivation as a **post-pass in `resolver.ts`** right after `resolveVariants` (l. 137), before
      `hasFreeShippingProducts` (l. 186) — no `resolveVariants` signature change: for each
      resolved variant, `v.grantsFreeShipping = v.kind !== 'digital' && discounts.some(d =>
      matchesSelector(selectorLineFromResolved(v, parentById), d.appliesTo))`, `parentById` from
      `categoryMap` (`ResolvedCategory.parentId`). The adapter `selectorLineFromResolved` (in
      `data/resolve/variants.ts`, exported): `variantId: _id`, `productId: product._id`, `kind`,
      `categoryIds: withAncestors(categories.map(c => c._id), parentById)`, `manufacturerIds:
      manufacturers.map(m => m._id)`, `hasCompareAtPrice: compareAtPrice != null &&
      compareAtPrice > price` (all already resolved with the variant→product fallbacks).
      `variants.ts` l. 447 becomes `grantsFreeShipping: false` (set by the post-pass). Known gap,
      accepted: `ResolvedVariant.categories` is empty without `shop.category` (the category query
      is gated, l. 63), so a category rule left over after turning the flag off shows no build
      claim while checkout still waives — the flag-off Studio warning covers it.
    - `types/data.ts` comments (l. 336, l. 395) → "derived from automatic shipping discounts".
    (round 2) `schema/shipping.ts` `variantToCartItem` passes
    `grantsFreeShipping` into `ShippingCartItem`, which step 12 removes — so
    `buildShippingDetails` applies it itself: after `priceShippingMethods`, a variant with
    `grantsFreeShipping` publishes rate 0 for every delivery method (same result as today's
    `productFree`); drop the field from `variantToCartItem`.
19. **Migration functions** (`src/netlify/lib/discount-migration.ts`, pure + tested) and an
    `itsshops` CLI subcommand `sanity migrate-discounts [--dry-run] [--yes]` under the existing
    `sanity` group in `src/bin/itsshops.ts` (reuses `loadEnv(command.optsWithGlobals().env)`
    and `getSanityClient('raw')` — `raw`, because the preflight must see `drafts.*` docs, which
    the default `published` read hides; asks for confirmation like `sanity delete` (type the
    dataset name), refuses without a TTY unless `--yes`; `--dry-run` prints per step what it would
    change and the check results, writes nothing; exits non-zero on a check mismatch);
    document in `cli.md` (today: "There is no write/patch command" — amend). Production runs are
    handed to the user as a `!` command (cli.md → auto mode). See Migration.
20. CHANGELOG (major: 6.0.0 — response shape, removed `grantsFreeShipping`, `appliedCoupons`);
    docs: `commerce-and-netlify.md` (Coupons → Discounts, product free shipping section rewritten),
    `wc-api.md`, `ui-contracts.md` (checkout discount rows + hint), `cli.md`
    (`sanity migrate-discounts`), `data-layer.md` (derived `grantsFreeShipping`); no
    `configuration.md` change — core-front gets no new flag (`automaticDiscounts` is core-back
    only, documented in core-back's config docs); ADR `discounts-model.md` (supersedes
    `product-free-shipping-variant-flag.md`, mark it superseded).

## Migration (per dataset, CLI, dry run first; backup before — `sanity-dataset-backups.md`)

Every step is **idempotent** (skips what is already migrated: `discount` exists for the coupon,
order has `appliedDiscounts` or line `discount`s), so a second run after the frontend publish
picks up stragglers (Rollout 4).

0. **Preflight:** abort if any `drafts.*` coupon or `drafts.*` variant with `grantsFreeShipping`
   exists (list them — the editor publishes or discards first); orders are `liveEdit` (no
   drafts).
1. **Coupons → discounts:** each `coupon` → `discount` with `_id` `discount-<old _id>` (Q1;
   create + delete of the coupon in one transaction):
   `trigger: code`; `percent`/`fixed` → `target: order`, same `valueType`/`value`; `freeShipping` →
   `target: shipping`, `valueType: free`, `appliesToPickup: true`; `minSubtotalBasis: wholeCart`;
   `combinesWith: { shipping: true }`; other fields copied (`title`, `description`, `enabled`,
   dates, limits, `redemptionCount`); then delete the `coupon`.
2. **Product free shipping → automatic discount:** if any variant has `grantsFreeShipping: true`,
   create one automatic shipping discount (title de "Versandkostenfrei mit Weinpaket" / en "Free
   shipping with a wine bundle" for the kind-bundle case, else "Versandkostenfrei" / "Free
   shipping"; editors can rename). `appliesTo` = kind bundle **if** the flagged set equals
   all active bundles (Tinhof: yes), else `variants[]` = the flagged variants. `appliesToPickup:
   false`; `combinesWith: { items: true, order: true }` (so it stacks with migrated codes as
   today — the combinability rule needs both directions); `enabled: true`, `redemptionCount: 0`,
   `minSubtotalBasis: wholeCart`. Then unset `grantsFreeShipping` on all variants.
3. **Orders:** per document, in one transaction each:
   - line discounts recomputed with **the current wc-api algorithm** (proportional over the
     expanded lines, `Math.round`, remainder on the last line — copied verbatim into the migration
     so the result equals what wineNET already received) and written to `orderItem.discount` /
     bundle child `discount`;
   - `appliedCoupons[]` → `appliedDiscounts[]` (title = code, `trigger: code`, target as in 1,
     `discountRef` → `discount-<old _id>`, `amount` = `discountAmount`), then **unset**
     `appliedCoupons`;
   - `freeShippingReason`: `product` → `discount` + an `appliedDiscounts` entry
     "Versandkostenfrei durch Produkt" (no ref, `target: shipping`, `amount` unset — the waived
     cost was never stored), `coupon` → `discount`, `threshold` unchanged;
   - a `system` history entry "Format migriert";
   - **check:** totals, line prices, VAT unchanged; sum of line discounts = `totals.discount`
     (holds by construction: the old algorithm makes the discounted lines sum to `grandTotal −
     shippingCost`); every line discount ≥ 0; abort the run on any mismatch.
4. **`orderMeta` are not migrated at all:** unpaid ones go through the webhook transition
   (step 14); paid ones are dead copies (the webhook returns early when the order exists,
   `findOrderByPaymentIntent`) that `order-meta-cleanup` deletes after 30 days.
5. Datasets: Tinhof `development` then `production` (in the release window, Rollout 4);
   Jurtschitsch, Lichtenau, Rosi Schuster: run if they have coupons/orders/flags (staging data;
   no compat needed for non-live shops). itsapps and fem have no shop — nothing to run.

## Tests

Unit (pure): selector (each criterion, include/exclude, bundle own categories, subcategories,
compare-at price); conditions (each, boundaries, per-email); combinability (code vs automatic both
ways, decision 1, tie → code; two automatic discounts compatible / incompatible; two shipping
discounts never both; migrated code + migrated automatic shipping = today's result);
allocation (sums exact, bundle children, 1-cent cases, excluded lines 0, deterministic ties);
shipping discount per method (delivery zeroed, pickup only with `appliesToPickup`; amount 0 when
already free); webhook skips increments for deleted discount ids; client: stored code cleared
only without a `trigger: code` entry; build: dated/limited automatic shipping discounts don't
set `grantsFreeShipping`, a kind-bundle rule sets it on bundles only (incl. a stega-encoded
preview fetch guard: the build query result is unencoded); default method pick with a waived
shipping discount = cheapest real price (round 5); schema.org shipping rate 0 for a derived `grantsFreeShipping` variant
(`buildShippingDetails`); client (round 2): per-email drop on the express path clears the stored
code and the follow-up calculate keeps the error (no reconfirm loop), coupon box ignores
automatic entries, `COUPON_NOT_COMBINABLE` label with the title, v1 order snapshot ignored;
webhook increments an existing draft of the discount too;
totals/VAT (mixed rates, excluded 13 % bundle with 20 % juice, shipping VAT); threshold
before/after discount with exclusions; shipping discount vs pickup; order builder snapshot; wc-api
line totals for new orders and **byte-identical output for migrated old orders** (fixtures from
staging orders 000007/000008 with coupons); migration (each case + mismatch abort); webhook old
`orderMeta` conversion. Integration (`TEST_LIVE`, staging): code + bundle, automatic shipping,
per-email limit, express checkout (Apple Pay line items).

## Rollout

1. Build core-back + core-front on feature branches (core `npm run build` + push before each
   customer lockfile pin); Tinhof frontend/backend branches pin commits; the backend branch sets
   `automaticDiscounts: true` and drops `productFreeShipping`.
2. Staging (Tinhof `development`): run migration, set `discountExclusions` = kind bundle, check
   the migrated automatic shipping discount; test the matrix above, wc-api output on old and new
   orders, Studio views, mails.
3. Decide: release together with store pickup or after it.
4. Release (`consuming-core-and-deploy.md` → Release flow, majors). The old frontend reads
   `_type == "coupon"` and `grantsFreeShipping`, the new one `discount` — whichever runs against
   the other's data loses codes and bundle free shipping. Keep that window to seconds:
   1. Backup production.
   2. Tinhof backend on core-back 7.0.0 with `automaticDiscounts: true` added and
      `productFreeShipping` removed in `sanity.config.ts` (the migrated automatic discount needs
      the flag to be editable; the old one no longer type-checks) → deploy the Studio (old
      `coupon` docs are invisible in the Studio until step 4 — harmless for minutes).
   3. Production frontend Netlify project: **stop auto publishing**, push `production` (new
      frontend builds but is not published).
   4. Run the migration on `production` (user runs it, `!` command).
   5. Publish the new deploy, re-enable auto publishing.
   6. Run the migration once more, **right after** 5 (idempotent — catches orders the old frontend
      created between 4 and 5; they are old-shape). Until then the new wc-api reads such a coupon
      order with no line `discount`s, so its line totals don't add up to `total` (round 2); if
      one exists, check that wineNET didn't import it in that window.
   7. Verify one order (code + bundle) and the wc-api output of an old and a new order.
5. Tell Tinhof: "Rabatte" replaces "Gutscheine", where the bundle free-shipping rule lives,
   exclusions in the shop settings, new options.
6. Next minor, ≥ 30 days after the release (step 14): drop the webhook transition and the old
   schema fields (`appliedCoupons`, `appliedCoupon`, old reason values).
7. Other customers upgrade when their work resumes (non-live: no compat): run the migration on
   their dataset if it has coupons/orders, drop `productFreeShipping` from their backend config
   (Lichtenau has `productFreeShipping: false`), set `automaticDiscounts` if wanted.

## Docs to update on completion

Tinhof frontend `CLAUDE.md` ("Product free shipping" → discounts; Wired & features; Go-live
status) and backend `CLAUDE.md` (`automaticDiscounts`, no `productFreeShipping`), core-front docs
listed in step 20, core-back `CLAUDE.md` + architecture (schemas, flags incl. the derived
`shop.discounts`, order view), core-back `CHANGELOG.md` upgrade notes (remove
`productFreeShipping` from `sanity.config.ts`).
