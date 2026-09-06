---
date: 2026-09-06T20:29:31+02:00
researcher: AdamBorowiecki
git_commit: 566eace19e0debc51760dc3091903969f2aee6f2
branch: feature/m2l4
repository: Flashcards
topic: "Where a card's data flows through this codebase today, and what a ts-fsrs-backed review-and-reschedule slice would have to plug into"
tags: [research, codebase, cards, rls, astro-endpoints, react-islands, sql-tests, srs]
status: complete
last_updated: 2026-09-06
last_updated_by: AdamBorowiecki
---

# Research: What a ts-fsrs-backed review slice has to plug into

**Date**: 2026-09-06T20:29:31+02:00
**Researcher**: AdamBorowiecki
**Git Commit**: `566eace`
**Branch**: `feature/m2l4`
**Repository**: Flashcards

## Research Question

Where does a card's data flow through this codebase today — schema, RLS, Supabase client, Astro endpoint
conventions, React island patterns, and the local SQL test harness — and what would a `ts-fsrs`-backed
review-and-reschedule slice have to plug into?

Paired with `external-research.md`, which settles Open Roadmap Question 5 in favour of `ts-fsrs` (FSRS v6).

## Summary

**A card's data does not flow anywhere yet.** That is the single most important finding. `public.cards`
exists, is correctly isolated by RLS, and is populated by a seeding trigger — but **nothing in `src/`
reads or writes it**. The entire live surface of the card domain is two SQL migrations and two SQL test
scripts. The only Supabase usage in application code is authentication.

Three consequences shape the plan:

1. **Adding FSRS state costs nothing downstream.** There are no application-code consumers to migrate,
   no row type to widen, no query to rewrite. `cards_update_own` already permits the update (both `using`
   and `with check`), and the `grant` is column-agnostic — no policy change is needed.
2. **Everything above the database is greenfield, and greenfield means _decide_, not _match_.** A JSON
   API response, an HTTP status code, an in-endpoint auth guard, and a `fetch()` from React each have
   **zero precedent** in this repo. The plan must state each contract explicitly rather than claim to
   follow a convention that does not exist.
3. **Verification is SQL run by hand.** There is no JS test runner and CI runs none. The executable
   ordering check that `change.md` and `roadmap.md:103` demand has exactly one home that matches house
   practice: a new script under `supabase/tests/`.

The prerequisite state is also thinner than the roadmap implies: **S-01's phases 3–4 and F-01's phase 3
are not implemented.** `Astro.locals.supabase` does not exist, `src/env.d.ts` declares only `user`, and
the dashboard has no deck count. Any page in this slice that needs a Supabase client must either land
`locals.supabase` itself or build its own.

## Detailed Findings

### Data layer — the card store as it actually exists

**Two migrations, in order:**

1. `supabase/migrations/20260905163222_create_cards_table.sql`
2. `supabase/migrations/20260906133232_seed_starter_deck.sql`

**The table** (`supabase/migrations/20260905163222_create_cards_table.sql:7-23`) carries exactly six
columns — `id`, `user_id`, `front`, `back`, `next_review_at`, `created_at` — plus two not-blank check
constraints. Its header comment states the deferral in so many words: _"Deliberately carries no
scheduling state: Open Roadmap Question 5 … is unresolved and blocks S-02."_

- `next_review_at timestamptz not null default now()` (`:12`) — every inserted card is due immediately.
- **A due-queue index already exists**: `cards_user_id_next_review_at_idx on public.cards (user_id, next_review_at)`
  (`:25-26`). A `where user_id = … and next_review_at <= now() order by next_review_at` query is already
  covered; this slice does not need to add an index.
- There is no `updated_at` and no uniqueness constraint on `(user_id, front)`.

**RLS** (`:28-56`): `grant select, insert, update, delete on public.cards to authenticated`, then
`enable row level security` and four policies, all keyed on the same predicate `auth.uid() = user_id`,
all scoped `to authenticated`. `cards_update_own` carries **both** `using` and `with check`, so the
rating write this slice performs is already permitted and cannot be used to reassign a row to another
learner. `anon` holds no grant at all.

