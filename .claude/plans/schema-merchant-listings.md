# Plan — schema.org product markup for Google merchant listings

Status: **implemented** (2026-10-19), uncommitted, not released — steps 1–5 and 7 done (tests:
`src/schema/__tests__/schema.test.ts`; Tinhof development build checked: 162 `ProductGroup` + 16
`Product` pages, every in-stock offer has shipping, development already has the delivery time).
Remaining: Rich Results Test (step 6, needs a public URL — staging), then step 8. Added during
implementation: a variant's `name` in the group = title + label ("… 0,75 l · 2022"), as variant
titles are mostly just the product title. Planned Decided 2026-10-19: shipping only on buyable
offers, bundles included, `weight` added to the variant (and bundle-item) projection, all steps in
one release (core 3.5.0); after review: brand = `siteTitle` → `company.name`, `comingSoon` →
`OutOfStock`, no made-up `validFrom`, one shipping entry per method (all its countries). After the
second review (2026-10-19): customer-paid returns = `ReturnFeesCustomerResponsibility`, shipping
cost via checkout's `resolveShippingMethods`, availability = checkout's rule, no offers on category
pages, `deliveryTime` is required by Google. After the third review (2026-10-19): no offer without
a price, shipping per offer (always — not at Organization level, see step 3), variants as
`ProductGroup` (step 2b) in 3.5.0, `deliveryTime` set in development for the staging test. After
the fourth review (2026-10-19): never a `Product` without offers (category list = plain
`ListItem`s, a price-0 variant page gets no product markup), `returnPolicyCountry`, narrow
shipping input type instead of a fake `ValidatedCartItem`, check `handlingTime` in the Rich Results
Test. Origin: Google Search Console mails for tinhof.at
after the sitemap upload. "Händlereinträge" (merchant listings) found 4 issues and "Produkt-Snippets"
(product snippets) found 2. All are **non-critical**: product pages stay indexed and eligible, and
the warnings only block extras (shipping and returns in the result, stars).

| Search Console warning | Cause in `src/schema/index.ts` | Step |
|---|---|---|
| No global identifier (GTIN or brand) | `brand` only from `variant.manufacturers[0]`; shops without manufacturers have none | 1 |
| `validFrom` missing (offers) | Unclear — Google lists `validFrom` as a recommended Offer field of its own, so removing the made-up `priceValidUntil` may not clear it | 2 |
| `shippingDetails` missing (offers) | No shipping in the markup | 3 |
| `hasMerchantReturnPolicy` missing (offers) | No return policy in the markup | 4 |
| `review` / `aggregateRating` missing | No reviews exist | — **won't fix** (fake ratings break Google's guidelines; harmless warning) |

Applies to every shop with product pages once it upgrades core: Tinhof, Jurtschitsch, grass-art
(full); rosi_schuster (`checkout: false`, so brand only, see step 5); itsapps, fem_innenarchitektur
and yogamax have no product markup.

## Steps

### 1. Brand fallback
`brand` = first manufacturer, else `settings.siteTitle` (documented as the brand name), else
`settings.company.name` (the legal name, last resort) — `{ '@type': 'Brand', name }`. Wineries
sell their own brand, so no GTIN/EAN is needed (Google wants GTIN *or* brand). A shop that sells
third-party goods should set `manufacturers`. Applies to product pages only (on the `ProductGroup`
when the product has variants, step 2b — Google doesn't need it repeated per variant).

### 2. `priceValidUntil` / `validFrom`; no products on category pages
Remove `priceValidUntil` from `buildOffer`. It isn't a real end date, and Google says to set it only
when the price really expires. Re-test (step 6). If the `validFrom` warning stays, **accept it**
(non-critical) — don't publish a made-up date (`_updatedAt` changes on any edit, not only on price
changes).

