# Images

All image rendering goes through `src/image/index.ts`. Two rendering functions, one URL utility.

---

## `sanityPicture` shortcode

Outputs `<img srcset sizes>` for Sanity-hosted images. WebP is requested via Sanity's URL API (`&fm=webp`) — no `<picture>` element needed.

```njk
{% sanityPicture image, imageSizes.hero %}
{% sanityPicture image, imageSizes.card, { loading: "eager", fetchpriority: "high" } %}
{% sanityPicture image, imageSizes.product, { class: "my-img" } %}
```

Output:
```html
<img
  src="https://cdn.sanity.io/...400w.webp"
  srcset="https://cdn.sanity.io/...800w.webp 800w, https://cdn.sanity.io/...400w.webp 400w"
  sizes="(min-width: 40em) 50vw, 100vw"
  width="400" height="600"
  alt="Wine bottle"
  loading="lazy"
>
```

**Why `<img>` and not `<picture>`:** The browser's preload scanner evaluates `sizes` correctly on `<img srcset>` but not on `<source srcset>` inside `<picture>`. Using `<picture>` caused double image requests on mobile (scanner grabbed the first srcset entry regardless of viewport width).

**Why no jpg fallback:** WebP is supported in all modern browsers (Safari 14+, 2020). The ~0.5% of older browsers are not worth the added complexity of a `<picture>` fallback.

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `loading` | `"lazy"` | `"lazy"` or `"eager"` |
| `fetchpriority` | — | `"high"` for LCP images |
| `class` | — | Class on the `<img>` |
| `alt` | `image.alt` | Overrides the Sanity alt text |

---

## `staticPicture` async shortcode

For static assets (logo, icons, illustrations). Uses `@11ty/eleventy-img` to generate actual image files on disk. Outputs a full `<picture>` element with multiple formats because the files genuinely exist.

```njk
{% staticPicture "./src/assets/images/logo.png", imageSizes.thumb %}
{% staticPicture "./src/assets/images/hero.jpg", imageSizes.hero, { loading: "eager" } %}
```

Output:
```html
<picture>
  <source type="image/webp" srcset="/assets/images/logo-300.webp 300w" sizes="300px">
  <img src="/assets/images/logo-300.jpeg" width="300" height="300" alt="" loading="lazy">
</picture>
```

---

## `imageUrl` filter

Plain URL — for `og:image`, JSON-LD, CSS backgrounds, and JS-inserted images. No srcset.

```njk
{# og:image — original format (crawlers may not support webp) #}
<meta property="og:image" content="{{ page.image | imageUrl(1200) }}">

{# JS-inserted image — pass webp explicitly #}
data-preview="{{ item.image | imageUrl(1400, null, 'webp') }}"

{# With explicit dimensions #}
{{ product.image | imageUrl(800, 600) }}
```

**Signature:** `imageUrl(width?, height?, format?)`
`format` is optional: `'webp'` | `'jpg'`. Omit for og:image and JSON-LD.

---

## `imageSizes` presets

Available globally in all templates as `imageSizes`.

### Core presets

| Key | Aspect | Sizes | `sizes` attribute |
|-----|--------|-------|-------------------|
| `hero` | 16:9 | 1600w, 1200w, 800w | `(min-width: 80rem) 1600px, (min-width: 60rem) 1200px, 100vw` |
| `content` | 4:3 | 800w, 400w | `(min-width: 50rem) 800px, 100vw` |
| `carousel` | 3:2 | 1200w, 800w | `(min-width: 60rem) 1200px, 100vw` |
| `card` | 3:2 | 600w, 300w | `(min-width: 30rem) 50vw, 100vw` |
| `thumb` | 1:1 | 300w | `300px` |

### Overriding / extending in `project.config.mts`

Customer presets are **merged over** the core presets — you can override `card`, `hero` etc. or add new keys.

```ts
// project.config.mts
imageSizes: {
  // Override core card preset (core is landscape 3:2, Jurtschitsch needs portrait 2:3)
  card: {
    sizes: [[600, 900], [300, 450]],
    widths: '(min-width: 30rem) 50vw, 100vw',
  },
  // Product detail page — portrait, left half on desktop / full width on mobile
  product: {
    sizes: [[800, 1200], [400, 600]],
    widths: '(min-width: 40em) 50vw, 100vw',
  },
  // Half-screen split layout module
  splitModule: {
    sizes: [[800, 1200], [400, 600]],
    widths: '(min-width: 50rem) 50vw, 100vw',
  },
},
```

### `PictureSize` type

```ts
type PictureSize = {
  sizes: [number, number | null][]  // [width, height] pairs; null height = natural aspect ratio
  widths: string                    // CSS sizes attribute
  formats?: ('webp' | 'jpg')[]      // defaults to ['webp']
}
```

Use `null` height only when the image's natural aspect ratio should be preserved (uncommon — e.g. author headshots with varying ratios). Fixed heights ensure consistent layout.

---

## CSS patterns

### Product card (portrait image filling a fixed container)

The container defines the aspect ratio; the image fills it with `object-fit: cover`.

```css
.product-card--image-link {
  aspect-ratio: 0.7;   /* 2:3 portrait container */
  overflow: hidden;

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}
```

### Product detail (left half on desktop, full width on mobile)

```css
.product--gallery {
  img {
    display: block;
    width: 100%;
    height: auto;      /* natural height, no cropping */
  }
}
```

The grid layout (defined separately in `.product--outer-content`) puts the image in the left column on desktop.

### Split module (sticky full-height image on desktop)

```css
.split-module {
  /* Mobile: stacked */
  display: flex;
  flex-direction: column;

  &--image img {
    width: 100%;
    aspect-ratio: 4 / 3;
    object-fit: cover;
  }

  @screen md {
    display: grid;
    grid-template-columns: 1fr 1fr;

    &--image {
      position: sticky;
      top: 0;
      height: 100svh;
      overflow: hidden;

      img {
        aspect-ratio: unset;
        height: 100%;
        object-fit: cover;
      }
    }
  }
}
```

---

## SVG placeholder

When a product has no image, show an SVG placeholder that inherits the container's color.

```svg
<!-- src/_includes/placeholders/product.svg -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60"
     aria-hidden="true" focusable="false" class="product-placeholder">
  <path d="M26 5h8v16q8 3 8 13v18q0 3-3 3H21q-3 0-3-3V34q0-10 8-13V5Z" fill="currentColor"/>
</svg>
```

```njk
{% if product.image %}
  {% sanityPicture product.image, imageSizes.card %}
{% else %}
  {% include "placeholders/product.svg" %}
{% endif %}
```

```css
.product-placeholder {
  width: 100%;
  height: 100%;
  color: var(--color-text);
  opacity: 0.12;
}
```

---

## Preload hints

For LCP images, use `fetchpriority: "high"` on the shortcode. The carousel module also emits a `<link rel="preload">` in the `<head>` via the `preloads` bundle — it uses `imagesrcset` + `imagesizes` to match the srcset the browser will actually load:

```njk
{# In carousel.njk — automatically emitted for the first slide #}
<link rel="preload" as="image"
  imagesrcset="{{ slide | imageUrl(1200, null, 'webp') }} 1200w, {{ slide | imageUrl(800, null, 'webp') }} 800w"
  imagesizes="{{ imageSizes.carousel.widths }}"
>
```

**Important:** the preload URL format must match what `sanityPicture` requests (webp). A mismatch causes the browser to download both the preloaded image and the actual image.
