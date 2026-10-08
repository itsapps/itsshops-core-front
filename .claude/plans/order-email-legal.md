# Plan — legally complete order confirmation email

Status: **agreed, not started** (2026-10-07). Origin: review of what the automatic order
confirmation contains vs. Austrian/EU consumer-law expectations. Not legal advice: the legal
requirements below are an orientation; the shop owner confirms them (WKO templates / lawyer).

Main source: WKO, "Webshops — die wesentlichen Bestimmungen (Verbraucherrechte)", as of 2025-09-09
(<https://www.wko.at/internetrecht/webshops-die-wesentlichen-bestimmungen-verbraucherrechte>).
**Priority:** step 0 (withdrawal button, in force since 2026-10-01) before the email steps. No shop
is live yet (2026-10-07), so no hotfix release is needed — everything must be in place before each
shop's go-live.

**Releases (decided 2026-10-08):** two core releases, each tested on staging on its own.
- **Release 1 — code only:** steps 0 + 0b (together: 0b rewrites every German string, so the new
  step 0 labels are written once, in the right form of address) + 3b + 1 + 2 + 2b + 3. No Sanity
  content migration. Before it ships: Winenet informed (step 1), `SHOP_FORMALITY` set on the
  Jurtschitsch Netlify site (step 0b).
- **Release 2 — content:** steps 4 + 5b. Needs the per-shop migration (withdrawal page module,
  "Versand & Zahlung" page) and the owner's approval of the generated text.

**Shop timezone:** all dates/times in mails (withdrawal receipt, order date) use one core helper,
not hard-coded per call site. Source: env var `SHOP_TIMEZONE` (IANA name), **default
`Europe/Vienna`** (decided 2026-10-08 — customers are in Austria or Germany, which share CET/CEST,
so the default is right for both). Read like `SHOP_FORMALITY` (functions; build too if the website
ever formats dates). Invalid value (`Intl.DateTimeFormat` throws `RangeError`) → log a warning and
fall back to the default, never fail a mail.

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
- **Receipt confirmation content** (Art. 11a (3) of the directive): the customer's receipt mail must
  repeat **what was submitted** (name, order number, reason if given) and the **date and time** of
  submission. Today `order-withdraw-notifier.tsx` formats `declaredAt` with `dateStyle: 'long'` only
  (no time) and doesn't echo the submission → add both (`timeStyle: 'short'`, shop timezone
  `Europe/Vienna`); same date + time in the shop notification.
- **Store + receipt timestamp:** today the record's `declaredAt` is a second timestamp —
  `createOrderWithdrawal` sets its own `new Date()` (it gets only `orderId` + `reason`), while the web
  path's mail uses the handler's value. Pass the handler's `declaredAt` (plus `name` and the
  submitted `email` / `orderNumber`) into the `orderWithdrawal` document so record and mail share
  one value. The admin resend (`audience: 'customer'`, `fetchWithdrawalForNotify`) already reads
  `declaredAt` from the record; the web path must too — date/time, name and reason always **from
  the stored record**, never "now".
