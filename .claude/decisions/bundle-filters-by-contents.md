# Bundles match product-list filters by their contents

Status: accepted
Date: 2026-11-13

## Context

Filter attributes come from a variant's own wine data and options. A bundle has none, so any
non-price filter hid every bundle — including packs that clearly match (six 0.75 l bottles hidden
under "0,75 l", a pack with a sparkling wine hidden under "Schaumweine"). The list then says "no
such product" while one is on sale.

## Decision

After all variants are resolved, `mergeBundleFilterAttributes` (`src/data/resolve/filters.ts`)
gives each bundle the union of its items' filter attributes — wine fields, option groups **and
categories** — on top of its own ("contains a …"). Each gained value counts once. No flag: core
knows no shop that wants bundles out of the filters; add one if a shop does.

Category **pages** and the Wein-page grid still list a bundle only by its own categories
(`filterByCategory`): inheriting there would put a mixed pack on every category it touches (the
grid would show it once per category). An editor adds a category to the bundle to put it on that
page.

## Consequences

The shop filter "Schaumweine" and the Schaumweine category page can differ for bundles — by
design (filter = contents, page = editor's assignment). A mixed-vintage pack appears under each of
its vintages.