**Seeding** (`20260906133232_seed_starter_deck.sql`): `public.starter_deck()` (`:15-33`) returns ten
EN→PL pairs; `public.seed_starter_deck()` (`:54-82`) is a `security definer` trigger function with
`set search_path = ''`; the trigger fires `after insert on auth.users` (`:87-90`); a backfill covers
pre-existing accounts (`:95-101`). Execute on `starter_deck()` is revoked from `public, anon,
authenticated, service_role` by name (`:48`) — the fix from commit `a1989dd`.

> **The constraint that matters for this slice**: both the trigger insert (`:67-69`) and the backfill
> (`:95-101`) write **only `(user_id, front, back)`**. Every new column must therefore carry a workable
> `default`, or both statements must be updated. Getting this wrong fails _silently_: the trigger's
> `exception when others` handler (`:78-81`) turns the failure into a `raise warning` and lets signup
> proceed, so the symptom is an empty deck, not an error — exactly the failure mode
> `context/foundation/lessons.md:12-17` was written about.

**No generated TypeScript types exist.** No `database.types.ts`, no `supabase gen types` script.
`createServerClient` is called without a `Database` generic (`src/lib/supabase.ts:9`), so any
`.from("cards")` written today returns untyped rows — which `strictTypeChecked` will reject (see below).

### The SQL test harness — the only real verification this project has

`supabase/tests/` holds two files, both plain psql scripts (**not** pgTAP, and `supabase test db` is not
wired):

- `supabase/tests/cards_rls.sql` (203 lines) — 6 assertions covering the isolation rules.
- `supabase/tests/seed_deck.sql` (225 lines) — 5 assertions covering seeding, idempotency, and resilience.

Shared shape, which a new ordering-test script must match:

- `\set ON_ERROR_STOP on`, `begin;` … `rollback;`, closing `\echo '<file>: all assertions passed'`.
- Assertions are bare `do $$ … if <cond> then raise exception '…'; end if; end $$;` blocks — a failure
  exits non-zero.
- A header block naming the exact run command **and** a "what this catches / what it does not" section.
- **Authentication as a fake learner** is done at `cards_rls.sql:75-76`:
  ```sql
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"1111...","role":"authenticated"}';
  ```
  Connecting as `postgres` bypasses RLS entirely, so a script that forgets this passes vacuously.
- **Counts are asserted as deltas, not absolutes** — `cards_rls.sql:58-62` captures a baseline via
  `set_config`, because the S-01 seeding trigger broke every absolute count.

Run command (documented only in the test file headers, `cards_rls.sql:9-17`, `seed_deck.sql:13-16`):

```
npx supabase start -x edge-runtime
npx supabase db reset
docker exec -i supabase_db_10x-astro-starter \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/<file>.sql
```

`-x edge-runtime` is required on this machine (TLS-intercepting proxy breaks the deno.land pull) —
rationale at `context/changes/seed-deck-on-first-login/plan.md:130`. The container name derives from
`project_id = "10x-astro-starter"` (`supabase/config.toml:5`).

`supabase/config.toml` also points `[db.seed] sql_paths` at `./seed.sql` (`:65`), a file that **does not
exist** — all seeding is via the migration trigger. `enable_confirmations = false` (`:209`) means local
signup fires the trigger immediately.

### Server layer — what a rating endpoint would plug into

**`src/lib/supabase.ts` (24 lines) exports exactly one symbol**: `createClient(requestHeaders, cookies)`,
wrapping `createServerClient` from `@supabase/ssr`. There is **no browser client** — `SUPABASE_URL` /
`SUPABASE_KEY` are declared `context: "server", access: "secret"` (`astro.config.mjs:19-20`), so they are
unreachable from client code by design. **All Supabase access must go through server routes.** The
function returns `null` when unconfigured, and every caller null-checks it.

