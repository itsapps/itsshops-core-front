# Draft-preview session in sessionStorage + header, not a cookie or URL token

Status: accepted
Date: 2026-11-12

## Context

The `preview` function rendered drafts for anyone who knew the URL. Gating it uses Sanity's
preview secret (Presentation `previewMode` → `preview-enable` validates it once per Presentation
session); the result has to be carried to every later preview request. The preview runs inside the
Studio's iframe, i.e. **cross-site** (Studio and frontend are different Netlify sites).

Tried on Tinhof staging (2026-11-12): an `HttpOnly; Secure; SameSite=None; Partitioned` cookie set by
`preview-enable` worked in Firefox, but **Safari dropped it** (it blocks every cookie in a cross-site
iframe; `Partitioned` doesn't help) → "session expired" on every preview.

A signed `?pt=` URL token was the planned fallback. Presentation's code shows it would be lost
constantly: the Refresh button sets the iframe `src` to the plain preview URL, and document
switches go through `presentation/navigate` → the overlay's `replaceState` — neither carries extra
query params.

## Decision

`preview-enable` answers a small page that stores the signed token (1 h, HMAC with
`PREVIEW_SESSION_SECRET`) in the iframe's **sessionStorage** and replaces itself with the preview
path. `preview` answers a request **without** the `x-preview-session` header with a loader page (no
draft content) that re-fetches the same URL with the token as that header and `document.write`s
the result. sessionStorage is available in Safari's cross-site iframes (partitioned per top-level
site) and stays with the iframe across reloads, Refresh and document switches. One mechanism for all
browsers — no cookie path kept.

## Consequences

- Works in Safari and Firefox (re-tested on Tinhof staging, 2026-11-12).
- Two requests per preview load (the loader is tiny).
- The token isn't `HttpOnly`: a script on the shop origin inside that iframe could read it. It only
  grants draft reads for ≤ 1 h — accepted.
- The loader's CSP can only be `frame-ancestors`: `document.write` keeps the document and its CSP,
  so anything stricter would also apply to the rendered page.
- `preview-enable` lives at `/api/preview-enable`: under `/api/preview/` it would collide with the
  `/api/preview/:locale` wrapper path (home-page preview).
