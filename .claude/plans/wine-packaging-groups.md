# Plan — wine packaging groups: remove the old `packagingConfigs`

Status: **one cleanup left** (2026-11-06). Packaging groups shipped in core-back 4.0.0 / core-front
3.0.0; Tinhof is live with them. Mechanism: `architecture/commerce-and-netlify.md` (Wine packaging)
+ core-back `schemas.md`; rationale: ADR `wine-packaging-groups-one-size-per-group.md`. The old
field was meant to go "in the next core-back release" but core-back 5.0.0 / 5.1.x still carry it.
Nothing reads it any more (no `packagingConfigs` in core-front `src/`).

## Steps (core-back)

1. Dataset check, read-only, from each shop frontend with wine shipping (Tinhof, Jurtschitsch),
   per dataset (`-e` for production):
   `itsshops sanity query '*[_type == "shippingMethod" && defined(packagingConfigs)]{_id, title}'`
2. Remove the field from `src/schemas/documents/shippingMethod.ts` (the hidden `packagingConfigs`
   array and the commented-out rule referring to it), the `winePackagingConfig` object type
   (`src/schemas/objects/winePackagingConfig.ts`, its entry in `src/schemas/objects.ts`) and its
   labels in `src/localization/resources/fields_de.ts` / `fields_en.ts`; regenerate
   `sanity.types.ts` (core-back and core-front).
3. Right after the release, unset the leftover data from step 1 in each dataset
   (`patch(id).unset(['packagingConfigs'])` on the published docs) — until then the Studio shows
   it as an unknown field, nothing breaks.
4. Ship: core-back minor (the field was hidden and unused, nothing for a customer to change),
   `CHANGELOG.md` "Removed". Then delete this plan.
