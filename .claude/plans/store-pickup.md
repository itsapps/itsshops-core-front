# Plan — store pickup (click & collect) as a shipping method

Status: **planned** (2026-11-17), nothing built; refined 2026-11-18 (round 1, 80/100), 2026-11-18 (round 2, 86/100). All decisions are the
owner's (1–5, 7–9 confirmed 2026-11-18). Spans **core-back** (shipping method fields, order snapshot, status labels)
and **core-front** (checkout UI, tax country, order snapshot, mails, thanks page, wc-api, info
page). Tinhof is the first user ("Abholung im Weingut", Eisenstätter Straße 10, 7061 Trausdorf —
to confirm); the other wine shops (Jurtschitsch, Lichtenau) are likely next.

## Why core (not customer code)

The checkout, the tax calculation, the order snapshot and the mails are core and can't be
changed by a customer override, and `shippingMethod.methodType` is a core-back schema field. So
pickup goes into core.

**No feature flag** (owner, 2026-11-17): "Abholung" is always offered in the shipping method's
type list when `shop.checkout` is on; its fields stay hidden until it's chosen, so shops that
don't use it see one extra list entry, nothing else. The data is the switch: a published pickup
method turns pickup on in the checkout, unpublishing/deleting it turns it off. Unlike
`shop.productFreeShipping` (a checkbox on every variant, where a stray tick makes whole orders
ship free — ADR `product-free-shipping-variant-flag.md`), there is no clutter and no accidental
cost to guard against.

## What already exists (leftovers, checked 2026-11-17)

Pickup is **not usable today** (`commerce-and-netlify.md` → "Pickup is not supported"):

- core-back `schemas/documents/shippingMethod.ts`: `{ value: 'pickup' }` and `pickupFee` are
  commented out; the `hidden` rules for `rates` / `packagingGroups` / `freeShippingThreshold`
  are commented out too.
- core-back `schemas/objects/orders/fulfillment.ts`: `methodType` allows `pickup`;
  `pickupLocation` (free-text string, admin-writable, shown only for pickup); `trackingCode`
  hidden for pickup. `OrderView.tsx` shows `pickupLocation`; `OrderActions.tsx` skips the
  tracking-code prompt for pickup.
- core-front `netlify/lib/shipping.ts` `resolveShippingMethods`: pickup branch (price =
  `pickupFee`, no packaging, no free-shipping reason); `selectShippingMethod` prefers the
  cheapest **delivery** method by default (keep: pickup is never pre-selected).
- `CHECKOUT_QUERY` (`netlify/services/sanity.ts`) already reads `methodType`, `pickupFee`, but
  filters methods by the **address country** (`references(taxCountry)`).
- `OrderEmail.tsx` prints `fulfillment.pickupLocation`; `order-thanks.ts` hides the address for
  pickup; `shippingInfoModule.njk` has a pickup-fee row; schema.org skips pickup methods;
  the privacy policy's carrier paragraph depends on a non-pickup method existing.
- Tests exist for the pickup branch (`shipping.test.ts`, `order-snapshot.test.ts`,
  `order-thanks.test.ts`, `schema.test.ts`, `order-builder.test.ts`).

## Decisions

Owner, 2026-11-17/18 (1–5 and 7–9 confirmed 2026-11-18):

1. **A pickup location is a `shippingMethod` with `methodType: 'pickup'`** (one per location;
   Tinhof has one). No separate document type.
2. **Pickup fields on the method:** `pickupFee` (price, default 0), `pickupAddress`
   (`businessAddress`, required for pickup), `pickupInstructions` (`i18nText`: opening hours,
   "bring ID — we check age at handover", "we'll e-mail you when it's ready"). `deliveryTime`
   is reused as "ready for pickup in …" (label switches for pickup). `pickupHoldDays`
   (optional number, decision 10) = how long a ready order is held.
3. **Pickup isn't bound to a country:** a pickup method has no `eligibleCountries` (hidden + not
   required for pickup) and is offered whatever country the address has — see decision 12 for
   which countries the address may have. Delivery methods keep their countries.
4. **VAT for pickup = the pickup location's country** (place of supply where the customer takes
   the goods; `pickupAddress.country`, fallback `shopSettings.defaultCountry`) — not the
   customer's address. Tinhof: AT and DE have the same rates today, so no visible change for
   Tinhof, but core must be right for other shops. *Confirm with the tax advisor.*
5. **Address for pickup = billing address only**, still required (name, street, zip, city,
   country — wineNET needs a customer, invoices > €400 need the address). No shipping address is
   stored for pickup orders; the "different billing address" toggle is hidden. The pickup
   location is **not** written into `customer.shippingAddress` (owner, 2026-11-18): `customer`
   holds only what the customer entered; the pickup address lives once, in
   `fulfillment.pickupAddress` (decision 9). The consumers of a missing `shippingAddress` are
   fixed instead (step 7). Towards an ERP the wc-api may still send the pickup address as
   `shipping` (step 17).
6. **Phone is optional, for pickup and delivery** (owner, 2026-11-18), no setting. Today the
   checkout form has **no** phone input at all (`checkout-form.ts` reads `shipping.phone` /
   `billing.phone`, but `checkout.njk` has no such field; the order address, `OrderView` and
   the wc-api already carry `phone`) — step 6a adds it for every shop. Express doesn't ask for
   it (no `phoneNumberRequired`): Apple Pay would then make it mandatory in its sheet, Google
   Pay returns it only best-effort — neither fits "optional". A required phone would need a
   setting; build that only when a shop needs it.
