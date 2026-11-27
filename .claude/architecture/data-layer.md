# Data layer

Sanity → resolved `cms` global data. All localized fields are pre-resolved to plain strings so
templates never run locale filters.

## Orchestration (`src/data/resolver.ts`)

`buildCmsData(client, ctx)` is **async** and runs once per build (cached unless `serve.refetchData`).
Pipeline:

1. **Fetch raw data in parallel**, feature-gated — products/variants only when `shop.enabled`,
   categories only when `shop.category`, posts only when `blog`, shopSettings only when shop. Each
   uses the dynamically-built GROQ (below). Extension `queries` are fetched too.
2. `extensions.onRawDataFetched?(raw)` debug hook fires.
3. **Pre-compute shared maps:** `productMap` (`_id`→product) and `siblingsMap` (`productId`→variants).
4. **Vinofact:** collect `wine.vinofactWineId`s off the variants and `fetchVinofactWines(...)` into a
   `vinofactMap` (only when `shop.vinofact.integration` is set, i.e. `VINOFACT_API_TOKEN` +
   `VINOFACT_PROFILE_SLUG` are in env).
5. **Per-locale loop** (see below) → builds each `cms[locale]` and pushes into the flat arrays.
6. After the loop: `cms.sitemaps = buildSitemaps(...)`, `cms.llms = buildLlmsTxt(...)`, then
   `extensions.onCmsBuilt?(cms)`.

**Preview build:** `fetchQuery` enables Sanity stega + `resultSourceMap` when `buildMode === 'preview'`
and a `studioUrl` is set. Even in preview it fetches **all** documents (not just the previewed one),
because cross-document references — menu titles/URLs, internal links, the locale switcher — resolve
through `docMap`/`urlMap` and would otherwise fall back to `#`. Only `config.preview.locale` is
processed, and only the previewed doc is actually rendered (the `pages/preview/` templates select it).
Stega embeds invisible metadata in resolved strings → strip it with `stegaClean` for any non-display
use (meta/SEO, JSON-LD, comparisons, slugs/URLs). See
[filters-and-shortcodes.md](filters-and-shortcodes.md) → "`stegaClean` — when and where to strip".

### The per-locale loop

For each locale: build a `ResolveContext` via `makeCtx` (below), then run the per-type resolvers from
`src/data/resolve/` in order — `resolveCategories` (returns them sorted by `sortOrder` asc, missing =
0, then title — so `cms[locale].categories` is already in display order) → `resolveVariants` (needs productMap, categoryMap,
siblingsMap, vinofactMap, resolve hooks, a filter accumulator) → `resolvePages` → `resolvePosts` →
`resolveMenus` → `resolveSettings`/`resolveShopSettings`. `buildFilterGroups(filterAcc)` turns the
accumulated variant attributes into `filterGroups`. Finally assemble `CmsLocaleData` (next sections).

Resolved output types (`ResolvedVariant`, `ResolvedCategory`, …) and the full `CmsLocaleData` /
`CmsData` shape live in `src/types/data.ts`. Core-front carries **no** copy of the generated Sanity
schema types — only the resolved shapes it consumes. Customers generate their own `sanity.types.ts`.

## ResolveContext & resolve hooks (`src/data/resolve/context.ts`)

`makeCtx(locale, defaultLocale, translate, units)` returns the `ResolveContext` threaded into every
resolver and every customer `extensions.resolve.*` hook. It bundles the locale-bound helpers:
`resolveString`, `resolveInherited` (variant field with product fallback, locale first — see
"Variant → product fallbacks"), `resolveImage`, `resolveLocaleAltImage`, `resolveBaseImage`, `resolveSeo`,
`resolveCarousel`, `resolvePortableText`, `resolveActions`, `resolveLocaleValue`, plus `locale`,
`defaultLocale`, `units`, and `translate`. A customer hook uses these so the fields it returns are
already locale-resolved and consistent with core output — see [extending.md](extending.md).

## Queries & projections (`src/data/queries.ts`, `src/data/projections.ts`)

