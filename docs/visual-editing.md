# Visual Editing & Stega

## How it works

In preview mode, Sanity wraps string values from the API with invisible unicode characters (stega markers). The `@sanity/visual-editing` script running in the browser reads these markers from DOM text nodes and shows click-to-edit overlays pointing to the correct field in Sanity Studio.

Stega is **only active in preview mode** (`buildMode === 'preview'`). In normal builds strings are clean — `stegaClean` is a no-op.

---

## The rule

| Usage | Action |
|---|---|
| String rendered as **text content** — `{{ product.title }}` | Leave encoded — powers overlays |
| String used in an **HTML attribute** — `href`, `alt`, `src`, `class` | Must call `stegaClean` |

---

## `stegaClean` — where and why

### Core (applied automatically, customer projects don't need to think about these)

**`src/media.ts` — `sanityPicture`, `image.alt` → `alt=""`**

Before:
```html
<img alt="Grüner&#xFEFF; Veltliner">
```
After:
```html
<img alt="Grüner Veltliner">
```
```ts
const alt = stegaClean(altOverride ?? image.alt ?? '').replace(/"/g, '&quot;')
```

---

**`src/data/resolve/menus.ts` — `item.url` → `href`**

Before:
```html
<a href="/de/produkte/gr&#x200B;üner-veltliner/">...</a>
<!-- → 404 -->
```
After:
```html
<a href="/de/produkte/grüner-veltliner/">...</a>
```
```ts
url: stegaClean(ctx.resolveString(url)) || null
```

---

**`src/data/resolve/modules.ts` — `youtube.url` → `src=""`**

Before:
```html
<iframe src="https://youtube.com/embed/abc&#xFEFF;">...</iframe>
<!-- → broken embed -->
```
After:
```html
<iframe src="https://youtube.com/embed/abc">...</iframe>
```
```ts
case 'youtube':
  resolved = { ...m, url: stegaClean(m.url) }
```

---

**`src/data/portableText.ts` — `blockContent()`, rendered children string**

Before:
```html
<!-- stega markers make an "empty" block look non-empty -->
<p></p>
```
After:
```html
<!-- empty block filtered out -->
```
```ts
function blockContent(children: string | undefined): string {
  return stegaClean(children ?? '').replace(/^(\s*<br\s*\/?>)\s*)+|(\s*<br\s*\/?>)+$/gi, '').trim()
}
```

---

**`src/data/portableText.ts` — `block.style`, `block.listItem` → component dispatch**

Before:
```html
<!-- "h2\u{FEFF}" doesn't match "h2" in component map → all blocks render as <p> -->
<p>This should be an h2</p>
```
After:
```html
<h2>This should be an h2</h2>
```
```ts
const normalizedBlocks = blocks.map((block: any) => ({
  ...block,
  style:    block.style    ? stegaClean(block.style)    : block.style,
  listItem: block.listItem ? stegaClean(block.listItem) : block.listItem,
}))
```

---

**`src/data/portableText.ts` — `link` / `externalLink` marks, `href` → `href=""`**

Before:
```html
<a href="https://example.com&#xFEFF;">...</a>
<!-- → broken URL -->
```
After:
```html
<a href="https://example.com">...</a>
```
```ts
const href = escapeHTML(stegaClean(value?.href ?? value?.url ?? '#'))
```

---

**`src/data/portableText.ts` — `internalLink` mark, fallback `slug` → `href=""`**

Before:
```html
<!-- unpublished draft, slug comes raw from Sanity -->
<a href="/gr&#xFEFF;üner-veltliner">...</a>
```
After:
```html
<a href="/grüner-veltliner">...</a>
```
```ts
// urlMap values are pre-cleaned; raw slug fallback used for unpublished drafts
const url = urlMap[id] ?? `/${stegaClean(value?.reference?.slug ?? '')}`
```

---

**`src/templates/core/head/seo.njk` — all meta content → `content=""`**

Before:
```html
<meta name="description" content="Weingut&#xFEFF; Jurtschitsch">
```
After:
```html
<meta name="description" content="Weingut Jurtschitsch">
```
```njk
{%- set _desc = (_seo.metaDescription | stegaClean) if _seo.metaDescription else '' -%}
```

---

**`src/data/resolver.ts` — page/product/category slugs and URLs**

