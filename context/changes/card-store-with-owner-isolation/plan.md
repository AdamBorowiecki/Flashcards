# Card Storage with Per-Learner Isolation — Implementation Plan

## Overview

Create the project's first database table: a card record owned by exactly one learner, with that ownership enforced by Postgres row-level security rather than by application code. This is roadmap item **F-01**, the foundation that unlocks S-01 (starter deck), S-02 (review and reschedule) and S-04 (create own card).

The change is deliberately narrow. It delivers one table, its access policy, one type, and a script that proves the isolation actually holds. It delivers no UI, no API route, and — critically — no scheduling state.

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

Verification that this is true: `npx supabase migration list` shows the migration applied both locally and remotely, and `supabase/tests/cards_rls.sql` runs to completion with every assertion passing — including the one that proves learner A cannot read learner B's cards.

### Key Discoveries

- `AGENTS.md:9` already fixes the mechanism: _"Enforce via Supabase Row-Level Security — never omit the user ID predicate in a card query."_ This plan implements that rule rather than choosing an approach.
- `AGENTS.md:11` names multi-user ownership columns as a first-code signal of out-of-scope work. The ownership column here is singular (`user_id`) by design.
- `CLAUDE.md` §Domain Model fixes the vocabulary: a card is front + back, belongs to one user, and carries `next_review_at`. These are contract names, registered in `docs/reference/contract-surfaces.md`.
- Roadmap F-01 `Unknowns` explicitly defers scheduling state: Open Roadmap Question 5 is open and blocks S-02, so any rung index / ease factor / repetition count arrives with that slice, not this one.
- `src/pages/api/auth/signin.ts:9-12` establishes the null-guard convention for `createClient` that any future card query must follow.
- `supabase/config.toml:36` pins Postgres major version 17, and `config.toml:55` has migrations enabled.

## What We're NOT Doing

- **No scheduling state.** No rung index, ease factor, repetition count, or review-state column. Open Roadmap Question 5 is unsettled and this foundation must not prejudge it.
- **No review history table**, no statistics table, no deck grouping. The roadmap's F-01 Risk names all three as the scope-creep failure mode.
- **No UI and no API endpoints.** Nothing in `src/pages/` changes. S-01 and S-04 own their own read/write paths.
- **No data-access module.** No `src/lib/cards.ts` with list/insert helpers — the first slice that actually queries decides the query shape.
- **No generated Supabase types.** A hand-written `Card` type is enough at one table; revisit when the schema grows.
- **No seed data.** The starter deck is S-01.
- **No test framework.** Verification is a SQL script, not a new dependency.
- **No CI wiring.** The RLS script is run by hand; putting it in CI needs database credentials in GitHub secrets, which is its own decision.

## Implementation Approach

Three phases with a deliberate boundary. Phase 1 touches only the repository and is fully reversible by `git checkout`. Phase 2 is the only phase with an external, hard-to-undo effect — it writes schema to a live project — so it sits behind a manual gate. Phase 3 proves the property the whole foundation exists for, then corrects the two documents that would otherwise lie about the new state.

## Critical Implementation Details

**RLS is default-deny, and that is the whole safety mechanism.** `alter table ... enable row level security` with no policies blocks every read and write, including through the anon key. Enabling RLS and creating the policies must land in the same migration — a migration that enables RLS and stops leaves a table nothing can touch, and a migration that creates the table without enabling RLS leaves every learner's cards readable by every other learner through the anon key. Neither half is safe alone.

**`auth.uid()` reads the JWT the request carries, not a session on the server.** The SSR client forwards the learner's access token from cookies, so `auth.uid()` resolves inside the policy for a signed-in request and returns `NULL` for an anonymous one — which makes every policy predicate false and yields zero rows. That is the intended behaviour for the unauthenticated case, not a misconfiguration to work around.

**The `service_role` key bypasses RLS completely.** This project only ever uses the anon key (`SUPABASE_KEY`, declared `optional: true` in `astro.config.mjs`), so isolation holds today. If a future change introduces a service-role path, RLS stops protecting anything on that path and the user-id predicate has to be written by hand — which is exactly what `AGENTS.md:9` warns about.

**`supabase link` against a project created through the dashboard needs the project ref and the database password**, and the remote will have no `supabase_migrations` schema until the first push initializes it. Expect the first `db push` to create that history table as well as the cards table.

