# Gallery (Embla main + thumbs)

A linked main carousel + thumbnail navigation built on [Embla Carousel](https://www.embla-carousel.com/). Clicking a thumb scrolls the main; scrolling the main highlights the active thumb.

---

## How it works

The JS (`src/scripts/gallery.ts`) looks for every `[data-gallery]` element on the page and wires up the two Embla instances it finds inside:

- `.embla__viewport` — the main carousel
- `.embla-thumbs__viewport` — the thumbnail carousel (optional)

If no thumbs viewport is found, only the main carousel is initialised. This means the same `data-gallery` attribute works for both "main only" and "main + thumbs" layouts.

The script is lazy-loaded from `src/scripts/index.ts` — it is only fetched when `[data-gallery]` exists on the page.

---

## Templates

Two partials in `src/templates/components/gallery/`:

| Partial | Renders |
|---------|---------|
| `gallery-main.njk` | `.embla` main carousel |
| `gallery-thumbs.njk` | `.embla-thumbs` thumbnail strip (nothing if ≤ 1 image) |

Both are **data-agnostic** — they read from `_galleryImages` / `_galleryImage` variables, not from any specific document type. The caller sets these before the include.

### Variables

| Variable | Type | Description |
|----------|------|-------------|
| `_galleryImages` | `ResolvedImage[]` | Array of images. If set and non-empty, used as slides. |
| `_galleryImage` | `ResolvedImage` | Single image fallback when `_galleryImages` is empty. |
| `_galleryImageSize` | `PictureSize` | Size preset for main slides. |
| `_galleryThumbSize` | `PictureSize` | Size preset for thumbnails. |

The `_` prefix signals these are scoped to the include and should be set by the caller immediately before `{% include %}`.

---

## Usage

### 1. Add `data-gallery` to the wrapper

The wrapper must contain both the main and thumbs viewports (they can be in different nested elements inside it).

```html
<div class="my-gallery-wrapper" data-gallery>
  <!-- main carousel goes here or in a nested child -->
  <!-- thumbs carousel goes here or in a nested child -->
</div>
```

### 2. Set variables and include the partials

```njk
{%- set _galleryImages    = product.localeAltImages -%}
{%- set _galleryImage     = product.image -%}
{%- set _galleryImageSize = imageSizes.product -%}
{%- set _galleryThumbSize = imageSizes.productThumb -%}

{% include "components/gallery/main.njk" %}
{% include "components/gallery/thumbs.njk" %}
```

Main and thumbs don't need to be siblings — they just need to share a `[data-gallery]` ancestor.

### 3. Add CSS

The partials emit raw `.embla` / `.embla-thumbs` markup with no styles. Add the CSS in the customer project:

```css
.embla__viewport       { overflow: hidden; }
.embla__container      { display: flex; touch-action: pan-y pinch-zoom; }
.embla__slide          { flex: 0 0 100%; min-width: 0; }

.embla-thumbs__viewport  { overflow: hidden; }
.embla-thumbs__container { display: flex; }
.embla-thumbs__slide     { flex: 0 0 25%; min-width: 0; }

.embla-thumbs__slide__number { border: 1px dashed transparent; }
.embla-thumbs__slide--selected .embla-thumbs__slide__number {
  border-color: var(--color-text);
}
```

See `src/assets/css/global/blocks/embla-gallery.css` in the Jurtschitsch project for a full reference.

### 4. Define `imageSizes` presets

The gallery partials receive size presets via `_galleryImageSize` and `_galleryThumbSize` — define whatever keys make sense for your use case in `project.config.mts`:

```ts
// project.config.mts
imageSizes: {
  product: {
    sizes: [[800, 1200], [400, 600]],
    widths: '(min-width: 40em) 50vw, 100vw',
  },
  productThumb: {
    sizes: [[200, 300], [100, 150]],
    widths: '(min-width: 40em) 12vw, 25vw',
  },
}
```

---

## Another example

```njk
{%- set _galleryImages    = doc.images -%}
{%- set _galleryImage     = doc.coverImage -%}
{%- set _galleryImageSize = imageSizes.terroir -%}
{%- set _galleryThumbSize = imageSizes.terroirThumb -%}

<div class="terroir-gallery" data-gallery>
  <div class="terroir-gallery__main">
    {% include "components/gallery/main.njk" %}
  </div>
  <div class="terroir-gallery__thumbs">
    {% include "components/gallery/thumbs.njk" %}
  </div>
</div>
```

The partials live in `components/gallery/` and are not tied to any document type.

---

## Carousel-only (no thumbs)

The generic content carousel (`src/scripts/carousel.ts`) handles simpler cases — autoplay, fade, loop — via `[data-carousel]`. Use that for banners, hero slides, and content modules. Use `[data-gallery]` only when you need the main + thumbs sync.

| Use case | Script | Attribute |
|----------|--------|-----------|
| Content carousel (autoplay, fade, loop) | `carousel.ts` | `data-carousel` |
| Product/content gallery with thumbs | `gallery.ts` | `data-gallery` |
