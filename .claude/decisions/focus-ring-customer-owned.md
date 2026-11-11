# Global focus ring belongs to the customer (starter), not core

Status: accepted
Date: 2026-11-11

## Context
While switching tinhof to core 4.0, tinhof's global focus ring (1px dotted, also on `:focus`)
was aligned to the one itsapps, jurtschitsch and rosi_schuster already share:
`:focus-visible { outline: 2px dotted currentColor; outline-offset: -2px }`. With all four on the
same rule, the obvious next step looked like moving it into core's `base.css`.

## Decision
Core ships no global focus ring. The starter's base `global-styles.css` carries it, and a starter
check keeps it there (plan `customer-starter.md`, parts C + E).
- It is design: colour, line style and offset depend on the site, and every customer has places
  where the general ring doesn't fit (itsapps' header links, tinhof's video toggle, shop button
  and `.btn`, jurtschitsch's fields). That is customer CSS ("copied, not imported").
- A core rule adds no safety: without any rule the browser's own ring shows, and since 4.0 a
  layered core rule loses to any unlayered customer rule anyway. It could not stop a customer's
  CSS from hiding focus.

## Consequences
- Each customer owns its ring. A new customer gets it from the starter, not from core.
- Core only documents where its own CSS affects focus: `ui-contracts.md` → form fields
  (`outline: none` + `--field-focus-color`) and bordered buttons.