Before:
```
slug = "grüner-veltliner\u{FEFF}"
urlMap[id] = "/de/produkte/grüner-veltliner\u{FEFF}/"
<!-- → 404 for all internal links -->
```
After:
```
slug = "grüner-veltliner"
urlMap[id] = "/de/produkte/grüner-veltliner/"
```
```ts
const slug = stegaClean(p.slug || coreSlugify(stegaClean(title)) || p._id)
```

---

### Customer projects (Jurtschitsch)

**`src/_config/extensions.mts` — `externalLink.url` → `href` in pinwall template**

Before:
```html
<a href="https://example.com&#xFEFF;">...</a>
<!-- → broken link -->
```
After:
```html
<a href="https://example.com">...</a>
```
```ts
return { _type: link._type, url: stegaClean(link.url), title: ctx.resolveString(link.externalLinkTitle) }
```

---

**`src/_includes/header/header.njk` — `_pageTitle` in decorative UI span**

Before:
```html
<!-- visual editing overlay appears on decorative header chrome -->
<span class="site-header__page-name" aria-hidden="true">Grüner&#xFEFF; Veltliner</span>
```
After:
```html
<!-- no overlay on decorative chrome -->
<span class="site-header__page-name" aria-hidden="true">Grüner Veltliner</span>
```
```njk
{# _pageTitle is text content, but this span is aria-hidden decorative chrome.
   Visual editing overlays on header UI are unwanted, so clean explicitly. #}
<span class="site-header__page-name" aria-hidden="true">{{- _pageTitle | stegaClean -}}</span>
```

---

## `escapeHTML` — where and why

Used when manually building HTML strings with template literals and interpolating values into attributes or text content. Converts `<`, `>`, `&`, `"` etc. to HTML entities, preventing broken markup.

> Note: not needed in Nunjucks `{{ }}` — Nunjucks auto-escapes by default. Only needed inside TypeScript/JavaScript template literals.

**`src/data/portableText.ts` — `internalLink` mark**

Before:
```html
<a href="/search?a=1&b=2">...</a>
<!-- → invalid HTML attribute -->
```
After:
```html
<a href="/search?a=1&amp;b=2">...</a>
```
```ts
return `<a href="${escapeHTML(url)}">${children}</a>`
```

---

**`src/data/portableText.ts` — `link` / `externalLink` marks**

Before:
```html
<a href="https://example.com/page?a=1&b=2"">...</a>
<!-- → broken attribute (unescaped & and ") -->
```
After:
```html
<a href="https://example.com/page?a=1&amp;b=2">...</a>
```
```ts
const href = escapeHTML(stegaClean(value?.href ?? value?.url ?? '#'))
return `<a href="${href}" target="_blank" rel="noopener noreferrer">${children}</a>`
```

---

**`src/_config/portable-text.mts` — `withFootnotes`, footnote text content**

Before:
```html
<span class="block-footnote">See <Wine Atlas></span>
<!-- → broken HTML, tag injected by editor -->
```
After:
```html
<span class="block-footnote">See &lt;Wine Atlas&gt;</span>
```
```ts
`<span class="block-footnote">${escapeHTML(f.text ?? '')}</span>`
```

---

## What stega does NOT encode

Sanity never encodes structural/system fields — always safe in attributes without cleaning:

- `_id`, `_type`, `_key`, `_ref` — system fields
- `urlMap` values — built from stega-cleaned slugs in resolvers
- URLs built from locale + permalink patterns — constructed in TypeScript, not from raw Sanity strings

---

## Adding new fields in customer extensions

If your module resolver passes a raw Sanity string that will be used in an HTML attribute, clean it there:

```ts
// extensions.mts
import { stegaClean } from '@itsapps/itsshops-core-front'

module(module, ctx) {
  return {
    externalUrl: stegaClean(module.externalUrl), // used in href → clean at source
    title: ctx.resolveString(module.title),       // text content → leave encoded
  }
}
```

In Nunjucks templates, only clean when using a Sanity string in an attribute and you haven't already cleaned it in the resolver:

```njk
{# text content — leave encoded #}
{{ module.title }}

{# attribute — clean #}
<a href="{{ module.externalUrl | stegaClean }}">{{ module.title }}</a>
```
