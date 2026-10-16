# Dataset backups as encrypted GitHub artifacts per customer

Status: accepted
Date: 2026-10-16 (amended same day: daily documents-only backups added)

## Context
Without Sanity's paid Backups feature, nothing we or editors delete is restorable (Sanity's internal
backups are disaster recovery only), and production holds orders/customers that can't be rebuilt.
A full export with assets is large (Tinhof production ≈ 272 MB). Free GitHub accounts offer 500 MB
artifact storage and 10 GB Git LFS. The export contains personal data (GDPR: no open-ended
retention, processors should not see plaintext).

## Decision
- Scheduled GitHub Actions export of **production only**, kept as workflow **artifacts**: a full
  export with assets on Mondays (exactly **one** kept — it fills more than half the quota) and a
  documents-only export (`--raw`, a few hundred KB) every other day, newest 7 kept. Documents
  (orders) change daily, images rarely; documents-only backups make daily history free.
  Each run prunes only after its own upload succeeded.
- Encrypted with `age` to a public key; the private key lives only in the password manager.
- Read-only (Viewer) Sanity token as the only secret.
- Rejected: **Git LFS** — committed versions are never freed (storage only grows, ~9 months to fill
  10 GB weekly) and keep encrypted personal data in history forever. **Several weeks of history in
  artifacts** — doesn't fit the free quota. Object storage (R2/S3) is the upgrade path if more
  history is wanted.

## Consequences
- Free, no extra account; document history reaches back ~8 days, images one week; a mistake noticed
  later may already be in every backup → manual exports before risky operations.
- Restore = full backup, then the newest documents-only one with `--replace`.
- Losing the password-manager entry makes every backup unreadable.
- Steps: `.claude/workflows/sanity-dataset-backups.md`.