GROQ is built dynamically so extension points can be injected. Builders include
`buildProductQuery`, `buildVariantQuery`, and the per-type category/page/post/menu/settings queries.
`projections` holds reusable projection fragments; both are re-exported from `src/index.ts`
(`queries`, `projections`).

### Extension injection

Three injection points, driven by `config.extensions`:

- `extensions.fields.variant` → appended to the variant projection
- `extensions.fields.menuItem` → appended to the menuItem projection (both nesting levels)
- `extensions.modules.<docType>` → conditional projections inside that document's `modules[]`
- `extensions.queries.<name>` → run as a separate query, merged into `cms[locale].<name>`

This is how a customer adds custom fields/documents (e.g. events, pinwall) without forking core.
For the **customer-facing how-to** (every `extensions.*` option, resolve hooks, portable text, search,
with examples) see [extending.md](extending.md); this section is the query-building internals.

## Locale resolution (`src/data/localizers.ts`)

Replaces the old `src/data/locale.ts`. Exports `resolveString`, `resolveImage`,
`resolveLocaleAltImage`, `resolveBaseImage` (re-exported from `src/index.ts`). These collapse
Sanity's internationalized-array / locale-object fields down to a single locale's plain value.
`resolveString` order: locale → default locale → first entry (an entry with `''` stops it).
`resolveInheritedString(variantArr, productArr, locale, defaultLocale)` merges two documents
locale-first and skips blank entries (bound as `ctx.resolveInherited`).

## Variant resolution (`src/data/resolve/variants.ts`)

The largest resolver. `resolveVariants` does, per variant:
- **Slug** (`src/data/slugify.ts`), kind-aware: wine → `slugify(title + volume + vintage?)`;
  physical/digital → `slugify(title + option names)`; bundle → `slugify(title)`. Collision-safe per
  locale via a tracked `Set` (`deduplicateSlug` appends `-2`, `-3`, …). `url = /<locale>/<product
  permalink>/<slug>/`. (Page/post slugs are slugified but keep `/` separators.) `@sindresorhus/slugify`
  is locale-blind: `&` becomes `and` in every locale ("Yoga & Kurse" → `yoga-and-kurse`) — set
  the page's `slug` field for a German path (`yoga-und-kurse`).
- **Label**: from option names joined with ` · `, falling back to the title.
- **Siblings**: other variants of the same product (via `siblingsMap`), for variant switchers.
- **Status** = `effectiveStatus(raw, rawVariantMap, productMap)` at all three sites (the variant,
  its siblings, `variantAxes` option targets), so templates and customer overrides that check
  `status == "active"` agree with checkout: an active variant without own and product price →
  `unavailable` (resolved-only, not a schema value); an active bundle with no items, an item missing
  from `rawVariantMap` (archived/dangling) or a non-active item → `soldOut`, with an unpriced item →
  `unavailable`. Resolved `bundleItems` silently drop missing items — the status is what tells.
- **Categories**: resolved from `categoryMap`.
- **Vinofact merge**: when the variant's `wine.vinofactWineId` is in `vinofactMap`, the VinoFact
  fields (locale-resolved) are merged onto the resolved wine.
- **Filter attributes**: accumulated into `filterAcc` (`buildFilterAttributes` / `accumulateFilterGroups`)
  to later form `filterGroups`; bundles then take their items' attributes (see "Filter groups").
- **Free shipping / bundle total**: `grantsFreeShipping` is **derived** (core-front 6.0.0, no
  variant field any more): `resolveVariants` sets `false`, then the resolver's post-pass
  `applyBuildShippingDiscounts` (`resolve/variants.ts`) sets it on every non-digital variant that
  an automatic shipping discount's `appliesTo` matches — a cart holding just this variant
  (`matchesSelector(selectorLineFromResolved(v, parentById), …)`, ancestors from
  `ResolvedCategory.parentId`). Only discounts without conditions (`isUnconditional`: no dates,
  limits, min subtotal / quantity), fetched by `fetchBuildShippingDiscounts`
  (`data/build-discounts.ts`, only with checkout) with plain `client.fetch` — **never stega**,
  which would encode `appliesTo.kinds` in preview builds so nothing matches. The build snapshot
  changes with the next deploy; checkout evaluates every rule live. Without `shop.category` the
  resolved categories are empty, so a leftover category rule shows no build claim (the Studio
  warns about the disabled criterion). `commerce-and-netlify.md` → "Discounts"; `bundleItemsTotal` (`bundleItemsTotal()`:
  bundles only, items' single prices × quantity when above the bundle price, else null —
  `templates-and-assets.md` → "Bundle: sum of single prices").