---

## Phase 1: Schema and type in the repo

### Overview

Write the migration and the `Card` type. Nothing is applied to any database in this phase; the working tree is the only thing that changes.

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

Then `alter table public.cards enable row level security` and four policies, all predicated on `auth.uid() = user_id`: select (`using`), insert (`with check`), update (`using` **and** `with check` — without the `with check` half a learner could reassign a row to someone else), delete (`using`).

#### 2. Card type

**File**: `src/lib/card.ts` (new)

**Intent**: Give the consuming slices one shared shape for a card row so they don't each re-declare it. Type only — no functions, no queries.

**Contract**: `export type Card` with fields mirroring the table one-to-one: `id: string`, `userId: string`, `front: string`, `back: string`, `nextReviewAt: string`, `createdAt: string`. Import path is `@/lib/card` per the alias rule in `CLAUDE.md` §TypeScript.

### Success Criteria:

#### Automated Verification:

- Linting passes: `npm run lint`
- Build passes: `npm run build`
- Formatting is clean: `npm run format`
- A file matching `supabase/migrations/*_create_cards_table.sql` exists

#### Manual Verification:

- The migration contains no scheduling-state column beyond `next_review_at` — no rung, ease, interval, or repetition field
- All four policies are present and every one of them is keyed on `auth.uid() = user_id`
- `enable row level security` and the policies are in the same migration file

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual review was successful before proceeding to the next phase.

---

## Phase 2: Apply to the cloud project

### Overview

Link the CLI to the live Supabase project and push the migration. This is the only phase with an effect outside the repository.

### Changes Required:

#### 1. CLI link

**File**: none tracked — `supabase link` writes to `supabase/.temp/`, which `supabase/.gitignore` already excludes

**Intent**: Point the CLI at the project the production Worker actually talks to, so the migration lands where the app reads.

**Contract**: `npx supabase link --project-ref <ref>`. The project ref and database password are secrets the human supplies interactively; they are never written to a tracked file or pasted into the conversation.

#### 2. Migration push

**File**: none — remote schema change only

**Intent**: Apply the Phase 1 migration to the cloud database and initialize remote migration history.

