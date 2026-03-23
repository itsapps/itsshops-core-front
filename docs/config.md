# Configuration

`project.config.mts` exports a `Config` object passed to `createEleventyConfig`. All fields are optional unless noted otherwise.

```ts
import { type Config } from '@itsapps/itsshops-core-front'

export const projectConfig: Config = { ... }
```

---

## `locales`

`Locale[]` — list of active locales. Currently `'de'` and `'en'` are supported.

```ts
locales: ['de', 'en']
```

## `defaultLocale`

`Locale` — locale used as fallback and for the root redirect.

```ts
defaultLocale: 'de'
```

---

## `sanity`

Sanity client credentials. All fields can alternatively be set via env vars — the config value wins if both are present.

| Field | Env var | Description |
|---|---|---|
| `projectId` | `SANITY_PROJECT_ID` | Sanity project ID |
| `dataset` | `SANITY_DATASET` | Dataset name (e.g. `production`) |
| `token` | `SANITY_TOKEN` | Read token (required for drafts / preview) |
| `studioUrl` | `SANITY_STUDIO_URL` | Studio origin — enables stega markers for visual editing |

```ts
sanity: {
  projectId: 'abc123',
  dataset: 'production',
}
```

---

## `features`

Opt-in feature flags. Omitting `shop` disables it entirely. Omitting a sub-flag defaults it to `false`.

```ts
features: {
  shop: {
    checkout:     false,  // Stripe checkout flow
    manufacturer: false,  // manufacturer document type
    stock:        false,  // stock level tracking
    category:     false,  // category pages
    vinofact: {
      enabled: false,
    },
  },
  blog:  false,
  users: false,
}
```

### `features.shop.vinofact`

Enables fetching wine data from the Vinofact API.

```ts
vinofact: {
  enabled: true,
  fields: ['color', 'type', 'year', 'alcohol', 'varietals', 'awards'],
  integration: {
    endpoint:    '...',   // or set via VINOFACT_API_URL
    accessToken: '...',   // or set via VINOFACT_API_TOKEN
    profileSlug: '...',   // or set via VINOFACT_PROFILE_SLUG
  }
}
```

`fields` controls which additional fields are requested. Base fields (`id`, `slug`, `title`) are always fetched.

Available fields: `color`, `type`, `description`, `year`, `alcohol`, `tartaricAcid`, `freeSulfur`, `phValue`, `histamine`, `varietals`, `classifications`, `normClassifications`, `awards`, `terroir`.

---

## `permalinks`

Override the URL segments used for built-in route types. Only specify what you want to change.

**Defaults:**

| Segment | de | en |
|---|---|---|
| `product` | `produkte` | `products` |
| `category` | `kategorien` | `categories` |
| `blog` | `blog` | `blog` |
| `checkout` | `warenkorb` | `checkout` |
| `account` | `konto` | `account` |
| `register` | `registrierung` | `register` |
| `recover` | `passwort-vergessen` | `recover-password` |
| `login` | `anmelden` | `login` |

```ts
permalinks: {
  de: { product: 'weine' },
  en: { product: 'wines' },
}
```

---

## `translations`

Additional UI strings merged with core defaults. Structured as `{ [locale]: { [namespace]: { [key]: string } } }`. Access in templates via the `trans` filter.

```ts
translations: {
  de: {
    common: {
      map: { directions: 'Wegbeschreibung' },
    },
  },
  en: {
    common: {
      map: { directions: 'Get directions' },
    },
  },
}
```

---

## `headers`

Configures Content Security Policy (CSP) directives written to the Netlify `_headers` file.

### `headers.extra`

Extra CSP sources added to every route.

```ts
headers: {
  extra: {
    'img-src':     ['https://*.tile.openstreetmap.org'],
    'connect-src': ['https://*.tile.openstreetmap.org'],
    'frame-src':   ['https://player.vimeo.com'],
  }
}
```

Supported directives: `script-src`, `connect-src`, `frame-src`, `img-src`, `style-src`.

### `headers.routes`

