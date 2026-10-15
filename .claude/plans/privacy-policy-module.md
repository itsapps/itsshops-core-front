# Plan — generated privacy policy (`privacyPolicyModule`)

Status: **In progress** — steps 0–5 done: released in core-back 4.1.0 / core-front 3.1.0 (2026-10-15). Mechanism: `architecture/commerce-and-netlify.md` → "Privacy policy", `decisions/privacy-policy-generated.md`. Next: step 6 per shop — Tinhof backend 1.4.0 / frontend 1.6.0 tagged, production push pending; then delete this plan. Decisions 2026-10-14: see "Decided" below. Origin: Tinhof's "Datenschutz" page is a hand-typed
rich text that doesn't describe what the shop does. Not legal advice: the requirements below are an
orientation; the core wording gets one legal review, each shop owner approves their generated page.

When this ships, delete this file — durable parts go to `architecture/templates-and-assets.md`
(module), `i18n.md` (strings), a decision record and `workflows/go-live-checklist.md`.

## Decided (2026-10-14)

- **Analytics:** the module always states "no analytics / no tracking". No analytics section until a
  real consent banner + GTM loading exist (separate feature, later, together). The unused `gtmId`
  CSP widening (`config/headers.ts:139`) is noted as cleanup.
- **Wording:** Claude drafts (de formal, de informal, en); the user reviews; each owner approves
  their generated page. Lawyer optional.
- **Tinhof map:** keep loading OSM tiles on page view; disclose it in an extra section (OSMF, UK,
  adequacy decision, Art. 6(1)(f)). No click-to-load.
- **Carrier:** named as a **category** ("Paketdienstleister") inside the Orders section, generated
  whenever a shipping method (not pickup-only) exists — Art. 13(1)(e) allows categories, and a
  named carrier would drift when the shop switches. Carrier = independent controller, Art. 6(1)(b),
  no AVV. The carrier gets name + shipping address only (no email; checkout collects no phone).
  Tinhof uses DPD; not named on the page.
- **Age confirmation:** not a processing (only a line of text in checkout and the order mail; nothing
  stored) → no section. The age gate is unused → left out of the browser-storage list.
- **Unpaid `orderMeta`:** currently never deleted. Prerequisite step: a scheduled cleanup deletes
  unpaid `orderMeta` after **30 days**; the Orders section states that period.
- **Function logs:** audit every `log.*` call in `src/netlify` so no name, address, email or phone
  is logged (ids only); the hosting section mentions function logs and their retention.
- **GTM:** `gtmId` is not a builder input and not in the tests. The CSP widening stays a separate
  cleanup note.
- **Retention / region:** look up Netlify log retention and the Supabase project region **before**
  step 1 and put concrete values into the provider data.
- **Order system (`wc-api`):** recipient hardcoded as **wineNET** when `WC_CONSUMER_KEY` is set — no
  `orderSystemName` field. Revisit when a shop uses another ERP.
- **DPO:** item omitted when `dpoContact` is empty (Art. 13(1)(b) only applies if a DPO exists).
- **Extra sections** render right after "External content" (same kind of processing), not at the end.
- **Stripe** loads only on the checkout page — verified: `scripts/index.ts` imports `./checkout`
  only with `[data-checkout]`, `loadStripe` is only called there, all other `@stripe/stripe-js`
  imports are type-only. Cookie statement "checkout page only" holds; no code change.
- **wineNET:** named as processor — winenet gmbh, Reitschulgasse 19, 7093 Jois, AT (EU, no
  transfer). Its own privacy page offers no AVV → per shop, owner checks the contract/terms for an
  AVV (Art. 28) and requests one if missing.
- **Contact for privacy questions:** `settings.company.email` — no extra field.
- **Overview** section (no tracking, no ad cookies, no social plugins) stays at the top;
  **browser storage** is a bullet list filtered by feature.
- Checkout collects **no phone**; the carrier gets name + shipping address only.
- **Apple Pay / Google Pay** (Stripe express checkout; Link, PayPal, Amazon Pay off): one sentence
  in the Payment section — Apple/Google process data under their own policies.
