# Workflow: develop against a customer, release a version

## Local development (no dev server in this repo)

Core-front has no standalone dev server — develop against a consumer frontend.

1. In this repo: `npm run dev` (tsup watch + `watch-templates.mjs`).
2. In the customer frontend: `npm link @itsapps/itsshops-core-front` (once).
3. Run the customer's Eleventy dev server (via its `itsshops` CLI or npm script). Changes to
   `dist/` and `src/templates/` propagate without re-linking.

**Never use yalc** to push/publish this package — plain `npm link` only.

## Tests

`npm run test` (vitest). Meaningful coverage exists only in `src/netlify/__tests__/` (commerce math).
Run it after any change under `src/netlify/lib/`.

## Release

1. `npm run build` (also runs on `prepare`/`prepublishOnly`).
2. Bump version in `package.json` (currently 1.4.x).
3. Publish to the npm registry, then `npm update`/re-link in each customer that should pick it up.

Commit/push/publish only when the user asks.
