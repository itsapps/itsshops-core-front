# Commerce & Netlify backend

The dynamic side of the shop — checkout, users, newsletter — runs as **Netlify Functions** in
`src/netlify/`, with typed client counterparts in `src/scripts/` talking to them through
`src/shared/*-api.ts`.

## How customer projects use these functions

Core does **not** auto-register functions in the customer's Netlify site. Instead core builds each
function to its own `dist/<name>.js` (tsup entries in `tsup.config.*`) and exposes it as a **package
subpath export** `@itsapps/itsshops-core-front/functions/<name>`, each exporting a **factory**
`create<Name>Handler(config?)`.

A customer opts a function in by dropping a **thin wrapper** in its own `netlify/functions/<name>.mts`
that sets the Netlify route and re-exports the handler:

```ts
// netlify/functions/newsletter-confirm.mts (customer project)
import type { Config } from '@netlify/functions'
import { createNewsletterConfirmHandler } from '@itsapps/itsshops-core-front/functions/newsletter-confirm'

export const config: Config = { path: '/api/newsletter/confirm' }
export default createNewsletterConfirmHandler()
```

Rules of thumb:
- **One wrapper file per function you want live.** Omit the wrapper → that endpoint doesn't exist on
  that site. (Jurtschitsch's frontend wires newsletter, payment-create/-webhooks/-refund,
  order-notify/-withdraw/-withdraw-notify/-status, preview.)
- **`config.path` must match the route core's client code calls.** The browser scripts
  (`src/scripts/*`) + `src/shared/*-api.ts` call fixed `/api/...` paths; copy the paths from a
  reference customer (`jurtschitsch/webshop-frontend/netlify/functions/`) as the canonical set.
- Some factories take an optional config object (`create...Handler(config)`); most are zero-arg.
- The functions need their server env vars at runtime (Stripe secret, Supabase, Mailgun/Resend,
  Sanity token, `SANITY_STUDIO_NETLIFY_*` etc.) — set them on the Netlify site, not in client config.
- `netlify.toml` controls bundling: the preview function declares `included_files` and excludes the
  bundler/React/Stripe node_modules it doesn't need (see the customer's `netlify.toml`).

### Function catalog (subpath → factory)

| Subpath `@itsapps/itsshops-core-front/functions/…` | Factory | Purpose |
|---|---|---|
| `preview` | (default preview handler) | Sanity visual-editing preview render |
| `payment-create` | `createPaymentHandler` | Create a Stripe payment / checkout intent |
| `payment-webhooks` | `createWebhookHandler` | Stripe webhook receiver (order fulfilment, customer confirmation + shop new-order mail) |
| `payment-refund` | `createRefundHandler` | Refund a payment |
| `order-notify` | `createNotifyHandler` | Studio-triggered order mails (status change / manual send, optional customer message) |
| `order-withdraw` | `createOrderWithdrawHandler` | Process a right-of-withdrawal request |
| `order-status` | `createOrderStatusHandler` | `GET /api/order/status?payment_intent=pi_…` → order number only (thanks page, pending-payment cart cleanup) |
| `order-withdraw-notify` | `createWithdrawNotifyHandler` | Withdrawal notification email |
| `user-register` / `-login` / `-logout` / `-confirm` / `-recover` / `-reset` | `createUser…Handler` | Supabase-backed auth flows |
| `auth-webhooks` | `createAuthWebhookHandler` | Supabase auth webhook receiver |
| `newsletter-subscribe` / `-confirm` / `-unsubscribe` | `createNewsletter…Handler` | Double-opt-in newsletter |
| `wc-api` | `createWcApiHandler` | WooCommerce API bridge — read by **Winenet** (third party: reads orders, updates their status, issues invoices / accounting). See "WooCommerce API bridge" below |
| `supabase-keep-alive` | `createKeepAliveHandler` | Scheduled ping to keep Supabase warm |
| `order-meta-cleanup` | `createOrderMetaCleanupHandler` | Scheduled (wrapper: `schedule: '@daily'`): deletes `orderMeta` not updated for `ORDER_META_RETENTION_DAYS` (30, `config/constants`) — the privacy policy states this period |

The full built set is the tsup `entry` map; the exposed set is the `exports` map in `package.json`.

### Adding a new function — what to update

