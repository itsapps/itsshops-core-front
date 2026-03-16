---
name: project_next
description: Agreed next steps for itsshops-core-front development
type: project
---

## 1. URL map — unblocks portable text internal links

Add `cms[locale].urlMap: Record<string, string>` (Sanity `_id` → resolved URL).
Populated at the end of `buildCmsData` after all documents are resolved — covers pages, posts, categories, variants.
Used by `portableTextToHTML` filter instead of `cmsRef`.

**Why:** Internal links in portable text need a URL per locale. Passing `cms[locale]` explicitly to the filter is cleaner than implicit shared state.

## 2. portableTextToHTML filter

Extensible filter registered in `createFilters`. Core handles standard marks and blocks.
Customer injects custom block/mark handlers via `config.extensions.portableText`:
```ts
portableText?: {
  blocks?: Record<string, (value: any, ctx: PortableTextCtx) => string>
  marks?:  Record<string, (value: any, children: string, ctx: PortableTextCtx) => string>
  types?:  Record<string, (value: any, ctx: PortableTextCtx) => string>
}
```
Template usage: `{{ module.text | portableTextToHTML(locale, cms[locale]) }}`
No `cmsRef` — cms data passed explicitly as filter argument.

## 3. Static pages global data

Equivalent of reference impl's `static.mjs` — login, register, checkout, order-thank-you, reset, recover etc.
Built inside the library as `addGlobalData('staticPages', ...)` using `translate` + `config.features`.
Feature-gated: only generated when `features.users` / `features.shop.checkout` are enabled.

## 4. Customer project configs

**Jurtschitsch** (`extensions` in their `eleventy.config.mts`):
- `fields.menuItem`: project images (left/right baseImage + imagePosition)
- `modules.page`: pinwallModule, pageModule01
- `queries.pinwall`: fetch singleton pinwall document
- `resolve.menuItem`: pass through `images` field

**Tinhof** (`extensions` in their `eleventy.config.mts`):
- `modules.page`: thHero, stdContent (i18nTextField), eventFeed, pageHeader
- `queries.events`: fetch events ordered by date

## 5. extend hook in Config (deferred)

```ts
extend?: (configs: PluginConfigs) => void
```
Lets customer register their own filters/shortcodes with access to `translate`, `cmsRef` etc.
Not implementing until there's a concrete need.

## 6. CoreContext type

Empty `CoreContext` type was added to `src/types/context.ts` — needs to be defined properly.
`buildCmsData` already takes `CoreContext` (with `config`, `translate`, `imageBuilder`).
Needs to be wired consistently.