- **Description**: `description` (core-back `i18nText`, any kind) → plain string or `null`, by
  `ctx.resolveInherited` (O2 order: variant[locale] → product[locale] → variant[default] →
  product[default] → variant[first] → product[first], blank entries skipped — so a variant with
  only a German text shows the product's English one on the English page). `product.description`
  is the product's own text (`resolveString`). Rendered by the `productDescription` macro with the
  `paragraphs` filter; for wines it beats `wine.description` (VinoFact), which is the macro's
  fallback. Also the first fallback for `seo.metaDescription` (whitespace collapsed), before the
  wine description.
- **Specifications**: `specifications` (core-back `productSpecification` label/value pairs, any
  kind) → `ResolvedSpecification[]` of plain strings; the variant's non-empty list replaces the
  product's, lines missing a label or value are dropped. Rendered by the `productSpecifications`
  macro (`macros/product.njk`) in the core product container, after the kind-specific details.
- **Resolve hook**: `extensions.resolve.variant` / `.product` output is merged in last.

### Variant → product fallbacks

An empty variant field means "use the product's value". **This table is the reference**; the
Studio hints (core-back, `productVariant.fields.*.description`) describe the same rules. "Set" means:
number → `typeof === 'number'` (0 is set); array → `length > 0`; i18n string → an entry with a
non-blank `value`; image → `asset`; reference → `_ref`.

| Field | Build (`resolve/variants.ts`) | Checkout (`services/sanity.ts` `CHECKOUT_QUERY`, `lib/cart-validator.ts`) |
|---|---|---|
| `title` | `resolveString` per document: variant[locale → default → first], else product. A variant's own title wins in every locale; the **slug** (`generateVariantSlug`) follows the same rule — keep both on it (no URL changes) | same (only when the cart sends no title) |
| `description` | `resolveInherited`, locale first (see "Description") | — |
| `specifications` | variant list if non-empty, else product's (replaces) | — |
| `price` | `variant ?? product ?? 0` (none → status `unavailable`) | `variant.price ?? productPrice` |
| `compareAtPrice` | `effectiveCompareAtPrice` (`shared/variant-fallbacks.ts`): own price → own compare-at only; no own price → variant ?? product; only when > the effective price, else `null` | same helper, for the `hasCompareAtPrice` discount criterion |
| `taxCategory` | variant → product (`taxCategoryId`) | variant → product → `shopSettings.defaultTaxCategory` |
| `categories` | variant list if non-empty, else product's — **replaces, doesn't add** | same |
| `manufacturers` | variant list if non-empty, else product's (an emptied list is `[]`) | GROQ `select(count(manufacturers) > 0 => …, product->manufacturers)` |
| `weight` | `variant ?? product` | `resolveVariantWeight`: same, wines estimate from volume |
| `image` | variant (with `asset`), else product | — |
| `seo` | per sub-field (`mergeSeoFallback`; i18n sub-fields by `length`, not locale-first — out of scope so far) | — |

The `productPrice` macro also guards `compareAtPrice > price` (data from customer resolve hooks).

## `CmsLocaleData` assembly & well-known URLs

After the resolvers, the loop builds `urlMap` (`_id` → URL) and `docMap` (`_id` → resolved doc) from
pages + categories + products + posts — these back `pageUrl`/`docById` filters and portable-text
internal links. It then assembles the `CmsLocaleData` with a large set of **well-known page URLs**,
each derived from `urlMap`, `permalinks`, or `userPaths`, and **feature-gated to `'#'` when off**:
- content pages: `homeUrl`, `shopUrl`, `privacyUrl`, `termsUrl`, `withdrawalPolicyUrl` (from `urlMap`
  via ids configured in settings/shopSettings).
- checkout: `checkoutUrl`, `orderThanksUrl` (only when `shop.checkout`).
- users: `loginUrl`, `registerUrl`, `accountUrl`, `confirm*`, `recover*`, `reset*`, … (only when
  `users`), from `config.userPaths[locale]`.
- newsletter: `newsletterConfirm*`, `newsletterUnsubscribe*` (only when `newsletter`).
- withdrawal: `orderWithdrawUrl`, `orderWithdrawSuccessUrl` (when shop).
- `shippingInfoUrl` (`shopSettings.shippingInfoPage`, `'#'` when unset); `cms[locale].shippingMethods`
  (`resolveShippingMethods`: title, delivery time, enabled countries, weight rates, packaging prices —
  gross cents, the checkout's own data; pickup methods carry `pickupAddress` / `pickupInstructions` /
  `pickupHoldDays` and always empty countries/rates/packaging, whatever the document still holds); `hasFreeShippingProducts` (any active variant with
  the derived `grantsFreeShipping` — the `shippingInfoModule` sentence follows the content, no
  config flag).
Plus `searchIndex`/`searchFields` and the merged `extensionData`. Templates read these directly
(e.g. `cms[locale].checkoutUrl`) instead of constructing URLs.

## Menus & system links (`src/data/resolve/menus.ts`)

The menu query (`buildMenuQuery` in `queries.ts`) fetches `menu.maxDepth − 1` levels of `children`
(`maxDepth` = levels, top level included, as core-back — flat menus fetch none); the
`extensions.fields.menuItem` projection is added on every level. core-back types the levels
`menuItem`, `menuItem1`, …; the frontend reads fields, never `_type`.

A `menuItem` has a `linkType`: `internal` (doc ref), `external` (`url`), `submenu` (`children`), or
`system`, meaning a **fixed core route** that isn't a document. It is named by `systemPage`, which is
currently only `orderWithdraw` (the Widerruf form). In the per-locale loop, `resolveMenus` gets a
`systemUrls` map (`systemPage` → URL, `'#'` when the page's feature is off). For a system item it sets
`url` from that map, and `title` falls back to `trans('staticPages.<systemPage>.title')`. For
`orderWithdraw` the editor title is **ignored** (`FIXED_LABEL_SYSTEM_PAGES` in `resolve/menus.ts`): the
label must be exactly "Vertrag widerrufen" (FAGG §13a). The item is
**dropped** when its URL is missing or `'#'`, so a disabled feature never renders a dead link.

`ensureSystemPageLink(menus, 'orderWithdraw', { main, footer }, …)` runs right after. If none of the
rendered menus (settings' `mainMenus` + `footerMenus`, nested children included) links to the
withdrawal page, it **appends** a system item to the last footer menu. The withdrawal form must always
be reachable (legal requirement), and this works for customer footer overrides too. Rationale:
[../decisions/withdrawal-link-as-menu-system-link.md](../decisions/withdrawal-link-as-menu-system-link.md).

**Rich text:** live system pages are also added to `urlMap` under `system:<name>`
(`addSystemUrls`/`systemUrlKey`), so `'system:orderWithdraw' | pageUrl` works. The `internalLink`
mark projection carries `systemPage` (from `internalLinkSystemPage`). The core `internalLink`
serializer links to it as a same-tab link, or renders plain text when the feature is off.

To add a system page: add it to `systemPages` in core-back's `src/schemas/systemPages.ts` (with its
feature), add its URL to `systemUrls` in `resolver.ts`, and make sure a `staticPages.<name>.title`
translation exists. Tests: `src/data/__tests__/{menus,portableText}.test.ts`.

## Filter groups (`src/data/resolve/filters.ts`)

Variant filter attributes accumulate during `resolveVariants` and `buildFilterGroups(acc)` emits the
`FilterGroup[]`. Each group has a `key`, `label`, and sorted `values` (`{value,label,count}`). Sort is
key-aware: `vintage` descending, `volume` numeric, `category` by `sortOrder`, else by label. These
drive the product-list filter UI (`src/scripts/product-filter.ts`, `filterGroupsForProducts` filter).
**Bundles** have no wine data of their own, so after all variants are resolved
`mergeBundleFilterAttributes` gives each bundle the union of its items' attributes (wine fields and
option groups, categories; "contains a red") on top of its own. Each gained value counts once.
Filters only: category pages and the Wein-page grid list a bundle by its **own** categories
(`filterByCategory`) — otherwise a mixed pack would appear on every category it touches; an editor
adds a category to the bundle to put it on that page. Without it any non-price filter hid every bundle. No flag (owner, 2026-11-13);
add one only if a shop wants bundles out of attribute filters. Tests: `bundle-filters.test.ts`.
Why: ADR `bundle-filters-by-contents.md`.

## Portable text (`src/data/portableText.ts`)

`resolvePortableText` / `renderPortableText` (both re-exported). Internal links resolve through
`cms[locale].urlMap` (Sanity `_id` → URL). Options type `PortableTextOptions`;
`PortableTextExtensionContext` lets customers add custom block/mark serializers.

## Permalinks (`src/i18n/permalinks.ts`)

`buildPermalinkTranslations(config.permalinks)` → `resolvedPermalinks`; `buildUserPaths()` →
`userPaths`. Core defaults de/en (product→produkte/products, category→kategorien/categories,
blog→blog, page→seiten/pages). Customers override per-locale segments via `config.permalinks`.

## Search (`src/data/search.ts`)

`buildSearchIndex(products, config, locale, ctx)` produces `cms[locale].searchIndex` (`SearchEntry[]`)
and `searchFields` (fed to MiniSearch on the client — `src/scripts/search.ts`). Empty when
`extensions.search` isn't configured — and then `search-index.njk` isn't built at all (no
`/<locale>/search.json`; gate `features.shop.search` in `src/config/templates.ts`). The config supplies **one of** `buildProductEntry` (one entry
per product, variants grouped by `product._id`) or `buildEntry` (one entry per variant); returning
`null` excludes an item. The build `ctx` (`SearchBuildContext`) gives `imageUrl`, `imageSrcset` (using
the customer's named `imageSizes`), and `formatVolume`. Also generates a per-locale
`search-<locale>.json`. Types in `src/types/config.ts`; customer usage in [extending.md](extending.md).

## Vinofact (`src/data/vinofact.ts`)

When `shop.vinofact.integration` is set (env token + profile slug), `fetchVinofactWines` pulls
wine data from the VinoFact API (one GraphQL request for all IDs) and merges it onto variants.
**Dated API:** the request goes to `<origin>/api/graphql/v<VINOFACT_API_VERSION>/`
(`vinofactEndpoint`; `VINOFACT_API_VERSION` and `VINOFACT_DEFAULT_ORIGIN` =
`https://www.vinofact.com` in `src/data/vinofact.ts`). `VINOFACT_API_URL` only overrides the
origin (path ignored). The version lives in code because the query shape does: bump it (same date
as core-back's constant) when VinoFact ships a change this core needs — never to a date after that
VinoFact release (a future date answers 400). Why: ADR `vinofact-dated-api-version-in-code.md`. Localized fields, image `alt`s included, are
`LocalizedString`s selected per locale (`alt { de en }`); `resolveLocaleMaps`
(`resolve/variants.ts`) turns them into the page locale's string (fallback default locale, then
`null`). `bottleImage` is for customer templates only — core renders none (schema.org uses Sanity
images; the Studio imports the bottle shot into the variant's `image`). **A failed request
fails the build** — a shop without wine data must not be published; the last good deploy stays
live. Transient failures (network, 30 s timeout, 429, 5xx, bad JSON) are retried once after 3 s;
401/4xx/GraphQL errors throw immediately. IDs the API doesn't return only warn. Tests:
`src/data/__tests__/vinofact.test.ts`. Image helpers (`vinofactImageUrl`, `vinofactSrcset`,
`vinofactImage`) are in `src/image` and re-exported.
