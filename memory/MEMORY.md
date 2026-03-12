# Memory: itsshops-core-front

## Project Paths
- Core frontend: `/Users/kampfgnu/Documents/programming/jamstack/itsshops-core-front`
- Core backend: `/Users/kampfgnu/Documents/programming/jamstack/itsshops-core-back`
- Jurtschitsch frontend: `/Users/kampfgnu/Documents/programming/web/jurtschitsch/webshop-frontend`
- Jurtschitsch backend: `/Users/kampfgnu/Documents/programming/web/jurtschitsch/webshop-backend`
- Tinhof backend: `/Users/kampfgnu/Documents/programming/web/tinhof/webshop-backend`
- Reference (old): `/Users/kampfgnu/Documents/programming/jamstack/itsapps_ffmh_frontend`

## Package Info
- Package name: `@itsapps/itsshops-core-front`
- Build: tsup → `npm run build` / `npm run dev`
- Local dev across projects: yalc

## What's been built (current state)
- `src/types/index.ts` — Config type (clean, with features/locales/permalinks/extensions)
- `src/types/sanity.ts` — trimmed copy of core backend generated types (no orders/customers/shipping)
- `src/i18n/permalinks.ts` — permalink translations (de/en defaults, customer overrides)
- `src/data/queries.ts` — GROQ query builders with dynamic extension injection
- `src/data/locale.ts` — locale resolution utilities (resolveString, resolveImage, resolveSeo)
- `src/data/types.ts` — resolved output types (ResolvedVariant, ResolvedPage, etc.)
- `src/data/resolver.ts` — main data builder: fetches, merges, resolves, builds cms object
- `src/index.ts` — clean plugin entry wiring everything together
- `src/core/clients/sanity.ts` — added createPreviewClient (drafts perspective)

## Config shape
```ts
Config = {
  sanity: SanityClientConfig       // note: 'sanity' not 'sanityClient'
  locales: Locale[]
  defaultLocale: Locale
  features?: { shop?, blog?, users? }
  permalinks?: Partial<Record<Locale, PermalinkTranslations>>
  extensions?: {
    queries?: Record<string, string>
    fields?: Record<string, string>
    modules?: Record<string, Record<string, string>>
  }
  tailwind?: { cssPath?: string }
  preview?: { enabled?: boolean }
}
```

## CMS data shape
`cms[locale].products` — ResolvedVariant[] (one per variant, product fallbacks applied, locale-resolved)
`cms[locale].categories`, `.pages`, `.posts`, `.menus`, `.settings`
Extension queries land at `cms[locale].key`

## Variant slug logic
- wine: title + volume + vintage
- physical/digital: title + option names
- bundle: title
- Deduplication via Set per locale, appends -2, -3 etc.

## Sanity types
Copy from `itsshops-core-back/src/types/sanity.types.ts` when backend schema changes.
Customer projects run `sanity typegen generate` for their own extended types.

## Feature flags
Frontend: `shop`, `blog`, `users`
Backend (superset): adds `shop.manufacturer`, `shop.stock`, `shop.category`, `shop.vinofact`, `shop.productKind.*`
