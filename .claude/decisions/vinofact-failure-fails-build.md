# A failed VinoFact request fails the build (one retry), not a degraded shop

Status: accepted
Date: 2026-11-03 (core-front 3.6.4)

## Context

`fetchVinofactWines` runs once per build (`src/data/resolver.ts`) and feeds the wine fields
(description, varietals, alcohol, awards, bottle image, factsheet …) of every variant. A network
error used to only `console.warn` and return an empty map, so a VinoFact hiccup during a Netlify
deploy published the whole shop without wine data — silently, since the build stayed green.
HTTP/GraphQL errors already threw, but without a retry.

## Decision

- Any failed request **throws** and fails the build. A red deploy keeps the last good one live;
  a green deploy without wine data replaces it.
- **One retry** (after 3 s) for transient failures only: network error, 30 s per-attempt timeout,
  429, 5xx, unparsable body. 401 / other 4xx / GraphQL errors fail immediately — a retry can't fix them.
- Wine IDs the API doesn't return (deleted/unpublished in VinoFact) only **warn** with the IDs:
  that's a content state, not an outage, and must not block deploys.

## Consequences

- A VinoFact outage blocks deploys (incl. editor-triggered rebuilds) until it's back — re-run the deploy.
- Local `serve` with `refetchData` also errors on a failed fetch instead of rendering without data.
- Tests: `src/data/__tests__/vinofact.test.ts`.
