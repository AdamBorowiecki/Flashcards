# First Production Deploy — Flashcards → Cloudflare Workers

> Deploy plan / audit artifact for the Lesson 5 first deployment. Governed by
> `context/foundation/infrastructure.md` (recommends **Cloudflare Workers**, runner-up Vercel)
> and `context/foundation/tech-stack.md` (Astro 6 + Supabase + Cloudflare Workers).

## Context

Lesson 5's infra chain ends with Plan Mode driving the **first deployment**. The goal of this
run is a single, human-approved production deploy via `wrangler deploy`, verified by walking a
real auth flow — **before** any CI auto-deploy is wired. This document is the persisted audit
trail of "what was supposed to happen".

**Confirmed prerequisites:**

- Cloudflare: **already authenticated** (a sandbox `wrangler whoami` TLS error is a network
  artifact, not a real auth gap).
- Supabase: **real project, URL + anon key ready**.
- Scope: **manual first deploy only** — do NOT add a deploy step to `.github/workflows/ci.yml`.

## Prerequisites — CLI & Supabase configuration

These are the one-time setup steps that must be in place **before** the Execution steps below.
They are largely manual/human (account creation, secrets) per the infrastructure.md
production-access boundary — tokens are scoped, secrets live in env vars/Workers secrets, never
committed.

### A. Wrangler (Cloudflare CLI)

1. **Binary** — already pinned as a devDependency (`wrangler ^4.90.0`); no global install
   needed. Invoke with `npx wrangler`.
2. **Authenticate** — pick one:
   - _Interactive (simplest for local dev):_ `npx wrangler login` opens a browser OAuth flow
     and stores the token under the user's config dir.
   - _Token (CI / non-interactive / headless):_ create a **scoped** API token at Cloudflare
     dashboard → My Profile → API Tokens → _Edit Cloudflare Workers_ template, then narrow it to
     **this account + Workers Scripts edit only** (no DNS, no billing, no Workers Secrets for
     unrelated projects). Export it as `CLOUDFLARE_API_TOKEN` in the shell — do **not** put it in
     `wrangler.jsonc` or commit it. `wrangler` auto-discovers it from the env.
3. **Verify** — `npx wrangler whoami` must print the account/email.
   - If it errors with `UNABLE_TO_VERIFY_LEAF_SIGNATURE` (corporate TLS proxy), point Node at the
     corporate root CA before any wrangler call: set `NODE_EXTRA_CA_CERTS=<path-to-root-ca.pem>`
     (persist with `setx` on Windows, new shell), or run with Node's `--use-system-ca`. The same
     fix applies to every subsequent `wrangler` command, including `deploy`.
4. **`workers.dev` subdomain (one-time, per account)** — the very first Workers deploy on a new
   account requires a registered `*.workers.dev` subdomain. If it isn't set, `wrangler deploy`
   prompts to claim one (or fails non-interactively). Claim it once in the dashboard
   (Workers & Pages → choose a subdomain) or accept the prompt; afterwards the worker publishes to
   `https://flashcards.<your-subdomain>.workers.dev`.

### B. Supabase

1. **Project** — create (or identify) a project at <https://supabase.com/dashboard>. Pick the
   region **closest to the expected user majority** — single-region Supabase governs interaction
   latency regardless of the global edge (infra Risk R1).
2. **Credentials** — in the project: Settings → **API**. Copy:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public** key (the publishable client key, _not_ the `service_role` secret) →
     `SUPABASE_KEY`. The app uses `@supabase/ssr` with the anon key + RLS; never ship
     `service_role` to the client/edge.
3. **Local `.env`** — copy `.env.example` → `.env` (gitignored) and fill both values, so
   `npx astro dev` / `npx astro build` resolve `astro:env/server`:
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_KEY=<anon-public-key>
   ```
4. **Auth URL allowlist (required for the email-confirmation flow)** — signup calls
   `supabase.auth.signUp` and redirects to `/auth/confirm-email`, so the confirmation link uses
   Supabase's **Site URL**. In Authentication → **URL Configuration**, set **Site URL** and add a
   **Redirect URL** for the deployed origin (`https://<name>.workers.dev`) — and `localhost` for
   dev. Without this, confirmation links bounce and login on the live deploy fails. Revisit this
   right after step 3 (deploy), once the real `*.workers.dev` URL is known.
   - _Email rate limit:_ Supabase's built-in SMTP is rate-limited (a few confirmation emails per
     hour) — fine for the verification walk, but configure a custom SMTP provider before any real
     usage. Out of scope for this first deploy.
5. **Schema** — ensure the `cards` table (front/back, `user_id`, `next_review_at`) and its RLS
   policies exist in the project. The Supabase CLI is available (`npx supabase`, `supabase/`
   dir present) for migrations; treat migrations as **forward-only** (infra Risk R5 — a
   `wrangler rollback` does not revert schema).

### C. Local toolchain

1. **Node** — `.nvmrc` pins `22.14.0`; run `nvm use` (CI uses Node 22). A mismatched major can
   break `astro build` / `wrangler`.
2. **Dependencies** — `npm ci` for a clean, lockfile-exact install (what CI runs). `node_modules/`
   is already present locally, but a fresh checkout needs this.
3. **Type/env sync** — `npx astro sync` regenerates `astro:env` and content types (CI runs it
   before lint). `astro build` triggers it too, but run it first if editor type errors appear.

## Already correct (do NOT redo)

- `astro.config.mjs`: `output: "server"`, `@astrojs/cloudflare` adapter, `astro:env` schema
  declaring `SUPABASE_URL`/`SUPABASE_KEY` as optional server secrets.
