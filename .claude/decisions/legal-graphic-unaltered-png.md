# Harmonised warranty notice: official graphic as pre-sized lossless PNGs

**Status:** Active
**Date:** 2026-10-08

## Context

FAGG §4 (1) requires the statutory-warranty information via the harmonised notice of Anhang II
(Implementing Regulation (EU) 2025/1960): a fixed graphic, no element editable, RGB online, with a QR
code. Shops already have an image pipeline (`assets/images/static` → eleventy-img, `staticImage`).

## Decision

- Core ships the official Commission artwork (page 1 = colour), rasterised once to 256-colour PNGs in
  two widths (600/1200) per language; the partial uses `srcset`, the email the 1200 file via a fixed
  URL (`/assets/legal/`).
- Rejected: eleventy-img / WebP. Lossy WebP alters colours and QR edges of a graphic that may not be
  altered; lossless WebP was larger than the indexed PNG for this graphic (measured: ~255 KB vs
  ~200 KB at 1000 px). Mail clients need one stable URL anyway.
- Rejected: each shop adding the file — the graphic is identical everywhere.

- Checkout shows a **compact** form (scaled thumbnail + one line linking to the full notice), not
  the full graphic: WKO's example is "a general notice on the website", the obligation is that it is
  clearly noticeable before ordering — so it stays visible, never behind a click/disclosure. The full
  notice lives on the "Versand & Zahlung" page and in the order confirmation. (Decided 2026-10-09;
  untested rule — owner/WKO confirm.)

## Consequences

- When regenerating: check the official blue stays exact and `zbarimg` decodes the QR code at both
  widths. No "Du" variant (not editable).
