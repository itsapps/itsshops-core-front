# Plan — wine packaging groups (mixed bottle sizes per box)

Status: **implemented, unreleased** (2026-10-14) — core-back + core-front code, tests, docs and
CHANGELOGs done (uncommitted at time of writing). Left: commit, release (core-back 4.0.0 → enter
groups in Tinhof production → core-front 3.0.0), then delete this plan. Deviation: the order
snapshot keeps the field name `packSize` (= places) instead of renaming it to `places`.
Planned 2026-10-13. Origin: Tinhof — drop the separate 375 ml
packages; half bottles go into the 0.75 l boxes, two per place.

Spans core-back (schema, OrderView) and core-front (data layer, shipping calc, info module). Read
core-back's `CLAUDE.md` before touching it. When this ships, move the durable parts into
`.claude/architecture/commerce-and-netlify.md` (shipping section) + core-back's docs, add a
`CHANGELOG.md` entry to both repos (breaking → major), and delete this file.

## Requirement (Tinhof)

375 ml bottles are packed in the 750 ml boxes, two half bottles taking one place:

| Cart | Places | Box |
|---|---|---|
| 2 × 375 | 1 | 1-place box (0.75 l) |
| 12 × 375 | 6 | 6-place box |
| 4 × 750 + 4 × 375 | 4 + 2 = 6 | 6-place box |
| 3 × 375 | 1.5 → 2 | 2-place box |

Places are summed per box type first and rounded up **once** (4 × 750 + 3 × 375 = 5.5 → 6, not
4 + 2).