- `wrangler.jsonc`: targets **Workers** with `main: "@astrojs/cloudflare/entrypoints/server"`,
  `nodejs_compat`, `ASSETS` binding, `observability.enabled`. This modern adapter entry
  supersedes the hand-written `./dist/_worker.js/index.js` template in infrastructure.md —
  keep the existing file as-is.
- `tech-stack.md` already reads `deployment_target: cloudflare-workers` — the stale
  `cloudflare-pages` hint (Risk R4) is already fixed.
- Supabase wiring degrades gracefully (`src/lib/supabase.ts` returns `null` when secrets are
  absent; `src/middleware.ts` guards `/dashboard` → redirects to `/auth/signin`).

## Execution steps

### 0. Pre-flight (read-only)

- `git branch --show-current` → `feature/doLesson4again`. Deploying from this branch is fine
  for a manual first deploy (Workers deploy is branch-agnostic; CI on `master` is untouched).
- `npx wrangler whoami` — confirm the authenticated account outside the sandbox. **If it
  returns `UNABLE_TO_VERIFY_LEAF_SIGNATURE`**, a corporate-proxy/cert issue will also break
  `deploy`; resolve first via `NODE_EXTRA_CA_CERTS=<corp-root-ca.pem>` or Node's
  `--use-system-ca`. Do not proceed until `whoami` succeeds.

### 1. Set Workers secrets — run interactively (keeps the key out of any transcript)

```
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_KEY
```

Secrets live as encrypted Workers secrets, never in `wrangler.jsonc`. GitHub repo secrets are
only for CI, which is out of scope for this run.

### 2. Build

```
npx astro build
```

### 3. First production deploy — the human-gated promote

```
npx wrangler deploy
```

Capture the resulting `*.workers.dev` URL from the command output.

### 4. Verify the live deploy (walk a real flow)

- `curl -I https://<name>.workers.dev/` → expect `200`.
- `curl -I https://<name>.workers.dev/dashboard` → expect a redirect to `/auth/signin`
  (proves middleware + Supabase client are live, not the null/auth-disabled path).
- Browser: open the URL, sign up / sign in, confirm a session reaches `/dashboard`. Validates
  `@supabase/ssr` cookie handling on `workerd` (Risk R3).
- Optional live tail during the walk: `npx wrangler tail --status error`.

## Critical files

- `wrangler.jsonc` — deploy config (read-only; already correct).
- `astro.config.mjs` — adapter + env schema (read-only; already correct).
- `src/lib/supabase.ts`, `src/middleware.ts` — the auth path being verified (read-only).
- `.github/workflows/ci.yml` — **explicitly untouched** (CI deploy is out of scope).

## Risks / contingencies (from the infra Risk Register)

- **TLS cert failure on wrangler calls** — resolve `NODE_EXTRA_CA_CERTS` / system CA before
  deploy (see step 0).
- **`@supabase/ssr` on workerd (R3)** — verify session/login on the _real deploy_, not just
  `astro dev`; do not assume Node-host cookie behavior.
- **DB-bound latency (R1)** — single-region Supabase governs interaction latency regardless of
  edge; note observed latency during the walk, don't reach for Hyperdrive reflexively.
- **Rollback ≠ schema rollback (R5)** — `wrangler rollback` reverts code in seconds but not
  Supabase migrations; keep migrations forward-only.

## Done = all true

1. `wrangler deploy` exits 0 and prints a `*.workers.dev` URL.
2. `curl -I /` → 200; `curl -I /dashboard` → redirect to `/auth/signin`.
3. A real browser login reaches `/dashboard` with a persisted session.

## Run log

- Deployed at: `2026-06-21 ~16:47 UTC`
- Live URL: `https://flashcards.adamborowiecki1990.workers.dev`
- Version ID: `66b6ef2b-3501-4be4-9021-825ba7a503ca`
- whoami account: `adamborowiecki1990@gmail.com` (Account ID `59fae5f1f063552a35940512d63790be`)
- Verification result: **partial pass** —
  - `curl -I /` → `200 OK` ✅ (edge WAW)
  - `curl -I /dashboard` → `302 → /auth/signin` ✅ (middleware + Supabase client live)
  - Browser login walk → **pending** (manual; requires Supabase project resumed + Site/Redirect URL allowlisted per prereq B4)

### Run notes — corporate-proxy/TLS workarounds (recurring)

This network sits behind a corporate TLS proxy. Two fixes were needed and apply to every future run:

- **wrangler** (`whoami`, `secret put`, `deploy`, `tail`): prefix with `NODE_OPTIONS="--use-system-ca"`
  — without it, every call fails `UNABLE_TO_VERIFY_LEAF_SIGNATURE` / `fetch failed`. Node ships its
  own CA bundle and ignores the Windows store where the corporate root CA lives; the flag makes Node
  trust the system store. Persist once with `setx NODE_OPTIONS "--use-system-ca"` (new shell).
- **curl** verification: add `--ssl-no-revoke` — schannel can't reach the CRL/OCSP endpoint through
  the proxy and fails `CRYPT_E_NO_REVOCATION_CHECK (0x80092012)`.

### First-deploy gotcha — workers.dev subdomain

The very first Workers deploy on this account had no registered `*.workers.dev` subdomain. Wrangler
prompts to claim one, but the non-TTY shell falls back to `no` and aborts. Resolved by registering the
subdomain in the dashboard (Workers onboarding); the next `wrangler deploy` then published cleanly to
`https://flashcards.adamborowiecki1990.workers.dev` (also auto-provisioned the `SESSION` KV namespace).
