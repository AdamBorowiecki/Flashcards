# Card Storage with Per-Learner Isolation — Implementation Plan

## Overview

Create the project's first database table: a card record owned by exactly one learner, with that ownership enforced by Postgres row-level security rather than by application code. This is roadmap item **F-01**, the foundation that unlocks S-01 (starter deck), S-02 (review and reschedule) and S-04 (create own card).

The change is deliberately narrow. It delivers one table, its access policy, and a script that proves the isolation actually holds. It delivers no UI, no API route, no TypeScript, and — critically — no scheduling state.

## Current State Analysis

The data layer does not exist. `supabase/` contains only `config.toml` and `.gitignore`: no `migrations/` directory, no `seed.sql` (though `config.toml:65` already declares `sql_paths = ["./seed.sql"]`), and no `.temp/`, meaning the Supabase CLI has never been linked to a remote project.

Everything else the change needs is already in place:

- Auth works end to end. `src/lib/supabase.ts` builds an SSR client from request headers and cookies via `@supabase/ssr`, and returns `null` when `SUPABASE_URL` / `SUPABASE_KEY` are unset.
- `src/middleware.ts:4,19-24` resolves the user onto `context.locals.user` and guards `PROTECTED_ROUTES`.
- `src/env.d.ts` types `App.Locals.user` as a Supabase `User | null`.
- The app is live on Cloudflare Workers against a **cloud** Supabase project; local development against Docker is documented in `README.md:77-114`.

Two constraints shape the plan:

1. **No test framework exists.** `package.json` has `dev`, `build`, `preview`, `astro`, `lint`, `lint:fix`, `format` and nothing else; no vitest, jest, playwright, or cypress in either dependency block. Automated verification of an RLS policy therefore cannot be a unit test — it has to be SQL executed against a real database.
2. **`README.md:114` currently asserts** "No database tables or migrations are required — this project uses Supabase Auth's built-in `auth.users` table only." That sentence is starter boilerplate and becomes false the moment this change lands.

## Desired End State

A table `public.cards` exists in the cloud Supabase project with row-level security enabled and four policies keyed on `auth.uid() = user_id`. A signed-in learner can read and write only their own rows; an unauthenticated request sees nothing. The migration that produced this state is committed in the repo and recorded in the remote migration history, so the next migration builds on a known baseline.

Verification that this is true: `supabase/tests/cards_rls.sql` runs to completion **against the local stack** with every assertion passing — including the positive one proving learner A does see their own row, and the negative one proving A cannot see B's — and only then does `npx supabase migration list` show the migration in the remote column.

### Key Discoveries

- `AGENTS.md:9` already fixes the mechanism: _"Enforce via Supabase Row-Level Security — never omit the user ID predicate in a card query."_ This plan implements that rule rather than choosing an approach.
- `AGENTS.md:11` names multi-user ownership columns as a first-code signal of out-of-scope work. The ownership column here is singular (`user_id`) by design.
- `CLAUDE.md` §Domain Model fixes the vocabulary: a card is front + back, belongs to one user, and carries `next_review_at`. These are contract names, registered in `docs/reference/contract-surfaces.md`.
- Roadmap F-01 `Unknowns` explicitly defers scheduling state: Open Roadmap Question 5 is open and blocks S-02, so any rung index / ease factor / repetition count arrives with that slice, not this one.
- `supabase test db` is documented by the CLI as _"Tests local Supabase containers"_ — the verification runner cannot reach a cloud project, which is why verification is a local-only phase that precedes the cloud push.
- `supabase/config.toml:36` pins Postgres major version 17, and `config.toml:55` has migrations enabled.

## What We're NOT Doing

- **No scheduling state.** No rung index, ease factor, repetition count, or review-state column. Open Roadmap Question 5 is unsettled and this foundation must not prejudge it.
- **No review history table**, no statistics table, no deck grouping. The roadmap's F-01 Risk names all three as the scope-creep failure mode.
- **No UI and no API endpoints.** Nothing in `src/pages/` changes.
- **No TypeScript at all.** No `Card` type, no data-access module, no generated Supabase types. Nothing in this change has a consumer yet, and a row type written before a real query is a guess — `supabase-js` returns column names verbatim (`user_id`, not `userId`), so the shape is best settled by the first slice that actually reads it.
- **No seed data.** The starter deck is S-01.
- **No test framework.** Verification is a SQL script, not a new dependency.
- **No CI wiring.** The RLS script is run by hand; putting it in CI needs database credentials in GitHub secrets, which is its own decision.
- **No verification against the cloud project.** The script creates users and rows; it runs only against a disposable local database.

