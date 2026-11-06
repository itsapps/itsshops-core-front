# Bundle VAT is split over its items by their single sale prices

Status: accepted (Tinhof's tax advisor to confirm before release) · Date: 2026-11-06

## Context
Bundles can mix VAT rates (Tinhof: wine 13 % + Traubensaft 20 %). Taxing a bundle by its own tax
category puts the whole price on one rate (€30 box: €3.45 VAT at 13 % vs €3.76 split). Bundles are
usually cheaper than their items, so the price can't simply be the items' prices.

## Decision
A bundle has no tax category (hidden in core-back). At checkout its unit price is split over its
items in the ratio of their single gross prices (item price ?? product price, × item qty), whole
cents, shares rounded down, the last item takes the remainder; each share is taxed at the item's
own rate. The split is stored on the order (`bundle.items[]`), never recomputed. An item without
any price makes the bundle unavailable (no ratio). Coupons stay order-wide, bundles included.
Rejected: the bundle's own rate (wrong for mixed bundles); a price derived from the items' sum
(owners want to see and set what customers pay).

## Consequences
Every bundle item needs a price (Studio error while the bundle is active; page shows
`unavailable`). Changing a loose item's price shifts the next orders' split (amount charged
unchanged). The invoice lists each item with its rate. Mechanism: `commerce-and-netlify.md` →
Bundle VAT.
