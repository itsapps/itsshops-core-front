# Bundles are packed with the rest of the cart; non-wine items pay weight rates

Status: accepted · Date: 2026-10-25 (B, D), re-confirmed 2026-11-06

## Context
Wine packaging (`calcWinePackagingCost`) boxes wine bottles by packaging groups and prices
non-wine items by the weight `rates` on top. A bundle's own carton (gift box, 3-pack) isn't
modelled, and a bundle mixing wine with non-wine items adds a weight-rate parcel to the boxes.

## Decision
- **B:** a bundle's wine bottles are pooled with the loose bottles and re-boxed together — today's
  calculation; Jurtschitsch re-boxes its bundles with the cart. No separate bundle carton.
- **D:** non-wine weight (loose or inside a bundle) keeps paying the weight rates on top of the
  boxes. Errs on the safe side (a mixed cart is overcharged a little, never undercharged) and
  matches the product-page markup (schema.org shipping uses the same code).
- Bundle contents are **not** restricted to wine (grass-art has physical-only bundles).

## Consequences
Revisit D when Jurtschitsch sells a mixed wine + physical bundle (only it allows both kinds):
then choose "non-wine rides free in the wine box" vs "free only inside bundles" in
`calcWinePackagingCost`. Revisit B only if a shop ships bundles in their own carton.
Mechanism: `commerce-and-netlify.md` → Wine packaging, Shipping weight.