**Contract**: `npx supabase db push`. Expect it to create the `supabase_migrations` bookkeeping schema on first run alongside `public.cards`.

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` shows the migration present in the remote column
- Build still passes: `npm run build`

#### Manual Verification:

- The `cards` table is visible in the Supabase dashboard with the RLS badge showing enabled
- All four policies appear under the table's Auth Policies view
- Sign-in on the live Worker still works — this change touches no auth path, so any regression here means something unexpected happened

**Implementation Note**: This phase writes to a live project. Stop before `db push` and get explicit human confirmation to proceed. After the push, pause again for manual confirmation before Phase 3.

---

## Phase 3: Prove isolation and record reality

### Overview

Demonstrate that the policy does what it claims, then fix the two documents that would otherwise describe a state that no longer exists.

### Changes Required:

#### 1. RLS verification script

**File**: `supabase/tests/cards_rls.sql` (new)

**Intent**: Prove, executably, that one learner cannot read another's cards. This is the property the entire foundation exists to guarantee and the one thing a manual click-through cannot show.

**Contract**: A self-contained SQL script that, inside a transaction it rolls back at the end:

- creates two users in `auth.users` with known UUIDs
- inserts one card for each
- sets the request JWT claims to learner A (`set local role authenticated` plus `set local request.jwt.claims`) and asserts a select returns exactly A's one row
- asserts an attempt to insert a row owned by B while acting as A is rejected
- asserts an attempt to update B's row while acting as A affects zero rows
- resets to an anonymous claim and asserts a select returns zero rows

Assertions use `do $$ begin if ... then raise exception ... end if; end $$;` so the script exits non-zero on failure rather than printing a table the reader has to interpret. Add a header comment naming the exact command to run it, since nothing in `package.json` will.

#### 2. README correction

**File**: `README.md`

**Intent**: Remove the claim that the project needs no tables or migrations, which this change falsifies.

**Contract**: The sentence at `README.md:114` under "First-time setup". Replace with a line stating that migrations live in `supabase/migrations/` and are applied with `npx supabase db push` (or `npx supabase db reset` locally). Leave the surrounding local-setup steps untouched.

#### 3. Contract surfaces registration

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Move `next_review_at` and the card column names from "contract only — absent from `src/`" to fixed, now that they exist in a schema, and record the table name.

**Contract**: The Domain vocabulary table. Update the `next_review_at` row's State column, add a row for `public.cards` and its column names, and leave the "per-card scheduling state (shape TBD)" row untouched — it stays undecided and still blocks S-02.

### Success Criteria:

#### Automated Verification:

- The RLS script runs to completion with no exception raised
- Linting passes: `npm run lint`
- Formatting is clean: `npm run format`

#### Manual Verification:

- `README.md` no longer claims that no tables or migrations are required
- `contract-surfaces.md` still shows per-card scheduling state as undecided — this change must not appear to settle Open Roadmap Question 5

**Implementation Note**: After this phase, F-01 is complete. The roadmap item moves to `done` via `/10x-archive`, not by hand.

---

## Testing Strategy

There is no test framework in this repo, and this change deliberately does not add one. Verification is therefore split by what each method can actually prove:

### SQL-level (the real test):

- Cross-learner read returns zero rows
- Cross-learner insert is rejected
- Cross-learner update affects zero rows
- Anonymous read returns zero rows

### Build-level:

- `npm run lint` and `npm run build` catch type and style regressions in `src/lib/card.ts`

### Manual:

- Dashboard inspection confirms RLS is enabled and policies exist as written
- The live Worker's auth flow still works after the schema push

The gap worth naming: none of this runs in CI. Wiring `cards_rls.sql` into `.github/workflows/ci.yml` needs database credentials as repository secrets, which is a separate decision and a separate change.

## Performance Considerations

One index on `(user_id, next_review_at)` covers the only query shape this milestone issues — "my cards, due before now, soonest first". At the PRD's stated scale (`target_scale.users: small`) nothing else is warranted. RLS adds a predicate to every query; on an indexed `user_id` this is negligible and is the cost of enforcing isolation in the database rather than trusting every call site to remember it.

## Migration Notes

This is the project's first migration, so there is no existing data to migrate and no rollback path to preserve. Reverting means dropping the table.

The local and cloud databases are separate. If you also run the local stack (`npx supabase start`), apply the same migration there with `npx supabase db reset` so the two stay aligned; otherwise local dev will disagree with production about whether `cards` exists.

## References

- Roadmap item: `context/foundation/roadmap.md` — F-01, and Open Roadmap Question 5 for the deferred scheduling decision
- Change identity: `context/changes/card-store-with-owner-isolation/change.md`
- Isolation rule: `AGENTS.md:9`
- Domain vocabulary: `CLAUDE.md` §Domain Model, `docs/reference/contract-surfaces.md`
- Client convention: `src/lib/supabase.ts`, `src/pages/api/auth/signin.ts:9-12`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Schema and type in the repo

#### Automated

- [ ] 1.1 Linting passes: `npm run lint`
- [ ] 1.2 Build passes: `npm run build`
- [ ] 1.3 Formatting is clean: `npm run format`
- [ ] 1.4 A file matching `supabase/migrations/*_create_cards_table.sql` exists

#### Manual

- [ ] 1.5 The migration contains no scheduling-state column beyond `next_review_at`
- [ ] 1.6 All four policies are present and keyed on `auth.uid() = user_id`
- [ ] 1.7 `enable row level security` and the policies are in the same migration file

### Phase 2: Apply to the cloud project

#### Automated

- [ ] 2.1 `npx supabase migration list` shows the migration present remotely
- [ ] 2.2 Build still passes: `npm run build`

#### Manual

- [ ] 2.3 The `cards` table is visible in the dashboard with RLS enabled
- [ ] 2.4 All four policies appear under the table's Auth Policies view
- [ ] 2.5 Sign-in on the live Worker still works

### Phase 3: Prove isolation and record reality

#### Automated

- [ ] 3.1 The RLS script runs to completion with no exception raised
- [ ] 3.2 Linting passes: `npm run lint`
- [ ] 3.3 Formatting is clean: `npm run format`

#### Manual

- [ ] 3.4 `README.md` no longer claims that no tables or migrations are required
- [ ] 3.5 `contract-surfaces.md` still shows per-card scheduling state as undecided
