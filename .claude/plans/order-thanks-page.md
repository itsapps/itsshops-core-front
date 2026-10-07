# Plan — order thanks page with order summary

Status: **in progress** — steps 0–5 done (2026-10-07); next: step 6 (other customers: CSS + wrapper
`netlify/functions/order_status.mts` when they bump core).
Planned 2026-10-06. Origin: Jurtschitsch — the thanks page is nearly empty and its
long title ("Vielen Dank für Deine Bestellung!") shows up as the top-nav page title.

When this ships, move the durable parts into `.claude/architecture/commerce-and-netlify.md`
(+ `templates-and-assets.md`), add a decision record for the sessionStorage snapshot, and delete
this file.

## Current flow (as of 2026-10-06)

1. **Checkout → Stripe.** `checkout.ts` submit → `POST /api/payment/create` (creates the
   PaymentIntent, `metadata: { orderMetaId }`, `automatic_payment_methods`) → returns
   `clientSecret` → `stripe.confirmPayment({ return_url })`. Express checkout
   (`checkout-express.ts`) does the same via `confirmPaymentWithDetails`.
   `return_url` = `data-return-url` in `core/components/checkout.njk` =
   `coreConfig.baseUrl + cms[locale].orderThanksUrl` — no params of our own.
2. **Stripe → thanks page.** Cards without 3DS redirect immediately; 3DS/Klarna/EPS/… go via the
   bank/provider first. Stripe appends:
   `?payment_intent=pi_…&payment_intent_client_secret=pi_…_secret_…&redirect_status=succeeded|processing|failed`
3. **Thanks page** (static: h1, one sentence, shop link). `order-thanks.ts` reads only
   `redirect_status`:

   | `redirect_status` | today |
   |---|---|
   | `succeeded` | `clearCart()` (cart + applied coupon in localStorage) |
   | `failed` | redirect to `data-checkout-url`, cart kept |
   | `processing` | **nothing** — cart stays full, text claims the order was received |
   | absent (URL opened directly) | nothing, generic page |

   `payment_intent` and the client secret are ignored; no server call.
4. **Server, in parallel.** `payment-webhooks.ts` handles **only** `payment_intent.succeeded`
   (+ `charge.refunded`): load OrderMeta → next order/invoice number → create order in Sanity
   (with `paymentIntentId`) → stock decrement → confirmation email. Races the thanks page load.
   For `processing` methods (SEPA debit) there is **no order and no email until the payment
   succeeds** (days later).

## Problems to fix

- **P1** Long title shown as Jurtschitsch top-nav title (`titleKey` = the h1 sentence).
- **P2** Page shows nothing about the order.
- **P3** `processing`: cart not cleared (customer may pay twice), and the text is wrong — nothing is
  confirmed yet and no email is coming soon.
- **P4** Customer never reaches the thanks page (tab closed during the bank redirect, app switch
  on mobile returning in another browser) → the paid cart is never cleared.
- **P5** Unused translation `staticPages.orderThankYou.submit` ("Bestellung laden") — remove.