All four are required (verified against the current wiring); miss one and customers can't consume it:
1. `src/netlify/functions/<name>.ts` exporting a factory `create<Name>Handler(config?)`.
2. A tsup **`entry`** line in `tsup.config.ts`: `'<name>': 'src/netlify/functions/<name>.ts'`
   (builds `dist/<name>.js`).
3. A **`package.json` `exports`** subpath:
   `"./functions/<name>": { "types": "./dist/<name>.d.ts", "import": "./dist/<name>.js" }`.
   Unlike CSS, functions *are* consumed through `exports` (normal JS module resolution), so this is
   mandatory.
4. Shared request/response types in `src/shared/` if the browser side calls it.
**Functions run as plain Node ESM on Netlify.** Vitest resolves imports more leniently, so a passing
test suite doesn't prove a function loads: never import an extensionless package subpath of a
package without an `exports` map (e.g. `lodash/merge` — it broke every function once). Run
`npm run check:functions` after `npm run build` before pushing a core commit that touches
`src/netlify/` or anything it imports.

Then each customer adds a thin `netlify/functions/<name>.mts` wrapper (set `config.path`,
`export default create<Name>Handler()`).

Public, unauthenticated endpoints (`order-status`, `order-withdraw`) get a per-IP limit in that
wrapper (for `order-withdraw` it is the only abuse guard besides the honeypot — no captcha) via Netlify's `config.rateLimit` (e.g. `windowSize: 60`, `windowLimit: 5`,
`aggregateBy: ['ip', 'domain']`) — not in core. Code-based rate limits work on every Netlify plan, capped at 2 rules per site on
Free/Personal, 5 on Pro (`workflows/netlify-plans.md`), and over-limit requests are answered by Netlify (429) before the function runs.

> Note: the JS `exports` subpaths are the public API and are in active use across the ecosystem —
> `.` (~30 files), `./core`, `./scripts`, `./test-utils`, and the `./functions/*` set (all wired by
> customers except `auth-webhooks`, which is exposed but currently unused). Keep them, `auth-webhooks`
> included — it's a valid endpoint a customer may wire. Only the **CSS** export subpaths were unused
> (removed 2026-10-02); CSS ships via `dist/` + the `onSuccess` copy instead.

## Functions (`src/netlify/functions/`)

HTTP entry points, one file per endpoint:

- **payments**: `payment-create.ts`, `payment-refund.ts`, `payment-webhooks.ts`
- **orders**: `order-notify.ts`, `order-withdraw.ts`, `order-withdraw-notify.ts`
- **users/auth**: `user-register.ts`, `user-login.ts`, `user-logout.ts`, `user-confirm.ts`,
  `user-recover.ts`, `user-reset.ts`, `auth-webhooks.ts`
- **newsletter**: `newsletter-subscribe.ts`, `newsletter-confirm.ts`, `newsletter-unsubscribe.ts`
- **misc**: `preview.ts` (Sanity preview, built to `dist/preview.js`), `wc-api.ts`,
  `supabase-keep-alive.ts`, `order-meta-cleanup.ts`

## Business logic (`src/netlify/lib/`) — unit-tested

Pure-ish logic, covered by `src/netlify/__tests__/` (vitest — `npm run test`):