Per-route extra CSP sources on top of the global ones.

```ts
headers: {
  routes: [
    {
      path: '/de/kasse/*',
      extra: { 'frame-src': ['https://js.stripe.com'] },
    }
  ]
}
```

---

## `extensions`

Hooks and injection points to extend the data pipeline and templates.

### `extensions.queries`

Additional GROQ queries fetched from Sanity and merged into `cms[locale]` under the given key.

```ts
extensions: {
  queries: {
    events: `*[_type == "event"] | order(date asc) { _id, title, date }`,
  }
}
// → cms['de'].events, cms['en'].events
```

### `extensions.fields`

Extra fields appended to the GROQ projection of core document/object types.

```ts
extensions: {
  fields: {
    variant:  'isLimited',
    menuItem: 'badge',
    settings: 'openingHours[] { day, hours }',
  }
}
```

Supported keys: `variant`, `product`, `category`, `page`, `post`, `menuItem`, `settings`.

### `extensions.modules`

Custom module projections per document type. Adds conditional blocks to the modules array projection.

```ts
extensions: {
  modules: {
    page: {
      eventList: `_type == "eventList" => { events[]-> { _id, title, date } }`,
    }
  }
}
```

Supported keys: `page`, `post`, `category`.

### `extensions.portableTexts`

Named sets of custom portable text components. Use `'default'` for the unnamed `portableText` filter call.

```ts
extensions: {
  portableTexts: {
    default: ({ image, imageSizes, escapeHTML }) => ({
      types: {
        customImage: ({ value }) => image(value, imageSizes.contentImage),
      }
    }),
    rich: (ctx) => ({ ... }),
  }
}
```

Usage in templates:
```njk
{{ content | portableText | safe }}
{{ content | portableText('rich') | safe }}
```

### `extensions.resolveData`

Called once per locale after raw extension query data is fetched. Return resolved data merged into `cms[locale]`.

```ts
extensions: {
  resolveData(rawData, { locale, resolveString }) {
    return {
      events: rawData.events.map(e => ({
        ...e,
        title: resolveString(e.title),
      }))
    }
  }
}
```

### `extensions.resolve`

Per-document-type hooks called during core resolution. Return fields to merge into the resolved object.

```ts
extensions: {
  resolve: {
    variant(raw, { resolveString }) {
      return { isLimited: raw.isLimited ?? false }
    },
    product(raw, ctx) { ... },
    category(raw, ctx) { ... },
    page(raw, ctx) { ... },
    post(raw, ctx) { ... },
    menuItem(raw, ctx) { ... },
    module(module, ctx) { ... },   // called for every module on every page
    company(raw, ctx) { ... },
  }
}
```

### `extensions.onRawDataFetched`

Debug hook called once after all Sanity queries have run, before per-locale resolution. Set a breakpoint here to inspect raw query results.

```ts
extensions: {
  onRawDataFetched(raw) { debugger }
}
```

`raw` contains: `products`, `variants`, `categories`, `pages`, `posts`, `menus`, `settings`, `shopSettings`, plus any keys from `extensions.queries`.

### `extensions.onCmsBuilt`

Debug hook called once after full resolution. Set a breakpoint here to inspect the final `cms` object.

```ts
extensions: {
  onCmsBuilt(cms) { debugger }
}
```

---

## `menu`

```ts
menu: {
  maxDepth: 1,  // maximum nesting depth for menu items, default: 1
}
```

---

## `units`

Display units for physical measurements. Affects variant pill labels throughout the shop.

| Field | Default | Description |
|---|---|---|
| `volume` | `'l'` | Unit appended to wine volume (e.g. `'ml'`, `'cl'`, `'l'`) |

```ts
units: {
  volume: 'ml',
}
```

Note: changing `volume` does not affect product URLs — slugs always use `ml` internally for stability.

---

## `imageSizes`

Additional image size presets merged with core defaults. Customer presets extend (and can override) built-in ones.

