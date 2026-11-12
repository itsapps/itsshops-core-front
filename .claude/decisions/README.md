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
- [preview-session-in-sessionstorage.md](preview-session-in-sessionstorage.md) — draft-preview
  session token in the iframe's sessionStorage + header (Safari drops cross-site iframe cookies; a
  URL token is lost on Presentation reloads).
- [preview-fetches-all-documents.md](preview-fetches-all-documents.md) — preview fetches every doc
  (for cross-ref resolution) but renders only the previewed one.
- [visual-editing-bundled-not-cdn.md](visual-editing-bundled-not-cdn.md) — Presentation overlay
  bundled into core's `dist/` and shipped by every build, not loaded from esm.sh.
- [newsletter-captcha-optional.md](newsletter-captcha-optional.md) — newsletter may run without
  hCaptcha (`features.newsletter.captcha: false` + rate limit); user forms keep it.
- [withdrawal-link-as-menu-system-link.md](withdrawal-link-as-menu-system-link.md) — Widerruf link is
  a `system` menu link + guaranteed footer fallback, not a page module (fixed route, CSP, legal).
- [noindex-pages-minimal-head.md](noindex-pages-minimal-head.md) — page-level `noindex` pages skip
  canonical/hreflang/og/twitter + WebSite/Organization JSON-LD (keyed on the page flag, not site-wide).
- [order-thanks-summary-from-session-snapshot.md](order-thanks-summary-from-session-snapshot.md) —
  thanks-page summary from a sessionStorage snapshot; no server fetch of `orderMeta` (the link must
  not become an access key to personal data).
- [payment-methods-not-restricted-in-core.md](payment-methods-not-restricted-in-core.md) — Stripe
  Dashboard decides payment methods; delayed methods (SEPA) unsupported by convention, not in code.
- [no-first-last-name-guessing.md](no-first-last-name-guessing.md) — express checkout stores only the
  full name; the Winenet export splits at export time.
- [formality-env-and-overlays.md](formality-env-and-overlays.md) — "Sie" base + "Du" overlays switched
  by `SHOP_FORMALITY` (env, both runtimes), not a Sanity toggle.
- [withdrawal-never-lost-no-captcha.md](withdrawal-never-lost-no-captcha.md) — unmatched withdrawals
  are stored + confirmed + flagged; no captcha, rate limit + honeypot instead.
- [captcha-only-for-account-forms.md](captcha-only-for-account-forms.md) — captcha only on account
  forms; collect forms get honeypot + fill time + rate limit, no daily mail cap.
- [legal-texts-generated-from-settings.md](legal-texts-generated-from-settings.md) — withdrawal
  instructions + model form built from settings by one builder for page and mail; wording verbatim.
- [privacy-policy-generated.md](privacy-policy-generated.md) — privacy policy built from features,
  services and settings; "no tracking" always, carrier as category, wineNET hardcoded, extras by editor.
- [legal-graphic-unaltered-png.md](legal-graphic-unaltered-png.md) — harmonised warranty notice as
  pre-sized lossless PNGs + srcset, not eleventy-img/WebP.
- [cli-sanity-delete-guarded.md](cli-sanity-delete-guarded.md) — `itsshops sanity delete` needs a
  typed dataset-name confirmation (`--yes` for scripts) and runs as one all-or-nothing transaction.
- [production-pins-core-tags.md](production-pins-core-tags.md) — production pins core by unprefixed
  semver tag (semver vs. last tag, `CHANGELOG.md`), customers tag each production release.
- [wc-api-mirrors-woocommerce.md](wc-api-mirrors-woocommerce.md) — wc-api reproduces WooCommerce's
  amounts/rounding from its source (net `price`, per-line tax, shipping tax separate); ERP quirks go
  to the vendor, no deviating workarounds.
- [shipping-vat-largest-gross-goods-value.md](shipping-vat-largest-gross-goods-value.md) — shipping
  VAT rate = rate with the largest gross goods value (owner's choice; not most VAT, not net, no split).
- [wine-packaging-groups-one-size-per-group.md](wine-packaging-groups-one-size-per-group.md) — wine
  packaging by box types; each bottle size in one group, unlisted sizes → next larger size's group
  ("nur für" boxes / 3D box packing rejected).
- [sanity-backups-github-artifacts.md](sanity-backups-github-artifacts.md) — production dataset backed
  up as `age`-encrypted GitHub artifacts per customer (daily documents-only + weekly full, free
  quota); Git LFS rejected.
- [shop-new-order-mail-not-bcc.md](shop-new-order-mail-not-bcc.md) — shop gets its own new-order mail
  (shop locale, no customer-only legal parts, Reply-To customer, Studio link) instead of a BCC.
- [schema-org-merchant-listings.md](schema-org-merchant-listings.md) — shipping per offer priced by
  checkout (Organization `ShippingService` rejected), return policy on Organization + each offer,
  never a `Product` without offers, no invented dates / handling time.
- [integration-tests-side-effects-opt-in.md](integration-tests-side-effects-opt-in.md) — `test-utils`
  tests that mail, pay or write data only run with `TEST_LIVE=1` (kept, not deleted: only
  end-to-end check of the order path); order mails go to a fixed `TEST_ORDER_ID`.
- [image-sizes-follow-editor-crop.md](image-sizes-follow-editor-crop.md) — `[w, null]` presets use
  the cropped area's ratio; `fit` presets ignore the crop; uncropped URLs kept byte-identical.
- [image-functions-accept-raw-assets.md](image-functions-accept-raw-assets.md) — image functions take
  `SanityImageInput` (`_ref` or `_id`) so raw portable-text image blocks render; not normalised only
  in the data layer.
- [vinofact-failure-fails-build.md](vinofact-failure-fails-build.md) — a failed VinoFact request
  fails the build (one retry for network/timeout/429/5xx); missing wine IDs only warn.
- [bundle-vat-split-by-single-prices.md](bundle-vat-split-by-single-prices.md) — a bundle has no
  tax category; its price is split over its items by single prices, each share at the item's rate.
- [wc-api-bundles-as-item-lines.md](wc-api-bundles-as-item-lines.md) — the wc-api sends a bundle as
  its items (loose `product_id`s), not WC Product Bundles' parent + €0 children.
- [checkout-reports-cart-changes.md](checkout-reports-cart-changes.md) — no auto-deploy on publish;
  checkout syncs the cart, reports changes and re-asks before paying.
- [invoices-issued-elsewhere-switch.md](invoices-issued-elsewhere-switch.md) — `invoices: false`
  (both cores) for shops whose invoices come from an ERP; no second invoice from core.
- [bundle-packaging-with-the-cart.md](bundle-packaging-with-the-cart.md) — bundle bottles are boxed
  with the cart; non-wine items pay weight rates on top (revisit with a mixed bundle).
- [order-refunds-rebuilt-from-stripe.md](order-refunds-rebuilt-from-stripe.md) — `order.refunds`
  is rebuilt from Stripe's list by core-front only (idempotent); revision via `getDocument`.
- [mail-history-entries-after-send.md](mail-history-entries-after-send.md) — every customer order
  mail appends a `mail` history entry after a successful send; the customer message lives there only.
- [theme-switch-in-core.md](theme-switch-in-core.md) — light/dark switch gated by `colorScheme`,
  fixed label + `aria-pressed`, own `themeBgColorDark`, scrollbar colours only in `theme.css`.
- [focus-ring-customer-owned.md](focus-ring-customer-owned.md) — the global `:focus-visible` ring
  is customer CSS (starter), not core: it's design, and a layered core rule couldn't enforce it.