Note: the client secret ends up in the URL/browser history (Stripe's design). With the publishable
key it allows `retrievePaymentIntent` (amount, status, maybe shipping) — acceptable, but **no
server endpoint may treat the URL as authorization for order details.**

Prior art, deliberately **not** reused: the pre-core Jurtschitsch frontend
(`web/jurtschitsch/jurtschitsch_frontend`, `src/assets/scripts/bundle/order-thanks.ts`) fetched the
**full order** from the server by `payment_intent` alone, with a retry button ("Bestellung laden" —
origin of the unused `submit` translation). Anyone with the link got the order details. This plan
replaces that with a local snapshot + an endpoint that returns only the order number.

## Decisions (2026-10-06)

- **Payment methods are not restricted in core.** The checkout uses
  `automatic_payment_methods` (server) and Elements without `paymentMethodTypes`, so whatever the
  shop admin enables in the Stripe Dashboard is offered. Delayed-notification methods (SEPA Direct
  Debit, and voucher/transfer methods) are **not** fully supported by the order flow (see step 4
  "Known limitation"); shop owners are **told** not to enable them instead of excluding them in
  code. (Stripe would allow it via `excludedPaymentMethodTypes` on Elements +
  `excluded_payment_method_types` on the PaymentIntent — both available in the installed SDKs —
  if this is ever revisited.) → record in `decisions/` when shipping.
- **Thanks page displays per `redirect_status`**, including `processing` (step 4).
- **Stripe params are stripped from the URL** after reading (step 4).
- **`order-status` is protected by Netlify rate limiting** + client poll cap (step 5).
- **`processing` clears the cart** (avoid paying twice; refilling after a later failure is
  accepted).
- **"What happens next" + 18+ delivery note are core translations**; the 18+ note renders when
  `shop.checkoutAgeConfirmation` is on. Shops adjust via translation overrides, not template
  overrides.

- **No server fetch of the order summary (2026-10-07).** `orderMeta` (written by
  `payment-create` before the redirect, never deleted) could serve the summary via an endpoint
  authorized by `payment_intent` + client secret (verified against Stripe, time-limited, POST,
  minimal fields). Rejected: it turns the thanks link into an access key for personal data, adds a
  Stripe + Sanity call and a loading state per visit, and only helps the minority returning in a
  different browser (they still get the status text + email). The sessionStorage snapshot stays
  the only source; `order-status` (step 5) returns only the order number.

## Existing duplication (cart sidebar vs. checkout)

| Piece | Cart sidebar | Checkout |
|---|---|---|
| Item markup | `<template id="cart-item-template">` (`core/components/cart.njk`) | `<template id="checkout-item-template">` (`core/components/checkout.njk`) — near-identical |
| Item fill | `cart-ui.ts` `renderItems` | `checkout-summary.ts` `renderCartItems` + `renderItems` — same image/title/subtitle/price/qty code 3× |
| Price format | `formatPrice` (`cart-ui.ts`) | `formatPrice` (`checkout-summary.ts`) — same logic |
| Totals | subtotal only | `renderTotals` builds an `innerHTML` string in JS (coupon code interpolated) |

The thanks page needs the same item row (read-only) and the same totals — so step 0 consolidates
these first instead of adding a third copy.

## Target content

1. Heading: "Danke, *Vorname*!" (fallback: "Vielen Dank für Deine Bestellung!")
2. Status line:
   - `succeeded`: "Eine Bestätigung mit Deiner Bestellnummer ist unterwegs an *email*."
   - `processing`: "Deine Zahlung wird noch verarbeitet. Sobald sie bei uns eingegangen ist, erhältst
     Du eine Bestätigung an *email*." (no promise of an immediate email)
3. Order number (step 5; `succeeded` only)
4. Items: thumbnail, title, variant, quantity, line price
5. Totals: subtotal, coupon discount(s), shipping, VAT breakdown, grand total
6. Delivery: shipping method title + shipping address — for `methodType: 'pickup'` the method title
   only
7. What happens next: translated text (shipping confirmation with tracking follows by email).
   Plus an 18+ delivery note (`nextStepsAgeRestricted`) when `shop.checkoutAgeConfirmation` is on.
8. Links: Widerruf (`orderWithdrawUrl`), contact, back to shop

Without a usable snapshot the page shows generic text (status-dependent, see step 4) — it must
stay a complete, sensible page.

## Steps

### 0. Refactor: shared item row, price formatter, totals — prerequisite

Behaviour-neutral for cart + checkout; ship and verify on its own before the thanks page.

1. **Item macro** `core/macros/cart-item.njk` → `cartItem({ editable })`:
   - `editable: true` — today's markup (qty −/+, remove, stock note), used by cart + checkout
     `<template>`s.
   - `editable: false` — no buttons, quantity as text ("2 ×"), for the thanks page.
   - **Keep all existing class names** (`cart-item`, `__image`, `__title`, `__subtitle`, `__row`,
     `__qty*`, `__price`, `__remove`, `__stock-note`) and `data-*` hooks — customer CSS depends on
     them.
2. **Price module** `scripts/price.ts`: `createPriceFormatter({ locale, currency, currencyLabel })`;
   replaces both `formatPrice` copies.
3. **Item fill** `fillCartItem(el, item, format)` (in `template-utils.ts` or `cart-item-render.ts`):
   image, title/link, subtitle, price, quantity. Cart + checkout keep their own button wiring; the
   thanks page skips it.
4. **Totals from a template**: `renderTotals(container, { totals, appliedCoupons }, labels, format)`
   fills `<template>` rows via `textContent` (no more `innerHTML`/interpolated coupon code). Markup
   becomes `<dl class="checkout-totals"><div class="checkout-totals__row …"><dt/><dd/></div></dl>`
   — row wrappers and modifier classes (`--discount`, `--vat`, `--total`) stay; core CSS resets
   `dd` margin-inline-start. Used by checkout + thanks page.

Before merging: re-grep all customer frontends for overrides of these templates/classes (as of
2026-10-06: none — see "Customer impact").

### 1. Short title vs. heading (core i18n + template) — P1, P5

- `staticPages.orderThankYou.title` → short: de "Bestellung abgeschlossen", en "Order complete"
  (used for `<title>` and by headers that show `titleKey`).
- New keys: `heading`, `headingNamed` (`{name}`), `confirmationSent` (`{email}`), `processing`,
  `processingEmail` (`{email}`), `nextSteps`, `nextStepsAgeRestricted`, labels for the summary sections.
- Remove `submit` (P5).
- Affects all customers — the shorter title is better everywhere; mention in release notes.

### 2. Snapshot + pending marker at checkout (`checkout.ts`, `checkout-express.ts`) — P2, P4

New module `src/scripts/order-snapshot.ts`. Both written after `createPayment` succeeds, right
before `confirmPayment` / `confirmPaymentWithDetails` (form path **and** express path via
`onCreatePayment`).

**a) Snapshot — sessionStorage** (`itsshops:order-snapshot`), for rendering the thanks page:

