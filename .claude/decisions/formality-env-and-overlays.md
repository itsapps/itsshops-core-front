# Form of address (Sie/Du) via an env var + overlay files, not a Sanity setting

**Status:** Active
**Date:** 2026-10-08

## Context

Core's German texts mixed "Du" throughout (website, emails, server messages). Shops differ:
Jurtschitsch wants "Du", Tinhof "Sie". Statutory texts (withdrawal instructions, warranty notice)
are officially in "Sie". Shop `config.translations` overrides only reach the website — the emails
are rendered by Netlify functions that never see the Eleventy config.

## Decision

- Base German files are **"Sie"**; `de_*.informal.ts` overlays hold only the differing "Du" keys.
- One switch, `SHOP_FORMALITY=formal|informal` (default `formal`), read by `resolveConfig` (build)
  and `serverT` (functions) — the only value both runtimes see.
- Rejected: a Sanity toggle — the build-time translator would have to wait for CMS data.
- Missing env var → "Sie": the fallback is the literal statutory form, so forgetting it is a tone
  issue, not a legal one. No build check, no du/Sie word lint ("Sie"/"Ihr" are ambiguous).
- Statutory texts follow the setting too; the overlay changes only the address forms (residual
  risk: the "Du" version isn't the literal model text — the shop owner approves it).

## Consequences

- Shops that relied on the old "Du" default switch to "Sie" unless they set the env var — for
  **all scopes** on Netlify (build-only gives a "Du" site with "Sie" mails).
- Every new German string that addresses the reader needs a base ("Sie") and an overlay ("Du") entry.
