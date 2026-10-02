# Extending the frontend (custom schemas, fields, modules)

How a customer handles content the backend added that core doesn't know about — custom document
types, extra fields on core types, custom page modules. The frontend doesn't define Sanity schemas
(that's `itsshops-core-back`); it **extends its GROQ queries, resolution, and templates** to consume
them. All via `config.extensions` (type `Extensions`, `src/types/config.ts`) plus template overrides.

The data layer wires these in: query building in `src/data/queries.ts`, resolution in
`src/data/resolver.ts` + `src/data/resolve/`. See [data-layer.md](data-layer.md) for internals; this
is the customer how-to.

## The three injection points for GROQ

### `extensions.fields` — extra projection fields on core types
Keyed by core type: `product`, `variant`, `category`, `page`, `post`, `menuItem`. The string is GROQ
appended to that type's projection (`extraFields()` in `queries.ts`).

```ts
extensions: {
  fields: {
    variant: `"isLimited": isLimited, "awardLabel": award->title`,
    menuItem: `"badge": badge`,
  },
}
```
Resolve the raw values into the output with a `resolve` hook (below), or read them raw in templates.

### `extensions.modules` — custom page modules
Per document type, per module `_type`. A **string replaces** the core projection for that module; an
object `{ extraFields }` **appends** to it.

```ts
extensions: {
  modules: {
    page: {
      pinwallModule: `_type, "items": items[]{ _key, title, "image": image }`,   // full projection
      splitModule:   { extraFields: `"accent": accent` },                          // append
    },
  },
}
```
Render each custom module with an overridable template (below).

### `extensions.queries` — whole custom document types
A named GROQ query whose result is merged into `cms[locale].<name>`. Pair with `resolveData` to shape
per-locale output.

```ts
extensions: {
  queries: { events: `*[_type == "event"]{ _id, title, date }` },
  resolveData: (raw, ctx) => ({
    events: raw.events.map((e) => ({ ...e, title: ctx.resolveString(e.title) })),
  }),
}
// templates: cms[locale].events
```

## Resolution hooks (`extensions.resolve`)

Called per locale after core resolution for each item; return fields to merge into the resolved
output. One hook per core type:
`variant`, `product`, `category`, `page`, `post`, `menuItem`, `module` (every module), `company`.

```ts
extensions: {
  resolve: {
    variant(raw, { resolveString, resolveImage }) {
      return { isLimited: raw.isLimited ?? false, awardLabel: resolveString(raw.awardLabel) }
    },
  },
}
```
`ctx` (`ResolveContext`) gives you `resolveString`, `resolveImage`, locale, etc. — use them so the
merged fields are already locale-resolved, matching the rest of `cms`.

`extensions.resolveData(rawData, ctx)` does the same for `queries` results (whole custom types).

## Portable text (`extensions.portableTexts`)

Named sets of custom block/mark serializers. `'default'` is used by the bare filter:

```ts
extensions: { portableTexts: { rich: (ctx) => ({ /* PortableTextHtmlComponents */ }) } }
```
```njk
{{ content | portableText | safe }}          {# default set #}
{{ content | portableText('rich') | safe }}   {# named set #}
```

## Search (`extensions.search`)

`SearchConfig` builds the per-locale `search-<locale>.json` index: `searchFields` (MiniSearch fields),
and `buildEntry(variant, locale, ctx)` **or** `buildProductEntry(variants, locale, ctx)` (mutually
exclusive). `ctx` (`SearchBuildContext`) offers `imageUrl`, `imageSrcset` (using your `imageSizes`),
`formatVolume`. See client wiring in `src/scripts/search.ts`.

## Debug hooks

- `extensions.onRawDataFetched(raw)` — after all Sanity fetches, before resolution.
- `extensions.onCmsBuilt(cms)` — after the full `cms` is built.
Set breakpoints here to inspect data end to end.

## Templates for custom content

Extensions get the data in; templates render it (see [templates-and-assets.md](templates-and-assets.md)):
- custom page modules → `src/_includes/overridable/modules/<moduleType>.njk` in the customer project;
- custom document types → a page template paginating `cms[locale].<name>`;
- overriding any core template → place a file at the matching `overridable/` path.

## Putting it together (new backend document type)

1. Backend adds the schema (`itsshops-core-back`) — see its `schema-authoring.md`.
2. Frontend: `extensions.queries.<name>` (or `fields`/`modules` for additions to existing types).
3. `extensions.resolveData` / `resolve.<type>` to localize the raw values.
4. An `overridable/` template to render it; add `imageSizes` presets if it has images.

Live example: `jurtschitsch/webshop-frontend/src/_config/extensions.mts` + its
`overridable/modules/*.njk`.