```ts
type OrderSnapshot = {
  v: 1
  paymentIntentId: string        // clientSecret.split('_secret_')[0] — never the secret
  createdAt: number
  locale: string
  currency: 'EUR'
  email: string
  firstName?: string
  // Shapes match the step-0 renderers, so the thanks page needs no mapping code:
  items: Pick<CartItem, 'title' | 'subtitle' | 'imageUrl' | 'url' | 'price' | 'quantity'>[]  // → fillCartItem
  summary: Pick<CalculateResponse, 'totals' | 'appliedCoupons'>                               // → renderTotals
  shippingMethod?: { title: string; methodType: 'delivery' | 'pickup' }
  shippingAddress?: { name: string; line1: string; line2?: string; zip: string; city: string; country: string }
}
```

Sources: `CreatePaymentResponse` (validated items with server quantity/price, totals, coupons,
`shippingMethods` + `selectedShippingMethodId`), local cart for display strings (title, subtitle,
image, url — same precedence as `checkout-summary.ts` `renderItems`), `form.getEmail()` /
`getShippingAddress()`; express: the `address`/`email`/`name` passed to `onCreatePayment`.

**b) Pending marker — localStorage** (`itsshops:pending-payment`), for P4. No PII:

```ts
type PendingPayment = { paymentIntentId: string; cartHash: string; createdAt: number }
```

`cartHash` = stable hash of the cart lines (id + quantity) at submit time, so we only clear the
cart later if it hasn't changed since.

**Security rules** (PII in browser storage):
- Minimal data: no phone, no billing address, no client secret, no `orderMetaId`.
- PII only in sessionStorage (per tab, gone on tab close). localStorage gets the PII-free marker
  only.
- Render the snapshot only if `snapshot.paymentIntentId === ?payment_intent` **and** status is
  `succeeded`/`processing` **and** `createdAt` < 30 min ago; otherwise delete and fall back.
