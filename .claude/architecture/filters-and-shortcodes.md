# Filters & shortcodes (template API)

The Nunjucks API available in every template. Registered in `src/filters/index.ts`
(`createFilters`) and `src/shortcodes/index.ts` (`createShortcodes`), both wired from `src/index.ts`.
Exact signatures live in those files — this is the catalog.

## Filters (`src/filters/index.ts`)

Usage: `{{ value | filterName(args) }}`.

### i18n & text
| Filter | Purpose |
|---|---|
| `trans(key, params?)` | Translate `key` at the current page locale (`this.page.lang`). See [i18n.md](i18n.md). |
| `nl2br` | Newlines → `<br>`. |
| `truncate(n)` | Shorten a string. |
| `slugify` | URL-slug a string. |
| `postalCode` | Format a postal code. |

### Money, numbers, dates, volume
| Filter | Purpose |
|---|---|
| `formatPrice(locale?)` | Currency format per `units.price` config. |
| `formatNumber` | Locale number format. |
| `formatVolume` | Format ml using the configured `units.volume`. |
| `formatDate(style?)` | Locale date (`Intl` dateStyle). |
| `formatDateRange(to?, { combine? })` | Format a from–to date range. |
| `toIsoString` | Date → ISO string. |

### Images (see [templates-and-assets.md](templates-and-assets.md))
| Filter | Purpose |
|---|---|
| `imageUrl(width, height, format, fit, bg)` | Sanity image URL with transforms. |
| `imageSizeUrl(size, format)` | URL for a named `imageSizes` preset. |
| `imageSrcsetData(size)` | `{src, srcset, sizes, width, height}` for a named preset. |
| `vinofactImageUrl(width, height)` / `vinofactSrcset(size)` | Same for VinoFact image URLs. |
| `focalPoint` | CSS `object-position` from a Sanity hotspot. |
| `stegaClean` | Strip Sanity stega metadata from a value. |

### CMS data lookup & lists
| Filter | Purpose |
|---|---|
| `pageUrl(id)` / `docById(id)` / `findById` | Resolve a Sanity `_id` to its URL / resolved doc (via `cms[locale].urlMap` / `docMap`). |
| `findByProductId` | Find variant(s) by product id. |
| `resolveProductRefs` | Resolve an array of product references to resolved variants. |
| `filterByCategory` / `filterGroupsForProducts` | Category filtering + which filter groups apply to a product set. |
| `hasModule(type)` | Does a `modules[]` array contain a module of `type`. |
| `limit(n)` / `map(path)` / `sortBy(path, reverse?)` | Array take / pluck / sort by key. |
| `countryName(code)` / `countryList(locale?)` | Country display name / option list. |
| `linkActiveState(url)` | Active-nav helper for the current page. |

### Portable text & schema.org
| Filter | Purpose |
|---|---|
| `portableText(name?, options?)` | Render portable text; `name` selects a `extensions.portableTexts` set (`'default'` when omitted). See [extending.md](extending.md). |
| `pageSchema(settings)` / `webSiteSchema(settings)` | Emit schema.org JSON-LD for a page / the site. |

### Debug
| Filter | Purpose |
|---|---|
| `log(label?)` | Console-warn a value (passthrough). |
| `json` | `JSON.stringify`. |

> In debug mode, templates run with `throwOnUndefined` — referencing an undefined variable fails the
> build (set in `src/config/templates.ts`).

## Shortcodes (`src/shortcodes/index.ts`)

Usage: `{% image img, size, options %}`.

| Shortcode | Purpose |
|---|---|
| `image(img, size, options?)` | Responsive `<picture>` for a Sanity image at a named/`PictureSize`. |
| `preload(img, size, options?)` | `<link rel="preload">` for an image (LCP). |
| `staticImage(filename, size, options)` | Responsive image for a local static file. |
| `staticPreload(filename, size)` | Preload for a local static file. |
| `vinofactImage(image, size, options?)` | Responsive image from a VinoFact image. |
| `gallery(images, size, options?)` | Render a gallery (pairs with the lightbox client script). |

The underlying functions (`image`, `preload`, `imageUrl`, `imageSrcsetData`, …) are also exported
from the package root (`src/image/`) for use in JS/extensions — see
[templates-and-assets.md](templates-and-assets.md).

Some exported helpers double as plain functions: `formatVolumeMl(ml, unit, locale)` and
`formatNumber(num, locale)` (`src/filters/index.ts`), re-exported from `src/index.ts`.