```ts
imageSizes: {
  carousel: {
    sizes: [[1200, 800], [800, 533]],   // [width, height] pairs — null height = preserve aspect ratio
    widths: '(min-width: 60rem) 1200px, 100vw',
    formats: ['webp', 'jpg'],           // default: ['webp', 'jpg']
  },
  logo: {
    sizes: [[340, 173], [170, 87]],
    widths: '170px',
    formats: ['webp', 'png'],
  },
}
```

Usage in templates: `{% image module.image, imageSizes.carousel %}` or via the `image` shortcode.

---

## `imagePlaceholders`

SVG placeholder strings keyed by name, used as `src` fallbacks when no image is set.

```ts
imagePlaceholders: {
  product: '<svg ...>...</svg>',
}
```

---

## `css`

CSS build options.

| Field | Default | Description |
|---|---|---|
| `cssPath` | `src/assets/css/global.css` | Entry CSS file |
| `minify` | `false` (env: `MINIFY`) | Minify output CSS |
| `inline` | `false` (env: `INLINE_CSS`) | Inline CSS into `<style>` instead of `<link>` |
| `viewport` | — | Custom viewport range for fluid type/spacing |
| `screens` | — | Custom breakpoint map |
| `colors` | — | Design token color list (passed to PostCSS) |
| `fontFamilies` | — | Design token font family list |
| `textSizes` | — | Design token text size list |
| `spacings` | — | Design token spacing list |

### Font preloading

Fonts placed in `src/assets/fonts/preload/` are automatically scanned at build time and output as `<link rel="preload">` tags. No config needed — just drop `.woff2` files there.

Non-preloaded fonts belong in `src/assets/fonts/extra/` (flat, no per-family subfolders).

---

## `js`

| Field | Default | Description |
|---|---|---|
| `minify` | `false` (env: `MINIFY`) | Minify output JS |

---

## `manifest`

Web app manifest colors.

```ts
manifest: {
  themeBgColor: '#ffffff',
  themeColor:   '#1a1a1a',
}
```

---

## `developer`

Rendered in the site footer or meta. Can also be set via env vars `PUBLIC_DEVELOPER_NAME` / `PUBLIC_DEVELOPER_WEBSITE`.

```ts
developer: {
  name:    'Your Agency',
  website: 'https://example.com',
}
```

---

## `dev`

Dev server options. All have env var equivalents.

| Field | Env var | Default | Description |
|---|---|---|---|
| `enabled` | `STAGE=development` | auto-detected | Enable dev mode |
| `liveReload` | `DEV_LIVE_RELOAD` | `true` | Live reload on file change |
| `serverPort` | `DEV_SERVER_PORT` | `8080` | Dev server port |
| `fetchOnRebuild` | `DEV_FETCH_ON_REBUILD` | `true` | Re-fetch Sanity data on every rebuild |

Set `fetchOnRebuild: false` to skip Sanity fetches during dev rebuilds and use cached data.

---

## `preview`

Preview mode settings. Normally controlled via env vars set by the Netlify preview function.

| Field | Env var | Description |
|---|---|---|
| `enabled` | `IS_PREVIEW` | Enable preview build mode |
| `documentType` | `PREVIEW_TYPE` | Document type to preview (`page`, `post`, …) |
| `documentId` | `PREVIEW_ID` | Sanity document `_id` to preview |
| `locale` | `PREVIEW_LOCALE` | Locale to render |

---

## `baseUrl`

Overrides the production URL. Normally read from `URL` (Netlify) or `DEV_URL` env vars.

```ts
baseUrl: 'https://example.com'
```

---

## `isMaintenanceMode`

`boolean` — serve the maintenance page for all routes. Env var: `MAINTENANCE=true`.

## `doIndexPages`

`boolean` — emit `<meta name="robots" content="noindex">` on all pages when `false`. Env var: `DO_INDEX_PAGES=false`.

## `maxProducts`

`number` — limit the number of products fetched from Sanity (useful during development). Env var: `MAX_PRODUCTS`.

---

## `stripe`

| Field | Env var | Description |
|---|---|---|
| `publishableApiKey` | `STRIPE_PUBLISHABLE_API_KEY` | Stripe publishable key (client-side) |

