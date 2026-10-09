# Withdrawal instructions generated from settings, verbatim statutory wording

**Status:** Active
**Date:** 2026-10-08

## Context

Shops kept hand-typed copies of the model withdrawal instructions in a rich-text page. Checked
2026-10-07 (Jurtschitsch, Tinhof): no model withdrawal form, no sentence on return costs, mixed
"Sie"/"du", outdated "Telefax", contact details typed by hand. The order confirmation must also carry
the instructions + form on a durable medium (FAGG §7 (3); a website link isn't one), and page and mail
must not contradict each other (e.g. return costs vs. the withdrawal confirmation mail).

## Decision

- Core generates Teil A + B of FAGG Anhang I (Directive 2011/83/EU Annex I for English) from shop
  settings with **one builder** (`src/shared/withdrawal-instructions.ts`) used by the page module
  (`withdrawalPolicyModule`, no fields) and the order confirmation.
- Settings are the single source: company identity, return address/costs, period-start variant,
  § 18 exceptions, return note. The wording is copied **verbatim** from RIS / EUR-Lex into the
  `shared` translations; code only picks variants and fills gaps. Exceptions and the shop's note
  render as separate blocks, never inside the model text.
- Rejected: PDF uploads (a second copy that drifts) and rendering the page's rich text into the mail
  (keeps the hand-typed, incomplete text).
- Incomplete settings → no legal text at all (mail: short notice + log warning; website: hint in
  preview only), never a half-filled one.

## Consequences

- Each shop migrates once: module on the withdrawal page, settings complete, owner approves the
  generated text (for "Du" shops the "Du" version). Go-live: `workflows/go-live-checklist.md`.
- New statutory wording is changed once, in core's translations, for every shop.