7. **Status flow: reuse the existing states** with pickup labels — `shipped` = "Abholbereit"
   (ready for pickup), `delivered` = "Abgeholt" (collected). No new states; the wc-api status
   mapping and the order list stay as they are. **But** a pickup order in `shipped` still has
   the goods at the shop, while today's code treats `shipped` as "goods with the customer" in
   four places (checked 2026-11-18, round 2): core-back `fulfillmentTransitions` (`shipped` →
   only `delivered`/`returned`, no `canceled`) and `refundCancelsFulfillment`; core-front
   `updateOrderPaymentStatus` (`services/sanity.ts` ~l.689, full refund auto-cancels only
   `created`/`processing`), the withdrawal receipt (`order-withdraw-notifier.tsx` ~l.86: asks
   for a **return**) and the wc-api's `isPreDispatch` (~l.338). Decision 10's "the shop cancels
   + refunds" an uncollected order is impossible without changing them — steps 4b and 16b
   treat pickup `shipped` as "not yet handed over".
8. **Mails:** the "shipped" mail for a pickup order is a "ready for pickup" mail (address +
   instructions, no tracking); "delivered" becomes "collected" (still opt-in). Same `MailType`s,
   text chosen by `fulfillment.methodType`.
9. **Snapshot:** the order stores `fulfillment.pickupAddress` (structured copy of the method's
   address), `fulfillment.pickupInstructions` (string, customer's locale) and
   `fulfillment.pickupHoldDays` (so a later change on the method doesn't move existing
   deadlines). The free-text
   `pickupLocation` field is replaced (no pickup orders exist anywhere, so no migration).
10. **Hold period = a field, not text** (owner, 2026-11-18): `pickupHoldDays` on the pickup
    method, optional, set by the shop in the Studio. **Deadline** = date of the order's latest
    `shipped` ("Abholbereit") `statusHistory` entry + `pickupHoldDays` — computed where shown,
    not stored (the `shipped` state is set by the Studio *and* by the wc-api, so one stored
    value would need writing in two places). Shown: the "ready for pickup" mail ("Bitte holen
    Sie Ihre Bestellung bis Di., 25.11. ab"), the order in the Studio ("abholen bis 25.11.",
    highlighted once past). The period without a date ("innerhalb von 7 Tagen nach unserer
    Benachrichtigung"): confirmation mail, thanks page, "Versand & Zahlung". The AGB name no
    number, only "the period stated in the pickup notification" — so changing the field needs
    no AGB change. Empty field → no period/deadline anywhere. **Not collected:** still manual —
    the shop cancels + refunds in the Studio ("Erstatten & abschließen"); no automatic
    cancellation or reminder in v1 (the field is the basis for one later). Tinhof note: wineNET
    sets `completed` → `shipped` right when a Vormerkung becomes an Auftrag (Tinhof
    `CLAUDE.md` → wineNET), i.e. a pickup order would turn "Abholbereit" early, without a mail,
    and its deadline would start then — **prerequisite:** plan
    `wc-api-erp-completed-accepted.md` (wc-api option `completedMeans: 'accepted'`) is live for
    Tinhof before it takes pickup orders — built and on Tinhof staging (2026-11-18), released
    together with pickup.
11. **Express checkout is always offered, also for pickup** (owner, 2026-11-18): when pickup is
    chosen on the page, the wallet sheet opens without a shipping address (billing address +
    email instead). Stripe supports this: `expressCheckoutElement.update()` takes
    `shippingAddressRequired` and `billingAddressRequired` (checked in the Stripe.js docs,
    2026-11-18; the same options on the click `resolve()` are deprecated). Only if the staging
    test shows a wallet that can't do it, fall back to hiding the express buttons while pickup
    is chosen.
12. **Pickup is open to customers from any country** (owner, 2026-11-17): in pickup mode the
    country select lists every country (ISO 3166-1 alpha-2), not just the enabled tax
    countries. The reasons for the tax-country list don't apply to pickup: VAT is the pickup
    location's (decision 4), there are no per-country shipping rates, and no destination-country
    excise duty, since the goods are handed over at the pickup location. Delivery keeps the
    tax-country list. *Confirm with the tax advisor together with decision 4* (incl. a non-EU
    customer, e.g. CH: Austrian VAT, no export). **Studio side:** the order stores the billing
    address as core-back `addressStrict`, whose `country` field lists
    `ctx.constants.countryOptions` = `localization.countries` (default: the 52 European codes,
    `EUROPE_COUNTRY_CODES` — so CH is in it, but e.g. US is not). A value outside it is written
    fine (the API doesn't validate) but the Studio shows it as "not in list" and flags the order.
    Step 3 (core-back) covers it. Related parked plan:
    `billing-address-all-countries.md` (every country for the billing address in general).

## Behaviour

- **Checkout:** a new choice at the top of the address fieldset (left column,
  `checkout.sections.delivery`), "Versand" vs. one radio per
  pickup method ("Abholung im Weingut — kostenlos"), shown only when the calculate response
  contains a pickup method (live, not build-time). Choosing pickup:
  - the address legend becomes "Rechnungsadresse", the billing toggle and billing fields hide,
    the shipping-method fieldset (right column, `data-checkout-shipping`) hides. The main fields
    keep their `shipping.*` names and stay the wire field `address.shipping` (see step 9) — only
    the server decides by the method type that they're the billing address;
  - the pickup address, instructions and "ready in …" show under the choice;
  - totals recalculate (fee, VAT by the pickup country, no packaging).
  - the country select switches to the full country list (decision 12; the chosen country is
    kept).
  Choosing "Versand" restores the current form and the tax-country list; a country outside it
  is cleared and the field shows the usual "country required" error. Default stays delivery
  (`selectShippingMethod`). An address country that isn't a tax country can only come from
  pickup mode, so its calculate response holds only pickup methods (no
  `SHIPPING_UNAVAILABLE` error) and pickup is selected.
- **Free shipping:** threshold and product free shipping don't apply to pickup (it has its own
  fee). A `freeShipping` coupon on a free pickup is accepted with 0 discount
  (`validateCoupon`: `zeroShipping = shippingCost > 0`; `payment-create` shows
  `displayDiscountAmount` 0) and still counts a redemption (webhook `couponIncrements`, one per
  applied coupon) — exactly what happens today with a delivery that is already free by
  threshold, so **no change**. On a pickup with a fee the coupon waives the fee (it is the
  order's shipping cost) — intended.
- **No weight/packaging limit** for pickup — large orders a carrier can't take stay possible.
- **Thanks page:** pickup address + instructions instead of the delivery address.
- **Shop inbox mail:** "ABHOLUNG" prominent at the top so the order isn't packed for DPD.
- **wineNET (wc-api):** shaped like a WooCommerce block-checkout Local Pickup order (checked
  in WC `trunk`, 2026-11-18): `shipping_lines[0].method_id` = `pickup_location` (the block
  checkout's pickup method, `src/Blocks/Shipping/PickupLocation.php` `$this->id`; `local_pickup`
  is the legacy shipping-zone method), `method_title` = method title, line `meta_data`
  `pickup_location` (name), `pickup_address` (one line, `", "`-joined) and `pickup_details`
  (instructions) — WC's own keys. The order's `shipping` address = **a copy of billing**: WC's
  checkout block sends the billing address as `shipping_address` when pickup is chosen
  (`use-checkout-address.ts`: `useBillingAsShipping = forcedBillingAddress ||
  prefersCollection`; the server stores it as is, `StoreApi/Utilities/OrderController.php`
  `update_addresses_from_cart`) — the pickup location is **not** written there. Tax lines /
  `rate_id`s by the pickup country (WC does the same: `ShippingController::
  filter_order_tax_location` reads `_pickup_location_address`). *Ask Andi* whether wineNET
  needs anything else for pickup orders (e.g. a Lieferart mapping by `method_id`, and whether it
  knows `pickup_location` or expects `local_pickup`).
- **Legal:** the withdrawal right still applies (distance contract); the period starts when the
  customer takes the goods — the statutory wording ("in Besitz genommen") already covers it.
  Return costs unchanged. Privacy policy (`privacyPolicy` in `i18n/translations/de_11ty.ts`, `de_11ty.informal.ts`,
  `en_11ty.ts`): **two** texts name the delivery address — the orders paragraph ("verarbeiten
  wir … Rechnungs- und Lieferadresse", ~l.584 / informal ~l.137) and "data we need for an
  order" (~l.645 / informal ~l.177). Reword both to "Rechnungsadresse und, bei Versand,
  Lieferadresse"; the orders paragraph also gets "und, falls angegeben, Ihre Telefonnummer"
  (step 6a). "Weitere Felder sind freiwillig" covers the phone in the second text. **Tinhof's AGB state
  "no pickup"** → rewrite the delivery section (owner approval).
- **Schema.org:** unchanged (pickup isn't a shipping detail for merchant listings).

## Steps — core-back

1. *(dropped — no feature flag, see "Why core")*
2. **`shippingMethod`**: add `{ value: 'pickup' }` to `methodType` (always); add
   `pickupFee` (`priceField`, initial 0), `pickupAddress` (`businessAddress`), `pickupInstructions`
   (`i18nText`), `pickupHoldDays` (number, integer ≥ 1, optional; description: "Wie lange eine
   abholbereite Bestellung aufbewahrt wird. Leer = keine Frist.") — hidden unless pickup,
   `pickupAddress` required for pickup (`requiredSubfields(['line1', 'zip', 'city', 'country'], ctx.t.default)`,
   `utils/validation.ts`), and its `country` must be an **enabled `taxCountry`** (async custom
   rule like `countryCodeField`'s: `count(*[_type == "taxCountry" && enabled && countryCode ==
   $code]) > 0`) — checkout taxes a pickup order by that country (decision 4). Hide
   `eligibleCountries` (validation only for delivery), `rates`, `packagingGroups`,
   `freeShippingThreshold` for pickup. Preview subtitle "Abholung" instead of the country count.
   Remove the old comment block at the end of the file (pickup "rate table" tip — obsolete).
3. **`fulfillment`** (`schemas/objects/orders/fulfillment.ts`): replace `pickupLocation` with
   `pickupAddress` (inline `object` with `line1`, `line2`, `zip`, `city` (plain `string` —
   snapshot in the customer's locale), `country`), `pickupInstructions` (`text`) and
   `pickupHoldDays` (number), `readOnly: lockSnapshot`, `hidden` unless `methodType ===
   'pickup'`; update the file's comment (only `trackingCode` stays admin-writable).
   Billing `country` (decision 12): `schemas/objects/addressStrict.ts` `country` list →
   `ctx.constants.allCountryOptions` (exists: `createAllCountryOptions`, every ISO code, already
   used by `address`). `addressStrict` is used only by `orderCustomer` (order + orderMeta billing
   and shipping — checked), and the shipping address is limited to tax countries by checkout
   anyway, so no order-only variant is needed. `OrderView` prints the country code
   (`formatAddressLines`) — unchanged.
3b. **Order preview without a shipping address** (`schemas/documents/orders/order.ts`
   `preview`): today `prepare` needs `customer.shippingAddress` and otherwise shows "New Order /
   Create a new order" — every pickup order would look like that in the order list **and** the
   withdrawal order picker. Select `billing: 'customer.billingAddress'` too and use
   `shipping ?? billing` for title/subtitle.
4. **Status labels by method type**: helper `statusLabelKey(state, methodType)` in
   `utils/orderTransitions.ts` → `order.status.options.<state>`, or
   `order.status.pickupOptions.<state>` for pickup `shipped` ("Abholbereit") / `delivered`
   ("Abgeholt") — keys in `components_de/en.ts` (the `componentT` family). Where labels show
   (checked): `OrderActions.tsx` `buildActions` (dialog buttons; `order.fulfillment.methodType`
   is already in `OrderActionDoc`), `OrderView.tsx` header badge (`tStatus`) and history entries
   (~l.601, today `schemaT` + `getStateTranslationKey` — switch fulfillment entries to
   `componentT(statusLabelKey(...))`), `OrderMailAction.tsx` mail-type labels
   (`actions.order.mailTypes.orderShipping` / `orderDelivered` → pickup variants
   "Abholbereit-Mail" / "Abgeholt-Mail"). `StatusIcon` shows only an icon — no change. The
   history entry's schema preview (`orderStatusHistory.ts`) can't see the order's
   `methodType` — stays generic (dev only).
4b. **Pickup `shipped` = not yet handed over** (decision 7) in `utils/orderTransitions.ts`:
   `getAllowedFulfillmentTransitions(current, payment, methodType?)` — for pickup, `shipped` →
   `['delivered', 'canceled']` (an uncollected order is cancelled, not "returned"; nothing came
   back); with `paymentStatus === 'refunded'` a pickup `shipped` order allows nothing more
   (like `created`/`processing`). `refundCancelsFulfillment(current, methodType?)` → also true
   for pickup `shipped`. Pass `order.fulfillment.methodType` at every caller (refund action,
   withdrawal "resolve" action, status dialog — grep the two functions; the callers weren't
   read in this refine). The `orderCanceled` mail text fits ("Falls Sie bereits bezahlt
   haben, erstatten wir …"). Tests: transition table for pickup vs delivery.
5. **`OrderView`**: pickup `AddressCard` (title "Abholung" + method title, pickup address,
   instructions, "abholen bis <date>" once `shipped` with `pickupHoldDays` set; past →
   `tone="caution"` card **and** the word "überfällig" in the text, not colour only) in place of
   the shipping-address card (which today also carries the method title — keep that for
   delivery). Billing card unchanged. Helper `pickupDeadline(statusHistory, holdDays)` in
   `utils/pickup.ts`: date of the latest `type: 'fulfillment', status: 'shipped'` entry +
   `holdDays` calendar days, `null` without entry or days; core-front has the same function
   (step 16) — the two packages don't share code, so both get the same test table.
6. Translations for the new fields (de/en), `npm run types` (extract + typegen →
   `src/types/sanity.types.ts`), `npm run build`, CHANGELOG.

## Steps — core-front

6a. **Optional phone field in the checkout** (decision 6) — independent of pickup, can ship
    ahead in its own core-front release. `checkout.njk`: one optional "Telefon (optional)"
    field in the address fieldset (`name="shipping.phone"`, `type="tel"`,
    `autocomplete="tel"`) and one in the billing fieldset (`billing.phone`,
    `autocomplete="billing tel"`); labels via `forms.fields.phone` (add an "(optional)" hint
    key). Server: `validateAddress` (`netlify/utils/validation.ts`) today checks only the required
    fields and passes anything else through — add: `phone`, if present, a string ≤ 40 chars
    after trim (else `INVALID_INPUT` with `details['<label>.phone']`). Mails/thanks page: show the phone where the address is shown, if given (check
    `OrderEmail.tsx`, `order-thanks.ts`). The phone isn't passed to a carrier by core (only the wc-api sends it to the ERP, a
    processor) — the carrier paragraph stays. In pickup mode the main field is the billing phone.
    Test: DOM test (field optional, sent when filled), order-builder keeps `phone`.
7. **Types** (hand-written — core-front has no generated `sanity.types`):
   `pickupAddress`, `pickupInstructions`, `pickupHoldDays` on `SanityShippingMethodResult` and
   `AvailableShippingMethod` (`netlify/types/checkout.ts`), `ShippingMethodResponse`
   (`shared/checkout-api.ts`), the order `Fulfillment` type (`checkout.ts` ~l.330; remove
   `pickupLocation`); `ResolvedShippingMethod` (`types/data.ts` ~l.232). Make
   `customer.shippingAddress` **optional** (`checkout.ts` ~l.287) — the compiler then lists
   every consumer to fix: `OrderEmail.tsx` ~l.229, `ShopOrderEmail.tsx` ~l.22 (`shipped.phone`
   would throw → the shop mail fails), `wc-api.ts`, `order-builder.ts`.
8. **`CHECKOUT_QUERY`** (`netlify/services/sanity.ts`): `shippingMethods` filter →
   `methodType == "pickup" || references(*[_type == "taxCountry" && countryCode ==
   $country]._id)`; project `pickupAddress{ line1, line2, zip, city, country }` (raw i18n
   `city`, resolved in step 10), `pickupInstructions`, `pickupHoldDays`. New key, same query (no
   second fetch): `"pickupTaxCountries": *[_type == "taxCountry" && enabled == true &&
   countryCode in *[_type == "shippingMethod" && methodType == "pickup"].pickupAddress.country]{
   countryCode, rules[]{ "taxCategoryCode": taxCategory->code.current, rate } }`
   (+ `SanityCheckoutQueryResult` type).
9. **`payment-create.ts` — tax country.** The tax rules must be known **before**
   `validateCart`, but the method is chosen after it (`selectShippingMethod` needs the priced
   methods) — so decide pickup from the raw `data.shippingMethods` first. After the existing
   fetch/refetch by address country:
   1. `requestedCountry` must be a valid ISO code (`isCountryCode`, step 12a) — else
      `INVALID_ADDRESS` (today any string passes and only fails as "no tax country").
   2. `pickups = data.shippingMethods.filter(m => m.methodType === 'pickup' && taxRulesFor(m))`
      where `taxRulesFor(m)` = `data.pickupTaxCountries` entry for `m.pickupAddress?.country ??
      shopSettings.defaultCountryCode`; a pickup method whose country has no enabled tax
      country is dropped with `log.warn` (the Studio rule in step 2 normally prevents it).
      "Dropped" = removed from the list handed to **both** `resolveShippingMethods` calls
      (pass 1 and the coupon pass 2, ~l.115 / ~l.176): `methodsIn = [...delivery methods,
      ...pickups]`, never `data.shippingMethods` directly.
   3. `pickup = pickups.find(m => m._id === req.shippingMethodId)`.
   4. **Address country not a tax country** (`!data.taxCountry`, decision 12): if `pickups`
      is empty → `SHIPPING_UNAVAILABLE` as today; else `pickup ??= pickups[0]` and the method
      list is `pickups` only (no delivery method exists for that country anyway).
   5. Tax rules for `validateCart` = `pickup ? taxRulesFor(pickup) : data.taxCountry.rules`.
   6. `selectShippingMethod(shippingMethods, pickup?._id ?? req.shippingMethodId)` — unchanged
      otherwise (default stays the cheapest delivery). Both passes (coupon re-resolve) use the
      same rules.
   `supportedCountries` in the response stays the tax-country list (the client builds the full
   list itself, step 12a).
   **Wire shape unchanged:** the client sends the main fields as `address.shipping` in both
   modes (`validatePaymentRequest` requires it). `createPayment` with a pickup method:
   `buildOrderMeta` gets `billingAddress = req.address.billing ?? req.address.shipping` and **no**
   `shippingAddress` (step 11).
10. **`resolveShippingMethods`**: pickup branch copies `pickupAddress` (city resolved to the
    locale) and `pickupInstructions` (locale) into the result; response maps them.
11. **`buildOrderMeta` / `buildFulfillment`**: snapshot `pickupAddress` + `pickupInstructions`
    + `pickupHoldDays`
    for pickup; omit `customer.shippingAddress` for pickup (`BuildOrderMetaInput.shippingAddress` optional;
    `buildAddressStrict` only when given). Webhook: no change — `buildOrder` copies
    `orderMeta.customer` / `fulfillment` as they are (`payment-webhooks.ts` →
    `order-builder.ts` `buildOrder`, read 2026-11-18).
12a. **Country list** (decision 12): `src/shared/countries.ts` — a static ISO 3166-1 alpha-2
    code array (browser-safe, no dependency) + `isCountryCode()`. Today the full list exists
    only server-side in `filters/index.ts` (`ALPHA2_CODES` from `i18n-iso-countries`, for the
    `countryList` filter) — switch that filter to the shared array and add a unit test that it
    equals `Object.keys(isoCountries.getAlpha2Codes())`, so there's one list. Names via
    `Intl.DisplayNames` (as `countryName`). Used by the checkout script (pickup-mode select,
    tax countries first, then the rest by localized name) and by `payment-create` (step 9.1).
    Not sent in the calculate response.
12. **Checkout template** (`core/components/checkout.njk`): fulfillment choice fieldset
    (`data-checkout-fulfillment`, radios, `aria-describedby` → pickup details), legend text for
    both modes as `data-t-*`, i18n keys `checkout.fulfillment.*`. Accessible: a real radio group
    in a nested `fieldset` with its own `legend` ("Versand oder Abholung"), the hidden sections
    use `hidden`, focus stays on the radio; the mode change is announced through a new
    `role="status"` sr-only region in the fieldset (the checkout has no general status region
    — `data-checkout-changes` is for cart changes, `data-checkout-error-global` is
    `role="alert"`). The pickup details block is rendered by the script from the response
    (address, instructions, hold period text) and referenced by the radio's
    `aria-describedby`.
13. **`checkout-fulfillment.ts` (new) / `checkout-shipping.ts` / `checkout.ts` /
    `checkout-form.ts`** (all read 2026-11-18, round 2):
    - New class `CheckoutFulfillment` (`[data-checkout-fulfillment]`): `render(pickupMethods,
      selectedId, formatPrice)` (radios "Versand" + one per pickup; the fieldset `hidden` when
      there is no pickup method), `getPickupId(): string | undefined`, `setOnChange(fn)`.
      `CheckoutShipping.render` today renders **every** method of the response (also in the
      re-confirm path, `checkout.ts` ~l.574) — pass it only `methodType === 'delivery'`.
    - `checkout.ts`: one function `selectedMethodId() = fulfillment.getPickupId() ??
      shipping.getSelectedId()` replaces every `shipping.getSelectedId()` (debounced recalc,
      coupon apply/remove, country change, shipping select, express `onAddressChange`, the
      express re-confirm recalc, submit — 8 call sites). On "Versand" after pickup, the
      delivery list may hold no checked radio → `undefined` → server default (cheapest
      delivery). Mode change → `calculate()`.
    - Submit in pickup mode: `{ shipping: form.getShippingAddress(), contactEmail }` with **no**
      `billing` (step 9's wire shape — the main fields are `shipping.*` and go as
      `address.shipping`), even if the "different billing address" box was unticked before
      the switch (its fields are hidden then; `getBillingAddress()` would still return them).
      `form.validate()` gets a `{ pickup }` option that skips the billing fields. The
      snapshot's `address` stays `form.getShippingAddress()`.
    - `checkout-form.ts` `bindBillingToggle`: in pickup mode the toggle and the billing
      fields are `hidden`; back on "Versand" restore `billingFields.hidden = checkbox.checked`.
    Mode change swaps the country options (`populateCountrySelect`: tax countries ↔ full list, step
    12a) and clears a country the delivery list doesn't have. Note `populateCountrySelect` today
    returns early once a select has options (`options.length > 1`, `checkout.ts` ~l.349) — add
    a `force` parameter for the swap, keep the early return for the per-calculate refill. The
    thanks-page snapshot (`buildOrderSnapshot`) gets the pickup method's address/instructions
    from the response's method (step 7).
14. **Order snapshot / thanks page** (`order-snapshot.ts`, `order-thanks.ts`,
    `overridable/order-thanks.njk`): pickup → `pickupAddress` + instructions slot.
    `order-snapshot.ts` (~l.61) takes the country name from `supportedCountries` (falls back to
    the code) — use `Intl.DisplayNames` instead, so a non-tax country shows its name. Pickup:
    the snapshot stores the method's `pickupAddress` + `pickupInstructions` (sessionStorage,
    so only what the response carried); the address slot shows them instead of the customer
    address (`order-thanks.ts` ~l.77 already skips the address for pickup).
15. **Express (`checkout-express.ts`)**: on a fulfillment mode change call
    `element.update({ shippingAddressRequired: false, billingAddressRequired: true })` for
    pickup, and back to `shippingAddressRequired: true` (billing off, as today) for delivery.
    `billingAddressRequired` has to be set explicitly: it defaults to false because the element
    is created with other options (both are in stripe-js'
    `StripeExpressCheckoutElementUpdateOptions`, checked in `node_modules`). New public
    method `setPickup(methodId: string | null)` (called by `checkout.ts` on a mode change and
    after each calculate) does the `update()` and stores the id. Pickup mode:
    - `handleClick`: `lineItems = buildLineItems(calc.items, <selected pickup method>,
      labels.pickup, calc.appliedCoupons)` (new label `labels.pickup` = "Abholung",
      `data-t-pickup`), **no `shippingRates` key**, and `this.shownCalculation = calc`.
      **Required:** without address/rate events nothing sets `shownCalculation`, and
      `expressMustReconfirm(null, …)` is always `true` (`checkout-changes.ts` ~l.43) — every
      pickup wallet payment would be refused with "please confirm again". The page's
      calculation is what the sheet shows (the pickup total doesn't depend on the wallet's
      billing country, decision 4), and the Elements amount is already the page's.
    - `handleConfirm` (today it reads `event.shippingAddress`/`event.shippingRate` and aborts
      without them): address from `event.billingDetails` (`name`, `address`, `email`, `phone`
      if given), method id = the stored pickup id; fail as today when name/address/email is
      missing.
    Don't use the deprecated per-click `shippingAddressRequired`.
    `allowedShippingCountries` limits only the shipping address, so a wallet billing address
    from any country passes; the server check (step 9) applies.
    `checkout-stripe.ts` `confirmPaymentWithDetails` always passes `confirmParams.shipping`
    (the address as Stripe's shipping details) — for pickup pass none (add an option), so the
    PaymentIntent carries no delivery address. `onCreatePayment` keeps sending the address as
    `{ shipping: address }` (wire shape, step 9).
16. **Mails** (`OrderEmail.tsx`, `ShopOrderEmail.tsx`, `order-notifier.tsx`,
    `templates/email/index.tsx`, `i18n/translations/{de,en}_server.ts`; all read 2026-11-18):
    - **Key selection:** helper `mailKey(mailType, order, part)` in `templates/email/index.tsx`
      → `emails.pickup.<mailType>.<part>` for a pickup order when that key exists for the
      mail type, else `emails.<mailType>.<part>`. Pickup variants (de/en, also
      `de_server.informal` if it exists — grep): `orderConfirmation.text` ("… wir melden uns,
      sobald sie abholbereit ist" + `{{holdPeriod}}` sentence when `pickupHoldDays` is set),
      `orderProcessing.text` (today "… in Kürze versendet"), `orderShipping.subject/preview/
      text` ("Bestellung {{orderNumber}} ist abholbereit"), `orderDelivered.subject/preview/
      text` ("abgeholt"). Three call sites use the key today and must all switch: `OrderEmail`
      body (`t(\`emails.${mailType}.text\`)`, ~l.233), `subjectFor` (~l.130; widen its
      `order` param to `Pick<OrderDocument, 'orderNumber' | 'fulfillment'>` — the only caller,
      `order-notifier.tsx` ~l.245, passes the full order) and the plain-text intro in
      `sendOrderNotification` (~l.249). Refund mails (`refundMailText`) stay generic.
    - **`OrderDetails`** (~l.85): drop the `pickupLocation` row (field removed, step 3); for
      pickup the labels `emails.order.pickupMethod` ("Abholung") instead of `shippingMethod`
      and `emails.order.pickupReadyTime` ("Abholbereit in") instead of `deliveryTime`.
      **`TotalsBlock`** gets a `methodType` prop → `emails.order.summaryPickup` ("Abholung")
      instead of `summaryShipping` (both mails call it).
    - **Addresses** (~l.286): with no `shippingAddress` today's code compares billing with
      `undefined`, goes to the two-column branch and `AddressBlock` throws on
      `address.country`. Pickup → `billedTo` block + "Abholort" block (`emails.order.
      pickupLocation`, reuse the key): `settings.shopName`, `fulfillment.pickupAddress`
      lines (country via `Intl.DisplayNames` as in `AddressBlock`) and `pickupInstructions`
      (split on `\n`). `AddressBlock` takes `AddressStrict` — add a small `PickupBlock`
      rather than loosening it. Delivery unchanged.
    - **Ready mail deadline** (`orderShipping`, pickup, `pickupHoldDays` set): "Bitte holen
      Sie Ihre Bestellung bis {{date}} ab" with `pickupDeadline(statusHistory, holdDays)` in
      `src/shared/pickup.ts` (same rule and test table as core-back's step 5 helper; calendar
      days counted in `shopTimeZone()`, so an entry at 23:30 UTC is the next Vienna day).
      `fetchOrderById` already returns `statusHistory` (`OrderDetails` reads it). The Studio's
      status dialog commits the `shipped` entry before it calls the mail function
      (`OrderActions.tsx` header comment), so the entry is there; no entry → today + days.
      Format `formatShopDate(deadline, locale, { dateStyle: 'full' })` (with weekday;
      the default `long` has none).
    - **Shop mail** (`ShopOrderEmail`): `const phone = billed.phone || shipped?.phone`
      (~l.25 throws today); pickup → a banner above the items (bold, "ABHOLUNG – nicht
      versenden", `emails.shopOrderConfirmation.pickupBanner`) and the same address blocks
      as above; `sendShopOrderNotification`'s plain text (~l.338) gets the banner line first.
      The subject already uses `billingAddress` — fine.
    Invoice PDF (`InvoicePdf.tsx`): it prints no delivery address (only billing) — only the
    shipping cost row (~l.191, label "Versand" + `(methodTitle)`) gets the label "Abholung"
    for pickup.
16b. **Pickup `shipped` = not yet handed over** (decision 7, core-front side of step 4b):
    helper `isHandedOver(status, methodType)` in `src/shared/pickup.ts` = `shipped`/`delivered`
    for delivery, only `delivered` for pickup. Use it in: `order-withdraw-notifier.tsx` ~l.86
    (a withdrawal on an "Abholbereit" order gets the `notDispatched` follow-up, with a pickup
    text `emails.orderWithdrawalCustomer.notCollected` — "Da Sie Ihre Bestellung noch nicht
    abgeholt haben, stornieren wir sie …"); `updateOrderPaymentStatus` (`services/sanity.ts`
    ~l.689, project `"methodType": fulfillment.methodType` in its query ~l.670) so a full
    refund of an uncollected order auto-cancels as in core-back; wc-api `isPreDispatch`
    (~l.338). Tests for each.
17. **wc-api** (`functions/wc-api.ts`, per "Behaviour" → wineNET, verified in WC's source):
    `shipping_lines[0].method_id` = `pickup_location` for pickup (today `f.methodType ??
    'flat_rate'`, ~l.475 — i.e. `delivery` stays as is), plus line `meta_data` `[{ key:
    'pickup_location', value: methodTitle }, { key: 'pickup_address', value: <one line> },
    { key: 'pickup_details', value: pickupInstructions }]` (`id`s via `stableId`, like the
    item meta); `shipping` = `mapAddress(shippingAddress ?? billingAddress)` (~l.446 — today
    `mapAddress(null)` would send empty strings); tax country =
    `fulfillment.pickupAddress.country` for pickup (~l.393 takes `shippingAddress ??
    billingAddress` — wrong for pickup, decision 4); project `pickupAddress`,
    `pickupInstructions` in `ORDER_PROJECTION`'s `fulfillment` and make
    `customer.shippingAddress` optional in its type (~l.58). With plan `wc-api-erp-completed-accepted.md`
    (Tinhof: `completedMeans: 'accepted'`) wineNET's `PUT completed` no longer sets "Abholbereit". Document in `wc-api.md`.
18. **Info page** (`shippingInfoModule.njk`, `resolveShippingMethods` in
    `data/resolve/settings.ts`, `buildShippingMethodsQuery` in `data/queries.ts`): the module
    already renders one `h3` + facts list **per method** (no per-country part; countries are a
    fact row, skipped when empty; pickup fee row exists). Add to the pickup method's facts:
    address, instructions (`paragraphs`), hold period (if set); project `pickupAddress`
    (i18n `city`), `pickupInstructions`, `pickupHoldDays` in the query and resolver.
19. **Product page tax line**: unchanged ("zzgl. Versandkosten" is still right). Leave as is.

## Tests (vitest)

- `shipping.test.ts`: pickup carries address/instructions; offered without a country match.
- `payment-create` tax country: pickup from a DE address → AT rules (needs a test with
  different rates per country, e.g. DE 19 %); switching back → DE rules.
- `payment-create`: pickup with a non-tax country (e.g. CH) → pickup only, pickup country's
  rules; same country for delivery → rejected; invalid code → rejected; no pickup method +
  non-tax country → `SHIPPING_UNAVAILABLE` as today.
- `order-builder.test.ts`: pickup snapshot, no `shippingAddress`.
- `coupon` / payment-create: `freeShipping` coupon + free pickup (accepted, 0 discount);
  + pickup with a fee (fee waived).
- `order-snapshot` / `order-thanks`: pickup address slot.
- wc-api: `pickup_location` + the three meta entries, `shipping` = billing copy, `rate_id` by
  pickup country; open withdrawal on a pickup `shipped` order → `cancelled`.
- Express (jsdom/unit): pickup click payload has no `shippingRates` and sets the shown
  calculation (a confirm with an unchanged response is **not** refused); confirm builds the
  address from `billingDetails`; `setPickup` calls `update()` with both flags.
- Pre-handover (16b / 4b): withdrawal receipt on pickup `shipped` → not-collected text; full
  refund of pickup `shipped` → auto-cancel; core-back transitions for pickup `shipped`.
- Mails: pickup subject/text keys in all three places (HTML body, subject, plain text),
  `orderProcessing` pickup text, `TotalsBlock` "Abholung".
- Checkout DOM test (jsdom): mode switch hides/shows sections, validation in pickup mode,
  country options swap (full list ↔ tax countries, foreign country cleared on "Versand").
- Mails: render `OrderEmail` for pickup confirmation / ready / collected; ready mail with and
  without `pickupHoldDays` (deadline date, none when empty); `ShopOrderEmail` and `OrderEmail`
  with no `shippingAddress` (must not throw).
- `pickupDeadline` (core-front + core-back, same table): latest `shipped` entry wins, no entry,
  no days.
- `validateAddress`: phone > 40 chars rejected, absent phone fine.
- `countries.ts` equals `i18n-iso-countries`' alpha-2 list.
- core-back: order preview with only a billing address (no "New Order").

## Docs

- core-front `commerce-and-netlify.md`: replace "Pickup is not supported" with the mechanism
  (tax country, address, snapshot, mails); `ui-contracts.md`: the fulfillment choice;
  `wc-api.md`: pickup mapping; `CHANGELOG.md`.
- core-back `schemas.md` (shipping method + fulfillment fields; no flag, the data is the
  switch; `addressStrict` country = all countries), `CHANGELOG.md`.
- ADR `decisions/pickup-tax-country-is-pickup-location.md` (decision 4) and
  `pickup-reuses-shipped-delivered-states.md` (decision 7).
- Tinhof `CLAUDE.md`: pickup method, AGB change, wineNET notes.

## Rollout (Tinhof)

1. Owner decisions (below), tax advisor on decision 4.
2. Build core-back + core-front (feature branches), push them, pin the commits in Tinhof
   backend/frontend (no config change — pickup needs only a pickup method in the data).
   Prerequisite: `wc-api-erp-completed-accepted.md` is released for Tinhof (decision 10).
3. Development dataset: create "Abholung im Weingut" (fee 0, address, instructions de/en).
4. "release tinhof staging": test orders — pickup via form and via Apple/Google Pay, with a DE
   billing address, with a non-tax-country (e.g. CH) billing address, with a coupon; status "Abholbereit" + mail, "Abgeholt"; refund/cancel of a
   not-collected order; wc-api output on staging.
5. Tell wineNET (Andi) about pickup orders (`pickup_location`, shipping = billing copy, pickup
   address in the shipping line's meta), check the first one there.
6. Update the AGB (delivery section, pickup hold period) and the "Versand & Zahlung" page;
   owner approval.
7. Release core tags + Tinhof production release; create the pickup method in production +
   Deploy.
8. Tell the owner: how pickup orders look in the Studio (Abholbereit/Abgeholt), the
   "ready for pickup" mail, the age check at handover, what to do with uncollected orders.

## Open decisions (owner)

- Pickup fee (0?), exact pickup address and opening hours / instructions text (de + en).
- Hold period: Tinhof enters `pickupHoldDays` themselves (or tells us the number); AGB approval
  of the generic wording (decision 10).
- Only Tinhof now, or switch it on for Jurtschitsch / Lichtenau too?
- Tax advisor: VAT of a pickup order by the pickup location (decision 4), also for customers
  from other EU and non-EU countries (decision 12).
- (round 2) An uncollected order ends as **"Storniert"** (steps 4b/16b: pickup `shipped` →
  `canceled`), not "Retourniert" — recommended, since nothing came back; confirm.
- (round 2) wc-api `method_id`: `pickup_location` (WC block checkout, recommended) vs.
  `local_pickup` (legacy) — follow Andi's answer if wineNET expects one.
