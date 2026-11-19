# Plan — store pickup (click & collect) as a shipping method

Status: **built, on branches `feat/store-pickup`** (core-back, core-front, Tinhof frontend; 2026-11-19), not on staging yet — Rollout 2 onward. Refined 2026-11-18/19 (8 rounds, last 96/100). All decisions are the
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
   is reused as "ready for pickup in …" — the label switches where it's *shown* (mails, info
   page); in the Studio a field title is static, so its description names both meanings
   (step 2). `pickupHoldDays`
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
   `created`/`processing`) and the withdrawal receipt (`order-withdraw-notifier.tsx` ~l.86: asks
   for a **return**); core-back's withdrawal guide (`withdrawalNextStep`: "wait" for the goods)
   too (round 3). Decision 10's "the shop cancels + refunds" an uncollected order is impossible
   without changing them — steps 4b and 16b treat pickup `shipped` as "not yet handed over".
   The wc-api's `isPreDispatch` stays as is (step 16b says why).
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
    the shop cancels + refunds in the order's **status dialog** ("Status aktualisieren"):
    first "Storniert" (cancel mail with the not-collected text, step 16c — it says the amount
    will be refunded), then "Refundiert" (refund; its mail optional). "Erstatten & abschließen"
    exists only on a withdrawal (`WithdrawalActions.tsx`), not for an order without one; a
    full refund first would auto-cancel (step 4b) but send only the refund mail, without the
    not-collected text. No automatic
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

