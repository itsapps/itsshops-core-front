# Newsletter captcha is optional; user forms keep theirs

**Status:** Active
**Date:** 2026-10-29

## Context

Captcha was all-or-nothing via `CAPTCHA_SITE_KEY` / `CAPTCHA_SECRET_KEY`: set → newsletter,
register and recover all get hCaptcha. The newsletter form usually sits in a site-wide footer
dialog, so with it the base `/*` CSP allows hCaptcha on every page and the privacy policy must
disclose a third party for the whole site. Register/recover only load it on their own pages. A
shop with user accounts (Rosi Schuster) wanted the newsletter without captcha but not the
registration (each submit creates a Supabase account and sends a mail).

## Decision

- `features.newsletter: { captcha: false }` drops the widget from the newsletter form, the
  site-wide hCaptcha CSP and the newsletter entry in the privacy-policy captcha section. Default
  stays `true`, so existing shops are unchanged.
- The server side is a separate handler option, `createNewsletterSubscribeHandler({ captcha:
  false })` — function wrappers don't read the plugin config (same as `registrationFields`, which
  is also passed twice).
- Abuse guard instead: per-IP Netlify `rateLimit` in the customer's `newsletter-subscribe`
  wrapper. Acceptable because the flow is double opt-in with a generic success response — the
  worst case is confirmation mails to foreign addresses. Rejected: dropping the env keys entirely
  (would also unprotect register/recover).

## Consequences

- Both flags must be set together; a frontend-only `false` makes every signup fail the server's
  captcha check (when `CAPTCHA_SECRET_KEY` is set).
- Resolved `features.newsletter` is `{ enabled, captcha }`; template/TS code reads `.enabled`.
- Each such shop uses one more rate-limit rule (`workflows/netlify-plans.md`).
