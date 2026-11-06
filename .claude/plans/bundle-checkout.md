# Plan — bundles at checkout: release checklist

Status: **implemented, merged to `main` in core-front and core-back (2026-11-06), not released**.
Tested on Tinhof staging (orders 000009–000015: VAT split, invoice, wc-api lines, Apple Pay,
price change before paying, VoiceOver notice). Delete this file at the release.

Where things live now: mechanism — `commerce-and-netlify.md` (Bundle VAT, order snapshot, invoice
VAT, cart changes at checkout), `wc-api.md` (Bundles), `data-layer.md` (`effectiveStatus`),
core-back `schemas.md` + `studio-components.md`; decisions — `decisions/bundle-vat-split-by-single-prices.md`
(F, G), `wc-api-bundles-as-item-lines.md` (C), `checkout-reports-cart-changes.md` (I, express),
`bundle-packaging-with-the-cart.md` (B, D), `invoices-issued-elsewhere-switch.md`; H (active
variant needs a price) — core-back `schemas.md`. Stock: `stock-tracking.md` (parked).

## Before release
- [ ] Tinhof's tax advisor confirms the split by single sale prices (decision F). For Tinhof only
  the split matters — wineNET issues the invoices (`invoices: false`).

## Release ("release tinhof", core-front `consuming-core-and-deploy.md` → Release flow)
- [ ] core-back **5.2.0** first (CHANGELOG "Unreleased" → 5.2.0), then core-front **3.9.0**.
- [ ] Tinhof frontend + backend: pin the tags (they pin untagged `main` commits since the staging
  test), release, tag.
- [ ] Tinhof: tell the owner that a bundle's VAT comes from its items (each needs a price; split by
  single prices) and that bundles are created only now; give Andi (wineNET) a heads-up that
  bundles arrive as their single wines. Update Tinhof frontend `CLAUDE.md` (wineNET → Bundles:
  released).
- [ ] Jurtschitsch: its `card.njk` / `container.njk` change (committed on its `main`) needs core-front
  3.9.0 — pin together. Decide `invoices: false` if wineNET issues its invoices.
- [ ] Move the optional item below into Jurtschitsch's `CLAUDE.md`, then delete this file.

## Optional, only if a shop asks
Bundle items on the order use core's subtitle format, not a shop's own frontend wording
(Jurtschitsch's `wineSubtitle` adds VinoFact varietals the checkout doesn't have). Fix then:
`addToCartButton` also writes each item's display title/subtitle; the server uses them only while
the cart's `bundleKey` matches the current contents, else core's format.
