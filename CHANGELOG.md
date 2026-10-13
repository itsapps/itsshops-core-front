# Changelog

Versions are git tags (no `v` prefix); customers pin them in `package.json`
(`github:itsapps/itsshops-core-front#<tag>`). **Upgrading** lists what a customer must change.
Release flow: `.claude/workflows/consuming-core-and-deploy.md` → "Release flow".

## 2.0.1 — 2026-10-13

### Fixed
- wc-api: amounts now follow WooCommerce's rounding exactly (see `docs/wc-api.md` → "Rounding"):
  - line-item `price` is the net unit price (unrounded number). It was the gross price, so wineNET
    added VAT twice (order total 112.02 instead of 100).
  - `tax_lines[].tax_total` no longer includes shipping tax (it is only in `shipping_tax_total`);
    with paid shipping the ERP counted it twice.
  - line taxes are rounded per line and add up to `tax_lines` / `total_tax`.

## 2.0.0 — 2026-10-12

First tagged release since 1.4.1. Pairs with **core-back 3.0.0**.

### Upgrading from 1.4.1
- Sender email/name moved from config to the Sanity settings.
- Auth: the `userPaths` param was removed.
- German checkout permalink default changed from `warenkorb` to `kasse` (set
  `permalinks.de.checkout` to keep the old URL).
- Order email legal needs core-back 3.0.0 and its content: withdrawal-instructions and
  shipping-info modules, a "Versand & Zahlung" page as `shopSettings.shippingInfoPage`, the
  required settings fields. See `.claude/workflows/go-live-checklist.md`.

### Added
- Legally complete order emails: §13a withdrawal, "Sie"/"Du" (`SHOP_FORMALITY`), order details,
  generated withdrawal instructions, warranty notice, shipping info; withdrawal link in mails.
- Legal modules: withdrawal policy, shipping info (methods serving the default country first),
  compact checkout warranty notice.
- Order thanks page: order summary and status-specific content.
- Newsletter subscription via dialog; hCaptcha (localized) on newsletter/user/withdrawal forms.
- Products: specifications, plain-text description, variant prices, price per liter, variant
  option sort order; vinofact quality-grade filter and certificate images.
- Product filter panel: opt-in modal dialog mode. Categories sorted by `sortOrder`.
- Menus and rich text: system-page links (withdrawal link guaranteed in menus).
- Gallery/lightbox; configurable minimum thumbnail count.
- Shared token-driven form system; CSS-mask cart icons; cart subtotal note.
- `llms.txt`; minimal head on noindex pages; `og:image:alt`.
- CLI: `-e` env file option, guarded `itsshops sanity delete`.

### Changed
- Payment `Permissions-Policy` scoped to the checkout route (disabled without checkout).

### Fixed
- wc-api: refund/status transitions (no "shipped" after refund, cancel or withdrawal).
- Netlify functions failing to load (lodash/merge subpath import).
- Page/post slug queries and URLs; preview loads the whole document set.
- Double submits of user, withdrawal and newsletter actions.