## Implementation Approach

Three phases, ordered so that nothing unproven reaches production. Phase 1 touches only the repository and is fully reversible by `git checkout`. Phase 2 stands up a disposable local database, applies the migration there, and proves the isolation property — all of it throwaway. Phase 3 is the only phase with an external, hard-to-undo effect: it pushes a migration that has already been proven to isolate correctly, then corrects the two documents that would otherwise lie about the new state.

## Critical Implementation Details

**RLS is default-deny, and that is the whole safety mechanism.** `alter table ... enable row level security` with no policies blocks every read and write, including through the anon key. Enabling RLS and creating the policies must land in the same migration — a migration that enables RLS and stops leaves a table nothing can touch, and a migration that creates the table without enabling RLS leaves every learner's cards readable by every other learner through the anon key. Neither half is safe alone.

**RLS is not a grant.** Policies decide which rows a role may touch; they do not give the role access to the table in the first place. A new table in `public` is reachable only if the role holds a `GRANT`. Supabase's standard bootstrap sets default privileges in `public` for `anon`, `authenticated` and `service_role`, so this usually works silently — but when it does not, the error is `permission denied for table cards`, which reads exactly like a broken policy and will send you off rewriting policies that were correct all along. The migration therefore grants explicitly; it is idempotent and harmless if the default privileges already cover it.

**`auth.uid()` reads the JWT the request carries, not a session on the server.** The SSR client forwards the learner's access token from cookies, so `auth.uid()` resolves inside the policy for a signed-in request and returns `NULL` for an anonymous one — which makes every policy predicate false and yields zero rows. That is the intended behaviour for the unauthenticated case, not a misconfiguration to work around.

**Connecting to Postgres as the `postgres` superuser bypasses RLS.** The verification script must `set local role authenticated` before asserting anything, or every policy will appear to pass while actually being ignored.

**The `service_role` key bypasses RLS completely.** This project only ever uses the anon key (`SUPABASE_KEY`, declared `optional: true` in `astro.config.mjs`), so isolation holds today. If a future change introduces a service-role path, RLS stops protecting anything on that path and the user-id predicate has to be written by hand — which is exactly what `AGENTS.md:9` warns about.

**`supabase link` against a project created through the dashboard needs the project ref and the database password**, and the remote will have no `supabase_migrations` schema until the first push initializes it. Expect the first `db push` to create that history table as well as the cards table.

---

## Phase 1: Migration in the repo

### Overview

Write the migration. Nothing is applied to any database in this phase; the working tree is the only thing that changes.

### Changes Required:

#### 1. Cards migration

**File**: `supabase/migrations/<timestamp>_create_cards_table.sql` (new — generate the timestamped filename with `npx supabase migration new create_cards_table` rather than inventing one, so it matches CLI ordering)

**Intent**: Create the single table this milestone stores everything in, and lock it down so Postgres refuses cross-learner access regardless of what the application later asks for.

