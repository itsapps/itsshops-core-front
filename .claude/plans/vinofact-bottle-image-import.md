# Plan — import VinoFact bottle images into Sanity (+ product link in the ProductManager toast)

Status: **planned** (2026-11-13), refined twice (2026-11-13: checked against core-back, core-front
and the vino-facts API; 2nd pass: helper deps, release-version filter, Schuster's core-back 6.0.0
migration, CLI syntax; 3rd pass 2026-11-14: toast description, i18n path, schema flag, checkbox
place; 4th pass 2026-11-14: VinoFact #922 live, #924 dated API with localized alt → D4/D10;
2026-11-14: core-front's move to the dated API added as step 9 + contract step 13, owner's call;
VinoFact URL env vars optional with default `https://www.vinofact.com`, owner's call; 5th pass
2026-11-14: D10 wiring checked in core-front `resolveFeatures` and core-back mapper /
`ITSCoreProvider` / `IntegrationsDialog`, step 9 tests made concrete, D11 merge checked against the
stored `InternationalizedArrayString` shape; then, owner's call: config fields
`shop.vinofact.integration` / `integrations.vinofact` removed (env only), no extra endpoint
validation, Studio builds the URL in `fetchData`). **Steps 9–10 done 2026-11-14** (core-front,
unreleased; Tinhof local build byte-identical to the old core); **core-back steps 1–8 implemented 2026-11-14** on branch
`feature/vinofact-bottle-import` (not released; Studio UI not yet clicked through — needs the
Schuster Integrations entries, Rollout step 2). As built, differing from the text below:
`vinofactLocaleKey` / `VINOFACT_LOCALES` / `vinofactLocaleKeys` live in `src/external/vinofact.ts`
(the client needs them; the helper imports them); `bottleImageTargets` (draft-vs-published choice)
is in `lib/shop/vinofactImage.ts`, tested; the background import after a Product Manager submit is
the hook `useBackgroundBottleImport` (`components/products/useBottleImageImport.ts`, with the
summary toast); the summary string needs no plurals ("{{imported}} übernommen, …" reads right for
every count); `useProductTransaction` became `.tsx` (JSX in the toast); `ProductCreator` wraps
`commitTransaction` in `commitProduct` (link + persistent card for all kinds).
Spans **core-back** (Studio: import button, bulk action, ProductManager option, toast link, dated
API) and **core-front** (dated API — vino-facts plan 924 §6 — and drop the schema.org bottle-image
fallback).
Depended on **VinoFact #922** (CORS on the image server's `/r/`, D2) — **live on prod since
2026-11-14 09:50**. Uses **VinoFact #924** (date-versioned GraphQL, VinoFact 2.31.62, 2026-11-14):
the dated API returns the bottle image's alt per language (D4, D10).
First user: Rosi Schuster (wants VinoFact bottle shots as product images). Tinhof and Jurtschitsch
use VinoFact as well, and the owner wants product images hosted on Sanity, not loaded from
VinoFact → core, not customer code.

## Goal

Editors copy a wine's VinoFact bottle image into the variant's own Sanity `image` once, by a
click. After that it is an ordinary Sanity image (crop, hotspot, CDN, `image` shortcode); nothing
is loaded from i.vinofact.com at page view.

## Decisions

- **D1 — One-off copy, no sync.** The import writes a Sanity asset and sets `image`. A changed
  bottle shot in VinoFact is not followed automatically; the editor clicks "Neu übernehmen".
  Uploading the same file again is harmless (Sanity dedupes assets by SHA-1). A replaced asset
  stays in the media library (no cleanup).
- **D11 — A re-import keeps existing alt texts (owner, 2026-11-14).** New asset; per content locale
  the variant's existing alt wins if non-empty, VinoFact's alt fills only the empty locales
  (D4). Crop/hotspot are dropped (they belong to the old image). Why: the alt describes the
  bottle, which a new shot of the same wine still shows; an editor's text is deliberate. We can't
  tell an editor's alt from one a previous import wrote — to take VinoFact's current alt, the
  editor clears the alt field first (said in the confirm dialog). Bulk action / Product Manager
  only import into variants without an image asset, but an `image` with an alt and no asset is
  possible → the same merge applies there.
- **D2 — CORS: fixed on the VinoFact side, ticket #922** (vino-facts
  `.claude/plans/922-image-server-cors-r-endpoint.md`). Checked 2026-11-13:
  `https://i.vinofact.com/r/…` (nginx + imgproxy, ADR 830 in vino-facts) answered `GET` and
  `OPTIONS` **without** `Access-Control-Allow-Origin`, so a Studio `fetch()` of the image failed
  (the GraphQL API is fine: `CORS_ALLOW_ALL_ORIGINS = True`). #922 adds
  `Access-Control-Allow-Origin: *` (`always`) to the `/r/` location only — not `/resize/`, not
  originals, no credentials, no OPTIONS handling. Constraints for this side:
  - fetch only the `/r/…` URL the API returns (the `bottleImage.url` template);
  - **plain `fetch(url)`** — no `Authorization` or other custom headers, no `credentials`, so it
    stays a simple request without preflight. Do **not** reuse `createVinofactClient`'s
    `fetchData` (it sends `Authorization` + `Content-Type: application/json`);
  - errors (404/502) carry the header too → check `response.ok` and show the real status.
  No proxy function in core-front. The Studios send no CSP (checked: customer backends'
  `netlify.toml` sets only CORS headers), so no `connect-src` change. #922 is live on prod
  (2026-11-14 09:50, vino-facts plan 922 §8: `/r/` answers 200 with `Access-Control-Allow-Origin:
  *`); the Studio download is the one check still open there — it is this plan's step 3 test.
