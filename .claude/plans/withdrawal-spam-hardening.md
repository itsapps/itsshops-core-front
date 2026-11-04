# Parked — withdrawal form spam hardening (core)

Status: **parked** (2026-11-04). Do nothing unless abuse shows up (Resend dashboard of a shop, or a
flood of `unmatched` withdrawals in the Studio). The live shops (Tinhof, Jurtschitsch, grass-art) are
fine as released.

**Risk.** `order-withdraw` sends a receipt to the typed address without double opt-in (FAGG wants it
right away), and every new *unmatched* declaration also mails the shop — 2 mails per submit. Guards
today: honeypot (`website`), link checks in name/reason, per-IP `rateLimit` 5/min in each wrapper. A
deliberate attacker (made-up order numbers) could empty a free Resend day (100 mails) in ~10 min,
and then order confirmations/invoices fail too. Unlikely: the form gives a spammer nothing.

**Candidate fixes, if needed** (core, every checkout shop benefits):
- minimum fill time (client sends the elapsed time, like Schuster's interest form —
  `netlify/lib/interest.mts`, `MIN_FILL_MS`);
- cooldown on *repeat* receipts (the first one already went out; the record is stored anyway);
- a daily cap on mails for *unmatched* declarations only — never hold back a matched receipt;
  open question then: store-without-mail vs. drop beyond the cap (Sanity free plan: 10k docs).