**Contract**: Table `public.cards` with:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users(id) on delete cascade` — deleting a learner removes their deck, which is correct for a personal-deck product
- `front text not null`, `back text not null`, each with a non-empty check constraint on the trimmed value
- `next_review_at timestamptz not null default now()` — a new card is due immediately; this is what stops a created or seeded card from never surfacing
- `created_at timestamptz not null default now()`

Plus an index on `(user_id, next_review_at)` — the shape of every due-queue query S-02 and S-03 will issue.

Then, in the same file and in this order:

1. `grant select, insert, update, delete on public.cards to authenticated;` — see Critical Implementation Details on why RLS alone is not enough.
2. `alter table public.cards enable row level security`.
3. Four policies, all predicated on `auth.uid() = user_id`: select (`using`), insert (`with check`), update (`using` **and** `with check` — without the `with check` half a learner could reassign a row to someone else), delete (`using`).

### Success Criteria:

#### Automated Verification:

- A file matching `supabase/migrations/*_create_cards_table.sql` exists
- Build still passes: `npm run build`

#### Manual Verification:

- The migration contains no scheduling-state column beyond `next_review_at` — no rung, ease, interval, or repetition field
- All four policies are present and every one of them is keyed on `auth.uid() = user_id`
- The grant, `enable row level security`, and the four policies are all in the same migration file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual review was successful before proceeding to the next phase.

---

## Phase 2: Apply and verify locally

### Overview

Stand up a disposable local database, apply the migration to it, and prove the isolation property before anything reaches the cloud project. Everything in this phase is throwaway — `supabase stop` discards it.

### Changes Required:

#### 1. Local stack

**File**: none tracked — the CLI writes to Docker volumes and to `supabase/.temp/`, which `supabase/.gitignore` already excludes

**Intent**: Provide a database that can be freely created, mutated and destroyed, so verification never touches anything real.

**Contract**: `npx supabase start` (requires Docker, ~7 GB RAM per `README.md:79`), then `npx supabase db reset` to apply the Phase 1 migration from scratch.

#### 2. RLS verification script

**File**: `supabase/tests/cards_rls.sql` (new)

**Intent**: Prove, executably, that one learner cannot read another's cards. This is the property the entire foundation exists to guarantee and the one thing a manual click-through cannot show.

**Contract**: A self-contained SQL script that, inside a transaction it rolls back at the end:

- creates two users in `auth.users` with known UUIDs
- inserts one card for each
- `set local role authenticated` and sets `request.jwt.claims` to learner A, then asserts a select returns **exactly A's one row** — this positive assertion must come first and must pass, because every assertion below is satisfied by an empty database
- asserts an attempt to insert a row owned by B while acting as A is rejected
- asserts an attempt to update B's row while acting as A affects zero rows
- resets to an anonymous claim and asserts a select returns zero rows

Assertions use `do $$ begin if ... then raise exception ... end if; end $$;` so the script exits non-zero on failure rather than printing a table the reader has to interpret. Header comment names the run command explicitly, since nothing in `package.json` will: `npx supabase test db`, or `psql "$(npx supabase status -o env | grep DB_URL)" -v ON_ERROR_STOP=1 -f supabase/tests/cards_rls.sql` if pgTAP conventions get in the way.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies the migration with no error
- `npx supabase migration list` shows the migration applied in the local column
- The RLS script runs to completion with no exception raised

#### Manual Verification:

- The positive assertion — learner A sees exactly their own row — passed. A run where every assertion is satisfied by zero rows proves nothing
- `npx supabase status` confirms the script ran against the local stack, not a linked remote

**Implementation Note**: Everything here is disposable. If the script fails, fix the migration in Phase 1 and re-run `db reset` — do not proceed to Phase 3 with a failing assertion.

---

## Phase 3: Push to cloud and record reality

### Overview

Push the now-proven migration to the live Supabase project, then fix the two documents that would otherwise describe a state that no longer exists. This is the only phase with an effect outside the repository.

### Changes Required:

#### 1. CLI link

**File**: none tracked — `supabase link` writes to `supabase/.temp/`

**Intent**: Point the CLI at the project the production Worker actually talks to, so the migration lands where the app reads.

**Contract**: `npx supabase link --project-ref <ref>`. The project ref and database password are secrets the human supplies interactively; they are never written to a tracked file or pasted into the conversation.

#### 2. Migration push

**File**: none — remote schema change only

**Intent**: Apply the verified migration to the cloud database and initialize remote migration history.

**Contract**: `npx supabase db push`. Expect it to create the `supabase_migrations` bookkeeping schema on first run alongside `public.cards`.

#### 3. README correction

**File**: `README.md`

**Intent**: Remove the claim that the project needs no tables or migrations, which this change falsifies.

**Contract**: The sentence at `README.md:114` under "First-time setup". Replace with a line stating that migrations live in `supabase/migrations/` and are applied with `npx supabase db push` (or `npx supabase db reset` locally). Leave the surrounding local-setup steps untouched.

#### 4. Contract surfaces registration

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Move `next_review_at` and the card column names from "contract only — absent from `src/`" to fixed, now that they exist in a schema, and record the table name.

**Contract**: The Domain vocabulary table. Update the `next_review_at` row's State column, add a row for `public.cards` and its column names, and leave the "per-card scheduling state (shape TBD)" row untouched — it stays undecided and still blocks S-02.

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` shows the migration present in the remote column
- Build still passes: `npm run build`
- Formatting is clean: `npm run format`

#### Manual Verification:

- The `cards` table is visible in the Supabase dashboard with the RLS badge showing enabled
- All four policies appear under the table's Auth Policies view
- Sign-in on the live Worker still works — this change touches no auth path, so any regression here means something unexpected happened
- `README.md` no longer claims that no tables or migrations are required
- `contract-surfaces.md` still shows per-card scheduling state as undecided — this change must not appear to settle Open Roadmap Question 5

**Implementation Note**: This phase writes to a live project. Stop before `db push` and get explicit human confirmation to proceed. After this phase, F-01 is complete; the roadmap item moves to `done` via `/10x-archive`, not by hand.

---

## Testing Strategy

There is no test framework in this repo, and this change deliberately does not add one. Verification is split by what each method can actually prove:

### SQL-level, against the local stack (the real test):

- Learner A sees exactly their own row — the positive assertion that makes the rest meaningful
- Cross-learner read returns zero rows
- Cross-learner insert is rejected
- Cross-learner update affects zero rows
- Anonymous read returns zero rows

### Build-level:

- `npm run build` guards against unrelated regressions; this change ships no source files, so it proves nothing about the migration itself

### Manual:

- Dashboard inspection confirms RLS is enabled and policies exist as written
- The live Worker's auth flow still works after the schema push

The gap worth naming: none of this runs in CI. Wiring `cards_rls.sql` into `.github/workflows/ci.yml` needs a database and credentials in GitHub secrets, which is a separate decision and a separate change.

## Performance Considerations

One index on `(user_id, next_review_at)` covers the only query shape this milestone issues — "my cards, due before now, soonest first". At the PRD's stated scale (`target_scale.users: small`) nothing else is warranted. RLS adds a predicate to every query; on an indexed `user_id` this is negligible and is the cost of enforcing isolation in the database rather than trusting every call site to remember it.

## Migration Notes

This is the project's first migration, so there is no existing data to migrate and no rollback path to preserve. Reverting the local database is `npx supabase db reset`; reverting the cloud one means a new forward migration that drops the table, since `db push` has no down step.

Local and cloud stay aligned because Phase 2 applies the migration locally and Phase 3 pushes the same file — but only for as long as you keep running `db reset` after future migrations.

## References

- Roadmap item: `context/foundation/roadmap.md` — F-01, and Open Roadmap Question 5 for the deferred scheduling decision
- Change identity: `context/changes/card-store-with-owner-isolation/change.md`
- Plan review: `context/changes/card-store-with-owner-isolation/reviews/plan-review.md`
- Isolation rule: `AGENTS.md:9`
- Domain vocabulary: `CLAUDE.md` §Domain Model, `docs/reference/contract-surfaces.md`
- Local setup: `README.md:77-114`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Migration in the repo

#### Automated

- [x] 1.1 A file matching `supabase/migrations/*_create_cards_table.sql` exists — 6815f1d
- [x] 1.2 Build still passes: `npm run build` — 6815f1d

#### Manual

- [x] 1.3 The migration contains no scheduling-state column beyond `next_review_at` — 6815f1d
- [x] 1.4 All four policies are present and keyed on `auth.uid() = user_id` — 6815f1d
- [x] 1.5 The grant, `enable row level security`, and the four policies are all in the same migration file — 6815f1d

### Phase 2: Apply and verify locally

#### Automated

- [x] 2.1 `npx supabase db reset` applies the migration with no error — e96c447
- [x] 2.2 `npx supabase migration list` shows the migration applied locally — e96c447
- [x] 2.3 The RLS script runs to completion with no exception raised — e96c447

#### Manual

- [x] 2.4 The positive assertion — learner A sees exactly their own row — passed — e96c447
- [x] 2.5 `npx supabase status` confirms the script ran against the local stack — e96c447

### Phase 3: Push to cloud and record reality

#### Automated

- [ ] 3.1 `npx supabase migration list` shows the migration present remotely
- [ ] 3.2 Build still passes: `npm run build`
- [ ] 3.3 Formatting is clean: `npm run format`

#### Manual

- [ ] 3.4 The `cards` table is visible in the dashboard with RLS enabled
- [ ] 3.5 All four policies appear under the table's Auth Policies view
- [ ] 3.6 Sign-in on the live Worker still works
- [ ] 3.7 `README.md` no longer claims that no tables or migrations are required
- [ ] 3.8 `contract-surfaces.md` still shows per-card scheduling state as undecided
