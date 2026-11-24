# wc-api sends a bundle as its items, as ordinary line items

Status: accepted · Date: 2026-11-06 (changed from the WC Product Bundles format, decided 2026-10-25)

## Context
WooCommerce's Product Bundles extension sends a parent line plus €0 child lines linked by
`bundled_by`/`bundled_items`. wineNET maps articles by WC `product_id` and learns the mapping from
the first orders (wineNET contact, by mail); a bundle article would need its own mapping, and €0
lines risk counting bottles twice. Each line can carry only one VAT rate.

## Decision
A bundle line is replaced by one line per item (no parent, no €0 lines): `product_id` /
`variation_id` of the item as if bought loose, quantity = bundle qty × item qty, gross = stored
share × bundle qty, its own tax; the bundle only in `meta_data` (`_bundle_title`, `_bundle_sku`,
`_bundle_variant_id`). For every shop, no switch: only new orders with a bundle change; older
orders (no stored items) stay one line.

## Consequences
ERPs need no bundle article. The order reads as if the wines were bought one by one — still a
plain WC order (`wc-api-mirrors-woocommerce.md`). Line ids are made unique per order (hash clash →
re-hash with a suffix). Mechanism: `wc-api.md` → Bundles.
