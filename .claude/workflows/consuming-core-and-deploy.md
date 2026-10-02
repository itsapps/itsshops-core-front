# Workflow: consuming core in a customer project & deploying

Canonical for **all** customer projects (frontend consumes `itsshops-core-front`, backend consumes
`itsshops-core-back`). Customer repos link here rather than repeating it.

## How a customer references core

In the customer `package.json`:

```json
"@itsapps/itsshops-core-front": "github:itsapps/itsshops-core-front"
```

No committish is given, so the **exact commit is pinned only in `package-lock.json`**:

```
"resolved": "git+ssh://git@github.com/itsapps/itsshops-core-front.git#<commit>"
```

Core builds itself on install via its `prepare` script, so the customer gets built `dist/`.
The core repos are **public GitHub repos** — there is **no npm registry**. The lockfile currently
resolves them over `git+ssh` (the dev machine's git remote), but since they're public they can
equally be fetched over HTTPS, so no registry auth or deploy key is required to install them.

## Local development

Use **`npm link`**:

```bash
# in the core repo
npm run dev     # core-front: tsup --watch + template watch
npm run watch   # core-back:  pkg-utils watch

# in the customer repo, once
npm link @itsapps/itsshops-core-front   # or -core-back in a backend
```

Core changes then show up live. See the core repos' own CLAUDE.md for their dev commands and the
backend's `sanity.cli.ts` dedupe gotcha.

## Updating core — two deliberate modes

Always **commit and push core to GitHub first** — the local `npm link` can hide uncommitted core, so
what you tested locally is not what deploys.

### Dev / test deploys — edit the lockfile hash (the fast path)

This is the intended workflow while developing and deploying to test — it's quicker than anything
npm offers:

1. In the customer `package-lock.json`, change the core `#<commit>` to the latest core commit.
2. **If core's `package.json` changed** (deps added/removed), reinstall so the dependency tree is
   picked up — a bare `#hash` swap only updates the pinned commit, not the rest of the lockfile
   (dependency tree + integrity), so it's sufficient only when core's deps didn't change.

That caveat in step 2 is the one thing to stay aware of; otherwise the hash edit is fine and fast.

### Going live (production) — use a git tag

When a project goes live, pin core to a **git tag** instead of a floating commit, in `package.json`:

```json
"@itsapps/itsshops-core-front": "github:itsapps/itsshops-core-front#v1.4.1"
```

Bump it with npm (rewrites `package.json` + lockfile correctly, including any dep changes):

```bash
npm install 'github:itsapps/itsshops-core-front#v1.4.1'
```

A tag gives production a stable, named core version that can't drift, while dev/test keeps the quick
hash-edit loop.

## Deploying a customer project (Netlify)

Branch-based:

1. Work on **`main`**; push it to `origin` as your **own** GitHub user (routine — `main` is not a
   Netlify deploy branch, so it triggers no build).
2. To deploy: merge `main` → the **`staging`** or **`production`** branch.
3. Push that branch to the **`user`** remote (the customer account, via its PAT). Netlify — tied to
   that same customer account — sees the matching pusher and rebuilds (`npm run build`, publish
   `dist/`). Deploy done.

Each customer's branch names / Netlify site live in its own CLAUDE.md.

### Deploy identity (two push identities, split by branch)

To avoid paying for extra Netlify team seats, **each customer gets its own GitHub + Netlify account
under the customer's own email** (e.g. `shop@jurtschitsch.com`). Netlify's free auto-rebuild fires
only when the **GitHub pusher's identity matches the Netlify account owner**. So pushes are split by
branch:

- **`main`** (and feature work) → pushed via `origin` as the **developer's own GitHub user** (the dev
  is a collaborator on the customer's repo). `main` is not a Netlify deploy branch → no build.
- **`staging` / `production`** → pushed via the **`user`** remote, authenticated with the **customer
  account's Personal Access Token (PAT)**. The pusher then matches the Netlify account → the build
  triggers.

This is about **push authentication**, *not* commit authorship — a separate thing. (The repo's local
`.git/config` happens to set `user.name`/`user.email` to the customer, e.g. `Admin` /
`shop@jurtschitsch.com`, so commits read as the customer; but Netlify keys on the pusher, not the
author.)

Observed in the Jurtschitsch repos (both remotes point at the **same** GitHub repo):
- `origin` → `https://github.com/Jurtschitsch/…` — pushes as your own user; used for `main`.
- **`user`** → `https://<PAT>@github.com/Jurtschitsch/…` — pushes as the customer; used for
  `staging`/`production`. (Remote names can differ per customer — check `git remote -v`.)

**Secrets / gotchas:**
- The PAT lives **only** in the `user` remote URL in `.git/config` (not tracked by git). Never put it
  in a tracked file, commit it, or `cat .git/config` into shared output.
- `.git/config` is per-clone: a fresh clone / new machine loses the `user` remote + PAT, so it must be
  reconfigured there or `staging`/`production` pushes won't trigger a Netlify build.