- **D3 — Full resolution.** `bottleImage.url` is a template with `{{width}}`/`{{height}}` and the
  VinoFact crop baked in (vino-facts `api/schema.py` → `resolve_bottle_image`, URL built by
  `fact_sheet/utils.py` → `imgproxy_url`, `rs:fit:W:H`). Fill it with the returned intrinsic
  `width`/`height` (`image_ref_dimensions` = size after the crop; imgproxy never enlarges).
  Fallback if either is null: 3000×3000 (fit). `bottleImage` is `null` when the wine has no pooled
  image → counted as "no image in VinoFact". `fetch()` sends `Accept: */*`, so imgproxy should
  return the source format; accept **any** `image/*` content type (a cached WebP from the nginx
  `proxy_cache` is possible and fine for Sanity) and take the filename extension from it.
- **D4 — Alt text (VinoFact #924, change `image-alt-localized`).** On the dated API
  `bottleImage.alt` is a `LocalizedString` = the pooled asset's alt per language (`null` when
  empty; modeltranslation falls back to VinoFact's default language). On `/api/v1/graphql` it
  stays the frozen `String` `wine.name` — one reason for D10. Write the value for each **content
  locale** (`config.localization.fieldLocales`, not the UI languages) into the `i18nString` alt;
  skip locales whose value is `null`/empty; all empty → omit `alt`. Editors can change it
  afterwards.
  Selection: `alt { <keys> }`, keys built from `fieldLocales` by `vinofactLocaleKey(locale)` =
  graphene's camelCase of VinoFact's language code (`de` → `de`, `zh-cn` → `zhCn`), and **only**
  keys in a `VINOFACT_LOCALES` list copied from vino-facts
  `src/vino_facts/api/graphql_schema/v2026-11-14.graphql` → `type LocalizedString` (an unknown
  key fails validation of the whole query). A field locale VinoFact doesn't have gets no alt.
- **D10 — Studio and frontend call the dated API; the version lives in each core's code** (vino-facts
  plan 924 §6). The env vars (`SANITY_STUDIO_VINOFACT_API_URL` in the backends,
  `VINOFACT_API_URL` in the frontends) hold a full URL (today `…/api/v1/graphql` everywhere), but
  the query shape comes from the code, so the date must too — a pinned old core pointed at a
  dated URL would break (frontend: the build). core-back's `src/external/vinofact.ts` gets
  `export const VINOFACT_API_VERSION = '2026-11-14'` and
  `export const VINOFACT_DEFAULT_ORIGIN = 'https://www.vinofact.com'`, and builds the endpoint as
  `` `${new URL(endpoint || VINOFACT_DEFAULT_ORIGIN).origin}/api/graphql/v${VINOFACT_API_VERSION}/` ``
  (`vinofactEndpoint`, steps 1 and 9). **No extra URL validation (owner, 2026-11-14):** only the
  developer sets the value, and a bad one already fails loudly — `new URL` throws `Invalid URL`
  naming the input; `localhost:8000` (no `http://`) parses with origin `"null"`, and `fetch` then
  fails on `null/api/…`. The frontend build fails either way. The one requirement: the Studio must
  not crash — so core-back builds the URL inside `fetchData` (step 1), where an error ends in the
  existing error toast, never during render.
  **The URL env vars become optional overrides (owner, 2026-11-14):** `VINOFACT_API_URL`
  (frontend) / `SANITY_STUDIO_VINOFACT_API_URL` (backend) — only for pointing at another VinoFact
  (e.g. a local dev server; `http://192.168.178.48:8000/…` is in some `.env` files). The config
  fields `features.shop.vinofact.integration` (core-front) and `integrations.vinofact`
  (core-back) are **removed** (owner, 2026-11-14): no customer sets them (checked Tinhof,
  Schuster, Jurtschitsch). Sources afterwards: **core-front** — URL (optional), token and slug
  from env (`VINOFACT_API_URL` / `_TOKEN` / `_PROFILE_SLUG`); **core-back** — URL (optional) and
  slug from env (`SANITY_STUDIO_VINOFACT_API_URL` / `_PROFILE_SLUG`), the token from the secrets
  document (`vinofactToken`, Integrations dialog, since 6.0.0 — unchanged). Only their origin is
  used, any path is ignored. Unset → `https://www.vinofact.com`. Existing values keep working;
  after the release they are removed from the shops' env (Rollout step 5). Token and profile slug
  stay required (secret / per winery). This also moves `getWines` — its fields (`id slug title year
  editUrl`) are unchanged in that version, and error messages are identical (the dated API only
  adds `extensions.code`), so `fetchData` stays as is. CORS: `CORS_ALLOW_ALL_ORIGINS = True` is
  global in vino-facts `settings.py`, so the dated route is covered. A future-dated version
  answers 400 `"API version in the future."` — never set the constant after the release date of
  the VinoFact change. core-front does the same in step 9. The two repos share no code: each has
  its own `VINOFACT_API_VERSION`; bump both together (same date) when VinoFact adds a change
  either needs.