- `cart-validator.ts` — re-validates the client cart server-side (never trust client prices)
- `totals.ts`, `tax.ts`, `shipping.ts`, `coupon.ts` — money math. VAT is extracted from gross
  prices and rounded once per rate (`buildVatBreakdown`). **Shipping VAT rate**
  (`dominantItemVatRate`, called in `payment-create.ts`): the rate whose items have the largest
  **gross** goods value (sum of shop prices; the owner's choice) — not the most VAT, which favoured
  the higher rate; ties → higher rate; 0 % items ignored. The shipping method's `taxCategoryCode` is not used. Shipping VAT is
  rounded on its own and stored as `fulfillment.taxSnapshot`. Why: ADR
  `shipping-vat-largest-gross-goods-value.md`.
- **Wine packaging** (`calcWinePackagingCost` in `shipping.ts`): a delivery method with
  `packagingGroups` prices wine by boxes. A group = a box type: `packages[]{ places, price }` +
  `bottles[]{ volume, perPlace }` (`perPlace` bottles share one place, e.g. 2 × 375 ml in a 750 ml
  place). Per group the places are summed and rounded up **once** (exact, integer units via the LCM
  of `perPlace`), then `calcMinPackagingCost` picks the cheapest boxes (DP, may over-cover: 4 places
  → a 6-box if cheaper). A size no group lists goes into the group of the smallest listed size ≥ it,
  1 per place (`log.warn`); a larger size, a wine without volume, or a group without boxes → method
  not offered. Non-wine items (incl. non-wine bundle children) are priced by the weight `rates` on
  top. Each box size → one `fulfillment.packagingLines[]` entry `{ volumes[], packSize, quantity,
  price }` (`volumes` = the group's sizes, largest first; orders before core-back 4.0.0 have a single
  `volume`). Info page: `shippingInfoModule.njk` renders one table per group, the caption lists the
  sizes (`formatVolumeList`) plus a note per shared size. Studio enforces each size in one group per
  method. A size in several box types (e.g. half-bottle-only boxes, 2 × 750 in a magnum box) is not
  supported — it would need boxes that accept only certain sizes and a split search.
- `order-builder.ts`, `order-item-display.ts` — order construction
- `*-notifier.tsx` — React-email templates (auth, order, newsletter, withdraw)
- `payment-method.ts` — Stripe charge → `order.payment` snapshot + readable label
- `email-settings.ts`, `auth-urls.ts`, `newsletter-urls.ts`

When touching pricing/tax/shipping/coupon math, **update or add a test in `__tests__/`** — this is
the one part of core-front with real coverage, keep it that way.

## Services (`src/netlify/services/`)

External integrations: `stripe.ts`, `supabase.ts` (users), `sanity.ts`, `email.ts` dispatching to
`mailgun.ts` / `resend.ts`. Config/keys come from env (see plugin-and-config doc) — Stripe publishable
key is the only one surfaced client-side.

## Utils & types (`src/netlify/utils/`, `src/netlify/types/`)

`utils/`: `response.ts`, `retry.ts`, `server-auth.ts`, `captcha.ts`, `i18n.ts`, `logger.ts`,
`validation.ts`, helpers. `types/`: `api.ts`, `checkout.ts`, `config.ts`, `errors.ts`,
`orderTransitions.ts` (order state machine).

## Client ↔ server contract (`src/shared/`)

`src/shared/{checkout,newsletter,order,user}-api.ts` + `validation.ts` are imported by **both** the
browser scripts and the functions, so request/response shapes and validation rules stay in sync. When
changing an endpoint's payload, change it in `src/shared/` and both sides follow.

## Checkout → Stripe → order thanks (client flow)

1. Checkout submit (`scripts/checkout.ts`, also the express path) → `POST /api/payment/create` →
   `clientSecret`. Right before `stripe.confirmPayment`, an **order snapshot** is written to
   **sessionStorage** (`scripts/order-snapshot.ts`): items, totals, coupons, shipping method,
   email, first name, shipping address — keyed to the PaymentIntent id. No phone, billing address,
   client secret or `orderMetaId`.
2. Stripe redirects to `orderThanksUrl` with `payment_intent`, `payment_intent_client_secret`,
   `redirect_status`. `scripts/order-thanks.ts` reads them and **strips them from the URL**
   (`history.replaceState`).
3. By status: `succeeded` / `processing` → clear the cart, show the status text, render the
   snapshot (only if PaymentIntent matches and < 30 min old; deleted on read); `failed` → back to
   checkout, cart + snapshot kept; none → generic page. All values via `textContent`.
4. **Order number** (`succeeded` only): the page polls `order-status` (≤ 5 requests over ~15 s,
   `scripts/order-status.ts`) and fills an `aria-live` region; gives up silently (the email has it).
   The endpoint returns **only** `{ orderNumber }` (404 until the webhook ran), never personal data,
   `no-store`; per-IP rate limit via `config.rateLimit` in the customer wrapper.
5. **Pending-payment marker** (`scripts/pending-payment.ts`, localStorage, no PII: PaymentIntent id
   + cart signature): written before confirm, removed by the thanks page. If the customer never got
   there (tab closed during 3DS, returned in another browser), opening the cart or the checkout asks
   `order-status` once per page; order exists + cart unchanged → cart cleared. Expires after 7 days.
6. Orders are created **only** by the webhook on `payment_intent.succeeded` — the thanks page
   never creates or trusts anything (`redirect_status` is user-controllable; it only affects this
   visitor's view and cart). Delayed methods (SEPA, `processing`) have no order/email/stock
   reservation until they succeed and no failure handling; core doesn't restrict payment methods —
   shop owners are told not to enable them.

Markup: `overridable/order-thanks.njk` (sections start `hidden`, filled by JS; item rows/totals via
`macros/cart.njk`, see templates doc). Plan / remaining work: `.claude/plans/order-thanks-page.md`.

## Withdrawal (Widerruf) — declaration only (FAGG §13a)

`order-withdraw` never cancels or refunds. The form (`core/components/order/order-withdraw.njk`,
`scripts/order-withdraw.ts`) asks for **name**, order number, email, optional reason. Labels are fixed
by law: page/links "Vertrag widerrufen", button "Widerruf bestätigen". Always available (no date
check), **no captcha** — the customer wrapper's Netlify `rateLimit` (429 → translated "try again
later" in the client) plus a hidden **honeypot** field (`website`; filled → same success, nothing
stored/sent). Name and order number are capped and URL-like input is rejected
(`checkWithdrawText` in `shared/validation.ts`) — both are echoed in a mail to any typed address.

**A declaration is never lost** — every valid submission is stored as an `orderWithdrawal`
(name/email/orderNumber/locale/reason/`declaredAt` as submitted):
- order number + email match → linked to the order, status `received`;
- otherwise → status **`unmatched`**, no order; the shop mail is flagged (+ "order exists, email
  differs" hint, shop-only). Editors assign the order in the Studio (status follows) or delete it
  (core-back: guarded delete, unmatched only; 30-day retention rule for editors).
- Same response either way (no order-number probing).
- Repeat submission (open record for that order / same email + number) → receipt re-sent, no new
  record, no shop mail. Double submits: deterministic `_id` (`withdrawal-<orderId | u-hash>-<n>`) +
  `createIfNotExists`.

Every mail is built from the **stored record** (`buildWithdrawalMails` in
`lib/order-withdraw-notifier.tsx`): the receipt repeats name, order number, reason (matched only) and
date + time (`formatShopDate`, shop timezone), then return instructions (`returnShippingBorneBy`,
`returnPolicyNote`) or "not dispatched → refund". The admin resend (`order-withdraw-notify`,
`fetchWithdrawal`) uses the same record → original timestamp; after assigning an unmatched record it
mails the order's email. Processing stays manual in the Studio (core-back `WithdrawalActions.tsx`):
**"Refund & close"** does a full Stripe refund, sets the order refunded (and canceled if undispatched)
and closes the withdrawal; partial refunds go through the order's refund action. Kept manual on
purpose: the refund may be withheld until the goods are back, and its amount varies. Remaining legal
work (generated withdrawal instructions, "Versand & Zahlung" page): `.claude/plans/order-email-legal.md`.

## Order confirmation content & shop inbox

- **Customer message** (all order mails, from the studio status/mail dialogs): `order-notify` takes an
  optional `customerMessage` (trimmed, ≤ `CUSTOMER_MESSAGE_MAX_LENGTH` = 2000, else 400) →
  `sendOrderNotification({ customerMessage })` → `OrderEmail` / `SimpleEmail` render it via
  `components/CustomerMessage.tsx` below the intro text (plain text, lines → paragraphs, left rule),
  and it's appended to the plain-text part. The studio's internal `statusHistory[].note` is never
  mailed.

- **Order details** (`OrderEmail.tsx` → `OrderDetails`): order date (`order.orderDate` = PaymentIntent
  `created`, fallback first status entry), payment method, shipping method, delivery time, pickup
  location — each only when present; statutory warranty sentence on `orderConfirmation`.
- **Payment method:** the webhook retrieves the PaymentIntent with `latest_charge` expanded and maps
  `payment_method_details` to `order.payment` (`lib/payment-method.ts`: type, card brand, last4,
  wallet; SEPA last4) — order only, not orderMeta (the method isn't final before payment). A Stripe
  error logs and stores nothing; never blocks the order. `paymentMethodLabel` → "Apple Pay (Visa ••••
  4242)". `wc-api` reports `payment_method` = type (`stripe` for old orders) and
  `payment_method_title` = that label to Winenet.
- **Delivery time:** optional `shippingMethod.deliveryTime` (i18n), snapshotted into
  `order.fulfillment.deliveryTime` at checkout.
- **Withdrawal section** in the confirmation is **default on** (`withdrawalNotice`, opt out with
  `false`). It carries the **full generated instructions + model form** (see "Legal texts" below);
  incomplete settings → the short notice + link and a `log.warn`, never a half-filled legal text.
- **Harmonised warranty notice** (FAGG §4 (1) + Anhang II): the official EU graphic as an image
  (`${baseUrl}/assets/legal/legal-guarantee-notice-<de|en>-1200.png`, served by the shop site) in every
  order confirmation.
- **Shop inbox:** `settings.shopNotificationEmail` (fallback `senderEmail`, resolved in
  `buildEmailShopSettings`) receives the new-order mail and withdrawal notifications. `From:`
  stays `senderName <senderEmail>`.
- **New-order mail to the shop** (`sendShopOrderNotification` in `lib/order-notifier.tsx`, template
  `ShopOrderEmail.tsx`): sent by the payment webhook right after the customer's confirmation, in its
  own try/catch (no longer a BCC of the customer mail). Shop's `defaultLocale`, neutral wording
  (`emails.shopOrderConfirmation.*`, subject "Neue Bestellung <nr> – <name>"), customer contact
  (email, phone, language) up front, Reply-To = customer; reuses the order summary blocks exported
  from `OrderEmail.tsx`; no greeting, warranty image, withdrawal text, invoice or footer. Button
  "Bestellung im Studio öffnen" when `SANITY_STUDIO_URL` is set (needs the functions scope on
  Netlify): `studioOrderUrlFor` → `<studio>/<defaultLocale>/intent/edit/id=<id>;type=order`
  (core-back names workspaces after UI languages and always has the default locale's). Webhook option
  `shopNotification`: default on, `false` off, `{ template }` override. `bccSender` still works on
  `sendOrderNotification` but core doesn't use it.
- **Footer** (`MailFooter.tsx`, all business mails): `settings.company` — name, owner, address,
  phone, email, VAT ID, register number/court — only filled fields; falls back to shop name, billing
  address, sender email. The invoice PDF still uses the shopSettings billing address.

All mail notifiers throw when `settings.senderEmail` / `senderName` / `siteTitle` are missing —
core-back makes them required when shop/users/newsletter is on (core-back `schemas.md` → "Settings
validation").

## Legal texts generated from settings

One builder, `src/shared/withdrawal-instructions.ts` (`buildWithdrawalInstructions`), produces the
withdrawal instructions + model form (FAGG Anhang I / Directive 2011/83/EU Annex I) for the website
module (`withdrawalPolicyModule`, Nunjucks filter `withdrawalInstructions`) **and** the order
confirmation (`withdrawalInstructionsFor` in `lib/order-notifier.tsx`) — page and mail can't
contradict each other. It only chooses the statutory variants and fills the gaps:
period start ← `shopSettings.withdrawalPeriodStart`; trader identity ← `settings.company` (fallback
billing address / sender email); online-function sentence ← always; refund-withheld sentence ←
always (core never collects goods); return address + costs ← `returnAddress` /
`returnShippingBorneBy`. `withdrawalExceptions` (§ 18) and `returnPolicyNote` render as separate
blocks, never inside the model text. Missing name/address/email → `null`.

**Output shape:** paragraphs (and the form's "An …" line) are arrays of segments
`{ text, href? }` (`WithdrawalRichText`; `richToText` flattens): the trader's phone (`tel:`, without
"(0)"), email (`mailto:`) and the withdrawal URL become links on the page and in the mail. Links pass
through the translator as opaque tokens, so the statutory wording stays untouched; on the website the
filter calls i18next with `escapeValue: false` (Nunjucks escapes the output itself).

**Wording rule:** the texts in `shared` translations (`withdrawalInstructions.*`) are copied
**verbatim** — German from RIS (FAGG, version from 2026-10-01), English from the EUR-Lex consolidated
Directive 2011/83/EU (2026-09-27). Never reword them; the "Du" overlay changes only the forms of
address. The harmonised warranty notice is an unaltered official graphic (`src/assets/legal/`, from
the Commission's package; colours untouched, QR code must scan) — no "Du" variant.

Placement before ordering: checkout — a **compact** notice above the order confirmations
(`partials/legal-guarantee-compact.njk`: official thumbnail + one line, linking to the full notice at
`shippingInfoUrl#<legalGuarantee.anchor>` — a translated fragment, e.g. `#gesetzliche-gewaehrleistung`, else the full-size graphic) and the "Versand & Zahlung" link at the
top and above the order button when `shippingInfoPage` is set; the full notice on the
`shippingInfoModule` page (with the shipping methods from `cms[locale].shippingMethods`) and in the
order confirmation. The compact form stays visible (not behind a click): WKO reads "hervorgehoben" as
clearly noticeable before ordering, not hidden or only on request.

### Privacy policy (`privacyPolicyModule`)

`src/shared/privacy-policy.ts` (`buildPrivacyPolicy`) builds the Art. 13 GDPR text from what the shop
runs; filter `privacyPolicy` (`src/filters/index.ts`) feeds it, `core/modules/privacyPolicyModule.njk`
renders it (website only — no mail). Same rules as the withdrawal builder: rich segments with links
(provider privacy policies, company email, DSB), missing company name/address/email → `null` +
preview-only hint.

Each section has a condition, so the text follows the features:

| Section | When |
|---|---|
| controller (+ DPO from `module.dpoContact`), overview, hosting (Netlify), content (Sanity CDN) | always |
| orders (+ carrier paragraph if a non-pickup shipping method exists), payment (Stripe, Apple/Google Pay) | `shop.checkout` |
| email (Resend / Mailgun EU / US) | checkout, users or newsletter — provider from `CoreConfig.services` |
| withdrawal | checkout + `orderWithdrawUrl` |
| orderSystem (wineNET, hardcoded) | checkout + `services.wcApi` (`WC_CONSUMER_KEY` set) |
| account (Supabase), newsletter | `users` / `newsletter` |
| captcha (hCaptcha, lists the forms) | `captchaSiteKey` + users or newsletter (the forms that load it) |
| vinofact | vinofact on **and** `'bottleImage'` in `vinofact.fields` (only bottle images load from `i.vinofact.com`) |
| `module.extraSections` (editor: map, embeds …) | after vinofact, before storage |
| storage (list: cart/coupon, pending payment, order snapshot, age gate, recent searches) | always, items filtered |
| required data, automated decisions (+ Stripe fraud screening) | checkout / always |
| rights, complaint (DSB), "Stand" line | always |

- Wording: `privacyPolicy.*` in `de_11ty.ts` / `en_11ty.ts` + `de_11ty.informal.ts` ("Du");
  provider names + privacy-policy URLs are data (`PRIVACY_PROVIDERS`). Unlike withdrawal it's our
  own wording (no statutory model).
- **Bump `PRIVACY_POLICY_UPDATED`** (YYYY-MM, rendered as "Stand: …") whenever the wording or a
  section condition changes.
- Facts the text states must stay true in code: unpaid `orderMeta` deleted after
  `ORDER_META_RETENTION_DAYS` (`order-meta-cleanup` function — the shop must wire it), no personal
  data in function logs (`configuration.md` → Logging), Stripe.js only on the checkout page (loaded
  from `checkout.ts`, which `scripts/index.ts` imports only with `[data-checkout]`), hCaptcha only
  where a captcha form is shown, no analytics. A shop adding an external service (CSP
  `headers.extra` host) adds an extra section.

## WooCommerce API bridge (`wc-api`, read by Winenet)

`src/netlify/functions/wc-api.ts` — orders as a WooCommerce REST v3 subset for an ERP (wineNET):
routes, status overrides, WooCommerce rounding, known gaps, wineNET's behaviour, tests →
**`.claude/architecture/wc-api.md`**.

## Customer names

Orders require only the full `name` (`REQUIRED_ADDRESS_FIELDS`, Sanity `addressStrict`).
`prename`/`lastname` are stored only when the customer typed them (manual checkout form). Express
checkout (Apple/Google Pay) delivers just the full name and **must not guess** a split. Where
separate fields are needed — the `wc-api` export to Winenet — `netlify/utils/name.ts`
(`splitNameForExport`) splits at export time (last word → last name; a single word → last name).
Customer-facing text uses `name`, or `prename` only if present (order thanks heading).

## Gating

Checkout, users, and newsletter are feature-flagged (`shop.checkout`, `users`, `newsletter`). CSP /
Permissions-Policy for payment is tied to checkout being enabled (`setupHeaders`). A customer with
checkout disabled ships none of the payment surface.
