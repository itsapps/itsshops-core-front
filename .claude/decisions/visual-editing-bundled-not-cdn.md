# Presentation overlay bundled in core, not loaded from a CDN

Status: accepted
Date: 2026-10-29

## Context

Preview renders loaded the Sanity Presentation overlay from esm.sh
(`@sanity/visual-editing@3.2.4?bundle`). That bundle still imports `@sanity/icons/<Icon>` subpaths
separately, and esm.sh answers every one of them with 404 "could not resolve build entry" (even when
pinned to an exact version). The overlay never started, and the Studio showed "Unable to connect to
visual editing". Firefox reports the 404s as CORS / MIME errors, which hides the cause. The pinned
3.x was also far behind the studios' Sanity v6.

## Decision

Core bundles `src/preview/visual-editing.ts` (`@sanity/visual-editing` 6, a devDependency, plus
React, styled-components and `@sanity/ui`) with esbuild in tsup `onSuccess` into
`dist/assets/visual-editing/` (JS + the `@sanity/ui` CSS). `setupAssets` ships it to
`/assets/visual-editing/` on every normal build, because the preview function's HTML loads it from the
deployed site. A CDN with a different resolver (jsdelivr `+esm`) was not adopted: it would keep the
same kind of external failure mode.

## Consequences

- Every customer build ships ~850 KB JS + 8 KB CSS that only preview renders use.
- Upgrading the overlay = bump the core devDependency + release core. Keep its major in line with the
  studios' `sanity` (they talk over a versioned protocol; verified with Sanity 6.9.2).
- Because core's `prepare` builds on a git install, customers must reinstall (not just swap the
  lockfile hash) when core's devDependencies change.