Not a backwards-compat constraint: only Tinhof is live; Jurtschitsch and the others aren't released,
so the model can be redesigned (Tinhof's data is migrated, see below).

## Current model (as of 2026-10-13)

- `shippingMethod.packagingConfigs[]` = `winePackagingConfig { volume, packages[] }`,
  `winePackage { count, price }` (core-back `src/schemas/objects/winePackag*.ts`), unique volume per
  method.
- `calcWinePackagingCost` (`src/netlify/lib/shipping.ts`) groups cart wine (incl. bundle children)
  **by volume** and runs `calcMinPackagingCost` (min-cost DP, allows over-coverage) per volume —
  sizes never share a box.
- A volume without a config falls back to weight (`estimateWineBottleWeight`) added to the non-wine
  weight, priced via `rates`. **Bug:** if the method has no `rates` (Tinhof's do not), that weight
  is silently not charged → a 500 ml bottle would ship with no packaging cost (Tinhof's only
  500 ml variant, "Flora", is archived as of 2026-10-13, so not currently buyable).
- Order snapshot: `fulfillment.packagingLines[]` = `fulfillmentPackagingLine { volume, packSize,
  quantity, price }` (`order-builder.ts:115`), shown in core-back `OrderView.tsx` (~l. 430).
  `wc-api.ts` only queries/types it (l. 75, 398) — not emitted to wineNET.
- Rendered in `templates/core/modules/shippingInfoModule.njk` (one price table per volume), data via
  `data/queries.ts:219` + `data/resolve/settings.ts:65`; checkout fetch in
  `netlify/services/sanity.ts:60`.

Live data: Tinhof DPD AT — 375: 1/2/6 · 750: 1/2/3/6/12 · 1500: 1 · 2000: 1; DPD DE — 375: 1 ·
750: 1/2/3/6/12 · 1500: 1 · 2000: 1. Tinhof also sells **500 ml** (no config). Jurtschitsch
(development) PostAG — 750: 1/2/3/6/12 · 1500: 1.

## New model: packaging groups

A **packaging group** is a box type: the boxes you can buy, and which bottle sizes go in them.
Replaces `packagingConfigs` on `shippingMethod`:

```
shippingMethod.packagingGroups[]  (packagingGroup)
  packages[] (packagingGroupPackage)    { places: int ≥ 1, price }
  bottles[]  (packagingGroupBottle)     { volume (volumeOptions), perPlace: int ≥ 1, default 1 }
```

`perPlace` = bottles of this size per place (375 → 2). Integers only, so editors never type 0.5.

**No text fields.** Admins only enter boxes and bottles; every label is generated from the group's
volumes, largest first ("0,75 l / 0,5 l / 0,375 l") — Studio preview, order snapshot, info-page
caption. Nothing to translate, can't drift from the actual sizes. (A free `title` was considered
and dropped 2026-10-14.)

Examples:

| Shop | Group | Packages | Bottles |
|---|---|---|---|
| Tinhof (AT + DE) | Karton 0,75 l | 1/2/3/6/12 | 750 ×1, 375 ×2, 500 ×1 |
|  | 1,5 l | 1 | 1500 ×1 |
|  | 2,0 l | 1 | 2000 ×1 |
| Jurtschitsch (likely the same) | Karton 0,75 l | 1/2/3/6/12 | 750 ×1 (+ 375 ×2, 500 ×1 if sold) |
|  | 1,5 l | 1 | 1500 ×1 |

Confirmed setup (2026-10-14): Tinhof drops the separate 375 ml packages; 375 → 0.75 l boxes, two
per place; 500 → 0.75 l boxes, one per place (listed explicitly — the fallback would do the same);
1500 and 2000 each keep their own box. Prices as today per box.

Studio validation (method level): each volume in at most one group; each group ≥ 1 package and
≥ 1 bottle; `places` unique within a group.

## Calculation (`shipping.ts`)

1. Collect wine bottles per volume (as today, incl. bundle children × bundle qty).
2. Map each volume to its group. **Fallback for a volume no group lists:** the group containing
   the smallest listed volume ≥ it, at `perPlace` 1 (500 ml → 0.75 l box, one place). Only if no
   larger listed volume exists in any group (e.g. 3 l with groups up to 2 l) → method not
   applicable. Replaces the weight fallback (fixes the uncharged-500 ml bug) without blocking
   checkout when an editor forgets a size; listing the volume in a group overrides it. Log a
   `warn` when the fallback is used, so missing config shows up in the function logs.
3. Per group: required places = `ceil(Σ count / perPlace)`, computed exactly in integer units
   (scale by the LCM of the group's `perPlace` values) — no float rounding.
4. Min-cost boxes via `calcMinPackagingCost` (unchanged DP; rename `count` → `places`).
5. Non-wine items: weight-based `rates` as today. Free-shipping threshold unchanged.

## Steps

### core-back (major)
1. New object types `packagingGroup`, `packagingGroupPackage`, `packagingGroupBottle` + previews
   (title "0,75 l / 0,5 l / 0,375 l", subtitle the box sizes, e.g. "1, 2, 3, 6, 12"); de/en field labels + descriptions.
2. `shippingMethod.packagingGroups` with the validation above. Keep `packagingConfigs` for **one
   release**, `hidden` + `readOnly` (migration window), then remove it with its types.
3. `fulfillmentPackagingLine`: snapshot `{ places, quantity, price, volumes[] }` (`volumes`
   = the group's volumes at order time — the label is derived from it); keep old
   `volume`/`packSize` read-only so existing Tinhof orders still render.
4. `OrderView.tsx`: render new lines ("1× Karton für 6 · 0,75 l / 0,5 l / 0,375 l", label from
   `volumes`), fall back to the old
   fields.
5. `npm run build`; regenerate sanity types (core-front `src/types/sanity.types.ts` too).

### core-front (major)
1. Queries: `data/queries.ts`, `netlify/services/sanity.ts` → `packagingGroups[]{ packages[]{
   places, price }, bottles[]{ volume, perPlace } }`; `data/resolve/settings.ts` maps groups
   (bottles sorted by volume, descending; packages by places).
2. Types (`netlify/types/checkout.ts`, `types/data.ts`): `SanityPackagingGroupResult`, new
   `PackagingLine` / `FulfillmentPackagingLine`.
3. `shipping.ts`: rewrite `calcWinePackagingCost` per above; `resolveShippingMethods` uses
   `packagingGroups`.
4. `order-builder.ts`: map the new line shape. `wc-api.ts`: update the type (still not emitted).
5. `shippingInfoModule.njk`: one table per group (replaces one per volume). Caption from the
   group's volumes, largest first, via `packagingCaption` with a volume list ("Versandkosten für
   Wein (0,75 l, 0,5 l und 0,375 l Flaschen), je Karton"); for each bottle with `perPlace > 1` a
   second caption line, new i18n key de + en, form-of-address neutral ("2 Flaschen à 0,375 l
   zählen als eine Flasche") — inside `<caption>` so screen readers announce it with the table.
   Rows unchanged (`packageCount` = places). Keep markup (`scope="col"`) and CSS. No admin text
   needed. Not chosen: every size in each row ("für 6 × 0,75 l oder 12 × 0,375 l") — too long on
   mobile.
6. Tests (`__tests__/shipping.test.ts`, rewrite around groups): the four requirement rows; exact
   round-up with mixed `perPlace`; bundles with half bottles; unlisted volume → next larger listed size's group at 1 per place
   (500 → 0.75 l, pooled with 750s); unlisted volume larger than every listed one → method dropped;
   two groups in one cart; wine + non-wine (rates); only half bottles; Jurtschitsch-style config.
7. Docs: `commerce-and-netlify.md` shipping section, `CHANGELOG.md` (upgrade note: re-enter
   packaging as groups).

### Tinhof migration (live — no gap)
1. Release core-back + Tinhof backend (new field present, old one kept).
2. In production Studio, enter `packagingGroups` for DPD AT and DPD DE (by hand — 2 methods; old
   config is still read by the live frontend meanwhile).
3. Release core-front + Tinhof frontend (reads only groups). Test checkout with 375-only, mixed,
   magnum carts.
4. Next core-back release removes `packagingConfigs`; unset leftover data (Studio or
   `itsshops sanity`).

Jurtschitsch / others: enter groups when set up; nothing to migrate.

## Decisions (Tinhof)
Resolved 2026-10-14: setup above (both DPD AT and DE; 1500 and 2000 separate). Note for Tinhof:
small half-bottle orders cost more than today in AT (1 × 375: €3.00 → €6.00, 2 × 375: €4.00 →
€6.00, 6 × 375: €6.00 → €7.00); 12 × 375 and mixed carts get cheaper (4 × 750 + 4 × 375: €14.00 →
€8.00).

## Possible extension (not planned)
Boxes that accept only certain sizes ("nur für") + a size in several groups / a bottle taking >1
place, with the calc trying the splits (min-cost assignment). Would allow cheap half-bottle-only
boxes next to the shared ones, or 2 × 750 in a 1.5 l box. Not needed for the confirmed setup.
