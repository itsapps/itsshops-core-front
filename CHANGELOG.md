# Changelog

Versions are git tags (no `v` prefix); customers pin them in `package.json`
(`github:itsapps/itsshops-core-front#<tag>`). **Upgrading** lists what a customer must change.
Release flow: `.claude/workflows/consuming-core-and-deploy.md` → "Release flow".

## 3.5.3

Pairs with **core-back 4.3.0** (`features.shop.checkout` hides checkout-only shop settings).

### Changed
- Withdrawal form (`order-withdraw` pages, `orderWithdrawUrl`, the guaranteed "Vertrag widerrufen"
  menu link) only with `features.shop.checkout` — was `shop.enabled`. Without checkout nothing is
  bought online, so there is nothing to withdraw from. Shops with checkout are unchanged.
- `privacyPolicyModule` without checkout: the email section no longer names order confirmations /
  shipping updates, the account section drops "orders are kept for the statutory retention period"
  (new keys `privacyPolicy.email.textNoShop`, `privacyPolicy.account.textNoShop`; de, de informal, en).

### Upgrading
- Shop without checkout: the `/de/widerruf` page disappears — remove menu links to it. Customer
  translation overrides of `privacyPolicy.email.text` / `account.text` need the `textNoShop` variant.

## 3.5.2

### Fixed
- schema.org `sku` fallback was `productVariant-<uuid>` (51 chars, Google allows 1–50) — now the
  bare id, capped at 50.

### Changed
- Return policy also on each offer (`offers.hasMerchantReturnPolicy`): Google's Rich Results Test
  doesn't apply the Organization's policy to offers. It gets `refundType: FullRefund` (statutory
  withdrawal refunds the price).