- **No match → store, confirm, flag** (decided 2026-10-07, replaces "keep rejecting"): a declaration
  is never lost. Every submission that passes validation (name, email, order number) is stored; the
  function tries to match it:
  - match → as today (record linked to the order, receipt + shop notification).
  - no match → `orderWithdrawal` with status `unmatched`, no order reference, holding the submitted
    name / email / order number / reason. Receipt to the **submitted** email: repeats name, order
    number, date + time and says the shop couldn't match it automatically and will get back to them
    — **without the free-text reason** (no third-party text through our mail); name length capped.
    Shop notification flagged "no matching order — please check".
  - Same response in both cases (no "not found" → order numbers can't be probed).
  - Order number is **free text** — no format validation; a typo lands in the unmatched flow, not in
    an error (Art. 11a only asks for something that identifies the contract).
  - Order number exists but the email doesn't match → still `unmatched`, but the **shop**
    notification says so ("order X exists, email differs") so editors don't have to search. Never
    in the customer's receipt.
  - **Name validation** (decided 2026-10-08): required, capped (~100 chars), and **URL-like input
    rejected** (`://`, `www.`, domain patterns) — the name is echoed in a mail that can go to any
    typed address, so it must not carry links.
  - **Dedupe unmatched** (decided 2026-10-08): an open unmatched record with the same email + order
    number (normalized: trimmed, lower-cased email) → re-send the receipt, no new record (same as
    the matched repeat case below).
  - core-back: `order` reference optional on `orderWithdrawal`, new status `unmatched`; editors can
    link the record to the right order in the Studio (it then counts as matched).
  - **Editor flow for unmatched** (decided 2026-10-08): order found → **assign it in the order
    field**; junk → guarded delete (below); real but no order found → editor contacts the
    submitted email manually, then assigns or deletes.
  - **Assigning an order** (core-back, no new document action — replaces the "Assign order"
    dialog idea):
    - `orderRef` is **editable while the published status is `unmatched`**, `readOnly` otherwise
      (normal withdrawals stay protected).
    - Normal Sanity reference picker → the editor can choose **any** order; the field's
      `options.filter` excludes orders that already have an open (`received`/`processing`)
      withdrawal. Check that the `order` schema's search/preview cover order number, customer
      name and email; extend if not.
    - **Suggestions** above the picker (custom input): orders matching the submitted order number,
      email or name, each with a "use this order" button. None fits → use the picker.
    - **Status follows the field:** picking an order sets status `received`, clearing it (before
      publish) sets `unmatched` again. Validation: `unmatched` ⇔ no `orderRef`; the chosen order
      has no other open withdrawal (guards races the filter can't).
    - Customer mail: after publishing, the existing **resend confirmation** action
      (`WithdrawalResendAction` → `withdrawNotify`) sends the normal receipt to the **order's**
      email — so the real buyer learns a withdrawal was filed on their order (an unmatched
      submission often had a different email). Afterwards it's a normal withdrawal;
      "Erstatten & abschließen" works as today (full refund + `orderRefunded` mail).
  - Update the schema comment in `orderWithdrawal.ts` ("never delete") to the new rule.
  - **Retention — editor rule, no code** (decided 2026-10-08): unmatched records may hold personal
    data of non-customers. Rule: within 30 days, link them to the right order or delete them in
    the Studio. Written (a) in the docs + each shop's go-live checklist and (b) in the Studio
    description of the `orderWithdrawal` status/order field ("Unmatched: assign it to an order or
    delete it after checking"). No auto-delete (a genuine late declaration must never be lost).
  - **Delete is blocked today** (`orderWithdrawal.ts`: `disallowedActions: ['delete', 'duplicate']`)
    → core-back re-adds a **guarded delete** in `config/actions.ts` (same pattern as `category`:
    keep `delete` disallowed in the schema, push a `createCustomAction` wrapper): allowed only when
    `status == "unmatched"`, otherwise a translated "only unmatched declarations can be deleted"
    message. Matched records stay undeletable (proof that a declaration was received).
- **Double-submit race** (exists today): `findOpenWithdrawal` → `createOrderWithdrawal` is
  check-then-create, so two quick submits can create two records. Use a deterministic `_id` for the
  open record + `createIfNotExists` (or an equivalent transaction) for matched and unmatched.
- **Repeat submission → receipt again:** today an existing open withdrawal makes the function return
  success silently with no mail (`order-withdraw.ts`, `findOpenWithdrawal`). Every submission must be
  confirmed (Art. 11a (3)): still no duplicate record, but re-send the receipt for the existing one
  (bounded by the rate limit below).
- **No captcha, rate limit instead** (decided 2026-10-07): the withdrawal function must be easy to
  use, so drop `enforceCaptcha` on this form. Since unmatched submissions now send mail to any typed
  address, rely on the per-IP limit. **Already in place:** the shops' function wrappers
  (`netlify/functions/order_withdraw.mts` in Jurtschitsch and Tinhof) set Netlify's `rateLimit`
  config (`windowSize: 60`, `windowLimit: 5`, `aggregateBy: ['ip', 'domain']`) — Jurtschitsch and Tinhof are on paid plans (confirmed
  2026-10-08); works on paid
  Netlify plans only, so every shop using the withdrawal function needs a paid plan (go-live
  checklist). Netlify answers over-limit requests itself (429) — the form's client script must show
  a translated "try again later" message for that status (the 429 body isn't our JSON — handle
  non-JSON responses). No per-email limit via Sanity (decided 2026-10-07: no counting queries
  against the CMS).
  - **Honeypot** (decided 2026-10-08): a per-IP limit doesn't stop distributed bots, and unmatched
    submissions now create Sanity documents + mails. Add a hidden honeypot field (visually hidden,
    `aria-hidden="true"`, `tabindex="-1"`, `autocomplete="off"`, never announced to screen-reader
    users); filled → the same success response, nothing stored or sent.
  - Jurtschitsch's wrapper passes `createOrderWithdrawHandler({ captcha: true })`, an option
    `OrderWithdrawConfig` doesn't define (core enforces the captcha unconditionally today) → remove it
    when the captcha goes.
- **Always available** (decided 2026-10-07): the form and its links stay up permanently, also after
  the withdrawal period — no date check that hides or disables it; late declarations are handled
  manually by the shop.
- "Hervorgehoben und leicht zugänglich" for the whole period — **decided:** footer link on every
  page + link in the order confirmation + thanks page, all labelled "Vertrag widerrufen". No new UI
  element.
- English labels: verify against Directive (EU) 2023/2673 Art. 11a (likely "withdraw from contract
  here" / "confirm withdrawal").
- Customer overrides: check customer `footer.njk` overrides and menus for hard-coded labels
  (Jurtschitsch, Tinhof, Grass-Art).
- Tests: form validation (name required, URL-like name rejected), function stores/sends the name;
  receipt mail contains submission content + date and time; unmatched → stored + receipt without
  reason + flagged shop mail, same response as a match; "number exists, email differs" hint in the
  shop mail only; repeat submission (matched and unmatched) → receipt, no second record; honeypot
  filled → success response, nothing stored/sent; resend keeps the original timestamp; client shows
  the "try again later" message on 429; render check of labels.

### 0b. Form of address: "Sie" by default, "Du" per shop (core-front)

**Decided (2026-10-07, statutory-text exception dropped 2026-10-08):** one global, per-shop setting
for all German texts — website, emails, server messages, **including** the statutory texts of steps
2b/4. **Default "Sie".** Jurtschitsch: "Du"; Tinhof: "Sie" (default).

- **Setting:** env var `SHOP_FORMALITY=formal|informal` (default `formal`), set once on the Netlify site (all
  scopes → build + functions) and in the shop's `.env` for local dev. Read by `resolveConfig` (build)
  and by `serverT` (functions) — the one value both runtimes see. (A Sanity toggle was rejected: the
  translator would have to wait for CMS data at build time.)
- **Base files become "Sie":** rewrite the ~80 du-strings in `de_11ty.ts` and `de_server.ts`
  (`de_shared.ts` has none) to the polite form ("Ihr Warenkorb ist leer.", "Vielen Dank für Ihre
  Bestellung!", …). Strings without address ("Zwischensumme", "Versand", …) stay as they are.
- **Overlay files** `de_11ty.informal.ts` / `de_server.informal.ts` / `de_shared.informal.ts`: only
  the keys whose text differs, same nesting, the "Du" variants. (`shared` is its own i18next
  namespace on the website — `frontTranslation.ts` — and merged into `serverT`; it needs its own
  overlay — it will hold the step 4 legal text.)
- **Statutory text follows the setting too** (decided 2026-10-08, replaces "always Sie"): the FAGG
  Anhang I wording (step 4) and the warranty notice (step 2b) get informal overlay variants that
  change **only the forms of address** (Sie/Ihr/Ihnen → du/dein/dir, verb forms accordingly); all
  other wording stays verbatim. Small residual risk: the "Du" version is no longer the literal model
  text the FAGG §4 (3) protection refers to (content unchanged; common practice) — the shop owner
  approves the Du version (step 7).
- **Merge order at startup** (only one table per language at runtime; templates keep calling
  `trans(key)` / `serverT(key)` unchanged):
  - website (`createTranslator`): core base → informal overlay (if `informal`, for `common` and
    `shared`) → shop's own `config.translations` overrides (existing deep merge)
  - server (`netlify/utils/i18n.ts` `serverT`): `de_server` + `de_shared` → their informal overlays
    (if `informal`)
- English: unaffected.
- Naming: code, values and comments in English (`formal`/`informal`); German only inside translation
  strings and German Studio labels.
- **Missing env var → "Sie"** (decided 2026-10-08: no build check): the fallback is the literal
  statutory form, so forgetting the variable is a tone issue, not a legal one. Set it for **all
  scopes** — build-only would give a "Du" website with "Sie" emails.
- **Tests:** every overlay key exists in the base; render thanks page + order email with both settings; for the
  statutory keys (steps 2b/4), the overlay differs from the base only in address forms (normalize
  pronouns/verb forms, then compare). No du/Sie word lint (decided 2026-10-08: too many false
  positives — "Sie"/"Ihr" can mean the order; tone is checked by reading).
- **Release gate (checklist, not just a note):** set `SHOP_FORMALITY=informal` on the Jurtschitsch
  Netlify site (all scopes) — and Grass-Art if it stays "Du" — **before** any staging/production
  deploy of the core version containing 0b.
- **Customer impact:** shops without the env var switch to "Sie" on their next core bump —
  **Jurtschitsch must set `SHOP_FORMALITY=informal` before deploying** that core; **Grass-Art** (today
  "Du") changes tone unless it sets it too. Note: shop translation overrides don't reach the server
  (emails) today — the env var is the only per-shop switch there.

### 1. Payment method on the order (core-front + core-back) — R4

- Webhook (`handlePaymentSucceeded`): retrieve the PaymentIntent with
  `expand: ['latest_charge']` (new helper in `services/stripe.ts`) and read
  `latest_charge.payment_method_details` — the record of what was actually charged (wallet in
  `card.wallet.type`; still there if the PaymentMethod is later detached). Map to
  `payment: { type, brand?, last4?, wallet? }` (`card` + `apple_pay`/`google_pay` wallet, `eps`,
  `klarna`, `paypal`, `sepa_debit`, …). Store on the order (and pass into `buildOrder`).
  `last4`: card → `card.last4`; SEPA → last 4 IBAN digits (`sepa_debit.last4`, decided).
- Async methods: `payment_intent.succeeded` is when the webhook creates the order and sends the
  confirmation. For SEPA Direct Debit that's days after checkout (R1 "within reasonable time") —
  no shop has SEPA enabled (confirmed 2026-10-08) → map `sepa_debit` generically, no special
  delayed-payment handling; revisit if a shop enables it. Never stored: full card number/IBAN, expiry, CVC,
  client secret (card data never reaches our servers; brand + last4 is PCI-allowed truncation).
  Label examples: "Visa •••• 4242", "Apple Pay (Visa •••• 4242)", "SEPA-Lastschrift •••• 3000", "EPS".
  On Stripe error: log, store nothing — never block order creation.
- Stored on the **order only, not on orderMeta**: orderMeta is written in `payment-create` before
  paying, when the method isn't final (customer can switch in the Payment Element; wallets decide
  in express checkout). It's final at `payment_intent.succeeded`, where the webhook creates the order.
- core-back: `orderPayment` object on the order schema (read-only), shown in `OrderView`.
- Email: "Zahlungsart: Visa •••• 4242" / "Apple Pay (Visa •••• 4242)" / "EPS" — translated labels,
  unknown types fall back to a generic label.
- `wc-api` (Winenet) — **decided: change both**: `payment_method` = the stored Stripe type (`card`,
  `eps`, `klarna`, `paypal`, …; `stripe` when unknown, e.g. old orders) and `payment_method_title` =
  the readable label ("Visa •••• 4242") instead of "Stripe". **Tell Winenet before releasing** — they
  may map `payment_method` in their accounting.
- Existing orders: no payment field → line omitted.

### 2. Shipping method in the email (core-front) — R4

- Show `fulfillment.methodTitle`; for `pickup` also `pickupLocation` if set.
- **Delivery time — decided:** optional i18n field `deliveryTime` on each shipping method
  (core-back, e.g. "2–4 Werktage"); snapshot it into `order.fulfillment` at order creation (like
  `methodTitle`) and show it in the mail when set. Could later also show in the checkout's shipping
  options.

### 2b. Order date + warranty notice in the email (core-front) — R1

**Decided (2026-10-07):** R1 asks for "sämtliche vorvertragliche Informationen"; two cheap gaps:
- **Order date** in the order details — **from the PaymentIntent's `created`** (decided
  2026-10-08: when the customer placed the order; the order document is only created at
  `payment_intent.succeeded`, days later for SEPA). Snapshot it onto the order at creation; shop
  timezone (`SHOP_TIMEZONE`). Existing orders without it → fall back to the order's creation date.
- **Statutory warranty notice** (FAGG §4: "Hinweis auf das Bestehen eines gesetzlichen
  Gewährleistungsrechts"): one translated sentence, near the withdrawal section. Follows the
  shop's form of address like step 4 (informal variant changes only the address forms, step 0b).
- Complaint-handling procedure: only if a shop has one — then via `returnPolicyNote` / page text, no
  new field for now.
- Tests: both appear in de/en render.

### 3. Business details in the footer (core-front + maybe core-back) — R5

- `MailFooter` renders `settings.company`: `name`/`owner`, `phone`, `vatId`, register data — only
  filled fields. **Decided: in all business mails** — order, withdrawal, account and newsletter mails
  (they share the footer; UGB §14 applies to business emails generally).
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
    configure the shop inbox. Update the function's doc comment. Technically an API change (a shop
    passing it would fail its TS build) → one line in the release notes.
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
translations (used by both Eleventy and the server), with placeholders. Use the version **in force
now** — check whether the amendment behind §13a (in force 2026-10-01, Directive (EU) 2023/2673)
changed the Annex I wording, e.g. to mention the withdrawal function. **Form of address follows
the shop setting** (decided 2026-10-08, replaces "always Sie"): the base is the official "Sie" text;
the informal overlay (step 0b) changes only the address forms, everything else verbatim. Shops may
override wording via translations — then the shop owns that change (website only; see 0b).

**Structure rules:**
- Annex I has these variants for when the period starts (goods): single item / several items of one
  order delivered separately / one item delivered in several lots or pieces / **regular delivery
  over a defined period** (subscriptions — relevant if a shop sells wine subscriptions). The new
  shopSettings field maps to these variants explicitly (default: "several items delivered
  separately" — cases can ship as several parcels), not a plain yes/no. Check the full list of
  optional Annex I sentences too (return-cost options incl. cost estimate, trader collects the
  goods, withholding the refund until the goods are back) and map each one to a setting or a fixed
  choice.
- **Exceptions are not part of the model text** (Annex I Part A has no slot for them; they're
  separate pre-contractual information). Render them as their own block next to the instructions,
  never spliced into the statutory wording. Same for `returnPolicyNote`.

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
  only; the email falls back to today's short notice + link and the function **logs a warning**
  (otherwise a misconfigured shop never notices). Never a half-filled legal text.
- Tests: render variants (return costs customer/merchant, single/partial delivery, exceptions,
  de/en, missing data → fallback); website and email produce the same text.

**Migration per shop:** put the module on `withdrawalPolicyPage` (replacing the rich-text copy; move
genuine extras into a normal module or the additional note), check `company`, return address,
return costs, partial delivery, exceptions in the settings; the owner reads and approves the
generated page once. **Go-live checklist item:** the email uses the generated text as soon as the
settings are complete, but a page still holding the old rich text doesn't read the settings — until
the module replaces it, page and email can say different things (e.g. return costs). Do the
migration before the shop goes live.

### 5. AGB in the email — R3, deferred

Not required by the WKO overview; the checkout links the AGB before ordering. Not part of this plan
unless an owner asks for it (then: attach a PDF upload or link — revisit; needs step 6).

### 5b. "Versand & Zahlung" page — R6 (core-front + core-back)

**Decided (2026-10-07):** accepted payment methods and delivery restrictions are stated on a content
page, linked before ordering, instead of new UI in cart/checkout.

- core-back: new page module **`shippingInfoModule` without fields** — renders shipping from the
  shipping-method documents. New `shopSettings.shippingInfoPage` reference (like `termsPage`) so core
  knows the URL.
- core-front: module template renders, per shipping method: title, type (delivery / pickup +
  location), **eligible countries** (delivery restrictions), **prices as rules** (weight rates
  "bis X kg: Y €", wine packaging rates per case size — never invented example totals; gross, like the
  checkout), **delivery time** (step 2 field) when set. Same data the checkout calculates with, so the
  page can't drift from what's charged. Free shipping via coupons isn't shown.
- **Payment methods**: not in Sanity (Stripe Dashboard decides) → editors write them in a normal
  rich-text module on the same page, next to the shipping module (no settings field).
- **Payment methods** text is editor-written and can drift from what's enabled in the Stripe
  Dashboard — per-shop checklist item: re-check it whenever payment methods change in Stripe.
- Links (decided 2026-10-07): **footer/menu** (editors add the page like any page) and **checkout**
  via `shippingInfoPage` — **at the top** (FAGG §8 (3): "spätestens bei Beginn des
  Bestellvorgangs"; the button area alone is the end of the process) **and above the
  "zahlungspflichtig bestellen" button**. Not in the cart sidebar.
- Data layer: `shippingInfoUrl` well-known URL (`'#'` when unset), like `termsUrl`.
- Tests: module renders rates/packaging/countries/delivery time; checkout link only when set.
- Per shop: create the page (module + payment-methods text), set `shippingInfoPage`, add to the
  footer menu.

### 6. Mail plumbing — only if attachments are needed

Not needed for step 4 (text in the email body). Only for step 5 or other attachments:
`attachments?: EmailAttachment[]` in `sendMail` (Mailgun + Resend accept arrays); fetch PDFs at send
time, send without on failure.

### 7. Customers

**Enabling — decided: on when configured, no new flags.** Payment and shipping lines always; full
withdrawal instructions whenever `withdrawalNotice` is on and the data is complete (otherwise the
short fallback); company/register fields and delivery time when filled.
**`withdrawalNotice` becomes default-on** (decided 2026-10-08): R1/R2 apply to every consumer
shop, so a shop that forgets the flag must not send a confirmation without withdrawal information.
On by default for the order-confirmation webhook, the option can turn it off (opt-out). Release
note: shops that didn't pass it now get the section.

- Jurtschitsch, Tinhof: create the "Versand & Zahlung" page (5b); step 0 labels/overrides check; step 0b env var (Jurtschitsch `informal`); step 4
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
  - Approve the generated withdrawal page once (step 4). Jurtschitsch ("Du"): approve the **Du
    version** of the statutory texts (instructions, model form, warranty sentence) explicitly —
    it deviates from the literal "Sie" model text in address forms only.

## Tests

- Step 0b: overlay keys ⊆ base keys; both variants render.
- Step 0: name required (client + function), stored + in both mails; receipt has submission
  content + date/time; unmatched handling (+ dedupe, shop-only "email differs" hint); URL-like name
  rejected; honeypot; repeat submission → receipt; resend keeps original timestamp; 429 message;
  labels.
- `withdrawalNotice` default-on: the section renders without the option, disappears with opt-out.
- Step 2b: order date + warranty sentence in the email.
- Payment mapping (unit): card/wallet/eps/klarna/unknown → stored shape + label.
- Webhook: payment retrieval failure doesn't block order + mail.
- Email render: payment + shipping lines, footer fields only when set, withdrawal instructions
  variants + fallback.
- Website module render matches the email text for the same settings.

## Open questions

None of the design questions are open (decided 2026-10-07: "Versand & Zahlung" page with shipping
module (5b), Winenet gets payment type + label, footer in all business mails, separate order inbox (3b), du/Sie via env, additional note =
`returnPolicyNote`, full instructions replace the short notice, on-when-configured, delivery time per
shipping method, footer link is prominent enough, register fields optional, company details in all
mails; unmatched withdrawals stored + confirmed + flagged, no captcha but rate limit, withdrawal form
always available, payment methods on the "Versand & Zahlung" page stay editor-written; decided
2026-10-08: statutory texts follow the du/Sie setting too, address forms only; two releases
(code / content); URL-like names rejected + honeypot; unmatched deduped on email + number;
unmatched retention as an editor rule (docs + Studio description, no code); `withdrawalNotice`
default-on; no build check for `SHOP_FORMALITY`; statutory overrides accepted as planned; order
date = PaymentIntent `created`; `SHOP_TIMEZONE` default Vienna; no du/Sie word lint). Remaining checks during implementation:

- Cite the Austrian law behind §13a FAGG (RIS) in the docs — housekeeping, no impact on the work
  (no shop is live).
- Official English labels for §13a (step 0).
- Exact statutory texts from RIS / the directive (step 4) — copy, don't paraphrase; use the
  version in force since 2026-10-01.
- Shop-owner to-dos in step 7 (return costs, return address, approve generated page).
- Inform Winenet about the `payment_method` change (step 1) before releasing.
- Payment method on the invoice PDF — not wanted for now.
