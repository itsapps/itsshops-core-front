# A bundle's sum of single prices is its own line, not a compare-at price

Status: accepted
Date: 2026-11-13

## Context

Tinhof wanted bundle pages to show what the items cost bought singly. The obvious way is to fill
`compareAtPrice` with that sum, so `productPrice` strikes it through everywhere with no template
change.

## Decision

`ResolvedVariant.bundleItemsTotal` (sum of the items' single prices × quantity, only when above the
bundle price) is rendered by its own macro `productBundleItemsTotal` as a plain line — `productPrice`
is unchanged. Its text names the single purchase as the comparison: "Statt €X bei Einzelkauf – Sie
sparen €Y" (2026-11-20, Tinhof found the first wording "Summe der Einzelpreise: €X" too
technical; a bare "Statt €X" was rejected — it reads as a former price). Hidden when an editor set `compareAtPrice`, so a
page never shows two comparison prices.

Why not `compareAtPrice`: the bundle never cost the sum. A struck-through "was" price (screen
readers hear "Ursprünglicher Preis") reads as a price reduction, which in AT/DE carries the
lowest-price-in-30-days rule (Omnibus directive / PrAG §9a). A separate macro rather than a branch
in `productPrice`: the owner wanted `productPrice` to stay a plain price display (same pattern as
`productFreeShipping`).

## Consequences

A full `product/container.njk` override must add the call (CHANGELOG 5.1.0); cards get it from the
core `product_card_price` block. The total follows item price changes only with the next build.