- Delete the snapshot right after reading (reload → generic page; acceptable). A new checkout
  overwrites both entries.
- Render with `textContent` / attribute setters only — never `innerHTML` (values are user-editable).
- Wrap all storage access in try/catch (private mode, blocked storage → fallback).

### 3. Thanks page rendering (`order-thanks.njk` + `order-thanks.ts`) — P2

- Template keeps the generic content server-rendered and adds hidden sections + `<template>`s:
  item row = `cartItem({ editable: false })`, totals row = the step-0 totals template. Overrides
  control the markup, JS only fills it. Labels via `trans` in the template; status texts as hidden
  blocks the JS unhides.
- JS is thin: `fillCartItem` per snapshot item, `renderTotals(snapshot.summary)`,
  `createPriceFormatter`, plus filling address/shipping/email slots. No rendering code of its own.

### 4. Status handling (`order-thanks.ts`) — P3

First thing on load: read `payment_intent` + `redirect_status` into memory, then
`history.replaceState` to strip **all** Stripe params (`payment_intent`,
`payment_intent_client_secret`, `redirect_status`) from the URL — keeps the client secret out of
the address bar, screenshots and shared links. A reload then shows the generic page (the snapshot
is deleted after reading anyway).

`redirect_status` is user-controllable. That's acceptable: it only drives what this visitor sees
and clears their own cart; nothing server-side trusts it (fulfilment is webhook-only). Don't
verify via `stripe.retrievePaymentIntent` — would need Stripe.js + Stripe CSP on the thanks page
(today checkout-only, see `decisions/payment-permissions-policy-checkout-only.md`).

The page must show the right content for every status — core does **not** restrict payment
methods (see "Decisions"), so `processing` must be handled properly, not just as a fallback.

| `redirect_status` | behaviour | content |
|---|---|---|
| `succeeded` | `clearCart()`, clear pending marker, start order-number lookup (step 5) | thanks heading, "confirmation with order number sent to *email*", summary, next steps |
| `processing` | `clearCart()` (avoid paying twice; if the payment later fails the customer rebuilds the cart — accepted), clear pending marker; **no** order-number lookup (the order only exists after `succeeded`) | thanks heading, "payment is still being processed — you'll get a confirmation to *email* once it has arrived (can take a few business days)", summary, no "will ship soon" wording |
| `failed` | redirect to checkout (as today), cart kept; keep snapshot + marker (retry overwrites them) | — |
| absent / unknown value | don't touch cart, snapshot or marker | generic text only (neutral: no claim that an order was received) |

Summary rendering in each case still requires a valid snapshot (PI match, < 30 min); without one,
the status-specific text is shown without the summary.

Known limitation (not this plan): while a payment is `processing`, no order exists in Sanity, no
stock is reserved, and a later failure is not handled (no `payment_intent.payment_failed`). Shop
owners are told not to enable delayed methods (see "Decisions").

### 5. Order-status function — P2 (order number), P4

New Netlify function `order-status` (`GET /api/order/status?payment_intent=pi_…`):
- Strictly validates the `pi_` format (else 400); looks up
  `*[_type == "order" && paymentIntentId == $pid][0].orderNumber` (same query as
  `findOrderByPaymentIntent` in `services/sanity.ts`) — **non-CDN** client, a fresh order must be
  visible immediately.
- Returns **only** `{ orderNumber }` or 404 — no PII. `Cache-Control: no-store`.
- **Netlify rate limiting** via the function's `config.rateLimit` (e.g. per IP, a few dozen
  requests/minute). Check the Netlify plan supports code-based rate limits; core has no rate
  limiting yet, so document the pattern. The client additionally caps itself at 4 polls.
