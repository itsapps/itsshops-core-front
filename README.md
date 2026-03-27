# itsshops-core-front

Shared Eleventy plugin for itsshops customer frontends. Provides templates, filters, CSS pipeline, Sanity data fetching, i18n, and CLI tooling.

---

## Customer project setup

### Minimal setup

**1. Install dependencies**

```bash
npm install @itsapps/itsshops-core-front @11ty/eleventy tsx
```

**2. `eleventy.config.mts`**

```ts
import { createEleventyConfig } from '@itsapps/itsshops-core-front'
import { projectConfig } from './itsshops.config.mts'

export default createEleventyConfig(projectConfig)
```

**3. `itsshops.config.mts`**

```ts
import { type Config } from '@itsapps/itsshops-core-front'

export const projectConfig: Config = {
  locales: ['de'],
  defaultLocale: 'de',
}
```

**4. `.env`**

```env
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_TOKEN=your_token
MINIFY=false
```

**5. Scaffold config files**

```bash
itsshops init
```

Writes `netlify.toml`. Use `--force` to overwrite an existing one.

**6. `package.json` scripts**

```json
{
  "scripts": {
    "clean":   "itsshops clean",
    "dev":         "itsshops eleventy --env=.env --serve --dev",
    "preview":     "itsshops eleventy --env=.env --serve --mode=preview",
    "maintenance": "itsshops eleventy --env=.env --serve --mode=maintenance",
    "build":       "itsshops eleventy",
    "netlify":     "itsshops netlify"
  }
}
```

---

### Full setup

#### `itsshops.config.mts`

All available options:

```ts
import { type Config } from '@itsapps/itsshops-core-front'

export const projectConfig: Config = {
  // Locales
  locales: ['de', 'en'],
  defaultLocale: 'de',

  // Features — omit shop to disable it entirely
  features: {
    shop: {
      category: true,
      checkout: true,       // Stripe checkout flow
      manufacturer: false,
      stock: false,
      vinofact: {
        enabled: true,
        fields: ['color', 'year', 'alcohol', 'varietals'],
      },
    },
    blog: false,
    users: true,
  },

  // CSS design tokens — consumed by the Tailwind config
  css: {
    colors: {
      primary: '#1a1a1a',
      bg: '#ffffff',
    },
    fontFamilies: {
      sans: ['Inter', 'sans-serif'],
    },
    textSizes: {
      base: ['1rem', { lineHeight: '1.5' }],
    },
    spacings: {
      section: '4rem',
    },
    screens: {
      sm: '40em',
      md: '50em',
      lg: '80em',
    },
  },

  // Image size presets for <picture> / srcset generation
  imageSizes: {
    card: {
      sizes: [[600, 825], [300, 413]],
      widths: '(min-width: 50em) 20vw, 50vw',
    },
  },

  // URL segment translations per locale
  permalinks: {
    de: { product: 'produkte', category: 'kategorien' },
    en: { product: 'products', category: 'categories' },
  },

  // Override core translation strings per locale
  translations: {
    de: {
      common: {
        product: {
          states: { soldOut: 'Ausverkauft', limited: 'Limitiert' },
        },
      },
    },
  },

  // GROQ query extensions — inject extra fields / modules / queries into the data layer
  extensions: {
    fields: {
      variant: ', "customField": customField',
    },
    modules: {
      page: {
        myModule: '{ title, body }',
      },
    },
    queries: {
      events: `*[_type == "event"]{ _id, title, date }`,
    },
  },

  // Menu
  menu: { maxDepth: 2 },

  // Units
  units: {
    volume: 'ml',
    price: {
      currency: 'EUR',
      currencyLabel: 'Eur',  // replaces Intl symbol → "12,90 Eur"
    },
  },

  // Stripe (can also come from STRIPE_PUBLISHABLE_API_KEY env var)
  stripe: {
    publishableApiKey: 'pk_live_...',
  },

  // Web manifest colors
  manifest: {
    themeColor: '#1a1a1a',
    themeBgColor: '#ffffff',
  },
}
```

#### `.env`

```env
# Sanity (required)
SANITY_PROJECT_ID=your_project_id
SANITY_DATASET=production
SANITY_TOKEN=your_token
SANITY_STUDIO_URL=http://localhost:3333

# Build
MINIFY=false
INLINE_CSS=false
DO_INDEX_PAGES=false

# Local serve
SERVE_PORT=8080
SERVE_LIVE_RELOAD=true
SERVE_REFETCH_DATA=true   # set false to skip Sanity re-fetch on every file-save rebuild

# Stripe (if checkout enabled)
STRIPE_PUBLISHABLE_API_KEY=pk_test_...
STRIPE_SECRET_API_KEY=sk_test_...
STRIPE_ENDPOINT_SECRET=whsec_...

# Users / Supabase (if users enabled)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SECRET_KEY=...
SERVER_JWT_SECRET=...
SERVER_FUNCTIONS_SECRET=...
SERVER_FUNCTIONS_ALLOWED_ORIGINS=http://localhost:3333

# Vinofact (if enabled)
VINOFACT_API_URL=https://www.vinofact.com/api/v1/graphql
VINOFACT_API_TOKEN=...
VINOFACT_PROFILE_SLUG=your-profile-slug

# Preview (uncomment to test locally)
# IS_PREVIEW=true
# PREVIEW_PERSPECTIVE=drafts
# PREVIEW_TYPE=page
# PREVIEW_ID=your-document-id
# PREVIEW_LOCALE=de
```

#### `eleventy.config.mts` — custom Eleventy extensions

Additional filters, shortcodes, or plugins go in the optional callback:

```ts
import { createEleventyConfig } from '@itsapps/itsshops-core-front'
import { projectConfig } from './itsshops.config.mts'

export default createEleventyConfig(projectConfig, eleventyConfig => {
  eleventyConfig.addFilter('myFilter', (value: string) => value.toUpperCase())
})
```

---

## CLI

```bash
itsshops init                          # scaffold netlify.toml (--force to overwrite)
itsshops eleventy --serve --dev        # dev server with debug features
itsshops eleventy --serve --mode=preview   # local Sanity preview
itsshops eleventy --mode=maintenance   # maintenance mode build
itsshops eleventy                      # production build
itsshops netlify                       # netlify dev (functions)
itsshops clean                         # remove dist/, built CSS/JS includes
```

**`--dev`** enables debug features: verbose Nunjucks undefined warnings, `throwOnUndefined`, and live-reloading of core dist templates when developing core itself via `npm link`.

---

## Template customization

Customer templates live in `src/_includes/` and shadow core templates by path:

| Folder | Purpose |
|---|---|
| `overridable/` | Override core templates (header, footer, modules, product/page/category containers) |
| `custom/` | Project-specific templates with no core equivalent |

Core templates under `core/` and page templates cannot be overridden — attempting to do so throws a build error.
