# Captcha only on account forms; collect forms use honeypot + fill time + rate limit

**Status:** Active
**Date:** 2026-11-04

## Context

Each public form had decided on captcha by itself: the core user forms (register, recover) got
hCaptcha because core built it in; the newsletter dropped it per shop
([newsletter-captcha-optional.md](newsletter-captcha-optional.md)); the withdrawal form never had
one ([withdrawal-never-lost-no-captcha.md](withdrawal-never-lost-no-captcha.md)). Rosi Schuster's
interest-list form (customer code, on an editor-chosen page) raised the question again, together
with a new constraint: shops run on the free Resend plan (100 mails/day), and every mail-sending
form shares that quota with order mails. The mail-spam risk of recover and the interest form is the
same (a mail to any typed address); what differs is what the form protects.

## Decision

- **Collect forms** (newsletter, withdrawal, customer forms like an interest list): honeypot,
  per-IP `rateLimit`, a minimum fill time where the form has a script, double opt-in where the law
  allows. **No captcha by default** — add one only when abuse shows up.
- **Account forms** (recover/register, later login if needed): hCaptcha from the start — they guard
  account access and account-existence probing, not just mail.
- **No daily mail cap** on collect forms. Rejected: under an attack the cap blocks real sign-ups
  as well, so it protects other mails at the cost of the people the form is for. Stop bots before
  they send instead.
- Rejected for now: a self-hosted proof-of-work captcha (ALTCHA) — privacy-friendly and free, but
  new core code; the fallback if bots get past the honeypot.

## Consequences

- Rule text: `architecture/commerce-and-netlify.md` → "Captcha or not". New forms follow it
  instead of whatever the template happened to ship with.
- Core's newsletter default is still `captcha: true` (older code, predates the rule); changing it
  would change every shop with `captchaSiteKey`, so it waits for a deliberate release.
- A deliberate, distributed attack on a collect form can still use up a free mail quota. Accepted
  as unlikely; parked hardening for the withdrawal form: `plans/withdrawal-spam-hardening.md`.
