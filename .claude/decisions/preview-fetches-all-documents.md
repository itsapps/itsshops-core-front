# Preview builds fetch all documents, render only the previewed one

**Status:** Active
**Date:** 2026 (in code; rationale is an inline comment in `src/data/resolver.ts`)

## Context

In a Sanity visual-editing **preview** build, only the single previewed document is actually
rendered. The obvious optimization is to fetch just that document (by `preview.documentId`). But
resolved output depends on **cross-document references** — menu titles/URLs, portable-text internal
links, the locale switcher — which resolve through `cms[locale].urlMap` / `docMap`. If those maps are
incomplete, every such reference falls back to `#` / empty, so the previewed page renders with broken
nav and links.

## Decision

`buildCmsData` fetches **all** documents even in preview (no per-`_id` filter). Only
`config.preview.locale` is processed, and only the previewed document is rendered (the
`templates/pages/preview/` templates select it by `preview.documentId`). Stega + `resultSourceMap`
are enabled on fetches when `buildMode === 'preview'` and a `studioUrl` is set, for click-to-edit.

## Consequences

- Preview builds do a full data fetch (slower than a single-doc fetch) but render correct
  links/menus/locale switching.
- **Do not** "optimize" preview to fetch only the previewed document — it will silently break
  cross-references. See [data-layer.md](../architecture/data-layer.md) (Orchestration → preview).