Category `ItemList`: no `Product` entries at all — plain `ListItem`s (`position`, `url`, `name`;
Google's summary-page list format). Google supports product rich results only on single-product
pages and recommends no product markup on listing/category pages; offers there could raise the same
merchant-listing warnings for category URLs, and a `Product` **without** offers is worse: Google
treats a `Product` with none of `offers` / `review` / `aggregateRating` as an invalid item (a
critical error, not a warning).

### 2a. Availability = what checkout accepts
Today `buildOffer` derives `availability` from `stock` only, so a `soldOut` variant with
`stock: null` is published as `InStock`. Mirror `cart-validator.ts` (line ~50–68) in one helper:
- `status !== 'active'` (`soldOut`, `comingSoon`, `archived`) → `OutOfStock`
- else, only when `features.shop.stock` is on and `stock` is a number: `stock > 0` → `InStock`,
  else `OutOfStock` (checkout ignores stock when the feature is off)
- else `InStock`

**No price → no offer.** The data layer falls back to `price: 0` (`data/resolve/variants.ts`,
`variant.price ?? product.price ?? 0`); checkout rejects a variant without a price, and Google
requires a price > 0 for merchant listings. A variant with price `0`/unset gets no `Offer` — and,
since a `Product` without offers is an invalid item (step 2), **no product markup on its page**
(neither `Product` nor `ProductGroup`; the breadcrumb stays). As a sibling on other variant pages
it stays a URL-only stub (step 2b), which Google accepts.

`shopSettings.stockThreshold` plays no role (no template or script uses it).

### 2b. Variants as `ProductGroup`
Today a variant page's `Product` carries the variant's offer **plus one offer per sibling** (other
vintages / bottle sizes, different prices). To Google several offers on one `Product` mean the same
item offered several times — the page's price and the markup's prices don't match. Use Google's
multi-page variant model instead (each variant has its own URL, so it qualifies; no single canonical
group URL needed):
- **Product without siblings** (or none with a page in `ctx.products`): a plain `Product` as today,
  with its own offer only.
- **With siblings:** one `ProductGroup` per page — `@id` `${baseUrl}#product-${product._id}`,
  `name` = `variant.product.title`, `productGroupID` = `product._id`, `brand` (step 1),
  `description` = the product's own description first (the variant's SEO / description can be
  vintage-specific), else today's chain. **Gap:** `ResolvedVariant.product` is only
  `{ _id, title }` — add `description` (`ctx.resolveString(product.description)`, already read in
  `data/resolve/variants.ts` ~line 413). **No `url`** on the group (Google: only for single-page
  setups). `hasVariant`: the page's own variant as a full `Product` (`name`, `url`, `sku`, `image`,
  `additionalProperty`, `inProductGroupWithID` = `product._id` (Google-recommended),
  `offers` with shipping) and each sibling as a URL-only stub
  `{ '@type': 'Product', url }`. Google wants this markup self-contained on every variant page.
- **`sku`:** Google wants a unique id per variant (`sku` or `gtin`); `sku` is `''` when unset →
  fall back to the variant's `_id`.
- **`variesBy`:** only Google's six values are supported (`color`, `size`, `suggestedAge`,
  `suggestedGender`, `material`, `pattern`). Wines: `https://schema.org/size` when the siblings
  differ in `volume` (`size` on the variant = "0,75 l"). Vintage has no value → not in `variesBy`;
  it stays in the variant's `name` and `additionalProperty`. Non-wine option groups aren't mapped
  (no reliable link from an option group to color/size) → `variesBy` omitted.
- Side effect: shipping (step 3) is computed for the page's variant only, not per sibling.
- Breadcrumb unchanged.

### 3. `shippingDetails` per offer
**Why per offer, not at Organization level.** Google also recommends a global shipping policy on
the Organization (`hasShippingService` → `ShippingService` → `ShippingConditions` by destination,
weight range, item-count range, order value; the cheapest matching condition wins). It can't express
packaging groups (2 × 375 ml per place, own boxes for 1500/2000 ml) without approximations that
undercut what checkout charges, and product-level markup overrides it anyway. Either way Google shows
the cost of buying **that one item** — the Organization level would not make shipping look cheaper.
Per offer publishes checkout's exact one-item cost. Decided: per offer, always (no per-shop switch).

One `OfferShippingDetails` per delivery method: the cost of buying **this one item alone** (qty 1),
`shippingDestination` = one `DefinedRegion` per country of the method (`addressCountry`; a method
has one price for all its countries), `shippingRate` (EUR, gross; prices are cents → `/100`), and
`deliveryTime`.
- **Data:** `cms[locale].shippingMethods` (`ResolvedShippingMethod`: `countries`, `rates`,
  `packagingGroups`, `freeShippingThreshold`, `deliveryTime`) and
  `shopSettings.freeShippingCalculation`. Pass them into `SchemaContext` from the `pageSchema`
  filter (`src/filters/index.ts`), as `products` is now.