Secret key and webhook secret are server-side only — set via `STRIPE_SECRET_API_KEY` and `STRIPE_ENDPOINT_SECRET` env vars.

## `captchaSiteKey`

Env var: `CAPTCHA_SITE_KEY`. Site key for the CAPTCHA widget (client-side). Secret key is server-side only via `CAPTCHA_SECRET_KEY`.

## `supportEmail`

Env var: `SUPPORT_EMAIL`. Displayed in transactional emails and order confirmation pages.

---

## Environment variables reference

All env vars recognized by the core. Server-side-only vars are not safe to expose to the client.

| Variable | Description |
|---|---|
| `SANITY_PROJECT_ID` | Sanity project ID |
| `SANITY_DATASET` | Sanity dataset |
| `SANITY_TOKEN` | Sanity read token |
| `SANITY_STUDIO_URL` | Studio origin for visual editing |
| `URL` | Production URL (set by Netlify) |
| `DEV_URL` | Local dev URL override |
| `STAGE` | `development` or `production` |
| `MAINTENANCE` | `true` to enable maintenance mode |
| `DO_INDEX_PAGES` | `false` to noindex all pages |
| `MAX_PRODUCTS` | Limit products fetched |
| `MINIFY` | `true` to minify CSS + JS |
| `MINIFY_HTML` | `true` to minify HTML output |
| `INLINE_CSS` | `true` to inline CSS |
| `DEV_LIVE_RELOAD` | `false` to disable live reload |
| `DEV_SERVER_PORT` | Dev server port (default `8080`) |
| `DEV_FETCH_ON_REBUILD` | `false` to skip Sanity refetch on rebuild |
| `IS_PREVIEW` | `true` to enable preview mode |
| `PREVIEW_PERSPECTIVE` | `drafts` or `published` |
| `PREVIEW_TYPE` | Document type for preview |
| `PREVIEW_ID` | Document ID for preview |
| `PREVIEW_LOCALE` | Locale for preview |
| `PUBLIC_DEVELOPER_NAME` | Developer name (public) |
| `PUBLIC_DEVELOPER_WEBSITE` | Developer website (public) |
| `DEVELOPER_EMAIL` | Developer contact email |
| `SHOP_ADMIN_EMAIL` | Admin email for stock alerts etc. |
| `SUPPORT_EMAIL` | Support email shown to customers |
| `MAILGUN_API_KEY` | Mailgun API key |
| `MAILGUN_DOMAIN` | Mailgun sending domain |
| `MAILGUN_USE_EU_REGION_URL` | `true` for EU Mailgun endpoint |
| `SEND_BUILD_EMAIL` | `true` to send build notification email |
| `SEND_LOW_STOCK_EMAIL` | `true` to send low stock alert emails |
| `VINOFACT_API_URL` | Vinofact API endpoint |
| `VINOFACT_API_TOKEN` | Vinofact access token |
| `VINOFACT_PROFILE_SLUG` | Vinofact profile slug |
| `STRIPE_PUBLISHABLE_API_KEY` | Stripe publishable key (public) |
| `STRIPE_SECRET_API_KEY` | Stripe secret key — server-side only |
| `STRIPE_ENDPOINT_SECRET` | Stripe webhook secret — server-side only |
| `CAPTCHA_SITE_KEY` | CAPTCHA site key (public) |
| `CAPTCHA_SECRET_KEY` | CAPTCHA secret key — server-side only |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase service role key — server-side only |
| `SUPABASE_EMAIL_HOOKS_SECRET` | Supabase email hook secret — server-side only |
| `SERVER_FUNCTIONS_ALLOWED_ORIGINS` | Comma-separated allowed origins for functions |
| `SERVER_FUNCTIONS_SECRET` | Shared secret for internal function calls — server-side only |
| `SERVER_JWT_SECRET` | JWT signing secret — server-side only |
| `TEST_USER_EMAIL` | Test user email — dev only |
| `TEST_USER_PASSWORD` | Test user password — dev only |
