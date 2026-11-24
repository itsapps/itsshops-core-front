# Stale site between publish and deploy: checkout reports changes, no auto-deploy

Status: accepted · Date: 2026-11-06

## Context
The site only changes on a deploy (Studio `DeployDialog` or a push); checkout reads Sanity live. Between
a publish and the next deploy the product page shows old prices/contents and the cart is filled
with them. Before, checkout charged the new price silently and dropped unavailable items with a
generic message (AT/DE: the final price must be visible before ordering).

## Decision
No auto-deploy on publish (each deploy costs Netlify credits, edit bursts queue builds), no live
prices on product pages (against the static design, a function call per view), no Studio
"undeployed changes" badge for now. Instead checkout syncs the stored cart from every server
answer, shows what changed, and refuses to confirm a payment whose cart or total changed since
the customer last saw it (manual and express). "Bundle contents changed" is decided by a
locale-independent key, not the localized subtitle.

Express (Apple/Google Pay): the customer sees the wallet sheet, not the page, so the payment is
compared with the sheet's last calculation (total + lines), not the stored cart. Comparing with
the cart was planned ("blocks once, errs safe") but blocked every price-change test (2026-11-06). The
sheet shows the current lines and total before the customer confirms, but no "price changed"
message; rejecting the sheet when its recalculation differs from the page (so the page notice
explains it) was rejected as not worth a second wallet attempt for a rare case (owner, 2026-11-06).

## Consequences
Editors still deploy by hand. A customer may have to confirm twice after a price change. Fallback
if editors forget deploys in practice: a `DeployDialog` badge counting build-relevant docs updated
after the last build. Mechanism: `commerce-and-netlify.md` → client flow, "Cart changes at checkout".