**`src/middleware.ts` (25 lines)** builds a client, sets `context.locals.user`, and guards
`PROTECTED_ROUTES = ["/dashboard"]` (`:4`) with a redirect to `/auth/signin` (`:20`). Two facts matter
here:

- Middleware runs on **all** routes including `/api/*`, so `locals.user` is populated there — but
  `/api/*` is **not** in `PROTECTED_ROUTES`, so a new domain endpoint receives **no automatic guard**
  and must check `locals.user` itself (or lean entirely on RLS).
- The client is built and **discarded** (`:7`); it is not stashed on locals. `src/env.d.ts` declares only
  `user`. Every endpoint and page re-calls `createClient` for itself.

**Endpoint convention**, extracted from `src/pages/api/auth/{signin,signout,signup}.ts`:

| Aspect        | What the three existing endpoints do                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| Symbol        | `export const POST: APIRoute = async (context) => {…}` — never destructured params                        |
| `prerender`   | never declared anywhere in `src/`; `output: "server"` (`astro.config.mjs:11`) makes SSR the default       |
| Body          | `await context.request.formData()` then `form.get("x") as string`. No JSON, no Zod, no validation library |
| Errors        | **302 redirect only** — `context.redirect(\`/auth/<page>?error=${encodeURIComponent(msg)}\`)`             |
| Status codes  | none set explicitly; no `Response.json()` anywhere in `src/`                                              |
| Unconfigured  | `if (!supabase) return context.redirect(…?error=Supabase is not configured)`                              |
| Shared helper | **none** — each endpoint hand-rolls its redirect                                                          |
| Auth check    | **none** — no endpoint reads `locals.user` today                                                          |

**Lint is the real gate.** `eslint.config.js:14-38` applies `tseslint.configs.strictTypeChecked` +
`stylisticTypeChecked` with full type information (`projectService: true`) to **all** files, and
`eslint-plugin-prettier` runs last, so **formatting violations are lint errors**. Practical consequences
for new server code:

- `no-unsafe-assignment` / `-member-access` / `-call` / `-argument` / `-return` will reject untyped
  Supabase results and any `any` from `await request.json()`. A JSON body parse needs an explicit type.
- `no-floating-promises`, `require-await`, `no-unnecessary-condition` all active.
- `restrict-template-expressions` is `{ allowNumber: true }` (`:35`) — interpolating anything else fails.
- `no-console: "warn"` (`:23`) — server-side logging trips a warning.
- Prettier: double quotes, semicolons, `printWidth: 120`, `trailingComma: "all"`, LF.

**There is no JS test runner. Definitively.** No `test` script (`package.json:5-13` has exactly
`dev/build/preview/astro/lint/lint:fix/format`); no vitest/playwright/jest/node:test/testing-library
anywhere; no config files; not installed. CI (`.github/workflows/ci.yml:18-21`) runs `npm ci` →
`npx astro sync` → `npm run lint` → `npm run build`, with **no test and no format step**, and does not
deploy. `astro sync` before lint is load-bearing: type-checked ESLint fails on a stale `App.Locals`.

Runtime target: `@astrojs/cloudflare` adapter, `compatibility_flags: ["nodejs_compat"]`,
`compatibility_date: "2026-05-08"` (`wrangler.jsonc:6`); Node `22.14.0` (`.nvmrc`), CI on `node-version: 22`.
`ts-fsrs` requires Node `>=20` and ships ESM — both satisfied.

### UI layer — what a review screen would plug into

**Island convention**: `grep -rn "client:" src/` returns **exactly two hits**, both `client:load`
(`src/pages/auth/signin.astro:16`, `signup.astro:16`). The house pattern is **one default-exported React
island per page, mounted `client:load`, receiving server-computed props**; every sub-component
(`FormField`, `PasswordToggle`, `ServerError`, `SubmitButton`, `ui/button`) is a plain named-export child
with no directive. Island imports carry no file extension.

**shadcn/ui holds exactly one primitive** — `src/components/ui/button.tsx`. No card, input, or dialog.
Anything else must be added. `components.json` is `style: "new-york"`, `baseColor: "neutral"`,
`iconLibrary: "lucide"`, css at `src/styles/global.css`.