- **D5 — No feature flag.** Everything is shown only when `shop.vinofact` is on (existing flag) and
  the variant has `wine.vinofactWineId`. It's opt-in by click.
- **D6 — Remove the schema.org bottle-image fallback** (core-front `src/schema/index.ts:176-180`).
  It is the only core use of `wine.bottleImage` (checked 2026-11-13: no core template uses
  `vinofactSrcset`/`vinofactImage` for bottles; Tinhof and Schuster don't even query
  `bottleImage` — only Jurtschitsch has it in `vinofact.fields`). schema.org then takes
  `seo.shareImage` → `variant.image` → `product.image` (`resolve/variants.ts:434` already falls
  back to the product image). **Keep** the `bottleImage` field in `VinofactField`, the
  `vinofactImageUrl`/`vinofactSrcset`/`vinofactImage` helpers and the privacy-policy flag
  (`filters/index.ts:394`): Jurtschitsch offers a bottle-image download link
  (`overridable/modules/downloadProductFiles.njk`, `vinofactImageUrl(2000, 2000)`), and
  certificate/award logos are VinoFact images too. Risk: a variant without any Sanity image gets no
  schema.org `image` → Google merchant listings flag it. Rollout step 1 checks this per customer.
- **D7 — Where the import writes.** Field button (step 3): through the form → the draft, like any
  edit. Bulk action / ProductManager (steps 4–5): the variant's draft if one exists, else the
  published document (`productVariant` is not `liveEdit`; patching published under an existing
  draft would be lost when the draft is published). ProductManager-created variants are always
  published (`docUid` → `createPublishedId`), so step 5 patches published directly.
- **D8 — Uploads run one after another** (no parallel uploads): full-resolution bottle shots can be
  several MB; a product has a handful of variants.
- **D9 — Product link is persistent in the tool, plus a toast button.** A toast times out (WCAG
  2.2.1) and renders in Sanity's toast portal outside the router context, so the reliable link is a
  persistent line in the Product Manager; the toast button is a convenience (step 6).

## Steps

### core-back