- Threat model: payment-intent IDs are unguessable → no enumeration. Someone holding a thanks link
  could get the order number — half of what the Widerruf form needs (it also needs the email).
  Accepted. (Requiring the client secret too adds nothing: it's in the same URL.)
- Same origin → no CSP change.

Uses:
- **Thanks page** (`succeeded`): poll with backoff (≈ 1 s, 2 s, 4 s, 8 s) → fill
  "Bestellnummer: …" slot (`aria-live="polite"`, since it appears after load); on give-up hide the
  slot — the email line covers it.
- **P4 cleanup**: on checkout page load and when the cart sidebar opens, if a pending marker
  exists and is < 7 days old: call `order-status`; if the order exists **and** the current cart
  hash equals `marker.cartHash` → `clearCart()` + delete marker; if the order exists but the cart
  changed → just delete the marker; if 404 → keep it (payment may still be processing, or was
  abandoned) until it expires. Never on every page load.

### 6. Customer repos (Jurtschitsch, Tinhof, Grass-Art, …)

- Bump the core commit in `package-lock.json` (after core build).
- **Jurtschitsch:** top-nav title fixes itself via step 1 (`header.njk` uses `titleKey | trans`).
- CSS for the thanks page (summary sections, read-only item row) if core's base styles aren't
  enough — Jurtschitsch and Tinhof `cart.css`/`checkout.css` are near-identical, so write once and
  copy.
- 18+ note and next-steps text come from core translations (Jurtschitsch + Tinhof have
  `shop.checkoutAgeConfirmation`); adjust wording via translation overrides if needed. Override
  `overridable/order-thanks.njk` only for real layout differences.

## Customer impact (checked 2026-10-06)

- **Templates:** no customer overrides the cart/checkout item templates. Jurtschitsch's
  `checkout.njk` extends `core/components/checkout.njk` and only overrides
  `checkout_root_class` → inherits the macro automatically. No customer overrides
  `order-thanks.njk`.
- **CSS:** Jurtschitsch, Tinhof, Grass-Art style `.cart-item*` and `.checkout-totals`,
  `__row--total` by class only (no element selectors) → unaffected as long as step 0 keeps the
  class names. Only visible change to check: totals as `<dl>` (`dd` indent reset in core).
- **Title change** (step 1) applies to every shop's `<title>` and any header showing `titleKey`.
- (`web/ffmh` and the pre-core `jurtschitsch_frontend` are not core consumers — ignore.)

## Accessibility

Single h1; status line as a paragraph right below it; items as `<ul>`, totals as `<dl>`; prices
include currency; thumbnails decorative (`alt=""`, title is adjacent text). Content from the
snapshot is filled synchronously on load (no live region); only the late order number uses
`aria-live="polite"`. No focus moves. Clear link texts. Check keyboard + screen reader, de + en.

## Tests

- Step 0 regression: cart sidebar + checkout look and behave unchanged (qty ±, remove, stock note,
  coupon row, VAT rows) in Jurtschitsch and Tinhof; vitest for `createPriceFormatter` (currency vs.
  `currencyLabel` mode) and `renderTotals` (coupon code rendered as text).
- vitest `order-snapshot.ts`: save/read round-trip, PI mismatch, expiry, delete-after-read,
  storage throwing, cart hash stability.
- vitest `order-status` function: invalid param, not found, found (returns only `orderNumber`),
  `no-store` header.
- vitest `order-thanks.ts` status table (jsdom): each `redirect_status` → cart/snapshot/marker
  effects + shown text; Stripe params removed from the URL after load.
- Manual (Stripe test mode): card (succeeded), 3DS card, SEPA (processing), declined (failed),
  express checkout, pickup shipping, coupon applied, reload of the thanks page, thanks URL opened
  directly, tab closed during 3DS → reopen shop → cart cleared on checkout/cart open; de + en.

## Open questions

- Show the payment method ("Visa •••• 4242")? Needs a Stripe lookup → skip for v1.
- Newsletter prompt on the thanks page? Only if checkout doesn't already offer opt-in.
- Full support for delayed methods (order on `processing` with "awaiting payment" status, stock
  reservation, `payment_failed` handling, core-back order statuses) — separate plan, only if a shop
  actually needs SEPA.
