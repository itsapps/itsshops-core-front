# Plan — withdrawal on an already refunded order: info mail, no new record

Status: **planned** (2026-11-10), nothing implemented. **core-front** (endpoint + mail), plus one
history label in core-back. Every shop with checkout (generic → core). Found on Tinhof staging
(order 000018: refunded + canceled, a second web declaration created withdrawal `…-1`, "Eingegangen",
a receipt and a shop mail again).

## Today (checked 2026-11-10)

`order-withdraw` (`src/netlify/functions/order-withdraw.ts`): order number + email match →
`findOpenWithdrawal(order._id)` (`services/sanity.ts`, `status in ["received", "processing"]`).
Open record → receipt again (`audience: 'customer'`), no new record. **No open record** → a new
one (`withdrawalId()` counts on: `…-0`, `…-1`) + receipt + shop mail
(`sendWithdrawalNotifications`, `lib/order-withdraw-notifier.tsx`). The order's payment state is
never looked at (`ORDER_LOOKUP_PROJECTION` has no `paymentStatus` / `refunds`). So every further
submission on a refunded order creates an open withdrawal + 2 mails; the editor can only close it
("Erstatten & abschließen" → close only), and the customer's receipt says a refund will follow.

## Decision (owner, 2026-11-10)

- **Fully refunded** (`order.paymentStatus === 'refunded'`), number + email match → **no new
  record, no shop mail**; the customer gets a short **info mail** instead. Same web response as
  always (`successResp()`), so nothing about the order is revealed on the page.
- **Partially refunded** or a **rejected** withdrawal → unchanged (new record): may be a dispute,
  an editor should look at it.
- Unmatched submissions → unchanged.

The trigger is the order's payment status only — not "the last withdrawal is `refunded`" (a partial
refund also closes a withdrawal as `refunded`, and that case stays a new record).

Why it doesn't break "a declaration is never lost" (ADR `withdrawal-never-lost-no-captcha.md`): the
contract is already unwound, so a further declaration has no legal effect and there is nothing to
prove. Extend that ADR with this exception.

## Steps

1. `services/sanity.ts`: `ORDER_LOOKUP_PROJECTION` + `paymentStatus` and
   `"refunds": refunds[]{ amount, status, createdAt }`; extend `OrderWithdrawalLookup`. New
   `findLastWithdrawal(orderId)` (latest by `declaredAt`, any status) for the mail's date.
2. `order-withdraw.ts`: after the match, before `findOpenWithdrawal`: `matched &&
   order.paymentStatus === 'refunded'` → send the info mail (customer only), return `successResp()`.
   An open record on a refunded order (refunded in the order dialog without closing the
   withdrawal) → keep today's path (receipt again), the editor still has to close it.
3. Mail: `buildWithdrawalAlreadyRefundedMail` + send in `lib/order-withdraw-notifier.tsx`,
   `SimpleEmail` like the receipt. Text (de, gist; "Sie"/"Du" variants via `de_server.informal.ts`):
   > Ihr Widerruf zur Bestellung #〈n〉 ist bereits bearbeitet: 〈amount〉 wurden am 〈date〉
   > erstattet. Die Gutschrift kann je nach Bank einige Tage dauern.
   `amount` = counted stored refunds (core-front `refundedTotal`-equivalent; failed/canceled don't
   count), `date` = latest counted refund `createdAt` (shop timezone, `formatShopDate`). No stored
   refunds (refunded before core-front 3.10.0) → text without amount and date. Optional: "Ihr
   Widerruf vom 〈declaredAt〉" from `findLastWithdrawal` when one exists (a refund without any
   withdrawal is possible — then leave it out). en alongside; owner approves the wording.
4. Order history: `mail` entry with a new status `withdrawalAlreadyRefunded` (`source: 'system'`)
   after the send. **core-back:** label in `components_de/en.ts` →
   `actions.order.mailTypes.withdrawalAlreadyRefunded` ("Widerruf bereits erstattet" /
   "Withdrawal already refunded"), history-only like `withdrawalReceipt` (not in "Send mail").
   Without the core-back label the entry shows its raw key — release core-back first.
5. Repeat guard: the info mail goes out on every such submission (the per-IP `rateLimit` caps it);
   no extra cooldown unless abuse shows up (parked: `withdrawal-spam-hardening.md`).

## Tests

`__tests__/order-withdraw.test.ts`: refunded order + match → no `createWithdrawalIfNotExists`, info
mail to the order's email, no shop mail, same response; partially refunded → new record as today;
email mismatch on a refunded order → unmatched as today; refunded with an open record → receipt
again. `__tests__/order-withdraw-notifier.test.ts`: info mail with amount + date; without stored
refunds (no amount line); locale + formality. By hand on staging: order refunded via "Erstatten &
abschließen", then the web form again → info mail only, nothing new in "Offen".

## Ship

core-front minor + core-back patch (label), core-back first. Docs: `commerce-and-netlify.md` →
"Withdrawal" (repeat-submission list), ADR `withdrawal-never-lost-no-captcha.md` (exception).
Customers: no code change. Delete this file when done.
