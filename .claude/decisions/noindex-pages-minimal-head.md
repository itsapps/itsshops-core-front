# Page-level noindex pages get a minimal head

**Status:** Active
**Date:** 2026-10-05

## Context

System pages (`pages/standard/`: 404, checkout, withdrawal, login, newsletter/user flows) set
`noindex: true` in front matter. They used to render the full head anyway: canonical, og:*,
twitter:* and the WebSite + Organization JSON-LD. A canonical on a noindex page sends search engines
mixed signals, and on the 404 page it was outright wrong (`/de/404/` is served for any missing URL).
Nobody shares these pages, and crawlers don't index them, so the share tags were dead weight.

## Decision

- `core/head/seo.njk`: when the page's own `noindex` is set, skip canonical, hreflang, og:* and
  twitter:*. Keep title, description, robots.
- `core/head/schemas.njk`: same condition skips the WebSite + Organization JSON-LD. Page-pushed
  custom schemas (`getBundle "schemas"`) still render.
- Keyed on the **page** flag only, not `coreConfig.doIndexPages`. Staging/preview/local builds are
  noindex site-wide but still render the full head, so share tags stay testable there.

Rejected: emitting WebSite/Organization only on the home page. Page schemas (Product, WebPage,
breadcrumbs) reference the Organization by `@id` (`#organization`), so indexable pages keep the full
Organization block to stay self-contained.

## Consequences

- A new system page that sets `noindex: true` automatically gets the minimal head.
- Related fix in the same change: `og:image:alt` uses the share image's own `alt` and is omitted
  when that's empty (it used to repeat the page title).
- `og:locale` intentionally stays the bare locale (`de`/`en`), not the OG `de_AT` form — chosen by
  the maintainer; don't "fix" it without asking.
