# An ERP's `completed` can mean "accepted"; the wc-api reports it back unchanged

Status: accepted · Date: 2026-11-18 (owner)

## Context
wineNET sends `PUT orders/:id {status: completed}` the moment a Vormerkung becomes an Auftrag —
automatic, the shop can't choose a status. Mapped to `shipped`, the order was "Versendet" days
before dispatch, and the shipping mail with tracking code could only go via Studio "Send mail".
The obvious fix — store and report `processing` — is unsafe: wineNET polls
`status=pending,processing,on-hold` for orders up to 2 days old, and whether it de-duplicates by
order id is unknown (asked 2026-10-23, never answered), so the order could be imported again on
every poll.

## Decision
Opt-in factory option `createWcApiHandler({ completedMeans: 'accepted' })` (default `'shipped'`).
In that mode the ERP keeps seeing exactly what it set: the order is reported `completed` (also by
the list filter), while internally it stays/becomes `processing` with `erpAcceptedAt` and an
`erp/accepted` history entry, and no mail is sent. The shop ships it in the Studio as usual. An
option in core rather than customer code because the wc-api is core and can't be overridden.

## Consequences
No re-import risk whatever wineNET's de-duplication does; nothing changes on wineNET's side.
The read override "accepted → `completed`" runs before the withdrawal → `cancelled` rule, so a
withdrawal on an accepted order is not signalled to the ERP — cancel the Auftrag there by hand
(as before, when such an order was `shipped`). Orders moved to `shipped` before the switch stay
`shipped` (no migration). Mechanism: `architecture/wc-api.md` → "ERP accepted".
