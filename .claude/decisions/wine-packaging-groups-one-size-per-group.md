# Wine packaging: groups (box types), each bottle size in exactly one group

Status: Accepted
Date: 2026-10-14

## Context

Packaging used to be configured per bottle volume (`packagingConfigs`: volume → packages); sizes
never shared a box. Tinhof wanted to drop the 375 ml packages and pack half bottles into the 750 ml
boxes, two per place (2 × 375 → 1-box, 12 × 375 → 6-box, 4 × 750 + 4 × 375 → 6-box). No other shop
was live, so the model could be redesigned instead of bolting a "borrow another volume's packages"
option onto the old one.

Alternatives discussed:
- **Boxes that accept only certain sizes** ("nur für") plus sizes in several box types, with the
  checkout searching the cheapest split. Would allow cheap half-bottle-only boxes next to shared
  ones (keeping 1–2 × 375 at today's €3/€4 instead of €6) or 2 × 750 in a 1.5 l box. Needs an
  assignment search instead of a per-group count, and more Studio rules. Nobody needed it: Tinhof
  accepted the higher price for small half-bottle orders, and 1.5 l / 2 l keep their own boxes.
- **3D box packing** (product/box dimensions, as WooCommerce box-packing plugins do) — far more
  data entry for the admin, no gain for wine.
- **Free group title** — dropped; labels can't drift from the sizes and need no translation.

## Decision

- `shippingMethod.packagingGroups[]`: a group = boxes (`places`, price) + bottle sizes
  (`volume`, `perPlace` = bottles per place, integer ≥ 1). **Each size in at most one group per
  method** (Studio validation), so the checkout never has to choose a box type for a bottle: per
  group, places are summed and rounded up once, then the existing min-cost DP picks the boxes.
- A size listed in no group goes into the group of the **next larger listed size, 1 per place**
  (logged); only a size larger than every listed one makes the method unavailable. This replaced
  the old weight fallback, which priced unlisted sizes by weight rates — and charged nothing when a
  method had no rates (Tinhof's 500 ml).
- No text fields; every label is generated from the sizes. The order snapshot keeps the field name
  `packSize` (places) and adds `volumes[]` (the group's sizes), so old orders need no migration.

## Consequences

- Small half-bottle orders can cost more than with dedicated 375 ml packages (Tinhof AT: 1 × 375
  €3 → €6); mixed and large orders get cheaper.
- Box types that accept only some sizes, or a size in two box types, are not possible. If that's
  ever needed, extend boxes with an accepted-sizes list and search the splits (the "nur für" idea);
  the group model stays a special case of it.
- The old `packagingConfigs` field is kept hidden for one core-back release (live frontends on the
  old core keep pricing while groups are entered), then removed.
