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

## Git workflow (developing core)

Develop on `main` (create feature branches for larger work), always with **your own GitHub user**.
Core is a library consumed as a git dependency and is **never deployed to Netlify**, so the
customer-identity / PAT mechanism does not apply here — that's only for customer repos'
`staging`/`production` pushes (see `consuming-core-and-deploy.md`).

## Releasing a change to customers

There is **no npm registry** — customers consume core as a public GitHub git dependency. "Releasing"
is just:
1. `npm run build` (also runs on `prepare`/`prepublishOnly`) and `npm run test`.
2. Commit + push to GitHub (`main`, your own user).
3. Customers pick it up per `consuming-core-and-deploy.md`: bump the pinned commit in their
   `package-lock.json` (dev/test), or pin a git **tag** (go-live). A `package.json` version bump
   (currently 1.4.x) is for cutting that tag.

Commit/push only when the user asks.
