# Widerruf link: a menu "system link" + guaranteed footer fallback, not a page module

**Status:** Active
**Date:** 2026-10-05

## Context

Customer footers hardcoded the right-of-withdrawal ("Widerruf") link (appended to the last footer
menu), so editors couldn't place or move it. The obvious alternative, a "Withdrawal" **page module**
that editors drop onto any page, conflicts with how the form works: it lives at a fixed route
(`userPaths.orderWithdraw`). The hCaptcha CSP is whitelisted **per route** (`src/config/headers.ts`).
The success page is a sibling fixed route, and the page is `noindex`. The notification emails
link to that one URL. A module could also be placed on several pages or on none. Separately, EU law
(Directive 2023/2673, applies from 2026-06-19) requires the withdrawal function to be easy to find,
so editors must not be able to remove the link by accident.

## Decision

- Keep the form at its fixed route. Make only the **link** editable: `menuItem.linkType: 'system'`
  plus `systemPage` (core-back, list filtered by feature: `orderWithdraw` requires `shop`). The
  resolver maps it to the route URL with a translated default title. It drops the item when the
  feature is off.
- **Fallback:** if no main/footer menu links to it, `ensureSystemPageLink` appends it to the last
  footer menu at data level, so it also works with customer footer overrides.
- Gated on `shop.enabled`, as the page/CSP/URL already were (not `shop.checkout`; core-back has no
  checkout flag anyway).

## Consequences

- Every menu-rendering template (core + customer overrides) needs an `elif linkType == 'system'`
  branch.
- Without editor action, output is unchanged (the fallback reproduces the old footer link). Once an
  editor places the link in any rendered menu, the fallback steps aside.
- The mechanism generalizes to other fixed routes (login, cart, search, …) by extending
  `systemPages` + `systemUrls`.