- **"Stand" date** from a core constant `PRIVACY_POLICY_UPDATED`, bumped with every wording or
  condition change (release checklist item).
- **No contact-form section:** core has none; Tinhof's contact module is mailto/tel links only.
- **CSP ↔ policy:** go-live checklist line — every `headers.extra` host needs a matching privacy
  extra section.

## Why a generated module

Same reasoning as `decisions/legal-texts-generated-from-settings.md`: hand-typed legal texts drift
from what the code does. A privacy policy is a description of data processing, and core knows which
processing a shop runs (features, env, settings). So core builds the text from that, and a section
appears or disappears when a shop turns a feature on or off. A wording fix in core reaches every
shop. Unlike withdrawal there is **no statutory model text** — the wording is ours, written once
along Art. 13 DSGVO, reviewed once.

Existing page contents are **not** a source (Tinhof's text claims "no transfer to third parties",
cites TKG 2003, mentions a non-existent contact form). Start from the requirements and the code.

## Legal frame (what the page must contain)

Sources: Art. 13 + 12 DSGVO; § 165 Abs 3 TKG 2021 (storage on the user's device); DSG; WKO guidance
on privacy notices for websites; EU-US Data Privacy Framework (DPF) adequacy decision 2023;
UK adequacy decision 2021.

Art. 13 checklist — every item must be covered (generated or explicitly "not applicable"):
1. Controller: name, address, contact (Art. 13(1)(a)).
2. Data protection officer: contact if one exists — usually none for a winery (Art. 13(1)(b)).
3. Per processing: **purpose + legal basis** (Art. 13(1)(c)); for Art. 6(1)(f) the **legitimate
   interest** named (Art. 13(1)(d)).
4. **Recipients** / categories of recipients (Art. 13(1)(e)).
5. **Third-country transfer** + safeguard (DPF, adequacy, SCCs) (Art. 13(1)(f)).
6. **Retention** period or criteria, per processing (Art. 13(2)(a)).
7. Rights: access, rectification, erasure, restriction, portability, objection (Art. 15–21)
   (Art. 13(2)(b)); withdrawal of consent where consent is the basis (Art. 13(2)(c)).
8. Complaint to a supervisory authority — Austria: Datenschutzbehörde, Barichgasse 40–42, 1030 Wien
   (Art. 13(2)(d)).
9. Whether providing data is required by contract/law and the consequence of not providing it
   (Art. 13(2)(e)) — e.g. no order without name/address/email.
10. Automated decision-making incl. profiling (Art. 13(2)(f)) — none by the shop; mention Stripe's
    fraud screening honestly.
11. Device storage (§ 165 Abs 3 TKG 2021): what is stored, that it's strictly necessary → no consent;
    anything not strictly necessary (analytics) only with consent.

Form (Art. 12): concise, plain language, in the site's languages; Sie/Du via `SHOP_FORMALITY`.

## Processing inventory (verified in code 2026-10-13)

Each row = one generated section. Condition = when core renders it.

| Section | Condition | Data / storage | Basis | Recipient (location, safeguard) | Retention |
|---|---|---|---|---|---|
| Hosting & server logs | always | IP, user agent, URL, time; function logs (request ids, no personal data after the audit); per-IP rate limiting of online withdrawal | 6(1)(f) security/operation | Netlify, Inc. (US, DPF) | access logs < 30 days; function logs ≤ 7 days |
| Content delivery / images | always | IP on image requests to `cdn.sanity.io` | 6(1)(f) | Sanity (US/EU, DPF) | provider logs |
| Orders | `shop.checkout` | name, addresses, email, items, payment status; stored as Sanity `order` / order meta docs | 6(1)(b), 6(1)(c) (BAO) | Sanity (DPF); shipping carrier as category, when a non-pickup shipping method exists | 7 years (§ 132 BAO); unpaid order meta 30 days (new cleanup) |
| Payment | `shop.checkout` | payment data, name, email, IP, device data; cookies `__stripe_mid`, `__stripe_sid` on checkout page | 6(1)(b); 6(1)(f) fraud prevention | Stripe Payments Europe Ltd. (IE); Stripe Inc. (US, DPF) | Stripe's own retention (own controller for parts) |
| Transactional email | checkout / users / newsletter | email, order content | 6(1)(b) | Resend (US, DPF) or Mailgun (US/EU per `MAILGUN_USE_EU_REGION_URL`) — from `EMAIL_PROVIDER` | provider logs |
| Online withdrawal | `orderWithdrawUrl` set | order number, email, declaration | 6(1)(c) (FAGG) | email provider | with the order |
| Order management / invoicing | `WC_CONSUMER_KEY` set (`wc-api`) | order data read by external merchandise system | 6(1)(b)/(c) | wineNET (hardcoded for now) | per contract |
| Customer account | `users` | email, name, registration fields; httpOnly cookies `sb_access_token`, `sb_refresh_token` | 6(1)(b) | Supabase (region per shop from its dashboard, DPF) | until account deletion |
| Newsletter | `newsletter` | email, double-opt-in token; stored as Sanity `newsletterSubscriber` | 6(1)(a) consent, revocable | Sanity, email provider | until unsubscribe |
| Spam protection | captcha key **and** a captcha form active (register, recover, newsletter) | IP, device signals | 6(1)(f) | hCaptcha / Intuition Machines (US, DPF) | provider |
| No tracking | always (decided: no analytics section for now) | statement: no analytics, no tracking, no ad cookies | — | — | — |
| Browser storage | always (list filtered by feature) | `localStorage`: cart, coupon code, pending-payment marker, recent searches; `sessionStorage`: order snapshot for thank-you page | § 165 Abs 3 TKG 2021 strictly necessary | stays on device | until removed / tab closed |
| External content | `shop.vinofact.enabled` and `'bottleImage'` in `vinofact.fields` (only bottle images load from i.vinofact.com; Tinhof: off) | IP on images from `i.vinofact.com` | 6(1)(f) | vinofact (AT) | provider |
| Shop-specific extras (render after External content) | editor field | e.g. Tinhof: OpenStreetMap tiles (IP → OSMF, UK, adequacy) | as written | as written | as written |
| Social links | none rendered by core | plain links, no plugins — state it only if useful | — | — | — |
| Rights / complaint / contact | always, last | — | — | — | — |

Fonts: all shops self-host (checked Tinhof) — state "no externally loaded fonts" only if core can
guarantee it; otherwise leave out.

## Design

**core-back**
- `src/schemas/modules/privacyPolicyModule.ts` (pattern: `shippingInfoModule.ts`), no feature gate.
  Fields:
  - `extraSections`: array of `{ heading: i18nString, text: i18nText }` — shop-specific processing
    core can't know (map, contact form of a customer extension, …).
  - `dpoContact` (i18nText, optional) — only if the shop has a data protection officer.
- Register in `schemas/objects.ts`; labels/descriptions in `localization/resources/fields_{de,en}.ts`
  (description of `extraSections` tells the editor *when* to add one: every external service on the
  page that core doesn't render).
- Controller data: existing `settings.company` (no new fields). Page link: existing
  `settings.privacyPage`.

**core-front**
- Builder `src/shared/privacy-policy.ts` — pure function like `withdrawal-instructions.ts`:
  input = feature flags, `EMAIL_PROVIDER`/Mailgun region, captcha key, WC configured,
  `settings.company`, module fields, locale, formality; returns `{ sections, missing }`.
  Provider facts (legal name, address, country, safeguard, privacy-policy URL) live as **data** in
  the builder (`PROVIDERS` map), wording in translations.
- Build-time access to function-only env: `EMAIL_PROVIDER`, `MAILGUN_USE_EU_REGION_URL`,
  `WC_CONSUMER_KEY` presence — add to `CoreConfig` as booleans/enums (never the secrets), document
  in `configuration.md`.
- Strings: `privacyPolicy.*` in `src/i18n/translations/{de,en}_11ty.ts` + `de_11ty.informal.ts`.
- Rendering: filter `privacyPolicy` in `src/filters/index.ts` (next to `withdrawalInstructions`);
  `templates/core/modules/privacyPolicyModule.njk` + `templates/overridable/modules/` include.
  Incomplete company settings → log + editor hint in preview only, nothing public (same rule as
  withdrawal). Semantic `<section>` + `<h2>`, provider privacy links as normal links.
- Data: projection in `src/data/queries.ts`, resolve i18n fields in `src/data/resolve/modules.ts`.
- CSS: base layout next to `.withdrawal-instructions` in `src/assets/css/core.css`.
- Consistency: the newsletter/register "privacy notice" strings already link `privacyUrl` — no
  change; go-live checklist requires `settings.privacyPage` to point at the page with the module.

**Tests** — `src/shared/__tests__/privacy-policy.test.ts`: section set for a Tinhof-like config,
a full config (users + newsletter + captcha), a minimal non-shop site; missing company →
`missing`; extras render right after External content; no DPO item without `dpoContact`; Resend vs.
Mailgun EU wording; Du/Sie.

## Steps

0. ✅ **Prerequisites** (core-front, 2026-10-14):
   - `order-meta-cleanup` function (`ORDER_META_RETENTION_DAYS` = 30 in `config/constants`, used by
     the builder too) deletes every `orderMeta` not updated for 30 days (paid ones are copies in
     their `order`). Customer wrapper `netlify/functions/order_meta_cleanup.mts`,
     `schedule: '@daily'` — every shop with checkout needs it (Tinhof: added after 1.5.0).
   - Log audit: removed recipient emails (`to`) from 4 log lines and the wc-api status-update body;
     the rest logs ids, error messages, `emailObfuscated` (4 chars). Rule in `configuration.md`.
     Residual: provider error messages (Supabase, Resend/Mailgun) may echo an address — accepted.
   - Netlify: access logs (IP, user agent, URL, referrer) "stored for less than 30 days" (Netlify
     statement, quoted on answers.netlify.com 2021; not on today's privacy page — wording "up to
     30 days"); function logs 24 h, up to 7 days on paid plans. Netlify, Inc., 101 2nd Street,
     San Francisco, CA 94105, USA; EU-US DPF (privacy policy). Processor under Netlify's DPA.
   - Supabase region: only Rosi Schuster uses `users`; the region is not in `SUPABASE_URL` →
     look it up in that project's dashboard when Rosi Schuster migrates; Tinhof doesn't need it.
1. **Wording draft** (de formal, de informal, en) per section in the table above, drafted by
   Claude, approved 2026-10-15 — now in `privacyPolicy.*` translations → reviewed by the user **before** coding the strings. Keep it short; one paragraph per section.
2. core-back: module schema + labels; `npm run build`.
3. core-front: `CoreConfig` additions, builder + tests, strings, filter, templates, CSS; build,
   `npm run test`, `npm run check:functions`.
4. Docs: decision record `decisions/privacy-policy-generated.md` (extends the legal-texts decision),
   `templates-and-assets.md`, `configuration.md`, `i18n.md`, go-live checklist (incl. "every
   `headers.extra` host has a privacy extra section"), CHANGELOG (minor),
   core-back `schemas.md`.
5. Release core-back + core-front (minor).
6. **Per-shop migration** (Tinhof first): pin versions; in development add the module after
   `pageHeader` on the privacy page, **disable** (not delete) the old rich text; fill extras
   (Tinhof: OpenStreetMap map); style like the other legal
   modules (Tinhof `src/assets/css/global/blocks/modules.css`); owner approval → production.

## Open points

- **Stripe as own controller:** Stripe processes some data as independent controller (fraud, legal
  obligations) — wording per Stripe's privacy policy.
- Per shop (owner): DPO yes/no, data processing agreements (AVV) with wineNET
  and the email provider in place.
