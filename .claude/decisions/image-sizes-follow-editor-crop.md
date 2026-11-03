# Open-height image presets follow the editor crop; `fit` presets ignore it

Status: accepted
Date: 2026-11-03 (core-front 3.6.3)

## Context

A `PictureSize` entry `[w, null]` means "keep the natural aspect ratio". Until 3.6.3 that ratio
came from the uncropped asset (`asset.dimensions.aspectRatio`), so core sent both `w` and `h`, and
Sanity then cut that (uncropped) ratio out of the editor's crop around the hotspot. Example: Rosi
Schuster's terroir background — a 5333×8000 portrait cropped to a landscape top half — came back as
a 2709×4064 portrait slice. Presets with `fit` call `ignoreImageParams()` and serve the whole image,
crop and hotspot dropped (downloads / galleries show the original).

## Decision

- `[w, null]` uses the **cropped** area's ratio (`sourceDimensions()` in `src/image/index.ts`); the
  source-width cap (3.6.1) uses the cropped width too. What the editor crops is what renders.
- Presets with `fit` keep the **whole image's** ratio — they never apply the crop, so using the
  crop's ratio there would shrink the image and give wrong `width`/`height` attributes.
- Uncropped images keep the old arithmetic (`w / aspectRatio`), not `w * h / w`: mathematically
  equal, but it floors 1px differently for some sizes, which would have changed every URL (CDN
  re-render) without a visible difference. Verified byte-identical URLs on all images of Tinhof
  production and Jurtschitsch / Rosi Schuster development.

Rejected: keeping the old behaviour as an option — no layout wants "the uncropped photo's ratio cut
out of the crop"; a fixed ratio is what `[w, h]` presets are for. Decoupling "ignore the crop" from
`fit` (e.g. `crop: 'ignore'`) was left until a case needs "show the crop, never upscale".

## Consequences

- With open-height presets the editor's crop decides the rendered shape and therefore layout height
  (Rosi Schuster's Weine banner got flatter). A layout that needs a stable height uses fixed `[w, h]`.
- Customers see the change only for cropped images and only after pinning ≥ 3.6.3.
