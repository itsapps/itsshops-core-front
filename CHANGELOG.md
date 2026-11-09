# Changelog

Versions are git tags (no `v` prefix); customers pin them in `package.json`
(`github:itsapps/itsshops-core-front#<tag>`). **Upgrading** lists what a customer must change.
Release flow: `.claude/workflows/consuming-core-and-deploy.md` → "Release flow".

## Unreleased

### Fixed
- `itsshops sanity delete` also removes the types' drafts and release versions (reads with
  `perspective: 'raw'`; before, it saw published documents only and left drafts behind). The
  per-type line counts them. `query` / `count` still read published documents.

## 3.10.0

Pairs with **core-back 5.3.0** (`order.refunds` / `orderRefund`, orders `liveEdit`) — release
core-back first.

### Upgrading
- **Stripe webhook endpoint:** add the event **`refund.updated`** (test and live mode) next to
  `payment_intent.succeeded` and `charge.refunded`. Optional — without it a refund's status stays as
  of its creation (a refund that fails later still counts as refunded).
- Orders refunded before this version have no `refunds` until their next refund event; to fill
  them at once, run `syncOrderRefunds(paymentIntentId)` for their PaymentIntents (old refunds
  then show source `stripe`).

### Added
- **Refunds stored on the order** (`order.refunds`): rebuilt from Stripe by `syncOrderRefunds`
  (`lib/order-refunds.ts`) after `payment-refund`, on `charge.refunded` (before the status update)
  and on the new **`refund.updated`** webhook (pending → succeeded / failed / canceled; a failed
  one logs `Refund failed asynchronously`). Studio refunds are tagged
  `metadata.itsshopsSource = 'studio'`. Survives simultaneous webhooks (revision via the document
  endpoint, unchanged lists aren't written, conflicts retried).
- Refund mail text `emails.orderRefunded.textRemainder` (de, de informal, en): a full refund after
  partial ones names the remainder and the total.

### Changed
- **Refund mails state the right amount:** explicit `refundAmount` ?? the latest stored refund ??
  (full refund only) the grand total. The partial mail without any → 400; the full mail from
  "Send mail" while the stored refunds don't cover the total → 400. Their texts name the order.
- **Order number in every order mail subject** ("Bestellung 000015 versendet 📦", "Zahlung
  teilweise zurückerstattet – Bestellung 000015 💶", …). `subjectFor(ctx, mailType, order?)`
  fills `{{orderNumber}}`. Customer translation overrides of `emails.*.subject` don't get it.

### Fixed
- The plain-text part of the refund mails contained a literal `{{amount}}`.

## 3.9.0

Pairs with **core-back 5.2.0** (order snapshot type `orderItemBundleItem`, bundle validation) —
release core-back first.

### Added
- **Bundle VAT from its items:** a bundle's price is split over its items by their single sale
  prices (whole cents, last item takes the remainder) and each share is taxed at the item's own
  rate (variant → product → shop default). The bundle's own tax category is no longer used. VAT
  breakdown, shipping VAT (`dominantItemVatRate`) and coupons run over the parts (`vatParts`).
- **Bundle contents on the order:** `orderItem.bundle.items[]` (`variantId, productId, title,
  subtitle, sku, quantity` per bundle, `price` share of one bundle, `vatRate`, `vatAmount`). Mails
  list them under the bundle line (nested list), the invoice PDF one line per item with its VAT
  rate; the bundle's subtitle isn't repeated there. Older orders render as before.
- **wc-api:** a bundle is sent as its items, as ordinary line items with the same
  `product_id`/`variation_id` as when bought loose (bundle in `meta_data`: `_bundle_title`,
  `_bundle_sku`, `_bundle_variant_id`). Line ids are unique per order. Older orders unchanged.
- **Checkout reports cart changes** (every kind): after each calculation the stored cart takes the
  server's prices, capped quantities and bundle contents and drops unavailable items; a notice
  above the summary says what changed (`checkout.changes.*`, `role="status"`, event
  `checkout:cart-changed`). If something changed — or the total differs from the one shown —
  when paying (manual or Apple/Google Pay), the payment isn't confirmed and the customer is asked
  to confirm again.
- Resolved-only variant status `unavailable` (label `product.states.unavailable`, "Derzeit nicht
  erhältlich" / "Currently unavailable") for an active variant without any price (own or the
  product's) and a bundle with an unpriced item; `productPrice` renders nothing without a price.

- **Invoice PDF states VAT per rate:** one row per rate below the total ("13 % MwSt. von 122,81 €
  netto: 15,96 €", shipping included, from `totals.vatBreakdown`), and every line shows its rate
  ("0,75l, 2025 · 13 % MwSt."; bundle items each their own). Before, only the VAT total was
  printed (AT § 11 UStG / DE § 33 UStDV need the rate). New keys `emails.order.summaryVatRow`,
  `emails.order.vatRateShort`. Customer `invoicePdf` overrides don't get it automatically.

- Notify option `invoices: false` (`createNotifyHandler`, also `notify` of the webhook): for a
  shop whose invoices come from another system (e.g. wineNET) — the `orderInvoice` mail and
  `attachInvoice` are refused with 400, so no second invoice with core's numbering goes out. Pair
  with core-back `features.shop.invoices: false`.

### Changed
- A bundle with no items, a missing (archived/unpublished) or non-active item is sold out on the
  page (cards, product page, pickers, search, schema.org) and refused at checkout (was a 500 for
  a dangling item).
- A bundle's subtitle is always composed from its current items at checkout (the cart's is
  ignored). `addToCartButton` writes `data-bundle-key` for bundles.
- `resolveBundleWeight` uses an item's explicit weight first (like `resolveVariantWeight`).
- Subtitles composed by checkout (bundle items; loose lines without a client subtitle) use
  `addToCartButton`'s default format: wine "0,75l, 2025" (was "2025 · 750 ml"), options "Rot, L"
  (was "Farbe: Rot · Größe: L"). The volume unit comes from the new optional function config
  `units.volume` (default `l`) — set it in the payment wrapper when `itsshops.config` sets another
  unit. `formatVolumeMl` moved to `src/shared/format-volume.ts` (still exported from the package).
- `ValidatedCartItem.bundleItems[]` / `ValidatedCartItemResponse.bundleKey`: new fields (see
  `src/netlify/types/checkout.ts`, `src/shared/checkout-api.ts`).

### Fixed
- Apple Pay / Google Pay hung ("IntegrationError: The amount … is less than the total amount of
  the line items") when the wallet's calculation differed from the page's — another country's
  shipping or a price changed since the page calculated: the Elements amount now follows the
  sheet's total (restored on cancel), and a failing answer rejects the sheet instead of hanging.
- The partial-refund mail ("Teilbetrag von …") sent without `refundAmount` (e.g. from the Studio's
  "Send mail" action) stated the order total. It is now refused with 400 without an amount; core-back
  5.2.0's "Send mail" asks for it. The status dialog's refund flow always passed it.

### Removed
- Translation key `checkout.itemsUnavailable` and the checkout's `data-t-items-unavailable`
  (replaced by the change notice). `cart-store`'s `syncPricesFromServer` → `syncCartFromServer`.

### Upgrading
- Template overrides that branch on `product.status` and show nothing for other values must also
  handle `unavailable` (label `('product.states.' + product.status) | trans`), and a price printed
  without `productPrice` should be guarded with `{% if product.price %}`. Jurtschitsch: done in its
  `product/card.njk` + `container.njk`.
- Don't pass a custom `subtitle` to `addToCartButton` for a bundle — checkout composes it and would
  report a custom one as "contents changed".
- A custom checkout template that replaces `core/components/checkout.njk` needs the
  `[data-checkout-changes]` region and the `data-t-changes-*` labels (extending it is enough).
- Shops with bundles: every bundle item needs a price (own or its product's), or the bundle shows
  "Derzeit nicht erhältlich" and checkout refuses it.

## 3.8.0

Pairs with **core-back 5.1.1** (shows "Gratis-Versand Berechnung" on coupon shops).

### Added
- `@itsapps/itsshops-core-front/functions/utils`: re-exports existing Netlify helpers for
  customer-only functions — `sanityClient`, `fetchEmailSettings`, `buildEmailShopSettings`,
  `sendMail` (+ `SendMailParams`, `SendMailResult`), `validateEmail`, `normalizeEmail`,
  `prepareSubscription`, `confirmSubscription`, `serverT` (core translations only), `success`,
  `badRequest`, `errorResponse`, `methodNotAllowed`, `ErrorCode`, `log`. No new behaviour.
- `renderSimpleEmail({ locale, settings, headline?, text, cta?, footerLink? })` in the same export
  (+ types `RenderSimpleEmailInput`, `EmailShopSettings`): renders core's `SimpleEmail` in the
  shop's email layout to HTML, so customer mails look like core's own.

### Changed
- Privacy policy: on a site with newsletter but neither checkout nor `users`, the "E-Mail-Versand"
  section no longer mentions account confirmations (new key `privacyPolicy.email.textNewsletterOnly`,
  legal basis consent). `PRIVACY_POLICY_UPDATED` → 2026-11.
- The functions' `sanityClient` is created on first use instead of at import (like the Supabase
  and Stripe clients). Importing a function or helper no longer needs `SANITY_*` env; a missing
  env var now throws on the first Sanity call. Callers are unchanged.

### Fixed
- Free shipping: an unset `shopSettings.freeShippingCalculation` now means `beforeDiscount` (was
  `afterDiscount`) — checkout (`payment-create`), schema.org shipping details and `cms` settings.
  A coupon no longer pushes an order back under the free-shipping threshold printed on the
  "Versand & Zahlung" page. The Studio hid the field on coupon-only shops (fixed in core-back),
  so their value was unset.
- `payment-refund` rejects a non-integer `amount` with 400 (was passed on to Stripe).

### Upgrading
- Coupon shops with the field unset (Tinhof was, Jurtschitsch and grass-art likely) switch to
  "free shipping before discount". To keep the old behaviour, set "Gratis-Versand Berechnung" →
  "Nach Rabatt" in the Studio.

## 3.7.0

Pairs with **core-back 5.0.0** (`category.description` becomes `i18nText`).

### Changed
- The category page renders `category.description` through `paragraphs`: blank lines start a new
  `<p>`, single line breaks become `<br>`. The wrapper is now `<div class="category-description">`
  (was `<p class="category-description">`) — paragraph spacing (e.g. `.category-description > * + *`)
  is up to the customer CSS.

### Upgrading
- Restyle `.category-description` if your CSS assumed a `<p>`. Overrides that print
  `category.description` / `cat.description` directly keep working but show one paragraph — use
  `{{ … | paragraphs | safe }}` in a `<div>` for multiple paragraphs.
- Existing category descriptions need a data fix in the Studio (see core-back CHANGELOG).

## 3.6.4

### Changed
- A failed VinoFact request now **fails the build** instead of publishing the shop without wine
  data. Before, a network error only logged a warning and every variant rendered without VinoFact
  fields. Transient failures (network error, 30 s timeout, 429, 5xx, unparsable body) are retried
  once after 3 s; 401/other 4xx/GraphQL errors fail right away. Wine IDs VinoFact doesn't return
  are listed in a warning (the build continues).

### Upgrading
- Nothing to change. A VinoFact outage during a deploy now shows as a failed Netlify build (the
  previous deploy stays live) — retry the deploy once VinoFact is reachable.

## 3.6.3

### Fixed
- Since 3.6.1, `image` / `preload` / `imageSrcsetData` threw (`Cannot read properties of undefined
  (reading 'endsWith')`) for images that weren't run through a resolver — e.g. portable-text image
  blocks a customer renders straight from the query (`asset->{ _id, … }`, no `_ref`). The SVG
  check now accepts `_ref` or `_id` (Jurtschitsch `richContentModule` failed to build).
  The image functions' types say so too: they take a new `SanityImageInput` (asset with `_ref`
  or `_id`) instead of `ResolvedImage`, which is still accepted unchanged.
- Sanity images with an editor crop keep the crop's aspect ratio for `null`-height preset entries
  (`image`, `preload`, `imageSrcsetData`, incl. the `<img>` `width`/`height`). The ratio came from
  the uncropped asset, so `h` was wrong and Sanity cut that ratio out of the crop around the
  hotspot (Rosi Schuster: a landscape crop of a portrait photo rendered as a portrait slice). The
  source-width cap (3.6.1) now uses the cropped width too. Presets with `fit` still serve the
  whole image (crop and hotspot ignored) and keep the whole image's ratio.

### Upgrading
- Nothing to change. Cropped images may now render with a different (the intended) aspect ratio.

## 3.6.2

### Fixed
- Image preloads (`{% preload %}`, `{% staticPreload %}`) carry `fetchpriority="high"`. The `<img>`
  reuses the preload request, so its own `fetchpriority="high"` never applied and the hero preload
  ran at Low — behind lazy images near the viewport (Tinhof mobile: hero finished at ~4.5 s, Speed
  Index 3.9 s).

### Upgrading
- Nothing to change.

## 3.6.1

### Changed
- Sanity image `srcset` (`image`, `preload`, `imageSrcsetData`) stops at the source width: Sanity
  upscales on request, so preset widths above `asset.dimensions.width` are dropped and the source
  width is offered instead (same ratio and quality as the nearest dropped entry). Small uploads no
  longer download upscaled files. SVGs and images without dimensions keep every entry.

### Upgrading
- Nothing to change. Presets can now list large widths (e.g. up to 3000 for full-viewport heroes)
  without penalising small uploads. For `object-fit: cover` images, write `widths` as a media query
  (`'(max-aspect-ratio: 3/2) 150vh, 100vw'`), not `max()` — see `templates-and-assets.md` → Images.

## 3.6.0

### Added
- `features.newsletter: { captcha: false }` — newsletter form without hCaptcha (no widget, no
  site-wide hCaptcha CSP, privacy policy lists only register/recover); user forms keep it.
  `createNewsletterSubscribeHandler({ captcha: false })` skips the server check.
- Filters `sortByVintage` (newest vintage first, 0.75 l first, no vintage last) and
  `representativeVariant(productId)` (the variant that stands for a whole product: its first in
  `sortByVintage` order), also exported for `extensions` (e.g. `search.buildProductEntry`). Use
  `representativeVariant` instead of `findByProductId` where one card stands for a product —
  `findByProductId` returns whichever variant the query returned first (an old vintage, without a
  newer vintage's variant title).

### Changed
- `test-utils`: tests with side effects (real mails, Stripe test payments, orders / withdrawals /
  users written to the dataset) only run with `TEST_LIVE=1`; a plain `npm test` skips them.
  `orderNotifyTests({ getOrderId })` is optional and defaults to `TEST_ORDER_ID`. The webhook tests
  send no shop new-order mail.

### Fixed
- User URLs in `cms[locale]` (`loginUrl`, `registerUrl`, …) are `'#'` again when `users` is off
  (the check read the always-truthy `features.users` object).

### Upgrading
- Nothing to change (`newsletter: true` keeps the captcha). To drop it: set both flags above and
  add a per-IP `rateLimit` to the `newsletter-subscribe` wrapper. Code reading
  `coreConfig.features.newsletter` as a boolean must use `.enabled` (resolved shape is now
  `{ enabled, captcha }`).
- Customers with their own `sortByVintage` in `src/_config/filters.mts` (Tinhof, grass-art) can drop
  it and use core's (same behaviour); a customer filter of the same name still overrides core's.
- Integration tests: set `TEST_LIVE=1` for the full run (e.g. before a release). In
  `tests/integration/order-notify.test.ts` drop a "newest order" `getOrderId` (Tinhof, grass-art)
  and set `TEST_ORDER_ID` in `.env` to a test order with your own address instead.

## 3.5.4

### Fixed
- Sanity Presentation: the visual-editing overlay never connected ("Unable to connect to visual
  editing"). The esm.sh build of `@sanity/visual-editing@3.2.4` imports `@sanity/icons/<Icon>`
  subpaths that esm.sh returns 404 for. Core now bundles `@sanity/visual-editing` 6 itself; every
  build ships it at `/assets/visual-editing/` (JS + CSS), and preview renders load it from there.

### Upgrading
- Nothing to change. Studios should be on `sanity` v6 (overlay and Presentation tool talk over a
  versioned protocol; tested with 6.9.2).

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
