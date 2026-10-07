# Plan — legally complete order confirmation email

Status: **agreed, not started** (2026-10-07). Origin: review of what the automatic order
confirmation contains vs. Austrian/EU consumer-law expectations. Not legal advice: the legal
requirements below are an orientation; the shop owner confirms them (WKO templates / lawyer).

Main source: WKO, "Webshops — die wesentlichen Bestimmungen (Verbraucherrechte)", as of 2025-09-09
(<https://www.wko.at/internetrecht/webshops-die-wesentlichen-bestimmungen-verbraucherrechte>).
**Priority:** step 0 (withdrawal button, in force since 2026-10-01) before the email steps.

When this ships, move the durable parts into `.claude/architecture/commerce-and-netlify.md`, add an
ADR for the withdrawal-instructions approach (step 4: core-generated, settings as the single source),
and delete this file.

## Current state

The confirmation (`orderConfirmation`) is sent by the payment webhook
(`netlify/functions/payment-webhooks.ts` → `lib/order-notifier.tsx` → `templates/email/OrderEmail.tsx`),
to `customer.contactEmail`, BCC `senderEmail`. It contains: order number, items, totals with VAT,
billing/shipping address, tracking number (if set), the opt-in withdrawal notice
(`withdrawalNotice`: title, one sentence, link to the withdrawal *form* page — Jurtschitsch and Tinhof
enable it on the webhook since 2026-10-07), footer with shop name, address, email (`MailFooter.tsx`).

Data that already exists but isn't used in the mail:
- `order.fulfillment.methodTitle` / `methodType` / `pickupLocation`
- `settings.company` (core-back `company` object: `name`, `owner`, `address`, `email`, `phone`,
  `vatId`; customers can add fields via `extensions.company`)
- `shopSettings.termsPage`, `shopSettings.withdrawalPolicyPage` (page references → URLs),
  `shopSettings.returnAddress`, `returnShippingBorneBy`, `returnPolicyNote` (used by the withdrawal
  mails)

Not stored anywhere: the **payment method** (the webhook only has the PaymentIntent; `wc-api`
reports a hard-coded `payment_method_title: 'Stripe'` to Winenet).

Mail plumbing: `sendMail` takes **one** `attachment` (Mailgun and Resend both accept several).
`@react-pdf/renderer` already renders the invoice PDF. A localized PDF upload field type
(`pdfFile` / `i18nPdfFile`) exists only in the **Jurtschitsch backend**, not in core-back.

Website data: the `cms` settings projection (`src/data/queries.ts`) includes `settings.company`, but
**not** `shopSettings.returnAddress` / `returnShippingBorneBy`. The email side loads them
(`fetchEmailSettings` in `services/sanity.ts`).

Existing withdrawal pages (checked 2026-10-07, read-only): Jurtschitsch and Tinhof each have a
`withdrawalPolicyPage` with **one rich-text module** (Jurtschitsch: own `richContentModule`; Tinhof:
core `stdContent`), de + en, holding an adapted copy of the statutory model text with the address,
phone and email typed in by hand. Both **lack the model withdrawal form** and **the sentence on who
bears return costs**; small slips ("Ihres"/"deinen" mixing du/Sie), outdated "Telefax".

## Requirements (orientation, to confirm)

| # | What | Basis (roughly) | Today |
|---|---|---|---|
| R0 | **Withdrawal button**: label only "Vertrag widerrufen", available + highlighted for the whole withdrawal period; form with consumer **name**, contract identification, contact channel; confirm button only "Widerruf bestätigen"; receipt confirmation on a durable medium without delay. **In force since 2026-10-01** | FAGG §13a (WKO) | ❌ labels "Widerruf" / "Bestellung widerrufen" / "Widerruf absenden"; no name field; receipt email ✅ |
| R1 | Contract confirmation on a durable medium (**email counts**), within reasonable time, at the latest on delivery: "den abgeschlossenen Vertrag samt sämtlicher vorvertraglicher Informationen" | FAGG §7 (3) | partly |
| R2 | Withdrawal instructions (conditions, period, procedure) + model withdrawal form, as part of R1 (a website link isn't a durable medium — CJEU C-49/11) | FAGG §7 (3), §4, §11 | ❌ short notice + link |
| R3 | AGB in the confirmation — WKO page doesn't require it; ECG §11 (store/reproduce) is arguably met by the website | ECG §11 | optional |
| R4 | Payment method and delivery method/terms in the order details | FAGG §4 | ❌ |
| R5 | Business identity (owner/legal form, VAT ID, company register no. + court if registered) | UGB §14, ECG §5 | name/address/email only |
| R6 | Accepted payment methods + delivery restrictions stated **at the latest at the start of ordering** | FAGG §8 (3) | Stripe element shows methods in checkout; no explicit list earlier |

Risk calibration (WKO): a missing/incomplete confirmation does **not** automatically extend the
withdrawal period; the 12-month extension (§11) applies when the withdrawal *information* wasn't
given properly — which the checkout does before ordering (link + checkbox). So the email steps are
an obligation, but lower risk than R0.

## Steps

### 0. Withdrawal button per §13a FAGG (core-front + core-back) — R0, **first**

- Labels (de; en equivalents "Withdraw from contract" / "Confirm withdrawal" — check the official
  English wording of the directive):
  - every entry point to the withdrawal page → exactly **"Vertrag widerrufen"**: footer/menu system
    link (check whether its label comes from translations or from the Sanity menu — see
    `decisions/withdrawal-link-as-menu-system-link.md`), thanks page link
    (`staticPages.orderThankYou.withdraw`), order-confirmation mail link
    (`emails.order.withdrawalLink`), withdrawal page title if used as the "button" text.
  - submit button → exactly **"Widerruf bestätigen"** (`forms.orderWithdraw.submit.text`).
- Form (`core/components/order/order-withdraw.njk`, `scripts/order-withdraw.ts`,
  `shared/order-api.ts` `WithdrawInput`, `functions/order-withdraw.ts`): add required **name** field
  (`autocomplete="name"`, labelled, error handling like the other fields); store it on the
  `orderWithdrawal` document (core-back schema field) and include it in the shop notification and
  the customer's receipt confirmation.
- "Hervorgehoben und leicht zugänglich" for the whole period — **decided:** footer link on every
  page + link in the order confirmation + thanks page, all labelled "Vertrag widerrufen". No new UI
  element.
- English labels: verify against Directive (EU) 2023/2673 Art. 11a (likely "withdraw from contract
  here" / "confirm withdrawal").
- Customer overrides: check customer `footer.njk` overrides and menus for hard-coded labels
  (Jurtschitsch, Tinhof, Grass-Art).
- Tests: form validation (name required), function stores/sends the name; render check of labels.

### 0b. Form of address: "Sie" by default, "Du" per shop (core-front)

**Decided (2026-10-07):** one global, per-shop setting for all German texts (website, emails, server
messages, the legal text of step 4). **Default "Sie".** Jurtschitsch: "Du"; Tinhof: "Sie" (default).

- **Setting:** env var `SHOP_FORMALITY=formal|informal` (default `formal`), set once on the Netlify site (all
  scopes → build + functions) and in the shop's `.env` for local dev. Read by `resolveConfig` (build)
  and by `serverT` (functions) — the one value both runtimes see. (A Sanity toggle was rejected: the
  translator would have to wait for CMS data at build time.)
- **Base files become "Sie":** rewrite the ~80 du-strings in `de_11ty.ts` and `de_server.ts`
  (`de_shared.ts` has none) to the polite form ("Ihr Warenkorb ist leer.", "Vielen Dank für Ihre
  Bestellung!", …). Strings without address ("Zwischensumme", "Versand", …) stay as they are.
- **Overlay files** `de_11ty.informal.ts` / `de_server.informal.ts`: only the keys whose text differs,
  same nesting, the "Du" variants.
- **Merge order at startup** (only one table per language at runtime; templates keep calling
  `trans(key)` / `serverT(key)` unchanged):
  - website (`createTranslator`): core base → informal overlay (if `informal`) → shop's own
    `config.translations` overrides (existing deep merge)
  - server (`netlify/utils/i18n.ts` `serverT`): `de_server` + `de_shared` → informal overlay (if `informal`)
- English: unaffected.
- Naming: code, values and comments in English (`formal`/`informal`); German only inside translation
  strings and German Studio labels.
- **Tests:** every overlay key exists in the base; heuristic lint — base has no "Du/Dein/Dir/Dich",
  overlay has no polite "Sie/Ihr"; render thanks page + order email with both settings.
- **Customer impact:** shops without the env var switch to "Sie" on their next core bump —
  **Jurtschitsch must set `SHOP_FORMALITY=informal` before deploying** that core; **Grass-Art** (today
  "Du") changes tone unless it sets it too. Note: shop translation overrides don't reach the server
  (emails) today — the env var is the only per-shop switch there.

### 1. Payment method on the order (core-front + core-back) — R4

- Webhook (`handlePaymentSucceeded`): retrieve the PaymentIntent with
  `expand: ['payment_method']` (new helper in `services/stripe.ts`), map to
  `payment: { type, brand?, last4?, wallet? }` (`card` + `apple_pay`/`google_pay` wallet, `eps`,
  `klarna`, `paypal`, `sepa_debit`, …). Store on the order (and pass into `buildOrder`).
  On Stripe error: log, store nothing — never block order creation.
- Stored on the **order only, not on orderMeta**: orderMeta is written in `payment-create` before
  paying, when the method isn't final (customer can switch in the Payment Element; wallets decide
  in express checkout). It's final at `payment_intent.succeeded`, where the webhook creates the order.
- core-back: `orderPayment` object on the order schema (read-only), shown in `OrderView`.
- Email: "Zahlungsart: Visa •••• 4242" / "Apple Pay (Visa •••• 4242)" / "EPS" — translated labels,
  unknown types fall back to a generic label.
- `wc-api`: `payment_method_title` from the stored payment (Winenet invoices) instead of "Stripe".
- Existing orders: no payment field → line omitted.

### 2. Shipping method in the email (core-front) — R4

- Show `fulfillment.methodTitle`; for `pickup` also `pickupLocation` if set.
- **Delivery time — decided:** optional i18n field `deliveryTime` on each shipping method
  (core-back, e.g. "2–4 Werktage"); snapshot it into `order.fulfillment` at order creation (like
  `methodTitle`) and show it in the mail when set. Could later also show in the checkout's shipping
  options.

### 3. Business details in the footer (core-front + maybe core-back) — R5

- `MailFooter` renders `settings.company`: `name`/`owner`, `phone`, `vatId`, register data — only
  filled fields. **Decided: in all mails** (the footer is shared by every order mail, not only the
  confirmation).
- **Decided:** optional `registerNumber` (Firmenbuchnummer) + `registerCourt` (Firmenbuchgericht) on
  core-back's `company` object, rendered only when set (sole-trader farm businesses often aren't
  registered — owners decide).
- Invoice PDF: check `InvoicePdf.tsx` uses the same company data (not decided to change it).

### 3b. Separate shop inbox for order mails (core-front + core-back)

**Decided (2026-10-07):** an optional settings field for the address that receives the shop's copy
of orders, so the sender (`senderEmail`, e.g. a no-reply/shop address) can differ from the inbox
where orders arrive.

- core-back: `shopNotificationEmail` (string, email validation, optional) on the general
  `settings` document, group "Notifications", next to `senderName` / `senderEmail`; de/en labels +
  description ("Empfänger der Shop-Kopie von Bestellbestätigungen und Widerrufen; leer = Absender").
- core-front: `fetchEmailSettings` projects it; `EmailShopSettings.shopNotificationEmail`.
  - Order confirmation (webhook, `bccSender`): BCC `shopNotificationEmail ?? senderEmail`.
  - Withdrawal: the separate notification mail to the shop (the customer gets their own receipt
    confirmation) goes to `shopNotificationEmail ?? senderEmail` (`order-withdraw-notifier.tsx`).
  - **Remove the `notifyEmail` option** from `createOrderWithdrawHandler` / `OrderWithdrawConfig` and
    the notifier (checked 2026-10-07: no shop sets it) — the Sanity field is the one place to
    configure the shop inbox. Update the function's doc comment.
  - `From:` stays `senderName <senderEmail>`.
- Single address (no list) — a shared mailbox/alias covers several recipients.
- Named `shopNotificationEmail` (Studio: "Shop notifications"): every mail *to the shop* uses it —
  order copies, withdrawal notifications, future ones (e.g. stock alerts). Mails to customers
  (newsletter, account) are unaffected.
- Decided: **one inbox for both** (orders + withdrawals); no separate withdrawal field.
- Tests: BCC/recipient fallback chain; settings without the field behave as today.

### 4. Withdrawal instructions + model form — one source for website and email (core-front + core-back) — R2

**Decided:** core generates the statutory text (FAGG Anhang I: Teil A instructions + Teil B model
form) from shop settings. The **same** data and translations render the website page and the order
email — no hand-typed addresses, no second copy, no contradictions (e.g. the return-cost sentence
and the withdrawal confirmation mail both follow `returnShippingBorneBy`). Rejected: PDF uploads
(second copy that drifts), rendering the page's rich text into the mail (keeps the hand-typed,
incomplete text).

**Data — all in settings, nothing on the page:**

| Template gap | Source |
|---|---|
| Business name, address, phone, email | `settings.company` (exists) |
| Return address | `shopSettings.returnAddress` (exists) → fallback company / billing address |
| Who pays return shipping (sentence in the instructions + withdrawal confirmation mail) | `shopSettings.returnShippingBorneBy` (exists) |
| Period starts at receipt of goods vs. **last partial delivery** | **new** shopSettings field (default: partial-delivery variant — 12-bottle cases can ship as several parcels) |
| Exceptions that apply (statutory list: sealed goods for hygiene, goods mixed after delivery, alcohol with market-dependent price delivered > 30 days later — en primeur/subscription, …) | **new** shopSettings multi-select |
| Additional note that belongs to the instructions (e.g. "Rücksendung in versandgeeigneter Verpackung") | **reuse `shopSettings.returnPolicyNote`** (decided) — today only in the withdrawal confirmation mail; then also in the instructions (page + order mail). Update its Studio description. |
| Link to the withdrawal function ("Vertrag widerrufen", step 0) | `orderWithdrawUrl` |

**Texts:** statutory wording copied verbatim from the official sources (de: RIS, FAGG Anhang I —
the official text is in "Sie"; en: Directive 2011/83/EU Annex I) into core's **`shared`**
translations (used by both Eleventy and the server), with placeholders. The "Du" variant goes into
the informal overlay (step 0b). Shops may override wording via translations — then the shop owns
that change (website only; see 0b).

**core-back:**
- New fields in `shopSettings` (group with `returnAddress` / `returnShippingBorneBy`): partial
  delivery, exceptions, (additional note).
- New page module **`withdrawalPolicyModule` without fields** — it only marks where the instructions
  render. Page-only extras (intro, contact note) are ordinary modules above/below it.

**core-front:**
- Data layer: project the return fields + new fields into the `cms` settings (website).
- Website: Nunjucks template for the module (instructions + model form + link to the withdrawal
  function). Accessible structure: headings, the model form as a readable block (not a fillable
  form).
- Email: React component from the same translations + `fetchEmailSettings` data (extend that query
  with `company` + the new fields — still one query per mail; the mail never loads the page).
  Rendered in `orderConfirmation` when `withdrawalNotice` is on, below the order, **replacing** today's
  short notice (decided): one section with full instructions, model form and the "Vertrag
  widerrufen" link.
- Safeguard: required data missing (no business address) → website shows an editor hint in preview
  only; the email falls back to today's short notice + link. Never a half-filled legal text.
- Tests: render variants (return costs customer/merchant, single/partial delivery, exceptions,
  de/en, missing data → fallback); website and email produce the same text.

**Migration per shop:** put the module on `withdrawalPolicyPage` (replacing the rich-text copy; move
genuine extras into a normal module or the additional note), check `company`, return address,
return costs, partial delivery, exceptions in the settings; the owner reads and approves the
generated page once.

### 5. AGB in the email — R3, deferred

Not required by the WKO overview; the checkout links the AGB before ordering. Not part of this plan
unless an owner asks for it (then: attach a PDF upload or link — revisit; needs step 6).

### 5b. Accepted payment methods before ordering — R6

- Show accepted payment methods (and delivery restrictions, e.g. countries) at the latest at the
  start of ordering: e.g. a line in the cart sidebar / checkout top, from a shopSettings text or
  translation. Shipping countries already come from the shipping config. **Decide where + source.**

### 6. Mail plumbing — only if attachments are needed

Not needed for step 4 (text in the email body). Only for step 5 or other attachments:
`attachments?: EmailAttachment[]` in `sendMail` (Mailgun + Resend accept arrays); fetch PDFs at send
time, send without on failure.

### 7. Customers

**Enabling — decided: on when configured, no new flags.** Payment and shipping lines always; full
withdrawal instructions whenever `withdrawalNotice` is on and the data is complete (otherwise the
short fallback); company/register fields and delivery time when filled.

- Jurtschitsch, Tinhof: step 0 labels/overrides check; step 0b env var (Jurtschitsch `informal`); step 4
  migration (above); fill company data (step 3); test with Stripe test orders (card, Apple Pay, EPS,
  pickup) and a test withdrawal.
- Grass-Art: decide "Du"/"Sie" (env var) before its next core bump.
- **To-dos for the shop owners** (found 2026-10-07, not code):
  - Decide who pays return shipping and set `returnShippingBorneBy` accordingly. Today Tinhof
    (production) has `customer` — the withdrawal confirmation mail tells customers they pay — but its
    instructions never said so (FAGG §15: then the shop pays). Jurtschitsch (checked: development
    dataset) has it empty → core treats it as `customer`, same issue. Step 4 makes both consistent
    automatically once set correctly.
  - Jurtschitsch: no separate return address set (billing address is used) — confirm.
  - Approve the generated withdrawal page once (step 4).

## Tests

- Step 0b: overlay keys ⊆ base keys; du/Sie lint; both variants render.
- Step 0: name required (client + function), stored + in both mails; labels.
- Payment mapping (unit): card/wallet/eps/klarna/unknown → stored shape + label.
- Webhook: payment retrieval failure doesn't block order + mail.
- Email render: payment + shipping lines, footer fields only when set, withdrawal instructions
  variants + fallback.
- Website module render matches the email text for the same settings.

## Open questions

None of the design questions are open (decided 2026-10-07: separate order inbox (3b), du/Sie via env, additional note =
`returnPolicyNote`, full instructions replace the short notice, on-when-configured, delivery time per
shipping method, footer link is prominent enough, register fields optional, company details in all
mails). Remaining checks during implementation:

- Official English labels for §13a (step 0).
- Exact statutory texts from RIS / the directive (step 4) — copy, don't paraphrase.
- Shop-owner to-dos in step 7 (return costs, return address, approve generated page).
- Payment method on the invoice PDF — not wanted for now.
