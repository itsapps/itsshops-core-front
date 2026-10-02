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

1. Work on **`main`**.
2. When done, merge `main` → the **`staging`** or **`production`** branch.
3. Push that branch to the customer remote; Netlify rebuilds (`npm run build`, publish `dist/`).
   Deploy done.

Each customer's branch names / Netlify site live in its own CLAUDE.md.

### Deploy identity (why the per-repo git config matters)

To avoid paying for extra Netlify team seats, **each customer gets its own GitHub + Netlify account
created under the customer's own email** (e.g. `shop@jurtschitsch.com`). Netlify's free auto-rebuild
fires only when the GitHub pusher's identity matches the Netlify account owner — so a deploy push
must be attributed to that customer account.

Setup per customer:
- The developer's personal GitHub user is added as a **collaborator** on the customer's GitHub repo
  (so they can push).
- The customer's GitHub account is wired as a git **remote** authenticated with that account's
  **Personal Access Token (PAT)**, and the repo's **local** `.git/config` sets the commit identity to
  the customer. Observed in `jurtschitsch/webshop-backend`:
  - `user.name = Admin`, `user.email = shop@jurtschitsch.com`
  - remote `origin` → the dev's repo (`main`, `develop`, …); remote **`user`** → the customer account,
    holding `production` / `staging`. (Remote names can differ per customer — check `git remote -v`.)
- Deploying = merge `main` → `staging`/`production`, then push that branch to the **customer remote**.
  Netlify sees the customer identity and rebuilds.

**Secrets / gotchas:**
- The PAT lives **only** in `.git/config` (not tracked by git). Never put it in a tracked file,
  commit it, or paste it anywhere — and don't `cat .git/config` into shared output.
- `.git/config` is per-clone and local: a fresh clone or a new machine **loses this identity + PAT**,
  so it must be reconfigured there or Netlify won't trigger the rebuild.
