# VinoFact API version lives in core code; the URL env var is only an origin override

Status: accepted
Date: 2026-11-14 (core-front after 5.1.0, core-back after 6.1.0 — both unreleased at the time)

## Context

VinoFact introduced date-versioned GraphQL (`/api/graphql/v<YYYY-MM-DD>/`, VinoFact #924; vino-facts
plan 924 §6). On the dated schema localized fields — image `alt`s included — are `LocalizedString`s
that must be selected per language (`alt { de en }`); on `/api/v1/graphql` `alt` stays a frozen
`String`. The endpoint used to come from env (`VINOFACT_API_URL` in the frontends,
`SANITY_STUDIO_VINOFACT_API_URL` in the backends) as a full URL, while the query shape is in core
code. A shop pinned to an old core but pointed at a dated URL (or the reverse) sends a query the
schema rejects — for the frontend that fails the build (`vinofact-failure-fails-build.md`). The
config fields `features.shop.vinofact.integration` (core-front) and `integrations.vinofact`
(core-back) were never used by any customer (checked Tinhof, Schuster, Jurtschitsch).

## Decision

- Each core has its own `VINOFACT_API_VERSION` constant next to its queries (`src/data/vinofact.ts`
  here, `src/external/vinofact.ts` in core-back) and builds the endpoint as
  `<origin>/api/graphql/v<version>/` (`vinofactEndpoint`). Bump both together, same date, never to a
  date after the VinoFact release (a future date answers 400).
- The URL env vars are **optional** and only their **origin** counts (default
  `https://www.vinofact.com`) — kept only to point at another VinoFact, e.g. a dev server (owner,
  2026-11-14).
- The unused config fields are removed; endpoint/token/slug come from env (core-back: the token
  from the secrets document).
- No own URL validation (owner, 2026-11-14): only the developer sets the value and a bad one
  already fails loudly — `new URL` throws, a scheme-less `localhost:8000` gives origin `"null"` and
  `fetch` fails. The Studio builds the URL per request inside `fetchData`, so a bad value ends in
  an error toast instead of breaking the provider's render.

## Consequences

- Query shape and API version can't drift apart per shop; a pinned core keeps working whatever the
  env says.
- A dated version stays valid because VinoFact freezes each version's whole schema
  (`api/graphql_schema/v<date>.graphql`, checked by its tests) and ships changes only under a new
  date — no per-consumer contract files for the cores (owner, 2026-11-15).
- After a release the URL vars can be deleted from the shops' env — only once that environment runs
  the new core (an old core without a URL builds without VinoFact data).
- core-back re-copies `VINOFACT_LOCALES` from VinoFact's `LocalizedString` when bumping (an unknown
  key fails the whole query).