- `Organization` gets `image` from `settings.defaultShareImage` (Google's local-business check).

## 3.5.1

### Changed
- schema.org category `ItemList`: item names include the variant label ("… 0,75 l · 2022"), like
  the variant in a `ProductGroup` — vintages / sizes of one wine no longer share a name.

## 3.5.0

### Added
- schema.org for Google merchant listings: `shippingDetails` per offer (one per delivery method,
  priced by checkout's shipping calculation, delivery time parsed from the method's text) and a
  shop-wide `hasMerchantReturnPolicy` on the `Organization` (14 days, by mail, fees from
  `returnShippingBorneBy`). Only with `features.shop.checkout`.
- Product brand falls back to `settings.siteTitle`, then `company.name` (fixes "no global
  identifier").
- Products with sibling variants are marked up as a `ProductGroup` (multi-page variants).
- `weight` on `ResolvedVariant` and `ResolvedBundleItem.variant`; `product.description` on
  `ResolvedVariant`.

### Changed
- No `priceValidUntil` on offers. Availability follows checkout (sold out / coming soon →
  `OutOfStock`; stock only with the stock feature). Variants without a price get no product markup.
- Category pages list plain `ListItem`s instead of `Product`s with offers.
- Checkout: weight rules moved into `resolveVariantWeight` / `resolveBundleWeight`
  (`netlify/lib/shipping.ts`), behaviour unchanged; shipping functions take a narrower
  `ShippingCartItem`.

### Upgrading
- Check per shop before release — the markup publishes them to Google: shipping methods (countries,
  rates), the delivery time on each delivery method (must contain the days as numbers, e.g.
  "2 – 5 Werktage" — otherwise Google ignores the shipping details), `company.name`, return
  address and `returnShippingBorneBy`.
- After going live: Rich Results Test on a product page, then "Validate fix" in Search Console.

## 3.4.1

### Fixed
- `privacyPolicyModule`: "recent searches" is listed under browser storage only when site search
  is configured (`extensions.search`); a site that stores nothing gets one sentence ("no cookies,
  no browser storage") instead of an empty list. The last list item always ends with a full stop.

## 3.4.0

### Added
- `config.redirects` (`{ from, to, status?, force? }[]`): extra Netlify redirects (e.g. old URLs
  after a relaunch), written into `_redirects` before the 404 catch-alls; default 301, not forced.
  Validated at build time.

## 3.3.0

### Added
- Shop new-order mail: button "Bestellung im Studio öffnen" linking to the order
  (`<SANITY_STUDIO_URL>/<defaultLocale>/intent/edit/id=…;type=order`, also in the plain-text part);
  omitted when `SANITY_STUDIO_URL` isn't set for the functions. Template prop `studioOrderUrl`.

## 3.2.1

### Fixed
- Shop new-order mail (`ShopOrderEmail`): no footer — it only repeated the shop's own company
  details.

## 3.2.0

Pairs with **core-back 4.2.0** (studio "message to customer"). Release core-front first: an older
frontend ignores the message (it's still stored on the history entry).

### Added
- `order-notify` / `sendOrderNotification`: optional `customerMessage` (plain text, max 2000 chars,
  `CUSTOMER_MESSAGE_MAX_LENGTH`) rendered below the intro text in `OrderEmail` and `SimpleEmail`
  (new `customerMessage` prop; `CustomerMessage` email component) and appended to the plain-text
  part. Custom email template overrides can read the new prop.
- **New-order mail to the shop inbox** (`sendShopOrderNotification`, template `ShopOrderEmail`):
  own wording in the shop's `defaultLocale`, customer contact (email, phone, language) up front,
  Reply-To = customer, no warranty image / withdrawal instructions. Webhook option
  `shopNotification` (default on; `false` off; `{ template }` override). `sendMail` takes `replyTo`.

### Changed
- The payment webhook no longer BCCs the shop on the customer's order confirmation — the shop gets
  the new-order mail above instead.

## 3.1.0

Pairs with **core-back 4.1.0** (`privacyPolicyModule`).

### Upgrading
- Privacy page: add `privacyPolicyModule` to the backend's page `modules` array, put it on the
  privacy page (after `pageHeader`), disable the old text; add an extra section per external
  service the shop embeds itself. Site CSS: lay out `.module--privacyPolicyModule` like the other
  legal modules. `EMAIL_PROVIDER` / `MAILGUN_USE_EU_REGION_URL` / `WC_CONSUMER_KEY` must be
  visible to the build.

### Added
- `privacyPolicyModule`: generated privacy policy (Art. 13 GDPR) — sections follow features and
  services; builder `shared/privacy-policy.ts`, filter `privacyPolicy`, strings `privacyPolicy.*`
  (de, de informal, en).
- `CoreConfig.services` (`emailProvider`, `mailgunEu`, `wcApi`) read from env at build time.

## 3.0.0

Pairs with **core-back 4.0.0** (`shippingMethod.packagingGroups`).

### Upgrading
- Wine packaging is configured as **packaging groups** (box types) instead of per-volume configs:
  enter `Weinverpackung` on every shipping method again (boxes by places + the bottle sizes that go
  in them, `perPlace` for sizes that share a place). Until then a method without groups prices wine
  by weight rates only. Release order for a live shop: core-back first (the old field is kept,
  hidden), enter the groups, then this frontend.
- Site CSS for `.shipping-info__table caption` may want to style the new
  `.shipping-info__table-note` (core: block, normal weight).
- `wc-api`: tax rates are per country and stable, as in WooCommerce — `tax_lines[].rate_id` is a
  fixed id per tax country + rate (was the position in the order, 1, 2, …), `rate_code` is
  `AT-20` (was `TAX-20`); `line_items[].taxes[].id` / `shipping_lines[].taxes[].id` refer to the
  `rate_id`. `tax_lines[].id` stays 1, 2, …. Tell the ERP (wineNET) before deploying.
- Optional: add the scheduled `order-meta-cleanup` function wrapper (see Added).

### Changed
- Packaging price: bottle sizes in one group share boxes, places summed and rounded up once
  (2 × 375 ml = 1 place; 4 × 750 + 4 × 375 → one 6-box). Unlisted sizes go into the next larger
  size's group (1 per place) instead of the weight fallback, which charged nothing when a method had
  no weight rates. Larger unlisted sizes make the method unavailable.
- Order snapshot `fulfillment.packagingLines[]`: `volumes[]` (the group's sizes) replaces `volume`.
- `shippingInfoModule`: one price table per group; caption lists the sizes, plus a note for sizes
  sharing a place (i18n `shippingInfo.packagingShared`).

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