- **Checkout:** a new section of its own right before the address fieldset (left column),
  "Versand" vs. one radio per
  pickup method ("Abholung im Weingut — kostenlos"), shown only when the calculate response
  contains a pickup method (live, not build-time). Choosing pickup:
  - the address legend becomes "Rechnungsadresse", the whole billing section (toggle + fields)
    hides, the shipping-method fieldset (right column — the `<fieldset>` around
    `data-checkout-shipping`, not just that div) hides (hooks: step 12). The main fields
    keep their `shipping.*` names and stay the wire field `address.shipping` (see step 9) — only
    the server decides by the method type that they're the billing address;
  - the pickup address, instructions and "ready in …" show under the choice;
  - totals recalculate (fee, VAT by the pickup country, no packaging).
  - the country select switches to the full country list (decision 12; the chosen country is
    kept).
  Choosing "Versand" restores the current form and the tax-country list; a country outside it
  is cleared and the field shows the usual "country required" error. Default stays delivery
  (`selectShippingMethod`), and pickup is **only ever chosen explicitly** (a pickup id in the
  request): today `selectShippingMethod` falls back to `methods[0]` when there's no delivery
  method — with pickup methods in every response that would silently make a "Versand" order a
  pickup order (step 9.6). A response with pickup methods but **no** delivery method (a tax
  country no carrier serves, or a pickup-only shop) switches the page to pickup mode (step
  13). An address country that isn't a tax country can only come from
  pickup mode, so its calculate response holds only pickup methods (no
  `SHIPPING_UNAVAILABLE` error); the page sends the chosen pickup id, and a request without one
  gets `selectedShippingMethodId: null` (step 9.4) — never a pickup the customer didn't pick.
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
  knows `pickup_location` or expects `local_pickup`), and whether it ever re-reads an order it
  already has as `completed` (step 16b assumes it doesn't — it polls by status).
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
   $code]) > 0`) — checkout taxes a pickup order by that country (decision 4). Both rules on
   the field: `validation: (rule) => [requiredSubfields(...)(rule), rule.custom(async …)]`,
   only for pickup. `requiredSubfields` (`utils/validation.ts` ~l.166) can't do that today: its
   `rule.custom` ignores the context, and Sanity validates hidden fields too — so every
   delivery method would be flagged. Add a generic option `when?: (context: ValidationContext)
   => boolean` to it (custom returns `true` when `when` is given and false); call it with
   `{ when: (c) => (c.parent as { methodType?: string })?.methodType === 'pickup' }`. The
   country rule checks `context.parent.methodType` itself (no code → `true`; the required
   subfield rule reports it). Hide
   `eligibleCountries` (validation only for delivery), `rates`, `packagingGroups`,
   `freeShippingThreshold` for pickup. Preview subtitle "Abholung" instead of the country count
   (select `methodType` too; key `shippingMethod.preview.pickup` next to
   `shippingMethod.preview.countries` in `schemaT`'s resources). `pickupFee` via `ctx.builders.priceField` (its `Rule.positive()`
   is Sanity's `min(0)`, so 0 is valid). Hidden fields keep their values when an editor
   switches the type — every reader ignores rates/packaging/countries/threshold of a pickup
   method (checkout: the pickup branch `continue`s; info page: step 18). Labels in
   `localization/resources/fields_de.ts` / `fields_en.ts` → `shippingMethod.fields` (there's
   already a `pickupFee` entry); `deliveryTime.description` → "Optional, z. B. „2–4
   Werktage“. Bei Abholung: wie lange es dauert, bis die Bestellung abholbereit ist." (en to
   match). Remove the old comment block at the end of the file (pickup "rate table" tip —
   obsolete).
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
   withdrawal's `orderRef` field (the "Bestellung zuordnen" dialog in `WithdrawalActions.tsx`
   has its own query on `customer.billingAddress.name` — unaffected, checked round 8). Select `billing: 'customer.billingAddress'` too and use
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
   `actions.order.pickupMailTypes.*` "Abholbereit-Mail" / "Abgeholt-Mail"; its
   `OrderMailActionDoc` (~l.38) has **no** `fulfillment` today — add `fulfillment?: {
   methodType?: 'delivery' | 'pickup' }`, `published` carries it), and the `mail` history
   entries in `OrderView` (~l.615, same `actions.order.mailTypes.*` lookup → same pickup
   variants). `StatusIcon` shows only an icon — no change. The
   history entry's schema preview (`orderStatusHistory.ts`) can't see the order's
   `methodType` — stays generic (dev only).
4b. **Pickup `shipped` = not yet handed over** (decision 7) in `utils/orderTransitions.ts`:
   `getAllowedFulfillmentTransitions(current, payment, methodType?)` — for pickup, `shipped` →
   `['delivered', 'canceled']` (an uncollected order is cancelled, not "returned"; nothing came
   back); with `paymentStatus === 'refunded'` a pickup `shipped` order allows nothing more
   (like `created`/`processing`). `refundCancelsFulfillment(current, methodType?)` → also true
   for pickup `shipped`. Callers (all read 2026-11-18, round 3):
   - `OrderActions.tsx` `buildActions` (~l.73) — `OrderActionDoc` already has
     `fulfillment.methodType`; its `refundOrder({ order, … })` call (~l.219) passes the same doc.
   - `utils/orderRefunds.ts` `buildRefundPatch(order, …)` (~l.101, called by
     `lib/shop/orderRefund.ts` `refundOrder` ~l.88): widen `order` to `{ status; fulfillment?:
     { methodType? } }` and pass the type to `refundCancelsFulfillment` (`refundOrder`'s `order`
     type widens with it).
   - `utils/withdrawals.ts` `returnedOffered(orderStatus, paymentStatus, methodType?)` (~l.178)
     → pass it on; caller `components/actions/WithdrawalActions.tsx` ~l.1183 —
     `returnedOffered(order.status, paymentStatusAfter(…), order.fulfillment?.methodType)`.
     Its order query (~l.1144) projects **nested** `"fulfillment": fulfillment{ methodType }`
     and `ResolveOrder` gets `fulfillment?: { methodType?: 'delivery' | 'pickup' }` — the same
     object goes to `refundOrder` (~l.1195) → `buildRefundPatch`, which reads
     `order.fulfillment?.methodType`; a flat `"methodType"` there would leave a fully refunded
     "Abholbereit" order un-cancelled (and, being refunded, with no transition left — stuck).
   - `utils/withdrawals.ts` `withdrawalNextStep` (~l.135): a pickup `shipped` order →
     `{ step: 'refund', why: 'notCollected' }` — a new row right after the `notShipped` row
     (~l.135, so before `partiallyRefunded`, like it); today it falls through to `wait` ("wait for
     the goods back"). `WithdrawalOrderLike` gets `methodType?` (flat: the guide's own query), `WithdrawalNextStep.why` gets
     `'notCollected'`, and `WithdrawalGuideInput.tsx`'s `ORDER_QUERY` (~l.21) projects it. The
     guide (~l.134, today `why === 'notShipped'` → `refundNotShipped` "Noch nicht versendet →
     …") gets a third branch, key `actions.orderWithdrawal.guide.step.refundNotCollected`
     (`components_de/en.ts`): "Noch nicht abgeholt → „Erstatten & abschließen“ (storniert
     auch die Bestellung)." The "How it works" list stays generic.
   "Erstatten & abschließen" sends the **refund** mail (`orderRefunded`/`…Partially`, ~l.1230),
   not the cancel mail — unchanged.
   The cancel mail gets a pickup text and a generic fix (step 16c).
   Tests: transition table for pickup vs delivery; `buildRefundPatch` full refund on pickup
   `shipped` → `canceled`; `withdrawalNextStep` pickup `shipped` → `refund`/`notCollected`.
5. **`OrderView`** (read in full, round 4): the inline types (~l.102 `Fulfillment`, ~l.164
   `customer`) — drop `pickupLocation`, add `pickupAddress`/`pickupInstructions`/
   `pickupHoldDays`, make `shippingAddress` optional. Pickup `AddressCard` (title "Abholung"
   — key `order.pickup` — + method title, pickup address via the existing
   `formatAddressLines` (~l.299; no name fields → the name line drops out), instructions,
   and **only while `order.status === 'shipped'`** with `pickupHoldDays` set the deadline line
   `order.pickupDeadline` "Abholen bis {{date}}" (`format.date(…, { dateStyle: 'medium' })`);
   past → `order.pickupOverdue` "Abholfrist abgelaufen am {{date}}" **and** the card's
   `tone="caution"`, not colour only. Not for `delivered`/`canceled` — a collected order must
   not read "overdue". Keys in `components_de/en.ts`) in place of the shipping-address card,
   rendered when `fulfillment.methodType === 'pickup'` (not "when `shippingAddress` is
   missing").
   That card today is the only place showing `customer.contactEmail` (first line, ~l.547) —
   the pickup card starts with it too. `AddressCard` takes `lines` only — add an optional
   `tone` prop, and key its lines by index (today `key={line}`: two equal instruction lines
   would clash). `pickupInstructions` goes in split on `\n` (a `Text` doesn't render line
   breaks). Delivery card unchanged (minus the `pickupLocation` line ~l.553). Totals row
   `order.shipping` ("Versand", ~l.437) → `order.pickup` for pickup. Billing card
   unchanged. Helper `pickupDeadline(statusHistory, holdDays)` in
   `utils/pickup.ts`: date of the latest `type: 'fulfillment', status: 'shipped'` entry +
   `holdDays` calendar days, `null` without entry or days; core-front has the same function
   (step 16) — the two packages don't share code, so both get the same test table.
6. Translations for the new fields (de/en), `npm run types` (extract + typegen →
   `src/types/sanity.types.ts`), `npm run build`, CHANGELOG.

## Steps — core-front

6a. **Optional phone field in the checkout** (decision 6) — independent of pickup, can ship
    ahead in its own core-front release. `checkout.njk`: one optional "Telefon (optional)"
    field in the address fieldset after the country select (`id="checkout-phone"`,
    `name="shipping.phone"`, `type="tel"`, `autocomplete="tel"`, `maxlength="40"`, no
    `required`, its own `data-checkout-error="shipping.phone"` span) and one after the billing
    country (`checkout-billing-phone`, `billing.phone`, `autocomplete="billing tel"`); label
    key `forms.fields.phone.labelOptional` ("Telefon (optional)" / "Phone (optional)") —
    `forms.fields.phone.label` exists ("Telefon", `de_11ty.ts` ~l.432) but its
    `errorMessage` says "darf nicht leer sein", so it's not reused for the error. Server: `validateAddress` (`netlify/utils/validation.ts`) today checks only the required
    fields and passes anything else through — add: `phone`, if present, a string ≤ 40 chars
    after trim (else `INVALID_INPUT` with `details['<label>.phone']`). Mails: `OrderEmail.tsx`
    `AddressBlock` (~l.13) prints no phone today — add `{address.phone && <EmailText>…}` after
    the country line (also used by `ShopOrderEmail`, which additionally shows the phone at the
    top, ~l.25 — keep). `order-builder.ts` `buildAddressStrict` already copies `phone`
    (~l.36) — no change. Thanks page: check `order-thanks.ts` / the snapshot (it may not carry
    the phone — then leave it out, the snapshot keeps personal data minimal). The phone isn't passed to a carrier by core (only the wc-api sends it to the ERP, a
    processor) — the carrier paragraph stays. In pickup mode the main field is the billing phone.
    Test: DOM test (field optional, sent when filled), order-builder keeps `phone`.
7. **Types** (hand-written — core-front has no generated `sanity.types`):
   `pickupAddress`, `pickupInstructions`, `pickupHoldDays` on `SanityShippingMethodResult` and
   `AvailableShippingMethod` (`netlify/types/checkout.ts`), `ShippingMethodResponse`
   (`shared/checkout-api.ts` ~l.44 — today only `_id`, `title`, `methodType`, `price`,
   `isFree`; also add optional `deliveryTime`, which the pickup details' "Abholbereit in …"
   needs and the response doesn't carry today), the order `Fulfillment` type (`checkout.ts` ~l.330; remove
   `pickupLocation`); `ResolvedShippingMethod` (`types/data.ts` ~l.232). Make
   `customer.shippingAddress` **optional** (`checkout.ts` ~l.287) — the compiler then lists
   every consumer to fix: `OrderEmail.tsx` ~l.229, `ShopOrderEmail.tsx` ~l.22 (`shipped.phone`
   would throw → the shop mail fails), `wc-api.ts`, `order-builder.ts`.
8. **`CHECKOUT_QUERY`** (`netlify/services/sanity.ts`): `shippingMethods` filter →
   `methodType == "pickup" || references(*[_type == "taxCountry" && countryCode ==
   $country]._id)`; project `pickupAddress{ line1, line2, zip, city, country }` (raw i18n
   `city`, resolved in step 10), `pickupInstructions`, `pickupHoldDays`. New key, same query (no
   second fetch): `"pickupTaxCountries": *[_type == "taxCountry" && enabled == true &&
   countryCode in (*[_type == "shippingMethod" && methodType == "pickup"].pickupAddress.country
   + [*[_type == "shopSettings"][0].defaultCountry->countryCode])]{ countryCode, rules[]{
   "taxCategoryCode": taxCategory->code.current, rate } }` — the default country is in the list
   because `taxRulesFor` (step 9.2) falls back to it for a pickup method without a country;
   without it that fallback would never find rules and drop the method
   (+ `SanityCheckoutQueryResult` type).
9. **`payment-create.ts` — tax country.** The tax rules must be known **before**
   `validateCart`, but the method is chosen after it (`selectShippingMethod` needs the priced
   methods) — so decide pickup from the raw `data.shippingMethods` first. After the existing
   fetch/refetch by address country:
   1. `requestedCountry`, when given, must be a valid ISO code (`isCountryCode`, step 12a) — else
      `INVALID_ADDRESS` (today any string passes and only fails as "no tax country"; `null`
      still falls back to the default country).
   2. `pickups = data.shippingMethods.filter(m => m.methodType === 'pickup' && taxRulesFor(m))`
      where `taxRulesFor(m)` = `data.pickupTaxCountries` entry for `m.pickupAddress?.country ??
      shopSettings.defaultCountryCode`; a pickup method whose country has no enabled tax
      country is dropped with `log.warn` (the Studio rule in step 2 normally prevents it).
      "Dropped" = removed from the list handed to **both** `resolveShippingMethods` calls
      (pass 1 and the coupon pass 2, ~l.115 / ~l.176): `methodsIn = [...delivery methods,
      ...pickups]`, never `data.shippingMethods` directly.
   3. `pickup = pickups.find(m => m._id === req.shippingMethodId)`.
   4. **Address country not a tax country** (`!data.taxCountry`, decision 12): if `pickups`
      is empty → `SHIPPING_UNAVAILABLE` as today; else the method list is `pickups` only (no
      delivery method exists for that country anyway). `pickup` is **not** defaulted (that
      would make a request without a pickup id a pickup order): the tax rules come from
      `pickup ?? pickups[0]`, the selection stays `null` (6.), the page then sends its pickup id
      (step 13, "no delivery method"), and a `createPayment` without one fails at ~l.252.
   5. Tax rules for `validateCart` = `pickup ? taxRulesFor(pickup) : data.taxCountry ?
      data.taxCountry.rules : taxRulesFor(pickups[0])`.
   6. `selectShippingMethod(shippingMethods, pickup?._id ?? req.shippingMethodId)`. In
      `netlify/lib/shipping.ts` (~l.391) drop the last fallback `return methods[0]` → `return
      null`: without a requested id only a delivery method is picked (cheapest); a pickup only
      when requested. A calculate with pickups but no delivery then answers
      `selectedShippingMethodId: null` (the `!selectedShipping && shippingMethods.length === 0`
      check ~l.126 still lets it through, since the list isn't empty) and a `createPayment`
      without a pickup id fails with `SHIPPING_UNAVAILABLE` (~l.252) — never a silent pickup
      order. Update `shipping.test.ts` (fallback case). Both passes (coupon re-resolve) use
      the same rules.
   `supportedCountries` in the response stays the tax-country list (the client builds the full
   list itself, step 12a).
   **Wire shape unchanged:** the client sends the main fields as `address.shipping` in both
   modes (`validatePaymentRequest` requires it). `createPayment` with a pickup method:
   `buildOrderMeta` gets `billingAddress = req.address.billing ?? req.address.shipping` and **no**
   `shippingAddress` (step 11).
10. **`resolveShippingMethods`**: pickup branch copies `pickupAddress` (city resolved to the
    locale), `pickupInstructions` (locale) and `pickupHoldDays` into the result. The
    calculate response's method mapping (`payment-create.ts` ~l.228, today `_id`, `title`,
    `methodType`, `price`, `isFree` only) adds `deliveryTime` (both types) and, for pickup,
    the three pickup fields.
11. **`buildOrderMeta` / `buildFulfillment`** (`netlify/lib/order-builder.ts`, read in full
    round 8): `buildFulfillment` (~l.121) adds, only for `methodType === 'pickup'`,
    `pickupAddress: { line1, ...(line2 && { line2 }), zip, city, country }` (from
    `selectedShipping.pickupAddress`, city already resolved by step 10),
    `...(pickupInstructions && { pickupInstructions })`, `...(pickupHoldDays && {
    pickupHoldDays })` — same spread style as `deliveryTime` (~l.140), no `null` fields in the
    document. A pickup method without `pickupAddress` (Studio rule, step 2, prevents it) →
    throw, so `payment-create` fails before the PaymentIntent instead of storing an order
    without a pickup location. `buildOrderMeta` (~l.176): `BuildOrderMetaInput.shippingAddress`
    becomes optional; `customer.shippingAddress` is written only for delivery
    (`selectedShipping.methodType === 'delivery'`), and a delivery without it throws — the
    method type decides, not whether the caller happened to pass one. `packagingLines` /
    `freeShippingReason` already drop out for pickup (~l.154–157). Webhook: no change — `buildOrder` copies
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
12. **Checkout template** (`core/components/checkout.njk`, read in full round 8):
    - **Fulfillment choice:** a new `<fieldset class="checkout__section"
      data-checkout-fulfillment hidden>` between the contact fieldset and the address fieldset
      — a sibling, not nested in the address fieldset (whose legend turns into
      "Rechnungsadresse" in pickup mode, so a nested "Versand oder Abholung" group would sit
      under the wrong name). Own `legend` (`checkout.fulfillment.legend`, "Versand oder
      Abholung"), a radio container filled by the script, a details container
      (`data-checkout-pickup-details`, `id="checkout-pickup-details"`) referenced by each pickup
      radio's `aria-describedby` (address, instructions, hold period text — rendered by the
      script from the response). Focus stays on the radio.
    - **Status region:** `<p data-checkout-fulfillment-status class="sr-only" role="status">`
      **outside** that fieldset (right after it), always in the DOM and not `hidden` — the
      fieldset starts `hidden`, and a live region is only announced reliably when it exists
      (visible to AT) before it's filled (same reason as the `data-checkout-changes` comment).
      The checkout has no general status region (`data-checkout-changes` is for cart changes,
      `data-checkout-error-global` is `role="alert"`).
    - **Hooks the mode switch needs** (none exist today): `data-checkout-address-legend` on the
      address fieldset's `<legend>` with root attributes `data-t-address-delivery`
      (`checkout.sections.delivery`) / `data-t-address-billing` (`checkout.sections.billing`);
      `data-checkout-billing-section` on the billing toggle's `<fieldset>`;
      `data-checkout-shipping-section` on the shipping-method `<fieldset>` (right column). Hide
      the **fieldsets**, not their inner divs: Tinhof styles `.checkout__section`
      (`blocks/checkout.css`), so a fieldset with only its inner part hidden stays an empty box
      (shipping: an orphaned "Versandart" legend).
    - Pre-existing a11y bug to fix on the way: the billing fieldset's `<legend>` sits inside
      `data-checkout-billing-fields` (a `div`), so it isn't the fieldset's first child and names
      nothing. Make the fieldset's first child a `<legend class="sr-only">`
      (`checkout.sections.billing`) and keep the visible heading in the div as a `<p>` (or
      `aria-hidden` copy) — one accessible name, no duplicate announcement.
    - Root `data-t-pickup` (`checkout.pickup`, "Abholung") — read by the summary label (step
      13) and the express line items (step 15); i18n keys `checkout.fulfillment.*`.
13. **`checkout-fulfillment.ts` (new) / `checkout-shipping.ts` / `checkout.ts` /
    `checkout-form.ts`** (all read 2026-11-18, round 2):
    - New class `CheckoutFulfillment` (`[data-checkout-fulfillment]`): `render(pickupMethods,
      selectedId, formatPrice)` (radios "Versand" + one per pickup; the fieldset `hidden` when
      there is no pickup method), `getPickupId(): string | undefined`, `setOnChange(fn)`.
      `CheckoutShipping.render` today renders **every** method of the response (also in the
      re-confirm path, `checkout.ts` ~l.574) — pass it only `methodType === 'delivery'`.
    - `checkout.ts`: one function `selectedMethodId() = fulfillment.getPickupId() ??
      shipping.getSelectedId()` replaces every `shipping.getSelectedId()` (debounced recalc
      ~l.250, coupon apply/remove ~l.259/264, express `onAddressChange` ~l.381, the express
      re-confirm recalc ~l.432, country change ~l.512, submit `createPayment` ~l.556, the
      thanks-page snapshot's `shippingMethodId` ~l.587 — 8 call sites; checked round 6).
      `shipping.setOnSelect` (~l.515) keeps passing its own `methodId` (only reachable in
      delivery mode — the fieldset is hidden in pickup mode). On "Versand" after pickup, the
      delivery list may hold no checked radio → `undefined` → server default (cheapest
      delivery). Mode change → `calculate()`.
    - **No delivery method in the response** but pickup methods (step 9.6): after the
      calculate, switch to pickup mode with the first pickup method checked, recalculate with
      its id, and announce it in the fieldset's status region ("Versand in dieses Land ist
      nicht möglich – Abholung ausgewählt", `checkout.fulfillment.deliveryUnavailable`); the
      "Versand" radio stays enabled. **Once per country:** `checkout.ts` keeps
      `autoPickupCountry` (the country it last auto-switched for) and only auto-switches when
      the response's `selectedCountry` differs — else choosing "Versand" again would trigger a
      calculate that switches straight back. In delivery mode with an empty delivery list
      there is no "no shipping" state today (`CheckoutShipping.render` just renders nothing,
      and the server only errors when the whole list is empty) — so `render` with no delivery
      methods shows one `<p>` with `checkout.fulfillment.deliveryUnavailableShort` ("Versand
      in dieses Land ist nicht möglich.") in the shipping fieldset; a submit then fails with
      `SHIPPING_UNAVAILABLE` (step 9.6) as the error the page already shows.
      No pickup and no delivery → today's `SHIPPING_UNAVAILABLE` path.
    - Submit in pickup mode: `{ shipping: form.getShippingAddress(), contactEmail }` with **no**
      `billing` (step 9's wire shape — the main fields are `shipping.*` and go as
      `address.shipping`), even if the "same as shipping" box (`data-checkout-same-billing`)
      was unticked before the switch (its fields are hidden then; `getBillingAddress()`
      returns them whenever that box is unchecked).
      `form.validate()` gets a `{ pickup }` option that skips the billing fields. The
      snapshot's `address` stays `form.getShippingAddress()`.
    - `checkout-form.ts` `bindBillingToggle` (~l.82): in pickup mode the whole
      `[data-checkout-billing-section]` fieldset is `hidden` (step 12); back on "Versand" unhide
      it and restore `billingFields.hidden = checkbox.checked`. The shipping-method fieldset:
      `[data-checkout-shipping-section]` `hidden` in pickup mode. The address legend's text
      swaps between `data-t-address-delivery` / `data-t-address-billing`.
    Mode change swaps the country options (`populateCountrySelect`: tax countries ↔ full list, step
    12a) and clears a country the delivery list doesn't have. Note `populateCountrySelect` today
    returns early once a select has options (`options.length > 1`, `checkout.ts` ~l.349) — add
    a `force` parameter for the swap, keep the early return for the per-calculate refill. The
    thanks-page snapshot (`buildOrderSnapshot`) gets the pickup method's address/instructions
    from the response's method (step 7). Totals row: the summary's "Versand" label
    (`labels.shipping`, `checkout.ts` ~l.44 → `order-totals.ts`) reads "Abholung"
    (`checkout.pickup`, `data-t-pickup`) while pickup is selected — as in the mails'
    `TotalsBlock` (step 16). `CheckoutSummary` keeps its labels in a private field set once in
    the constructor (`checkout-summary.ts` ~l.24/38) — add `setShippingLabel(label: string)`;
    `checkout.ts` calls it on every mode change (and on the "no delivery method" auto-switch)
    before the next `renderTotals`.
14. **Order snapshot / thanks page** (`order-snapshot.ts`, `order-thanks.ts`,
    `overridable/order-thanks.njk`): pickup → `pickupAddress` + instructions slot.
    `order-snapshot.ts` (~l.61) takes the country name from `supportedCountries` (falls back to
    the code) — use `Intl.DisplayNames` instead, so a non-tax country shows its name. Pickup:
    the snapshot stores the method's `pickupAddress` + `pickupInstructions` (sessionStorage,
    so only what the response carried) and **no** `shippingAddress` (the file keeps personal
    data minimal, header comment — the customer's billing address isn't shown for pickup, so
    it isn't stored); the address slot shows the pickup address + instructions instead
    (`order-thanks.ts` ~l.77 already skips the customer address for pickup). For pickup the
    section heading (`staticPages.orderThankYou.delivery` "Lieferung", `order-thanks.njk`
    ~l.39) becomes `staticPages.orderThankYou.pickup` ("Abholung", as `data-t-pickup` on the
    root, swapped by the script — one `h2`, same id) and the totals "Versand" label becomes
    "Abholung" (`data-t-pickup-total` → `renderTotals` labels).
15. **Express (`checkout-express.ts`)**: on a fulfillment mode change call
    `element.update({ shippingAddressRequired: false, billingAddressRequired: true })` for
    pickup, and back to `shippingAddressRequired: true` (billing off, as today) for delivery.
    `billingAddressRequired` has to be set explicitly: it defaults to false because the element
    is created with other options (both are in stripe-js'
    `StripeExpressCheckoutElementUpdateOptions`, checked in `node_modules`). New public
    method `setPickup(methodId: string | null)` (called by `checkout.ts` on a mode change and
    after each calculate) does the `update()` and stores the id. (File read in full, round 4.)
    **Delivery mode** — required: every calculate response now also lists the pickup methods,
    and `buildPayloadFromCalculation` (~l.94) hands **all** `calc.shippingMethods` to the
    sheet as `shippingRates` (`buildShippingRates`, ~l.86) — the wallet would offer
    "Abholung" as a shipping rate and create a pickup order with a collected shipping
    address. Filter to `methodType === 'delivery'` there; if none is left, `event.reject()`
    in `showCalculation` (the sheet says the address can't be served). Pickup mode:
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
      → `emails.pickup.<mailType>.<part>` for a pickup order when the mail type/part is in a
      static map `PICKUP_MAIL_KEYS` (same file: `orderConfirmation: ['text']`,
      `orderProcessing: ['text']`, `orderShipping: ['subject', 'preview', 'text']`,
      `orderDelivered: [...]`, `orderCanceled: ['text']` with the 16c rule), else
      `emails.<mailType>.<part>`. Not "if the key exists": `serverT` (`netlify/utils/i18n.ts`)
      returns the key itself on a miss and has no exists check. Pickup variants (de/en, also
      `de_server.informal.ts` — it exists): `orderConfirmation.text` ("… wir melden uns,
      sobald sie abholbereit ist"; the hold period is an extra line, see "Extra pickup lines"),
      `orderProcessing.text` (today "… in Kürze versendet"), `orderShipping.subject/preview/
      text` (`preview` is read by no template today — add it only for parity) ("Bestellung {{orderNumber}} ist abholbereit"), `orderDelivered.subject/preview/
      text` ("abgeholt"). Three call sites use the key today and must all switch: `OrderEmail`
      body (`t(\`emails.${mailType}.text\`)`, ~l.233), `subjectFor` (~l.130; widen its
      `order` param to `Pick<OrderDocument, 'orderNumber' | 'fulfillment'>` — the only caller,
      `order-notifier.tsx` ~l.245, passes the full order) and the plain-text intro in
      `sendOrderNotification` (~l.249). Refund mails (`refundMailText`) stay generic.
    - **Extra pickup lines** (no interpolation inside the main text — `t(\`emails.….text\`)` is
      called without params today): helper `pickupExtraLines(ctx, mailType, order): string[]` in
      `templates/email/index.tsx`, appended after the body lines in `OrderEmail` (~l.240) **and**
      to the plain-text `intro` (~l.249), so HTML and text match. For a pickup order with
      `pickupHoldDays`: `orderConfirmation` → `emails.pickup.holdPeriod` ("Wir bewahren Ihre
      Bestellung ab unserer Benachrichtigung {{days}} Tage für Sie auf."); `orderShipping` →
      `emails.pickup.deadline` ("Bitte holen Sie Ihre Bestellung bis {{date}} ab.", see "Ready
      mail deadline"). Otherwise `[]`.
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
    - **Ready mail deadline** (`orderShipping`, pickup, `pickupHoldDays` set): the
      `emails.pickup.deadline` line with `pickupDeadline(statusHistory, holdDays, timeZone)` in
      `src/shared/pickup.ts` (same rule and test table as core-back's step 5 helper; calendar
      days counted in `timeZone`, so an entry at 23:30 UTC is the next Vienna day). `shared/`
      is browser-safe, and `shopTimeZone()` lives in `netlify/utils/i18n.ts` and reads
      `process.env` — so the time zone is a parameter; the mail passes `shopTimeZone()`.
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
    Invoice PDF (`netlify/templates/pdf/InvoicePdf.tsx` — not `email/`; read in full, round
    4): it prints no delivery address (only billing) — only the shipping cost row (~l.189,
    `emails.order.summaryShipping` + `(methodTitle)`) takes `emails.order.summaryPickup` for
    pickup (the `TotalsBlock` key).
16b. **Pickup `shipped` = not yet handed over** (decision 7, core-front side of step 4b):
    helper `isHandedOver(status, methodType)` in `src/shared/pickup.ts` = `shipped`/`delivered`
    for delivery, only `delivered` for pickup. Use it in: `order-withdraw-notifier.tsx` ~l.86
    (a withdrawal on an "Abholbereit" order gets the `notDispatched` follow-up, with a pickup
    text `emails.orderWithdrawalCustomer.notCollected` — "Da Sie Ihre Bestellung noch nicht
    abgeholt haben, stornieren wir sie …"); the record's order comes from
    `ORDER_LOOKUP_PROJECTION` (`services/sanity.ts` ~l.244) — add `"methodType":
    fulfillment.methodType` there and to `OrderWithdrawalLookup`. `updateOrderPaymentStatus`
    (`services/sanity.ts` ~l.689, project `"methodType": fulfillment.methodType` in its query
    ~l.670) so a full refund of an uncollected order auto-cancels as in core-back. Tests for
    each.
    **Not** the wc-api's `PRE_DISPATCH` / `isPreDispatch` (~l.273/~l.386): a pickup order in
    `shipped` is already `completed` for the ERP (it set that itself in `accepted` mode, or
    the shop's "Abholbereit" maps to it), so it has left the ERP's ship queue, and the
    `cancelled` override only works through that queue's poll. `PRE_DISPATCH` also drives
    `statusFilter`'s GROQ (accepted mode), which can't see `methodType` without a second
    filter — changing only `mapOrder` would make list and record disagree. A withdrawal on an
    "Abholbereit" order is cancelled in the ERP by hand, as accepted orders already are.
16c. **Cancel mail** (`emails.orderCanceled.text`; `de_server.ts` ~l.198,
    `de_server.informal.ts` ~l.47, `en_server.ts` ~l.198). Owner, 2026-11-18:
    - **Generic, every shop (not pickup-specific):** today "Falls Sie bereits bezahlt haben,
      erstatten wir Ihnen den Betrag in voller Höhe …" — but an order only exists after Stripe
      confirmed the payment (webhook `payment_intent.succeeded`), so it is always paid, and
      "in voller Höhe" is wrong after an earlier partial refund. New: "Ihre Bestellung wurde
      storniert. Den bezahlten Betrag erstatten wir Ihnen über das ursprünglich verwendete
      Zahlungsmittel zurück.\nSollten Sie Fragen haben, …" (informal and en to match).
      CHANGELOG note (text change visible to customers of every shop).
    - **Pickup, not collected:** a pickup order that has a `fulfillment`/`shipped`
      ("Abholbereit") history entry gets a pickup text via `mailKey` (step 16):
      `emails.pickup.orderCanceled.textNotCollected` when `pickupHoldDays` is set ("Da Sie
      Ihre Bestellung nicht innerhalb der Abholfrist abgeholt haben, haben wir sie storniert.
      Den bezahlten Betrag …"), `…textNotCollectedNoPeriod` when it isn't ("Da Sie Ihre
      Bestellung nicht abgeholt haben, …") — no period named without the field (decision 10).
      A pickup order cancelled **before** "Abholbereit" gets the generic text. `mailKey`
      therefore needs the order's `statusHistory` + `fulfillment.pickupHoldDays` for this
      mail type (both on the fetched order). Subject stays generic.
    Tests: generic text without "Falls"; pickup cancel with/without `pickupHoldDays`; pickup
    cancelled before `shipped` → generic.
17. **wc-api** (`functions/wc-api.ts`, per "Behaviour" → wineNET, verified in WC's source):
    `shipping_lines[0].method_id` = `pickup_location` for pickup (today `f.methodType ??
    'flat_rate'`, ~l.525 — i.e. `delivery` stays as is), plus line `meta_data` `[{ key:
    'pickup_location', value: methodTitle }, { key: 'pickup_address', value: <one line> },
    { key: 'pickup_details', value: pickupInstructions }]` (`id`s via `stableId`, like the
    item meta); `shipping` = `mapAddress(shippingAddress ?? billingAddress)` (~l.496 — today
    `mapAddress(null)` would send empty strings); tax country =
    `fulfillment.pickupAddress.country` for pickup (~l.443 takes `shippingAddress ??
    billingAddress` — wrong for pickup, decision 4); project `pickupAddress`,
    `pickupInstructions` in `ORDER_PROJECTION`'s `fulfillment` (~l.552) and add both to
    `SanityOrder.fulfillment` (~l.85). `customer.shippingAddress` is already `SanityAddress |
    null` there (~l.73) and GROQ returns `null` for a missing field — no type change. With plan `wc-api-erp-completed-accepted.md`
    (Tinhof: `completedMeans: 'accepted'`, on core `main` since `cc7fe57`) wineNET's `PUT
    completed` keeps a pickup order "In Bearbeitung" (+ `erpAcceptedAt`) instead of setting
    "Abholbereit"; the shop then sets "Abholbereit" in the Studio (reported `completed` as
    before). No pickup-specific code in the accepted mode. Document in `wc-api.md`.
18. **Info page** (`templates/core/modules/shippingInfoModule.njk` — the `overridable/`
    one only includes it; no customer overrides it, checked round 7 — `resolveShippingMethods` in
    `data/resolve/settings.ts`, `buildShippingMethodsQuery` in `data/queries.ts`): the module
    already renders one `h3` + facts list **per method** (no per-country part; countries are a
    fact row, skipped when empty; pickup fee row exists). Add to the pickup method's facts:
    address, instructions (`paragraphs`), hold period (if set); the `deliveryTime` row's label
    → `shippingInfo.pickupReadyTime` ("Abholbereit in") for pickup. Query (~l.219): `pickupAddress
    { line1, line2, zip, ${proj.i18nStringField('city')}, country }`,
    `${proj.i18nStringField('pickupInstructions')}` — **not** `proj.i18nTextField`, which is
    the portable-text projection; `i18nText` is a plain `{ language, value }` array like
    category descriptions — and `pickupHoldDays`. Resolver (`data/resolve/settings.ts` ~l.49):
    `pickupAddress` as `ResolvedAddress` (city via `ctx.resolveString`, like
    `returnAddress`), `pickupInstructions: ctx.resolveString(...) || null`, `pickupHoldDays ??
    null`; for a pickup method emit `countries: []`, `rates: []`, `packagingGroups: []`,
    `freeShippingThreshold: null` (leftovers from before a type switch, step 2 — else the page
    would show a rate table for pickup). Its home-country sort puts pickup last — fine.
19. **Product page tax line**: unchanged ("zzgl. Versandkosten" is still right). Leave as is.

## Tests (vitest)

- `shipping.test.ts`: pickup carries address/instructions; offered without a country match;
  `selectShippingMethod` with only pickups and no requested id → `null`, with a pickup id →
  that pickup.
- `payment-create`: tax country with pickups but no delivery → calculate `selectedShippingMethodId:
  null`; `createPayment` without a pickup id → `SHIPPING_UNAVAILABLE`.
- Express: delivery-mode payload lists no pickup rate; no delivery rate left → event rejected.
- Info page resolver: a pickup method with leftover `rates`/countries renders none.
- `payment-create` tax country: pickup from a DE address → AT rules (needs a test with
  different rates per country, e.g. DE 19 %); switching back → DE rules.
- `payment-create`: pickup with a non-tax country (e.g. CH) → pickup only, pickup country's
  rules; without a pickup id → `selectedShippingMethodId: null`, `createPayment` →
  `SHIPPING_UNAVAILABLE`; response methods carry `deliveryTime` + pickup fields; same country for delivery → rejected; invalid code → rejected; no pickup method +
  non-tax country → `SHIPPING_UNAVAILABLE` as today.
- `order-builder.test.ts`: pickup snapshot (no `line2`/instructions/hold days keys when
  empty), no `shippingAddress` even when one is passed; pickup without `pickupAddress` and
  delivery without `shippingAddress` throw.
- Checkout DOM test: pickup mode hides the billing and shipping-method **fieldsets**, swaps the
  address legend; the status region exists before the fieldset is shown.
- `coupon` / payment-create: `freeShipping` coupon + free pickup (accepted, 0 discount);
  + pickup with a fee (fee waived).
- `order-snapshot` / `order-thanks`: pickup address slot.
- wc-api: `pickup_location` + the three meta entries, `shipping` = billing copy, `rate_id` by
  pickup country; open withdrawal on a pickup `shipped` order stays `completed` (step 16b).
- Express (jsdom/unit): pickup click payload has no `shippingRates` and sets the shown
  calculation (a confirm with an unchanged response is **not** refused); confirm builds the
  address from `billingDetails`; `setPickup` calls `update()` with both flags.
- Pre-handover (16b / 4b): withdrawal receipt on pickup `shipped` → not-collected text; full
  refund of pickup `shipped` → auto-cancel (webhook and Studio `buildRefundPatch`); core-back
  transitions, `returnedOffered` and `withdrawalNextStep` for pickup `shipped`;
  `refundOrder` with an order shaped like `ResolveOrder` (nested `fulfillment.methodType`) →
  the patch sets `canceled`.
- `pickupExtraLines`: hold-period line in the confirmation, deadline line in the ready mail,
  none without `pickupHoldDays` / for delivery; HTML body and plain text get the same lines.
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
- core-back: `requiredSubfields` with `when` false → valid with an empty value; true → the
  missing subfields are reported (delivery method without `pickupAddress` stays valid).
- Checkout DOM test: no delivery method → auto-switch to pickup once; choosing "Versand" again
  for the same country stays in delivery mode and shows `deliveryUnavailableShort`.
- `payment-create`: a pickup method without `pickupAddress.country` is taxed by the default
  country (it is in `pickupTaxCountries`), not dropped.

## Docs

- core-front `commerce-and-netlify.md`: replace "Pickup is not supported" with the mechanism
  (tax country, address, snapshot, mails); `ui-contracts.md`: the fulfillment choice;
  `wc-api.md`: pickup mapping; `CHANGELOG.md`.
- core-back `schemas.md` (shipping method + fulfillment fields; no flag, the data is the
  switch; `addressStrict` country = all countries), `CHANGELOG.md`.
- ADR `decisions/pickup-tax-country-is-pickup-location.md` (decision 4) and
  `pickup-reuses-shipped-delivered-states.md` (decision 7).
- Tinhof `CLAUDE.md`: pickup method, AGB change, wineNET notes.

## Built (2026-11-19)

All steps 2–18 built on `feat/store-pickup` in core-back and core-front, with the tests listed
above (core-back `tests/pickup.test.ts`; core-front `payment-create-pickup.test.ts`,
`order-email.test.tsx` → "pickup orders", `checkout-fulfillment.test.ts`, `shared/__tests__`,
wc-api, shipping, order-builder, snapshot, express). Deviations from the steps:
- `form.validate()` has no `{ pickup }` option — `CheckoutForm` keeps the mode
  (`setPickupMode`), which also drives `getBillingAddress()`.
- Mail helpers live in `templates/email/mail-keys.ts` (re-exported from `templates/email`), not
  in `index.tsx` — `OrderEmail` imports them, and `index.tsx` imports `OrderEmail`.
- The thanks page also swaps "Wie geht es weiter?" to `nextStepsPickup`.
- `pickupDeadline()` without a `shipped` entry counts from now (core-front; the ready mail of a
  status not stored yet); core-back's returns `null` (the order view shows no deadline).
- Tinhof frontend: `.checkout__billing-heading` added to its legend rule (`blocks/checkout.css`).

## Rollout (Tinhof)

1. Owner decisions (below), tax advisor on decision 4.
2. Build core-back + core-front (feature branches), push them, pin the commits in Tinhof
   backend/frontend (no config change — pickup needs only a pickup method in the data).
   `wc-api-erp-completed-accepted.md` (on Tinhof staging, branch `fix/express-no-wallet` +
   backend `feat/wc-api-erp-accepted`) ships in the **same** release (decision 10) — build
   pickup on top of core `main` (contains it) and keep Tinhof's `completedMeans: 'accepted'`.
3. Development dataset: create "Abholung im Weingut" (fee 0, address, our drafted
   instructions de/en, `pickupHoldDays` 14 — see open decisions).
4. "release tinhof staging": test orders — pickup via form and via Apple/Google Pay and Klarna
   (the express element offers it; tested on staging 2026-11-17), with a DE
   billing address, with a non-tax-country (e.g. CH) billing address, with a coupon; status "Abholbereit" + mail, "Abgeholt"; refund/cancel of a
   not-collected order; wc-api output on staging.
5. Tell wineNET (Andi) about pickup orders (`pickup_location`, shipping = billing copy, pickup
   address in the shipping line's meta) and ask the questions in "Behaviour" → wineNET; check
   the first one there.
6. Update the AGB (delivery section, pickup hold period) and the "Versand & Zahlung" page;
   owner approval.
7. Release core tags + Tinhof production release; create the pickup method in production +
   Deploy.
8. Tell the owner: how pickup orders look in the Studio (Abholbereit/Abgeholt), the
   "ready for pickup" mail, the age check at handover, what to do with **uncollected** orders
   (status dialog: "Storniert" with mail, then "Refundiert" — decision 10) and **withdrawn**
   ones (on the withdrawal: "Erstatten & abschließen"); in both cases cancel the Auftrag in
   wineNET by hand, credit note if already invoiced.

## Open decisions (owner)

- ~~Pickup fee~~ — **0** (owner, 2026-11-18).
- Pickup address + instructions (de + en): **we draft, Tinhof approves** (owner, 2026-11-18) —
  address Eisenstätter Straße 10, 7061 Trausdorf; draft opening hours placeholder, "Ausweis
  mitbringen — Altersprüfung bei Übergabe", "wir benachrichtigen Sie per E-Mail, sobald die
  Bestellung abholbereit ist". Open: Tinhof's opening hours + approval.
- Hold period: **propose 14 days** to Tinhof (owner, 2026-11-18), entered as `pickupHoldDays`;
  Tinhof may change it in the Studio. Open: Tinhof's OK + AGB approval of the generic wording
  (decision 10).
- ~~Only Tinhof now, or switch it on for Jurtschitsch / Lichtenau too?~~ — only Tinhof at
  start (owner, 2026-11-18); the others get a pickup method when they ask for it.
- Tax advisor: VAT of a pickup order by the pickup location (decision 4), also for customers
  from other EU and non-EU countries (decision 12). **Build as planned, confirm before the
  production release** (owner, 2026-11-18) — a go-live blocker (Rollout 1/7), not a build
  blocker.
- ~~(round 2) An uncollected order ends as **"Storniert"** (steps 4b/16b: pickup `shipped` →
  `canceled`), not "Retourniert"~~ — confirmed by the owner 2026-11-18 (cancel mail: step 16c).
- ~~(round 2) wc-api `method_id`~~ — `pickup_location` (owner, 2026-11-18); switch only if
  Andi says wineNET expects `local_pickup`.
- ~~(round 3) Withdrawal on an "Abholbereit" order reported `cancelled` to the ERP?~~ — no
  (owner, 2026-11-18, step 16b): wineNET polls `processing` only, the order is `completed` for
  it by then. Tinhof: Studio "Erstatten & abschließen" on the withdrawal (→ "Storniert" + the
  **refund** mail — that action never sends the cancel mail; corrected round 4), then
  cancel the Auftrag in wineNET by hand (credit note if wineNET already invoiced) — the same
  as for accepted/shipped delivery orders today.
