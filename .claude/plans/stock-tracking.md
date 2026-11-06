# Plan — stock tracking (loose items and bundles)

Status: **parked** (2026-11-06), nothing implemented. No shop enables stock today
(`features.shop.stock` is off in every backend, so `stock` is hidden and empty = unlimited). Pick it
up when the first shop wants to turn stock on. One decision open (E, end of file). Split off from
`bundle-checkout.md` on 2026-11-06; its bundle parts build on the order snapshot
`orderItemBundle.items` (shipped with the bundle work, `commerce-and-netlify.md` → Order snapshot).

Spans core-back (`stock` field) and core-front (cart validation, webhook, resolver/schema.org).
Read core-back's `CLAUDE.md` before touching it. When this ships, move the durable parts into
`.claude/architecture/commerce-and-netlify.md` + core-back's docs, add `CHANGELOG.md` entries, and
delete this file.

## Current state (verified 2026-11-06)

- core-back `stock` field (`productVariant.ts`, only with `shop.stock`): `initialValue: 0` and
  `Rule.positive()`. Once a shop enables stock, every **new** variant starts at 0 = sold out at
  checkout, and 0 itself fails validation (also after the last unit sells, blocking the next
  publish of that variant). Existing variants have no `stock` (= unlimited).
- `validateCart` (`src/netlify/lib/cart-validator.ts`) caps each line to its variant's own `stock`
  (empty → no limit), line by line: two lines can't share one variant today, but a bundle's items
  aren't checked at all (the checkout query fetches item `stock`, unused).
- Stock is reduced in `payment-webhooks.ts` (`handlePaymentSucceeded`) from `orderDoc.orderItems`
  only — the bundle variant, never its items.
- `commitOrderTransaction` (`src/netlify/services/sanity.ts`) runs `p.dec({ stock })` on **every**
  order variant when `hasStock` is on — also on variants whose `stock` is empty (= unlimited). What
  Sanity's `dec` does on a missing field is unverified; if it creates it negative, the variant turns
  sold out after one order.
- The product page, cards and variant pickers read only `status`, never `stock`: a variant at
  `stock: 0` still shows the buy button until checkout refuses it. Only schema.org
  `offerAvailability` (`src/schema/shipping.ts`) reads `stock`. `ResolveContext` carries no feature
  flags.

## Steps (decision A: both stocks)

0. core-back `stock` field: drop `initialValue: 0` (empty = unlimited, as checkout already treats
   it) and replace `Rule.positive()` with `Rule.min(0).integer()`. `CHANGELOG.md` note: shops that
   enable stock enter stock explicitly.
1. Total demand per variant across the cart: loose qty + bundle qty × item qty, against each
   variant's stock. What happens to lines that don't fit: decision E. The bundle's own `stock` (if
   set) is checked as well, as today — e.g. a limited number of gift boxes.
2. Reduce stock on paid orders: the bundle's own stock (as today) **and** each item's stock by
   bundle qty × item qty, from the order line's `bundle.items` (exists since the bundle work),
   in the same `commitOrderTransaction`. Sum the quantities per variant first
   (loose + in bundles → one `dec` per doc). Only reduce variants whose `stock` is a number: in
   `handlePaymentSucceeded`, before `commitOrderTransaction`, fetch
   `*[_id in $ids && defined(stock)]._id` for the summed ids and drop the rest (`dec` is then never
   called on a missing field). A concurrent "stock emptied" edit between fetch and commit is
   negligible. This also fixes loose items.
3. Schema.org: the resolver sets a bundle's resolved `stock` to its **effective** stock — the
   minimum of its own `stock` (if a number) and `floor(item.stock / item.quantity)` over items with
   a numeric stock (`null` if none has one); `stock` is already in the raw variant query. Then
   `offerAvailability` follows unchanged.
4. Product page: a variant (loose or bundle) whose effective stock is ≤ 0 shows as sold out — pass
   `features.shop.stock` into the resolver (`ResolveContext` or a `resolveVariants` argument) and
   fold it into the `effectiveStatus` helper (`src/data/resolve/variants.ts`, `data-layer.md`) (→ `soldOut`), so cards, page and
   pickers follow with no template change.
5. Tests: stock across loose and bundle lines (`cart-validator.test.ts`); webhook reductions
   (summed per variant, unlimited variants untouched); effective stock/status in the resolver.

## Out of scope

Stock is checked at payment creation but reduced in the webhook, so concurrent payments can still
oversell — affects all items; separate item.

## Decisions

Open:
- **E — Lines that don't fit the stock:** when loose items and bundles compete for one variant's
  stock, which gives way? Suggested: reject the whole bundle line (→ `unavailableItems`) rather than
  cap it — no rule needed for which line keeps the stock, a bundle is only ever sold whole, and the
  customer message stays simple. Loose lines keep today's capping.

Decided 2026-10-25:
- **A — Stock model:** both — items' stock is checked and reduced, and the bundle's own `stock` (if
  set) is checked and reduced too.
