# Privacy policy generated from what the shop runs

**Status:** Active
**Date:** 2026-10-15

## Context

Tinhof's "Datenschutz" page was hand-typed and wrong for a shop: it claimed "no transfer to third
parties", cited TKG 2003 and a contact form that doesn't exist, and named none of the processors
(Netlify, Sanity, Stripe, Resend, wineNET). A privacy policy describes data processing, and core
knows which processing a shop runs (features, env, settings) — the same drift problem as the
withdrawal text ([legal-texts-generated-from-settings.md](legal-texts-generated-from-settings.md)).
Unlike withdrawal there is no statutory model text.

## Decision

- Core builds the policy (`shared/privacy-policy.ts`, `privacyPolicyModule`) from features, the
  function-side services (env read at build time) and `settings.company`; each section has a
  condition and disappears with its feature. Our own wording along Art. 13 GDPR, drafted once and
  reviewed by the user; each owner approves their page. A lawyer review is optional.
- **No analytics section:** the text always states "no tracking". Analytics only comes back
  together with a real consent banner (separate feature), so the page can't claim one or the other
  wrongly.
- **Carrier as a category** ("Paketdienstleistungsunternehmen"), not by name — Art. 13(1)(e) allows
  categories, and a named carrier would drift when the shop switches. Carrier = independent
  controller; it gets name + shipping address only (checkout collects no phone, email not passed).
- **wineNET hardcoded** as the `wc-api` recipient (processor, winenet gmbh, AT) instead of an editor
  field — every shop using `wc-api` uses wineNET; revisit when one doesn't.
- **Shop-specific processing** core can't see (Tinhof's OpenStreetMap map, embeds) comes from editor
  extra sections, placed after the embedded-content section. Rejected: click-to-load for the map
  (Tinhof keeps tiles on page view and discloses it).
- **Facts made true in code first:** unpaid `orderMeta` is deleted after 30 days
  (`order-meta-cleanup`; before, it was kept forever), function logs no longer contain recipient
  emails or request bodies. The text states only what the code guarantees.
- Sections that would overstate are gated on actual use: vinofact only with `'bottleImage'` fetched
  (other vinofact data never loads in the browser); hCaptcha only with a form that loads it.

## Consequences

- A wording or condition change in core reaches every shop; bump `PRIVACY_POLICY_UPDATED` with it.
- Build-time env (`EMAIL_PROVIDER`, `MAILGUN_USE_EU_REGION_URL`, `WC_CONSUMER_KEY`) must be visible
  to the build, not only the functions.
- Each shop migrates once (module on the privacy page, extra sections, CSS, owner approval;
  `workflows/go-live-checklist.md`). Owners check data processing agreements with the processors
  named (e.g. wineNET offers none publicly).
- Provider transfer bases (DPF vs. SCCs) were checked 2026-10-15; DPF certification is renewed
  yearly, so re-check at a release that touches the policy.