- **Cost:** call checkout's **`resolveShippingMethods`** (`src/netlify/lib/shipping.ts`) with
  `[variantToCartItem(v)]`, `subtotal = price`, `discount = 0`, `freeShippingCalculation` and the
  locale, and keep the `methodType === 'delivery'` results. It already handles packaging groups vs
  weight rates, wine + non-wine, "method not applicable" and free shipping — don't rebuild that
  branching. Adapters next to the schema code:
  - `ResolvedShippingMethod → SanityShippingMethodResult`: `title`/`deliveryTime` wrapped as
    `[{ language: locale, value }]`; rates with `maxWeight: null` are **dropped** (core-back
    requires `maxWeight`; in checkout's `findShippingRate` a null rate sorts as 0 and matches only
    a 0 kg cart, so `Infinity` would publish a rate checkout doesn't charge for real weights).
  - `variantToCartItem(variant)` (qty 1) with `kind`, `wine.volume`, `weight`,
    `bundleItems[].{kind, wine, weight, quantity}`. Note `ResolvedBundleItem.variant` differs from
    the checkout shape: flat `volume` (→ `wine: { volume }`), `kind: string` (narrow it), no weight.
    This is only part of a `ValidatedCartItem` (no `vatRate`, `vatAmount`, `title`, …) — don't
    cast: give `resolveShippingMethods` / `calcWinePackagingCost` / `calculateCartWeight` a narrow
    input type (e.g. `ShippingCartItem = Pick<ValidatedCartItem, 'kind' | 'quantity' | 'weight' |
    'wine' | 'bundleItems'>`); `ValidatedCartItem` still satisfies it, so checkout is unchanged.
  - **Known edge (not exact parity):** the data layer's `resolveShippingMethods` drops packaging
    groups without bottles or without boxes, and rates without a numeric price; checkout reads the
    raw data. A group with bottles but no boxes makes the method "not applicable" in checkout but
    not in the markup. Misconfiguration only, none in current shops — accepted; mention it in the
    test of the adapter.
  - Import alias: `data/resolve/settings.ts` already exports a `resolveShippingMethods` (builds
    `ResolvedShippingMethod`) — import checkout's as e.g. `priceShippingMethods`. Importing
    `netlify/lib/shipping` into the plugin bundle is fine (its logger only reads `LOG_LEVEL`).
- **Weight:** only used by weight-rate methods (methods without packaging groups, and non-wine
  items). Wines in a method with packaging groups are priced by the boxes only. Move the per-kind
  weight rules out of `cart-validator.ts` (line ~83–123) into a shared helper used by both checkout
  and the schema code, so they can't drift. **Gap:** the frontend data layer has no `weight` on
  `ResolvedVariant` nor on `ResolvedBundleItem.variant` — add it to both projections (variant's own
  plus the product's, as the checkout query has `weight` + `productWeight`, also on the bundle
  child: `netlify/services/sanity.ts` `bundleItems[].variant`).
- **Delivery time — required.** Google requires `deliveryTime`, `shippingDestination` and
  `shippingRate` for shipping details to count. `deliveryTime` is free text ("2 – 5 Werktage");
  parse two numbers (or one → min = max) as `transitTime` (`minValue`, `maxValue`,
  `unitCode: 'DAY'`). `handlingTime` is only recommended and not known → omit — **unverified**
  whether Google accepts a `deliveryTime` without it; check in step 6. If the test complains:
  `handlingTime` 0–0 and the full range as `transitTime` (still honest — the text is the total
  delivery time). No `businessDays` (Google's docs don't use it). If it can't be parsed, leave `deliveryTime` out (never guess) —
  then the shipping entry earns nothing and the warning stays for that shop.
- **Skip:** pickup methods, `kind: 'digital'`, and offers that aren't `InStock` (step 2a).
  Non-active / out-of-stock variants keep their offer as `OutOfStock` but get no shipping.
- **Build log:** `calcWinePackagingCost` logs `log.warn` for a bottle size not in any group; from
  the schema path that would repeat per product page × method × locale. Silence it there (e.g. an
  option or a quiet logger), checkout keeps the warning.

### 4. `hasMerchantReturnPolicy` (Organization level)
Emit it once on the Organization in `buildWebSiteSchema`, not on every offer. Google treats the
organization-level policy as the default for all products; offer-level policies only override it.
Needs `shopSettings` (and the shipping-method countries) passed into the `webSiteSchema` filter.
The Organization is emitted on every non-noindex page via `core/head/schemas.njk`, so product pages
carry it too — **but only when `company.name` is set** (otherwise no Organization, so no policy).
- `applicableCountry`: union of `shippingMethods[].countries`
- `returnPolicyCountry` (Google-recommended; where the item is sent back to):
  `shopSettings.returnAddress.country`, else `company.address.country`, else omit (Tinhof: AT)
- `returnPolicyCategory`: `MerchantReturnFiniteReturnWindow`, `merchantReturnDays: 14` (statutory
  withdrawal period, same source as the withdrawal module)
- `returnMethod`: `ReturnByMail`
- `returnFees` from **`shopSettings.returnShippingBorneBy`**: `'customer'` →
  **`ReturnFeesCustomerResponsibility`** (the customer sends it back and pays the postage; no
  amount), `'merchant'` → `FreeReturn`. Not `ReturnShippingFees` — that means a fixed fee the shop
  charges and requires a non-zero `returnShippingFeesAmount`.
- `merchantReturnLink`: withdrawal-policy page URL (`withdrawalPolicyUrl`), if set
- Statutory exceptions (`withdrawalExceptions`) are not expressible per product. Leave them out.
- Unverified: whether the *offer*-level warning clears with an Organization-level policy only. Check
  in step 6; if it stays, also put the policy (or an `@id` reference to it) on each offer.

### 5. Gating
Steps 3 and 4 only when `features.shop.checkout` is on (without online purchase there's no merchant
listing). Steps 1, 2, 2a and 2b always run.

### 6. Tests and verification
- New `src/schema/__tests__/schema.test.ts`: brand fallback (manufacturer → `siteTitle` →
  `company.name`); no `priceValidUntil`; category `ItemList` of plain `ListItem`s (no `Product`);
  price 0 → no offer and no `Product`/`ProductGroup` on that page (breadcrumb only), sibling stub
  elsewhere stays; never a `Product` without offers in any output;
  `ProductGroup` only with siblings (own variant full, siblings URL-only, no group `url`,
  `variesBy` size only when volumes differ, `sku` fallback to `_id`, group `description` from the
  product first), plain `Product` without
  siblings; availability
  (`soldOut`/`comingSoon`/`archived` → `OutOfStock`, `stock: 0` → `OutOfStock` only with the stock
  feature on, `stock: null` → `InStock`); shipping per method with all its countries for wine
  (packaging group) and physical (weight); bundle with a physical child; rate with
  `maxWeight: null` dropped; free-shipping threshold; delivery-time parsing (range, single number →
  min = max, unparseable → omitted); digital and pickup skipped; checkout gating; return policy for
  both `returnShippingBorneBy` values; `returnPolicyCountry` from return address → company address
  → omitted; no return policy without `company.name`.
- Shared weight helper: existing cart-validator tests still pass (behaviour unchanged).
- `npm run build`, `npm run test`, `npm run check:functions` (shipping.ts is shared with the
  functions).
- Before testing: set `deliveryTime` "2 – 5 Werktage" on both DPD methods in the **development**
  dataset (production has it), so staging shows the shipping entry.
- Tinhof dev server: paste a wine page's JSON-LD (one with siblings → `ProductGroup`, one without)
  and the home page's into <https://search.google.com/test/rich-results>. Then test a staging URL
  directly. Confirm the return-policy warning on offers is gone with the Organization-level policy
  (step 4), that the variant group is recognised, and that `deliveryTime` without `handlingTime`
  is accepted (step 3).

### 7. Docs
- `templates-and-assets.md`: short "schema.org" section covering what's generated per page type and
  which Sanity data each part needs (`siteTitle` as brand, `company.name` for the Organization and
  return policy, shipping methods with country rates and a parseable delivery time, return
  settings).
- `CHANGELOG.md`: minor version (3.5.0). Upgrade note: check shipping methods, `deliveryTime` (must
  contain the days as numbers, e.g. "2 – 5 Werktage" — without it Google ignores the shipping
  details) and return settings per shop. They are published to Google as set.
- `go-live-checklist.md`: add "Rich Results Test on a product page".

### 8. Release
Core-front 3.5.0, then **release tinhof** (1.8.2) via `consuming-core-and-deploy.md` → "Release
flow". After going live, use "Validate fix" in Search Console for each issue. Expected leftovers:
sold-out/coming-soon offers have no `shippingDetails` (by decision), and `validFrom` if it persists
(step 2) — not regressions. Jurtschitsch and grass-art get it with their next core upgrade.

## Before release — per shop
The markup publishes the existing settings to Google, so each owner confirms them:
- **Tinhof:** `returnShippingBorneBy` is `customer` — confirmed by the owner (2026-10-19): the
  customer pays the return postage. `deliveryTime` "2 – 5 Werktage" on both DPD
  methods is set in production; set it in development too before the staging test (step 6).
- **Jurtschitsch / grass-art:** check the return setting and `deliveryTime` on their next upgrade.
- **Every shop:** `company.name` must be set, or there is no Organization and so silently no return
  policy (Tinhof has it).

## Separate, later (not in 3.5.0)
Bundle weight inconsistency in `cart-validator.ts`: for a bundle's total weight a wine child is
always estimated from its volume (explicit weight ignored, line ~96), while `bundleItems[].weight`
uses the explicit weight first (line ~114). Only matters for weight-rate methods (no packaging
groups). Proposed: explicit weight first everywhere, like single wines. The shared helper (step 3)
keeps today's behaviour so markup and checkout match either way.

When this ships, delete this file. The durable parts go into `templates-and-assets.md`.
