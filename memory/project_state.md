---
name: project_state
description: Current implementation state of itsshops-core-front — what exists and how it works
type: project
---

## Architecture

`@itsapps/itsshops-core-front` — shared Eleventy plugin library consumed by customer shop frontends.

Entry: `shopCoreFrontendPlugin(eleventyConfig, config)` in `src/index.ts`.

## Plugin wiring (src/index.ts)

```
resolveConfig(itsshopsConfig)           → CoreConfig
setupTranslation(eleventyConfig, config) → TranslatorFunction
PluginConfigs = { eleventyConfig, config, translate }
setupIgnores / setupPlugins / cssConfig / createFilters / createShortcodes / setupAssets / loadTemplates
addGlobalData('cms') → buildCmsData(client, coreContext)
addGlobalData('coreConfig') → config
```

## Key types

**`PluginConfigs`** (`src/types/config.ts`):
`{ eleventyConfig, config: CoreConfig, translate: TranslatorFunction }`
Passed to every `setup*` / `create*` function.

**`ResolveContext`** (`src/types/context.ts`):
`BoundLocalizers & { locale, defaultLocale, resolvePortableText, translate }`
All locale-bound. Created per locale in `makeCtx()`. Passed to extension resolve hooks.

**`BoundLocalizers`** (`src/data/localizers.ts`):
`{ resolveString, resolveImage, resolveLocaleAltImage, resolveBaseImage, resolveSeo }` — all pre-bound to `(locale, defaultLocale)`.

**`CmsData`** / **`CmsLocaleData`** (`src/data/types.ts`):
`cms[locale].products/categories/pages/posts/menus/settings` + extension query keys.
Flat pagination arrays: `cms.products/categories/pages/posts` (all locales, with `locale` field).

## Data pipeline

`buildCmsData(client, coreContext)` in `src/data/resolver.ts`:
- Takes `CoreContext` (has `config`, `translate`, `imageBuilder`)
- Fetches all raw data in parallel
- Per locale: `makeCtx(locale, defaultLocale, translate)` → `ResolveContext`
- Passes ctx to: `resolveCategories(raw, ctx, permalinks, hook?)`, `resolveVariants(raw, productMap, ctx, permalinks, ...)`, `resolveMenuItems(items, ctx, hook?)`
- All string/image/seo resolution goes through `ctx.*` methods

## Projections (src/data/projections.ts)

Clean helper API:
- `i18nStringField(name)` — `name[]{ _key, value }`
- `i18nImageField(name)` — localeImage (image: i18nCropImage[], alt: i18nString[])
- `i18nAltImageField(name)` — localeAltImage (Sanity image + i18n alt)
- `baseImageField(name)` — plain image + string alt
- `portableTextField(name)` — plain portableText[] with internalLinkReference resolved
- `i18nTextField(name)` — i18nText / i18nStandardContent with internalLinkReference resolved
- `actionsField(name?)` — hero CTA actions array (internalLinkTitle/Reference/DisplayType)
- `seo`, `category`, `manufacturer` — shared fragments

## Queries (src/data/queries.ts)

Builders: `buildProductQuery`, `buildVariantQuery`, `buildCategoryQuery`, `buildPageQuery`,
`buildPostQuery`, `buildMenuQuery`, `buildSettingsQuery`.
Extension injection: `extraFields(type, extensions)`, `buildModulesProjection(docType, extensions)`.
`CORE_MODULE_PROJECTIONS`: hero (with actions), multiColumns, productSection, categorySection, carousel, youtube.

## Translation

`setupTranslation(eleventyConfig, config)` initializes i18next, registers `trans` filter, returns `TranslatorFunction`.
Called before `PluginConfigs` is constructed (it's a prerequisite).
Customer translations merged via `config.translations`.

## Customer backends

- **Jurtschitsch**: extends menuItem (images: left/right/imagePosition), adds pinwall document (singleton), adds pageModule01 / pinwallModule to page modules
- **Tinhof**: adds event document, adds thHero / stdContent / eventFeed / pageHeader to page modules

Schema source files are `.tsx` — not `.ts`. Located at root-level `schemas/` directory within each project (Sanity Studio pattern, not under `src/`).
