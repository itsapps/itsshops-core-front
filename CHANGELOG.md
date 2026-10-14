# Changelog

Versions are git tags (no `v` prefix); customers pin them in `package.json`
(`github:itsapps/itsshops-core-front#<tag>`). **Upgrading** lists what a customer must change.
Release flow: `.claude/workflows/consuming-core-and-deploy.md` → "Release flow".

## Unreleased (3.0.0)

Pairs with **core-back 4.0.0** (`shippingMethod.packagingGroups`).

### Upgrading
- Wine packaging is configured as **packaging groups** (box types) instead of per-volume configs:
  enter `Weinverpackung` on every shipping method again (boxes by places + the bottle sizes that go
  in them, `perPlace` for sizes that share a place). Until then a method without groups prices wine
  by weight rates only. Release order for a live shop: core-back first (the old field is kept,
  hidden), enter the groups, then this frontend.
- Site CSS for `.shipping-info__table caption` may want to style the new
  `.shipping-info__table-note` (core: block, normal weight).

### Changed
- Packaging price: bottle sizes in one group share boxes, places summed and rounded up once
  (2 × 375 ml = 1 place; 4 × 750 + 4 × 375 → one 6-box). Unlisted sizes go into the next larger
  size's group (1 per place) instead of the weight fallback, which charged nothing when a method had
  no weight rates. Larger unlisted sizes make the method unavailable.
- Order snapshot `fulfillment.packagingLines[]`: `volumes[]` (the group's sizes) replaces `volume`.
- `shippingInfoModule`: one price table per group; caption lists the sizes, plus a note for sizes
  sharing a place (i18n `shippingInfo.packagingShared`).

- `wc-api`: tax rates are per country and stable, as in WooCommerce — `tax_lines[].rate_id` is a
  fixed id per tax country + rate (was the position in the order, 1, 2, …), `rate_code` is
  `AT-20` (was `TAX-20`); `line_items[].taxes[].id` / `shipping_lines[].taxes[].id` refer to the
  `rate_id`. `tax_lines[].id` stays 1, 2, …. Tell the ERP (wineNET) before deploying.

### Added
- Filter `formatVolumeList`.
- Function `order-meta-cleanup` (`createOrderMetaCleanupHandler`, scheduled): deletes `orderMeta`
  not updated for 30 days (`ORDER_META_RETENTION_DAYS`) — abandoned checkouts and the pre-payment
  copies of paid orders. Customers add a wrapper with `config.schedule: '@daily'`.

### Fixed
- Function logs no longer contain recipient email addresses (`to` dropped from the order, withdrawal
  and auth mail log lines) or the wc-api status-update body (only its keys).

## 2.2.0 — 2026-10-13

### Changed
- Shipping VAT rate: the rate whose items have the largest **gross goods value** (sum of shop
  prices). Was: the rate contributing the most VAT, which favoured 20 % — e.g. 39.00 at 13 % vs
  37.00 at 20 % gave 20 %, now 13 %. Only new orders; stored orders keep their shipping VAT.
- wc-api: debug log per request with the query param *names*, `dp` and the user agent (to see
  what the ERP sends; credentials are never logged).

## 2.1.0 — 2026-10-13

Pairs with **core-back 3.1.0** (`shippingInfoModule.paymentInfo`).

### Upgrading
- "Versand & Zahlung" page: move the payment-methods text from the separate rich-text module into
  the shipping module's new "Zahlungsarten" field, then remove the rich-text module.
- Shipping method titles in `shippingInfoModule` are now **h3** (under a new h2 "Versand"); site CSS
  that styled them via `.shipping-info h2` must also target `h3`.

### Added
- `shippingInfoModule`: optional payment text (`paymentInfo`) rendered as an h2 "Zahlung" section;
  heading outline h2 Zahlung · h2 Versand > h3 per method · h2 Gesetzliche Gewährleistung
  (i18n `shippingInfo.paymentHeading` / `shippingHeading`).

### Fixed
- `shippingInfoModule`: the warranty section gets the baseline spacing (the graphic sat directly on
  the heading); more space below headings than between content blocks.
- wc-api: a shipping line lists its tax rate with `0.00` on free shipping (as WooCommerce does)
  instead of an empty `taxes` array.

## 2.0.1 — 2026-10-13

### Fixed
- wc-api: amounts now follow WooCommerce's rounding exactly (see `.claude/architecture/wc-api.md` → "Rounding"):
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