**Tailwind v4, CSS-first**: wired as a Vite plugin (`astro.config.mjs:13-15`), **no `tailwind.config.js`**.
`src/styles/global.css` carries the oklch token set plus the project's own `@utility bg-cosmic`
(`:113-115`) — every full-page view uses `class="bg-cosmic flex min-h-screen items-center justify-center p-4"`.
`cn()` at `src/lib/utils.ts:4`; icons always `className="size-4"`.

**How an island submits to the server — the established convention is a plain HTML form POST.**
There is **no `fetch()` anywhere in `src/`**. `SignInForm.tsx:36-43`:

```tsx
function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
  if (!validate()) {
    e.preventDefault();
  }
}
return <form method="POST" action="/api/auth/signin" … onSubmit={handleSubmit} noValidate>
```

React's only jobs are controlled inputs, client-side validation that calls `preventDefault()` **only on
failure**, and pending state via `useFormStatus` (`SubmitButton.tsx:12`) — which works _precisely because_
the submit is a native browser navigation. `signout` is a bare `<form method="POST">` with no React at all
(`Topbar.astro:16`, `dashboard.astro:17`).

> **The open design question this creates**: rating a card is a mutation followed by advancing to the next
> card. Full-page POST + redirect is the only precedent and would work; a `fetch()`-based rating would be
> the first of its kind in the repo. This is a `plan-brief.md` decision, not something to drift into.

## Code References

- `supabase/migrations/20260905163222_create_cards_table.sql:7-23` — the six-column `cards` table
- `supabase/migrations/20260905163222_create_cards_table.sql:25-26` — due-queue index, already present
- `supabase/migrations/20260905163222_create_cards_table.sql:28-56` — grant, RLS enable, four policies
- `supabase/migrations/20260906133232_seed_starter_deck.sql:67-69,95-101` — the two inserts that write only `(user_id, front, back)`
- `supabase/migrations/20260906133232_seed_starter_deck.sql:78-81` — the exception handler that swallows a seeding failure
- `supabase/tests/cards_rls.sql:75-76` — how a script authenticates as a fake learner
- `supabase/tests/cards_rls.sql:58-62` — delta-based counting after the seed trigger landed
- `supabase/tests/seed_deck.sql:13-16` — the documented run command, including `-x edge-runtime`
- `src/lib/supabase.ts:5-9` — `createClient(headers, cookies)`, returns `null` when unconfigured
- `src/middleware.ts:4,7,18-22` — `PROTECTED_ROUTES`, the discarded client, the redirect guard
- `src/env.d.ts:1-5` — `App.Locals` declares only `user`
- `src/pages/api/auth/signin.ts:4-19` — the endpoint convention in full
- `src/pages/auth/signin.astro:16` — the only island-mounting pattern in the repo
- `src/components/auth/SignInForm.tsx:36-43` — form POST + `preventDefault()` on failure only
- `eslint.config.js:14-38` — `strictTypeChecked` with type information, applied to everything
- `.github/workflows/ci.yml:18-21` — lint + build, no tests
- `astro.config.mjs:11,16,19-20` — SSR, Cloudflare adapter, server-secret env vars
- `docs/reference/contract-surfaces.md:32` — the "per-card scheduling state (shape TBD)" row this slice fills in

## Architecture Insights

- **The database is the enforcement layer, application code is not trusted with it.** Isolation is RLS;
  provisioning is a `security definer` trigger. A rating write should follow the same stance — the update
  is permitted only by `auth.uid() = user_id`, so an endpoint that forgets its own guard still cannot
  touch another learner's card. That is a safety net, not a licence to skip the guard.
- **Phases are ordered so nothing unproven reaches production**: repo-only first, disposable local
  verification second, app code third, external effect (cloud push) last. Both prior plans follow it, and
  a plan review escalated a violation of it to CRITICAL.