1. **VinoFact client:** dated endpoint per D10. In `src/external/vinofact.ts` export the two
   constants and `vinofactEndpoint(endpoint?: string): string` (the template literal from D10;
   `''`/`undefined` → default origin; no extra validation, D10).
   `createVinofactClient` keeps its signature (`endpoint: string`, `''` = default); `fetchData`
   calls `vinofactEndpoint(endpoint)` **inside its existing `try`**, as the first line, and posts
   to the result — so a bad value throws there (not while the provider renders) and reaches the
   callers' existing error toasts (`WineSelector.tsx:84-90` shows `err.message`). The URL becomes
   optional, and the config field goes (D10):
   - `src/types/config.ts:147`: remove `integrations?: { vinofact?: VinofactIntegrationConfig }`
     from `ItsshopsConfig` (the customer input; it has no other key). The resolved
     `IntegrationsConfig.vinofact` (`:132`, read by `ITSCoreProvider`) **stays** — it is where the
     mapper puts the env values. `VinofactIntegrationConfig.endpoint` (`:41`) stays `string`
     (`''` = default).
   - `src/config/mapper.ts:80-85`: env only — `features.shop.vinofact.enabled ? { endpoint:
     process.env.SANITY_STUDIO_VINOFACT_API_URL ?? '', profileSlug:
     process.env.SANITY_STUDIO_VINOFACT_PROFILE_SLUG ?? '' } : undefined`.
   - `src/context/ITSCoreProvider.tsx:89`: guard `if (!vinofact || !vinofactToken) return
     undefined` (drop the endpoint check; no `try` needed — building the client can't throw).
   - `src/components/IntegrationsDialog.tsx`: **no change** — it stores only `vinofactToken` (the
     endpoint and profile slug are public config, not secrets).
   - `tests/vinofact.test.ts`: `skipIf(!token || !profileSlug)` and
     `createVinofactClient('de', endpoint ?? '', token!, profileSlug!)` — without
     `SANITY_STUDIO_VINOFACT_API_URL` it calls prod VinoFact.
   Then Add `getBottleImages(ids: string[], locales: string[]): Promise<VinofactBottleImagesResponse>`
   to `src/external/vinofact.ts` (returned from `createVinofactClient`) and the
   `ITSVinofactClient` type (`src/types/vinofact.ts`). Query (uses the existing `fetchData`, which
   merges `profileSlug`; the `ids` arg exists in VinoFact's `Query.wines`, type `[ID]`):
   ```graphql
   query ($profileSlug: String!, $ids: [ID!]) {
     wines(profileSlug: $profileSlug, ids: $ids) { id bottleImage { url alt { ${L} } width height } }
   }
   ```
   `${L}` = the keys from D4 (`getBottleImages(ids, locales)` takes `fieldLocales`; the client is
   built in `ITSCoreProvider`, which has `ctx.config.localization`, so passing them at the call
   is simpler than in the constructor). New types: `VinofactBottleImage = { url: string; alt:
   Record<string, string | null> | null; width: number | null; height: number | null }`, `VinofactBottleImagesResponse = { wines: { id: string; bottleImage:
   VinofactBottleImage | null }[] }`. A requested id missing from the answer (wine deleted / other
   profile) counts as "not found in VinoFact". Export the new types from `src/types/index.ts` like
   the existing ones.
2. **Import helper** `src/lib/shop/vinofactImage.ts` (pure functions + one fetch, no React):
   - `bottleImageUrl(img: VinofactBottleImage): string` — replace `{{width}}`/`{{height}}` per D3.
   - `fetchBottleImage(img, fetchImpl = fetch) → Promise<Blob>` — plain
     `fetchImpl(bottleImageUrl(img))` per D2; throw with the status on `!response.ok`, throw if
     `content-type` doesn't start with `image/`. (`fetchImpl` only so tests can stub it.)
   - `uploadBottleImage(client, blob, { wineId, url }) → Promise<string /* asset _id */>` via
     `client.assets.upload('image', blob, { filename: \`vinofact-${wineId}.${ext}\`, source: {
     name: 'vinofact', id: wineId, url } })` (`ext` from the blob's type; same call pattern as
     `components/actions/generatedZips.tsx:150`); return the uploaded document's `_id`.
   - `vinofactLocaleKey(locale)` + `VINOFACT_LOCALES` per D4 (exported for step 1's selection).
   - `buildLocaleAltImage(assetId, alt: VinofactBottleImage['alt'], locales, existingAlt?:
     InternationalizedArrayString)` → `{ _type: 'localeAltImage', asset: { _type: 'reference',
     _ref: assetId }, alt? }` (shape = `LocaleAltImage`, `src/types/sanity.types.ts:1198`). `alt`
     per D11, in `locales` order: for each locale, an `existingAlt` entry with `e.language ===
     locale` and a non-blank `value` is **kept as is** (same `_key`, so the field diff shows no
     change); otherwise VinoFact's `alt?.[vinofactLocaleKey(locale)]` becomes a new entry via
     `buildI18nTitle([{ locale, value }])` (`lib/shop/productVariant.tx.ts:21`; it drops blank
     values and trims). Result empty → omit `alt`. Entries for languages not in `locales` are
     dropped. Entry shape (checked: `InternationalizedArrayStringValue`, plugin 5.2.0, and Tinhof
     development data — every entry has `language`, none keyed by `_key` only): `{ _key, _type:
     'internationalizedArrayStringValue', language, value }`; the form value (`props.value?.alt`,
     step 3) and the GROQ `image.alt` (step 4) have this same shape.
   - `importBottleImages(deps: { client: SanityClient; vinofactClient: ITSVinofactClient;
     locales: string[]; fetchImpl?: typeof fetch }, targets: { variantId: string; wineId: string;
     existingAlt?: InternationalizedArrayString }[]) →
     Promise<{ imported: number; noImage: number; failed: number }>` — one `getBottleImages(ids, locales)` call
     for all wine ids, then per target sequentially (D8): fetch → upload → `client.patch(variantId)
     .set({ image }).commit()`. `variantId` is the exact document id to patch (draft or published,
     chosen by the caller per D7). Per-target errors are counted, not thrown (log them with
     `console.error`); only a failing `getBottleImages` throws. Used by steps 4 and 5.
   - Unit tests `tests/vinofactImage.test.ts` (vitest, no network): `bottleImageUrl` (filled, null
     size → 3000), `vinofactLocaleKey` (`zh-cn` → `zhCn`, unknown → filtered), `buildLocaleAltImage`
     (shape, per-locale values, a `null` locale skipped, all null → no `alt`; D11: an existing
     `de` alt kept while an empty `en` is filled from VinoFact, a whitespace-only existing alt
     counts as empty, a kept entry keeps its `_key`, a `fr` entry not in `locales` is dropped),
     `vinofactEndpoint` (`https://www.vinofact.com/api/v1/graphql` →
     `https://www.vinofact.com/api/graphql/v2026-11-14/`, `''` → the default origin's URL,
     `'not a url'` throws), `importBottleImages` with a stubbed
     client/fetch (counts for ok / null `bottleImage` / missing id / HTTP 404). Extend the live
     `tests/vinofact.test.ts` with one `getBottleImages` call (skipped without env, like the rest).
3. **Variant field button** (main place): new component
   `src/components/products/VinofactImageInput.tsx`, wired on the variant's image field:
   `f('image', 'localeAltImage', { components: { input: VinofactImageInput } })`
   (`schemas/documents/productVariant.ts:139`, "media" group; only when
   `ctx.featureRegistry.isFeatureEnabled('shop.vinofact')` — read it in `build` next to
   `stockEnabled`/`freeShippingOn` — otherwise the field stays as is). The input reads `useFormValue(['kind'])` and
   `useFormValue(['wine', 'vinofactWineId'])`, renders `props.renderDefault(props)` and below it a
   `<Button>` "Flaschenbild aus VinoFact übernehmen" only when `kind === 'wine'` and the id is set.
   With an image already set (`props.value?.asset`): label "Neu übernehmen" and a confirm dialog
   (`@sanity/ui` `Dialog`, focus moves into it, Escape closes, focus returns to the button). The
   dialog text says the new image replaces the old one (crop reset) and that existing alt texts
   are kept — clear them first to take VinoFact's (D11).
   Click → `getBottleImages([id], fieldLocales)` (id missing from `wines` or `bottleImage: null` → the "no image
   in VinoFact" toast) → helper fetch/upload (`sanityClient` from `useITSContext()`; locales =
   `config.localization.fieldLocales`) → `props.onChange(set(buildLocaleAltImage(assetId,
   bottleImage.alt, fieldLocales, props.value?.alt)))` (whole value replaced, so an old
   crop/hotspot is dropped — correct for a new image; alt merged per D11) →
   lands in the draft like any edit. While running: button `loading` + `disabled`, `aria-busy` on
   the wrapper. Results as toasts (announced): success, "no image in VinoFact", error with the
   message/status; `vinofactClient` undefined → reuse the `vinofact.notInitialized` toast
   (`src/localization/resources/components_*.ts` → `vinofact.notInitialized.title/description`,
   as in `WineSelector.tsx:70`).
4. **Product document action** "Flaschenbilder aus VinoFact übernehmen":
   `src/components/products/ImportBottleImagesAction.tsx`, registered in `src/config/actions.ts`
   in a **new** block `if (isEnabledSchema(context.schemaType, 'product', 'shop.vinofact'))`
   after the `AddVariantsAction` one (that one is under `'shop'`, so it can't be shared). Clients,
   locales and `componentT` come from `useITSContext()` (works in document actions, as in
   `AddVariantsAction`); `vinofactClient` undefined → the `vinofact.notInitialized` toast. Returns `null` unless the product (`props.draft ?? props.published`) has
   `kind === 'wine'`; disabled while running or when the product isn't published (like
   `AddVariantsAction`). On click: fetch the product's variants with **`{ perspective: 'raw' }`**
   (the client's apiVersion `v2025-05-25` defaults to `published`, which hides drafts):
   `*[_type == "productVariant" && product._ref == $id && kind == "wine" && !(_id in
   path("versions.**"))]{ _id, "wineId":
   wine.vinofactWineId, "hasImage": defined(image.asset), "existingAlt": image.alt }` (passed on as
   the target's `existingAlt`, D11). Group by published id
   (`_id` without `drafts.`); per variant use the draft row if present, else the published one
   (D7; `props.id` is the published product id, which is what variants reference). Targets = rows with a `wineId` and **without** `hasImage`. None → info toast "Alle
   Varianten haben schon ein Bild". Else `importBottleImages` and a summary toast:
   "3 übernommen, 1 ohne Bild in VinoFact, 0 Fehler" (`warning` status if failed > 0).
   `importBottleImages` throws when `getBottleImages` fails (network, 401, GraphQL error, a bad
   `SANITY_STUDIO_VINOFACT_API_URL` — D10): wrap the call in `try/catch` → `error` toast
   `vinofact.importFailed.title` ("Flaschenbilder konnten nicht übernommen werden") with
   `err.message` as description; `finally` clears the running state.
5. **ProductManager option:** a `@sanity/ui` `<Checkbox id=…>` with a `<label htmlFor=…>`
   "Flaschenbilder aus VinoFact übernehmen" (id from `useId()`) in `WineTab` (default checked; shown
   only when `vinofactClient` is set), as the last child of WineTab's `content` `<Stack>` (after
   the "add variant" row, so it sits right above `ProductTab`'s submit button). `WineTab` is
   also rendered by `AddVariantsAction`'s dialog, so both get it. Changes:
   - `WineTabProps.onSubmit` (`ProductCreator.types.ts:113`) →
     `(rows: WineRow[], options: { importBottleImages: boolean }) => Promise<void>`;
     `WineTab.tsx:347` passes the checkbox state.
   - `addWineVariantToTx` (`lib/shop/productVariant.tx.ts`) returns the created variant `_id`
     (`string | undefined` when the row is skipped) instead of `void`.
   - `commitTransaction` (`lib/hooks/useProductTransaction.ts`) returns `Promise<boolean>`
     (`true` after a successful commit; today it swallows errors, so callers can't tell).
   - Note: `WineTab.handleSubmit` resets its rows after `await onSubmit(...)` whether or not the
     commit worked (today's behaviour) — unchanged; the import only depends on the boolean.
   - `ProductCreator.handleWineSubmit` and `AddVariantsDialog.handleWineSubmit` collect
     `{ variantId, wineId: row.wine.id }`, and if the commit succeeded and the option is on, run
     `importBottleImages` (published ids, D7) without awaiting it in the submit (the form resets
     as today; `AddVariantsDialog` closes via `onClose` — the running promise and `toast.push`
     outlive the unmount, so that is fine); its summary toast as in step 4. Not awaited, so chain
     `.catch` → the same `vinofact.importFailed` error toast as step 4 (otherwise a failing
     `getBottleImages` is an unhandled rejection with no message). Failures don't undo the
     product.
6. **Product link after creation** (independent of the rest; can ship first), per D9:
   - `commitTransaction(tx, count, onSuccess, link?: { documentId: string; documentType:
     'product' })`. `ProductCreator.tsx` passes the `productId` from `addProductToTx` (wine,
     physical/digital, bundle submits). `AddVariantsAction` passes nothing (the product is open).
   - In `useProductTransaction`, take `useRouter()` from `sanity/router` (the hook runs inside the
     tool / document pane, both in router context) and, when `link` is given, make the success
     toast's `description` (`ToastParams.description` is a `ReactNode`) a `<Stack gap={2}>` with
     the **existing** `productCreated.description` text and a
     `<Button mode="ghost" text="Produkt öffnen" />` (without `link` the description stays the
     plain string, as today) whose `onClick` calls
     `router.navigateIntent('edit', { id, type })` — captured router, not `IntentLink`, because the
     toast portal renders outside the router context. Toast `duration: 10000`.
   - **Persistent link:** `ProductCreator` keeps the last created `{ id, title }` in state (title
     = the default-locale entry of `titles`, read in the submit handler before `resetShared`) and
     renders, under the header, a `<Card tone="positive">` "Zuletzt angelegt: <title>" with an
     `IntentLink` (`intent="edit"`, `params={{ id, type: 'product' }}`) "Produkt öffnen" (in the
     tool, router context exists). Cleared on the next submit. This is the WCAG 2.2.1-safe path.
   - i18n: `productCreatorTool.messages.productCreated.open` (de "Produkt öffnen", en "Open
     product"), `productCreatorTool.lastCreated` (de "Zuletzt angelegt: {{title}}", en "Last
     created: {{title}}").
7. Localization (de/en) for all new strings in `src/localization/resources/components_de.ts` /
   `components_en.ts` (button
   labels, confirm dialog, action label, summary toasts with `_one`/`_other` plurals, checkbox,
   `vinofact.importFailed.title` next to the existing `vinofact.notInitialized` /
   `winesLoadedError` keys).
   Typegen unchanged (no schema change — only an input component on an existing field).
8. Docs + release: core-back `.claude/architecture/studio-components.md` (Product Manager:
   checkbox, persistent link; field input; document action), `CHANGELOG.md` entry (minor:
   new features, no customer change — uses the `vinofactToken` already required since 6.0.0; the
   Studio now calls VinoFact's dated API `v2026-11-14`, built from the origin of
   `SANITY_STUDIO_VINOFACT_API_URL`, which is now optional — default `https://www.vinofact.com`;
   the unused config field `integrations.vinofact` is removed, env only — no customer set it).
   Docs: core-back `.claude/architecture/plugin-and-config.md:86` (drop the
   `integrations.vinofact` config entry), `:97-98` and `CLAUDE.md:47` (URL optional, origin only,
   env only).

### core-front

9. **Dated VinoFact API** (vino-facts plan 924 §6, D10), `src/data/vinofact.ts`:
   - `export const VINOFACT_API_VERSION = '2026-11-14'` and
     `export const VINOFACT_DEFAULT_ORIGIN = 'https://www.vinofact.com'` next to `fieldSelections`,
     and `vinofactEndpoint(endpoint?: string): string` =
     `` `${new URL(endpoint || VINOFACT_DEFAULT_ORIGIN).origin}/api/graphql/v${VINOFACT_API_VERSION}/` ``
     (export it for the test).
   - URL optional, config field removed (D10): `resolveFeatures` (`src/config/config.ts:199-204`)
     builds the integration from env only — `env.vinofact.accessToken && env.vinofact.profileSlug
     ? { endpoint: env.vinofact.endpoint, accessToken: …, profileSlug: … } : undefined` (no
     `vinofactInput?.integration ??`, no endpoint in the condition). Types
     (`src/types/config.ts:110-124, 143, 166`): `VinofactConfig.integration.endpoint` →
     `endpoint?: string`; the customer input `ItsshopsFeatures.shop.vinofact` becomes
     `Omit<VinofactConfig, 'integration'>` (`enabled`, `fields`). The resolved
     `Features.shop.vinofact` keeps `integration` — it carries the env values to
     `resolver.ts:102` (fetch only if set, unchanged) and `fetchVinofactWines`.
   - `fetchVinofactWines` (`src/data/vinofact.ts:118-145`): `const url =
     vinofactEndpoint(endpoint)` before the first request, passed to both `requestWines` calls,
     printed in `fail`'s `Endpoint:` line. No wrapping (D10): an invalid value throws `Invalid URL`
     with the input and fails the build.
   - `fieldSelections`: `certificates { … image { url alt ${L} } }` and
     `bottleImage { url alt ${L} }` (now a template string like the others) (today `alt` is a bare `String`; on the dated
     schema it is a `LocalizedString` and a bare `alt` fails validation — vino-facts' contract test
     showed exactly that).
   - No resolver change: `resolveLocaleMaps` (`src/data/resolve/variants.ts:116`) already turns any
     object whose keys are all locale keys into the locale's string (fallback default locale, then
     `null`), so `alt` reaches templates as a string, as now. Only new case: `null` when VinoFact
     has no alt (the bottle image's asset alt; the certificate alt = its name, so never empty in
     practice). Type: `VinofactImage.alt: string | null` (`src/types/vinofact.ts`);
     `vinofactImage()` already does `alt ?? image?.alt ?? ''` (`src/image/index.ts`).
   - What changes for **live** shops: Tinhof and Schuster request `certificates` (not
     `bottleImage`); their templates don't render the certificate image alt (Tinhof's
     `overridable/product/container.njk` uses `cert.name` only). Their data is otherwise the same
     (dated API changes only the alts and adds `extensions.code` to errors; core-front reads only
     `errors[0].message`, unchanged). Jurtschitsch (not live) uses `bottleImage.url` only.
   - Tests in `src/data/__tests__/vinofact.test.ts` (fetch is stubbed via its `stubFetch`;
     `run()` passes locales `['de']`): the request goes to
     `https://vinofact.test/api/graphql/v2026-11-14/` for the existing config endpoint
     `https://vinofact.test/graphql` (assert `fn.mock.calls[0][0]`); with `integration.endpoint`
     omitted it goes to `https://www.vinofact.com/api/graphql/v2026-11-14/`; with `fields:
     ['bottleImage', 'certificates']` the parsed request body's `query` contains `bottleImage { url
     alt { de } }` and `image { url alt { de } }`; `endpoint: 'not a url'` rejects and `fn` was
     never called.
   - `resolveConfig` test: new `src/config/__tests__/vinofact-config.test.ts`, set up like
     `templates-gate.test.ts` (`SANITY_PROJECT_ID`/`SANITY_DATASET ??= 'test'`); `vi.stubEnv`
     `VINOFACT_API_TOKEN` + `VINOFACT_PROFILE_SLUG`, `VINOFACT_API_URL` stubbed to `''` →
     `resolveConfig({}).features.shop.vinofact.integration` is defined with the token and slug;
     without the token → `undefined`. `vi.unstubAllEnvs()` in `afterEach`. (The existing
     `vinofact.test.ts` passes a resolved `VinofactConfig` with `integration` straight to
     `fetchVinofactWines` — still valid, that type keeps the field.)
   - Resolver test: **export** `resolveLocaleMaps` from `src/data/resolve/variants.ts` (internal
     export for the test, not re-exported from `src/index.ts`; driving it through `resolveVariants`
     needs a full ctx/permalinks fixture for no gain) and add to `vinofact.test.ts`:
     `resolveLocaleMaps({ bottleImage: { url: 'u', alt: { de: 'x', en: null } } }, 'en', 'de')` →
     `{ bottleImage: { url: 'u', alt: 'x' } }` (default-locale fallback); same with locale `'de'`
     → `'x'`; `alt: { de: null, en: null }` → `alt: null`; `certificates: [{ image: { url: 'u',
     alt: { de: 'Bio' } } }]` → `alt: 'Bio'` (arrays recurse).
10. Remove the fallback (D6) in `src/schema/index.ts:176-180` (`image = _variantImg ?
   imageUrl(_variantImg, 1200) : undefined`) and drop the `vinofactImageUrl` import (line 7; its
   only use there). `src/schema/__tests__/schema.test.ts` has no bottle-image case today — add one
   asserting that a variant with `wine.bottleImage` but no Sanity image gets **no** `image`.
11. Docs: `data-layer.md` → VinoFact (dated API: `VINOFACT_API_VERSION`, only the origin of the
    endpoint is used, how to bump; bottleImage = for customer templates only),
    `plugin-and-config.md:31/52` + `configuration.md:32/46/148` (`VINOFACT_API_URL` optional override,
    origin only, default `https://www.vinofact.com`; the env integration needs token + slug;
    `integration` gone from the `shop.vinofact` config — env only), `data-layer.md:17/204`
    ("when `shop.vinofact.integration` is set" → "when `VINOFACT_API_TOKEN` + `_PROFILE_SLUG` are
    set"),
    `.claude/workflows/new-customer.md:78` (drop `SANITY_STUDIO_VINOFACT_API_URL` from the
    backend `.env` list, and `VINOFACT_API_URL` wherever it lists the frontend env), and
    `customer-starter.md` if its env templates list the URL vars, `templates-and-assets.md` → schema.org (image source order). CHANGELOG — **minor**
    (no customer change; `VINOFACT_API_URL` is optional now, existing values keep working; the
    unused `features.shop.vinofact.integration` config field is removed — no customer set it; no live shop loses
    anything: Tinhof and Schuster don't query `bottleImage`; Jurtschitsch isn't live, so no
    compat needed); the entry says "VinoFact: dated API `v2026-11-14` (alts per language)" and
    "schema.org no longer falls back to the VinoFact bottle image".

### VinoFact

12. ~~#922 released to prod~~ — done 2026-11-14 (prerequisite for steps 3–5). There is no VinoFact
    stage server, so test the import against prod images.
13. Register both cores as consumers of the dated API in vino-facts (Heini's repo, review there),
    so a later dated change can't silently break them: contract files in
    `src/vino_facts/api/tests/consumers/` — `core-front-v2026-11-14.graphql` (the step 9 query with
    every field, `{ de en }`; vino-facts `versioning.md` already asks for it "when core-front
    moves") and `core-back-v2026-11-14.graphql` (`getWines`, `getBottleImages` with
    `alt { de en }`) — and update `.claude/graphql/versioning.md` → "Known consumers" (core-front
    row: endpoint now dated; new core-back Studio row). Keep `core-front-v1.graphql` while a pinned
    old core-front still calls `/api/v1/graphql`. Retiring a date: VinoFact's access-log rule is
    enough for us (owner, 2026-11-14) — only active customers use VinoFact (Tinhof, Schuster,
    Jurtschitsch; no dormant project has it in its config), each builds on every Studio Deploy, so
    its date keeps showing in the log; a retired date would fail the build loudly
    (`fetchVinofactWines`), never publish without wine data. The contract files name the dates our
    cores use.

## Rollout

1. Before removing the fallback, per active customer count wine variants with neither a variant nor
   a product image (`sanity count` takes type names, not a filter — use `query`), dev + production
   (`-e <env file>`, check the printed dataset line):
   `itsshops sanity query 'count(*[_type == "productVariant" && kind == "wine" && !(_id in
   path("drafts.**")) && !defined(image.asset) && !defined(product->image.asset)])'`.
   Jurtschitsch (not live) is the one that may rely on the fallback.
   **Done 2026-11-14:** production has **no** gaps — Tinhof 0 of 106 wine variants, Jurtschitsch 0
   of 6, Schuster's production dataset has no wine variants yet. Development only (test data, all
   with a VinoFact id, so the import can fill them): Tinhof 2 of 95 (Feuersteig 2015, 2013),
   Schuster 2 of 7 (Ried Lamer Blaufränkisch 2023, 2024), Jurtschitsch 2 of 7 (Chardonnay
   classic 2024, Ried Käferberg 2024). → Step 10 needs no wait.
2. Toast/persistent link (step 6) and the import ship together (#922/#924 are live). Feature branch in core-back (`feature/vinofact-bottle-import`), test against the
   Schuster backend via `npm link`. **Schuster's backend floats core-back on commit `0ad40d8`
   (5.0.0)** — pulling this release crosses core-back **6.0.0** (secrets document): before testing,
   do its CHANGELOG 6.0.0 migration for Schuster (`vinofactToken` via the Integrations dialog,
   remove `SANITY_STUDIO_VINOFACT_API_TOKEN` from `.env` — it is still there — and the Studio's
   Netlify env; rotate the token afterwards — **code side done 2026-11-14**, backend `251b894`,
   frontend `139021b`; open: Integrations dialog entries, Netlify env, token rotation), otherwise `vinofactClient` is undefined and every
   import shows `vinofact.notInitialized`. Then test (step 3 field button, step 4 action on a product with a draft
   variant + one without, step 5 on a new product), then release core-back → Schuster backend pin:
   import all bottle images (bulk action per product), editors check crops. Update Schuster
   backend `CLAUDE.md` (import done / how editors use it).
3. core-front: step 9 (dated API) can ship on its own first — verify on Tinhof **staging**
   (`npm link` build locally, then a staging deploy): the build log shows the dated endpoint, no
   GraphQL error, product pages' wine data (certificates, awards, terroir) unchanged vs. production.
   Step 10 (fallback removed) once Rollout step 1 shows no gaps (or the gaps are filled by the
   import). Then per live customer: pin the core-front tag (Tinhof release flow), and after the
   release Heini sees `graphql/v2026-11-14` requests in VinoFact's nginx log; `/api/v1/graphql`
   requests should end once every shop is on it (vino-facts "Retiring a date").
4. Tell editors: the import is a copy; re-import after a new bottle shot in VinoFact.
5. **Remove the URL env vars** (D10) — per customer and environment, **only after** the release
   that pins the new core is live **in that environment**. With an older core an unset URL means
   no `integration` → the frontend build skips VinoFact and publishes wines **without** wine data
   (no error: `fetchVinofactWines` returns an empty map), and the Studio has no `vinofactClient`.
   Order: staging first (after the staging deploy with the new core), production after the
   production release. Where:
   - frontend: `VINOFACT_API_URL` in the Netlify env of **both** projects (staging, production)
     and the local `.env`; rebuild, check the build log shows the dated
     `https://www.vinofact.com/api/graphql/v2026-11-14/` and product pages still have wine data;
   - backend: `SANITY_STUDIO_VINOFACT_API_URL` in the `.env` and the Studio's Netlify env (a
     Studio build bakes `SANITY_STUDIO_*` in, so redeploy the Studio), then the Product Manager
     still lists wines.
   Tinhof first (live; frontend + backend), then Schuster, Jurtschitsch. Keep the var only where
   it overrides (a local dev `.env` pointing at a VinoFact dev server). Update each customer's
   `CLAUDE.md` if it names the var.

## Open

- None. (Decided 2026-11-14: alt merge D11; no wine-title alt fallback in core-front — after
  step 10 nothing in core renders `bottleImage`, Jurtschitsch uses only its URL, and Sanity
  product images without an alt render `alt=""` next to the visible title, which is fine;
  a bottle shot without an alt in VinoFact and no existing alt imports without one — editors set it.)
