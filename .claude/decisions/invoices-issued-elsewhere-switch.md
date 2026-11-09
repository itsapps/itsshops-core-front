# Invoices issued by another system: a core switch, not customer code

Status: accepted · Date: 2026-11-06

## Context
Tinhof's invoices come from wineNET (its ERP, fed by the wc-api). Core can still send its own
invoice: the Studio's "Send mail" offers "Rechnung" and "attach invoice PDF", and every order gets
a core `invoiceNumber`. An editor picking it would send the customer a second invoice with another
number sequence. Jurtschitsch will likely use wineNET the same way.

## Decision
A switch in both cores, default on: core-back `features.shop.invoices: false` hides the invoice
mail and PDF in "Send mail"; core-front's notify option `invoices: false` refuses them (400), so
no caller can send one. Core rather than customer code because more than one shop needs it
(rule: core-front `CLAUDE.md` → "What goes into core") and the action lives in core.

## Consequences
Core still assigns `invoiceNumber` (the mails don't print it). Credit notes for refunds are out of
scope until an owner or tax advisor asks (decided with the refund history, core-front 3.10.0). Mechanism: `commerce-and-netlify.md` → "Invoices
issued elsewhere".
