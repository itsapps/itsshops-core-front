# `itsshops sanity delete` is guarded: typed confirmation + one transaction

**Status:** Active
**Date:** 2026-10-12

## Context

`itsshops sanity delete <types>` (`src/bin/itsshops.ts`) originally deleted every document of the
given types one by one, immediately, using whatever `.env` sat in the current folder. Found while
documenting it:

- `itsshops` is on the global PATH (via `npm link`), so it runs from any folder — and a customer
  frontend's plain `.env` can point at the **production** dataset (Tinhof's did).
- Shell `SANITY_*` vars silently win over the env file, so `-e .env.production` can still target
  another dataset.
- Per-document deletes left a half-done state when one failed (e.g. Sanity refusing to delete an
  `order` still referenced by an `orderWithdrawal`) — earlier types/documents stayed deleted.
- The CLI bypasses studio guards (e.g. matched withdrawals, which the studio never deletes).

## Decision

- Print the target (`Sanity: <projectId> / <dataset>`) for every `sanity` command, and warn when a
  shell `SANITY_*` var overrides the env file.
- `delete` asks the user to **type the dataset name**; anything else, Ctrl+C/D, or no TTY aborts.
  `--yes` is the explicit opt-out for scripts. `--dry-run` stays for counts only.
- All deletes go in **one Sanity transaction** — all or nothing; referrer and referenced documents in
  the same run need no particular order.
- Rejected: a plain y/N prompt (too easy to confirm by reflex); keeping per-document deletes with a
  "list referrers first" rule (order-dependent and still non-atomic).

## Consequences

- No silent or partial production deletes; a reference to a type not in the list fails the whole
  delete instead.
- One transaction carries every ID — very large deletes (thousands of docs) may hit Sanity's
  request-size limit; split by type then. Untested at that scale.
- Scripts/CI must pass `--yes`.
- Usage + examples: `.claude/architecture/cli.md`.
