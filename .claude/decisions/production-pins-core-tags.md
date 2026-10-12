# Production pins core by git tag; core and customers are versioned with semver tags

Status: accepted
Date: 2026-10-12

## Context
Customers consume core as a git dependency pinned only by commit in `package-lock.json` (no npm
registry). Tinhof went live on untagged core commits (core-front `fa8124f`, 104 commits past tag
`1.4.1`; core-back `8b8c16c`, 27 past `2.0.0`), so there was no named record of what production
runs, and several breaking changes (config moved to settings, `kasse` permalink default, required
settings fields) had accumulated unannounced since the last tags.

## Decision
- `production` of a customer never ships an untagged core: the release cuts a core version and pins
  it by tag in `package.json`. `main`/`staging` keep the fast lockfile-hash loop.
- Core follows semver measured **against the last tag**, not against what customers happen to run —
  hence 2026-10-12 cut core-front `2.0.0` and core-back `3.0.0` (major) although Tinhof and
  Jurtschitsch already ran those commits.
- Each core repo keeps a `CHANGELOG.md` whose "Upgrading" section lists what a customer must change.
- Tags have **no `v` prefix**, matching the existing tags (`1.4.1`, `2.0.0`); `.npmrc`
  `tag-version-prefix=""` makes `npm version` follow suit.
- Customer repos tag each production release (annotated, message names the core versions; backend
  and frontend tagged separately, the pairing named in the message).

## Consequences
- Every production release has a core tag + a customer tag → rollback targets and a record of what
  went live (Netlify deploy history stays the emergency rollback).
- A customer still on an older tag can read the changelog range to upgrade.
- Releasing costs a core version cut even for small changes. Steps:
  `.claude/workflows/consuming-core-and-deploy.md` → "Release flow".
