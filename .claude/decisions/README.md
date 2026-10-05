# Decisions (ADRs)

One file per non-obvious decision, named `<slug>.md` (solo project — no ticket-number collision
convention needed, unlike the vinofacts workspace this pattern came from).

Format: `# <title>`, then `Status` / `Date`, then `Context` / `Decision` / `Consequences`.

Only create an ADR when the rationale is actually evidenced (a real finding, a tradeoff you
deliberately chose) — never a speculative or invented "why". Record a decision here when future-you
would otherwise re-litigate it: why a subsystem is shaped a certain way, why an obvious-looking
alternative was rejected, a constraint discovered the hard way.

- [css-shipped-via-dist-no-exports.md](css-shipped-via-dist-no-exports.md) — CSS consumed via `dist/`
  paths; `exports` subpaths removed (postcss-import ignores `exports`).
- [payment-permissions-policy-checkout-only.md](payment-permissions-policy-checkout-only.md) — Stripe
  Apple/Google Pay `payment` policy scoped to the checkout route (least privilege).
- [preview-fetches-all-documents.md](preview-fetches-all-documents.md) — preview fetches every doc
  (for cross-ref resolution) but renders only the previewed one.
- [withdrawal-link-as-menu-system-link.md](withdrawal-link-as-menu-system-link.md) — Widerruf link is
  a `system` menu link + guaranteed footer fallback, not a page module (fixed route, CSP, legal).
- [noindex-pages-minimal-head.md](noindex-pages-minimal-head.md) — page-level `noindex` pages skip
  canonical/hreflang/og/twitter + WebSite/Organization JSON-LD (keyed on the page flag, not site-wide).