- **Verification is deliberately hand-run SQL, and deliberately not in CI** — wiring it in "needs database
  credentials in GitHub secrets, which is its own decision". Two prior changes refused a test framework.
  A plan that introduces vitest here is making a new, arguable decision, not following the house style.
- **No speculative TypeScript ahead of a consumer.** A plan review killed a proposed `src/lib/card.ts`
  because `supabase-js` returns column names verbatim — so a row type must mirror the DB in **snake_case**,
  and should be written by the first slice that actually queries. **This slice is that first consumer.**
- **The app is server-rendered throughout with no client-side data layer.** Adding one would be a
  significant architectural first, not an implementation detail.

## Historical Context (from prior changes)

- `context/changes/card-store-with-owner-isolation/plan.md` — "What We're NOT Doing": _"**No scheduling
  state.** No rung index, ease factor, repetition count, or review-state column. Open Roadmap Question 5
  is unsettled and this foundation must not prejudge it."_ **This slice is the one that lifts that.**
- `context/changes/seed-deck-on-first-login/plan.md:130` — the `-x edge-runtime` requirement.
- `context/changes/seed-deck-on-first-login/plan.md` phase 4 criterion 4.8 — protects the
  `contract-surfaces.md` "undecided" row; this slice is the one allowed to change it.
- `context/changes/card-store-with-owner-isolation/reviews/plan-review.md:104` — _"The positive assertion …
  is now a required, first-position step"_; several negative assertions pass vacuously on an empty database.
- Same review, F1 (CRITICAL) — **never point a destructive verification script at the cloud project**.
- `context/changes/seed-deck-on-first-login/reviews/impl-review.md` F1 — new `public` functions are
  published as PostgREST RPCs by default; `revoke … from public` alone is insufficient, the three roles
  must be revoked **by name**.
- `context/foundation/lessons.md:12-17` — a swallowed failure needs a defined way to be noticed;
  _"'It logs a warning' is not a way to be noticed."_ Directly binding on any rating write that catches.
- **Live-state caveat**: seed-deck phases 3–4 and card-store phase 3 are unimplemented. `Astro.locals.supabase`
  does not exist; the dashboard has no count; neither migration is in the cloud project.

## Related Research

- `context/changes/srs-review-and-reschedule/external-research.md` — Exa/Context7 research settling Open
  Roadmap Question 5 in favour of `ts-fsrs` (FSRS v6), with the 3→4 rating mapping and its evidence.
- `context/changes/srs-review-and-reschedule/ts-fsrs-docs.md` — live `ts-fsrs` API from Context7 (pending).

## Open Questions

1. **Where does FSRS state live** — typed columns or one `jsonb` `review_state`? The library's `Card` is
   JSON-serializable, so both work. Whichever is chosen, it must have a `default` or the seeding trigger
   and backfill both need updating (and failure there is silent).
2. **Does the rating round-trip use a form POST + redirect (the only precedent) or a `fetch()` (a repo
   first)?** Advancing through a queue of due cards makes `fetch()` tempting; S-03 owns the routing, so
   this slice could stay on the boring path.
3. **JSON contract and status codes for the rating endpoint** — no precedent exists; must be stated.
4. **Does the endpoint check `locals.user` explicitly, given RLS already blocks cross-learner writes?**
   Recommended yes: RLS returns "zero rows updated", which is indistinguishable from a stale card id.
5. **How is the ordering guarantee asserted executably?** A new `supabase/tests/*.sql` script cannot call
   `ts-fsrs` (it is TypeScript). Either the check runs in JS — which means introducing the first JS test
   runner, an arguable new decision — or the endpoint is exercised end to end and the resulting
   `next_review_at` values are compared in SQL. This is the biggest unresolved shape in the slice.
6. **Do the ten seeded cards get `createEmptyCard()` state at seed time or lazily on first review?**
   Seed time means touching S-01's migration; lazily means the read path must tolerate a null state.
7. **`enable_fuzz`** — on by default, and it randomizes intervals, which would make an ordering assertion
   flaky. `fsrs({ enable_fuzz: false })` is documented; the test at minimum needs it off.
