# Pickup orders are taxed by the pickup location's country

Status: accepted (tax advisor confirmation pending before the first production release)
Date: 2026-11-19

## Context

Checkout taxes an order by the address country (`taxCountry`). For store pickup the customer's
address can be anywhere — another EU country or outside the EU — while the goods are handed over
at the shop. Taxing a DE customer's pickup at DE rates (or rejecting a CH customer) would be wrong
or block sales.

## Decision

- A pickup order's VAT country is the pickup method's `pickupAddress.country` (fallback
  `shopSettings.defaultCountry`) — the place of supply where the customer takes the goods (owner
  decision). WooCommerce does the same for Local Pickup
  (`ShippingController::filter_order_tax_location`).
- Pickup is open to every country (decision 12): there are no per-country rates and no
  destination excise for goods collected at the shop. Delivery keeps the tax-country list.
- core-back requires the pickup address's country to be an enabled tax country; core-front drops
  (and logs) a pickup whose country has none, so a pickup order is always taxable.

## Consequences

- `payment-create` must know whether the order is a pickup **before** `validateCart`, so it is
  decided from the raw methods and the requested id; a pickup is never selected implicitly.
- The wc-api reports the pickup country's `rate_id`s, the Studio/mails need no change.
- To be confirmed by the tax advisor (also for non-EU customers) before production.
