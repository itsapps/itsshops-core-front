# Image functions accept raw query images (`_id`), not only resolved ones (`_ref`)

Status: accepted
Date: 2026-11-03 (core-front 3.6.3)

## Context

Resolvers (`src/data/localizers.ts`) rebuild images as `ResolvedImage` with
`asset._ref = asset._ref ?? asset._id`. Queries dereference the asset (`asset->{ _id, … }`), so a
raw image has `_id` and no `_ref`. Portable-text image blocks are not resolved — they reach a
`portableTexts` extension's `types.image` serializer raw, and `PortableTextExtensionContext.image`
is offered exactly for rendering them. 3.6.1's SVG check read `asset._ref.endsWith('-svg')` and
threw for every such block (Jurtschitsch `richContentModule` failed to build).

## Decision

The image functions take `SanityImageInput` (`src/types/data.ts`: asset with `_ref` **or** `_id`)
and read `asset._ref ?? asset._id`. `ResolvedImage` stays as is and is still accepted.

Rejected as the only fix: normalising image blocks to `_ref` in `resolvePortableText` — it covers
only images that pass through that resolver; any customer calling `image()` with an image from its
own query would crash again. Sanity's URL builder itself accepts either id, so the image functions
match its contract.

## Consequences

- Never read `asset._ref` alone in image code (rule in `templates-and-assets.md` → Images).
- Normalising portable-text images in the data layer is optional consistency work, not needed for
  correctness.
