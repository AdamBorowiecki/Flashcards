# Starter Deck on First Login — Implementation Plan

## Overview

Give every learner a built-in ten-card deck the moment their account exists, so the review loop is reachable without authoring anything first. This is roadmap item **S-01** and PRD **FR-005**, and it exists because FR-001's Socratic resolution decided a blank canvas is the wrong first experience: _"a seed deck is added as FR-005 so day-one users can experience the full loop before creating their own cards"_ (`prd.md:60`).

Provisioning happens in the database, not in application code. A `security definer` trigger on `auth.users` inserts the deck; the same migration backfills accounts that already exist. The only user-visible surface is one line on the dashboard reporting how many cards the learner has.

## Current State Analysis

`public.cards` exists locally with row-level security and four policies (F-01, migration `20260905163222_create_cards_table.sql`), and `next_review_at` already defaults to `now()` — so a seeded card is due the instant it is written. Nothing reads or writes that table yet: `src/` contains no query against it, no `Card` type, and no data-access module.

Four facts about the current code shape this plan:

1. **There is no authenticated surface a deck could appear on.** `src/pages/index.astro` renders a public marketing page, `src/pages/api/auth/signin.ts:19` sends the learner to `/` after sign-in, and `PROTECTED_ROUTES` (`src/middleware.ts:4`) holds only `/dashboard` — which today shows an email address and a sign-out button.
2. **Only the anon key exists.** `src/lib/supabase.ts:3` reads `SUPABASE_KEY`; there is no `service_role` path anywhere in the project. Any application-side seeding would therefore run as the learner. A `security definer` function sidesteps that question entirely by running as the function's owner.
3. **The middleware already builds a Supabase client and throws it away.** `src/middleware.ts:7` constructs one to resolve the user, then lets it fall out of scope. A page needing a query currently has to build a second one.
4. **"First login" and "signup" are different moments, and differ per environment.** The cloud project has email confirmation on — signup redirects to `/auth/confirm-email` — while `supabase/config.toml:209` sets `enable_confirmations = false` locally.

The blocking dependency: **F-01's phase 3 has not run.** `supabase/.temp/` holds no project ref, so the CLI has never been linked, and the cloud database has neither `public.cards` nor a `supabase_migrations` history. Phases 1-3 below run entirely against the local stack and are unaffected. Phase 4 cannot start until F-01 reaches the cloud.

## Desired End State

A new learner who signs up has ten cards in `public.cards` before they ever see a page, each owned by them, each due immediately. An account that existed before this change and holds no cards has the same ten after the migration runs. Signing in and opening `/dashboard` shows the deck size as a number. Running the seeding a second time changes nothing.

Verification that this is true: `supabase/tests/seed_deck.sql` runs to completion against the local stack with every assertion passing — including the positive one proving ten cards appear with the right owner and a due date in the past, the idempotency one proving a second run leaves the count unchanged, and the resilience one proving a deliberately broken seed still lets the account be created.

### Key Discoveries

- **The mechanism was prototyped against the live local database before this plan was written, not assumed.** An `after insert on auth.users` trigger calling a `security definer` function inserted three cards, all due immediately; a subsequent guarded backfill left the count unchanged.
- **The failure path was prototyped too.** With a deliberately broken seed (a blank `front`, violating `cards_front_not_blank`), the account row was still created, the deck was empty, and Postgres logged `WARNING: seed_starter_deck failed for <uuid>: new row for relation "cards" violates check constraint`. plpgsql's `begin … exception` block opens a subtransaction, so the failed insert rolls back on its own without taking the signup with it.
- `roadmap.md:90` names the failure mode this change must not have: _"the seeding trigger firing more than once and duplicating a learner's deck."_
- `roadmap.md:89` assigns the deck's contents to the user as a non-blocking unknown. It is now settled: ten cards, English front, Polish back.
- FR-002's resolution (`prd.md:64`) rules out a browsable list view. The dashboard gets a count, not a deck page.
- `AGENTS.md:11` names "multi-user ownership columns" as a first-code signal of out-of-scope work; the seeded rows carry the same singular `user_id` F-01 established.

## What We're NOT Doing

- **No profiles table, and no `seeded_at` marker.** Idempotency comes from a `not exists` guard on the learner's own cards. A second table this milestone has no other use for is exactly the scope creep F-01's risk warned about.
- **No scheduling state.** Seeded cards rely on `next_review_at default now()`. Open Roadmap Question 5 stays open and continues to block S-02.
- **No deck-browsing view.** One count on the dashboard. FR-002's Socratic resolution ruled out the separate list.
- **No review UI, no rating, no queue.** That is S-02 and S-03.
- **No card creation form.** That is S-04.
- **No test framework.** Verification is a SQL script, consistent with F-01.
- **No CI wiring.** Same reason as F-01: it needs database credentials in GitHub secrets, which is its own decision.
- **No error-tracking table.** Seeding failures go to the Postgres log; `roadmap.md:160` parks application-level error tracking explicitly.
- **No repair of `AGENTS.md`'s deeper staleness.** That file still says the project is "pre-bootstrap — no source code exists yet" (`AGENTS.md:3`) and that build commands are "not yet available" (`AGENTS.md:19`). Both were false before this change and are not caused by it. Phase 4 corrects only the one claim this change makes actively misleading; the rest is a separate cleanup.

## Implementation Approach

Four phases, ordered so nothing unproven reaches production, mirroring the shape F-01 used. Phase 1 touches only the repository. Phase 2 applies the migration to a disposable local database and proves the three properties that matter — correct deck, no duplication, no signup breakage. Phase 3 adds the only application code in the change, which is small enough to verify by looking at it in a browser. Phase 4 is the sole phase with an external effect, and it is gated behind F-01 reaching the cloud first.

## Critical Implementation Details

**`set search_path = ''` is mandatory on a `security definer` function, and it changes how you must write the body.** An empty search path is the documented hardening against a caller shadowing a table name to hijack the elevated function. The cost is that nothing resolves unqualified any more: the body must say `public.cards`, never `cards`. This was confirmed working in the prototype.

**The exception handler is the feature, not defensive noise.** Without it, any error inside the trigger aborts the whole signup transaction, and Supabase surfaces that to the client as `Database error saving new user` — a message that names neither the trigger nor the constraint, and is close to undiagnosable from the browser. A bug in a convenience feature must never stop someone registering.

**The trigger fires at account creation, not at email confirmation.** In the cloud project, where confirmation is on, that means an account that never confirms still gets a deck. This is accepted: the rows are invisible to everyone including their owner until that account can sign in, and cascading delete on `user_id` removes them if the account is ever purged.

**The backfill runs once, when the migration applies, and must be guarded anyway.** `where not exists (select 1 from public.cards c where c.user_id = u.id)` is what makes it safe to re-run — which matters less for the migration itself than for the day somebody re-runs it by hand against a database that already has decks.

**This change breaks `supabase/tests/cards_rls.sql`, and that is not a hypothetical.** With the trigger installed, running the F-01 suite against the local database fails at its first assertion: `positive read: learner A should see exactly 1 card, saw 11`. That test creates users, gives each one card, and asserts a count of exactly one — arithmetic that only holds on a database where accounts arrive empty. Every absolute count in that file has the same problem. Adapting it is part of this change, not a follow-up.

**Migration ordering is by filename timestamp.** This migration references `public.cards`, so it must sort after `20260905163222_create_cards_table.sql`. Generating the name with `npx supabase migration new` rather than inventing one guarantees that.

**The deck content contains Polish diacritics.** The migration file must be UTF-8 with LF endings; `.gitattributes` enforces the latter project-wide.

---

## Phase 1: Seeding migration in the repo

### Overview

Write the migration: the seed function, the trigger that calls it, and the one-off backfill. Nothing is applied to any database; the working tree is the only thing that changes.

### Changes Required:

#### 1. Seeding migration

**File**: `supabase/migrations/<timestamp>_seed_starter_deck.sql` (new — generate the timestamped name with `npx supabase migration new seed_starter_deck` so it sorts after the cards table migration)

**Intent**: Provision every learner, present and future, with a starter deck, in the database rather than in application code — so no call site can forget to do it and no second privilege path is needed.

**Contract**: Four objects, in this order.

0. **`public.starter_deck()`** — the deck itself, as a function returning `setof record (front text, back text)`, `language sql`, `immutable`. Both the trigger function and the backfill select from it, so the ten pairs are written once and cannot drift. This is the only place the vocabulary lives; changing the deck later means replacing this one function.

1. **`public.seed_starter_deck()`** — a trigger function, `language plpgsql`, `security definer`, `set search_path = ''`. Returns `new`. Body: return early if the learner already has any row in `public.cards`; otherwise insert the ten seed pairs against `new.id`; wrap the whole thing in `exception when others then raise warning '…'; return new;` so a failure logs and yields rather than aborting the caller. Every table reference fully qualified.

2. **`on_auth_user_created_seed_deck`** — `after insert on auth.users for each row execute function public.seed_starter_deck()`.

3. **The backfill** — a single `insert … select` over `auth.users` cross-joined against `public.starter_deck()`, with `where not exists (select 1 from public.cards c where c.user_id = u.id)`.

The ten pairs are English front, Polish back, common enough that a reader can judge them at a glance. They live in `public.starter_deck()` and nowhere else.

Columns written are `user_id`, `front`, `back` only. `id`, `next_review_at` and `created_at` all take their defaults; that is what makes a seeded card due immediately.

### Success Criteria:

#### Automated Verification:

- A file matching `supabase/migrations/*_seed_starter_deck.sql` exists and sorts after `20260905163222_create_cards_table.sql`
- Build still passes: `npm run build`

#### Manual Verification:

- The function is `security definer` **and** carries `set search_path = ''`, and every table reference in its body is schema-qualified
- The exception handler is present and returns `new` — a seed failure cannot abort signup
- The backfill carries the `not exists` guard
- Exactly ten pairs, defined only in `public.starter_deck()` — neither the trigger function nor the backfill carries its own copy
- No column beyond `user_id`, `front`, `back` is written — nothing prejudges Open Roadmap Question 5

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual review was successful before proceeding to the next phase.

---

## Phase 2: Apply and verify locally

### Overview

Apply the migration to a disposable local database and prove the three properties: the right deck arrives, it never duplicates, and a broken seed cannot break signup. Everything here is throwaway — `supabase stop` discards it.

### Changes Required:

#### 1. Local stack

**File**: none tracked — the CLI writes to Docker volumes and `supabase/.temp/`, already ignored

**Contract**: `npx supabase start -x edge-runtime`, then `npx supabase db reset`. The `-x edge-runtime` exclusion is needed on this machine: the edge runtime container fails its health check pulling `deno.land` behind a TLS-intercepting proxy, and taking it out is harmless because this project uses no Edge Functions.

#### 2. Seeding verification script

**File**: `supabase/tests/seed_deck.sql` (new)

**Intent**: Prove executably that the deck arrives correctly, arrives once, and cannot take signup down with it. The duplication risk in particular is invisible to a manual click-through — you would have to contrive a double-fire by hand to see it.

**Contract**: A self-contained script in a transaction it rolls back, following the conventions `supabase/tests/cards_rls.sql` established — assertions as `do $$ … raise exception … $$` blocks so the script exits non-zero on failure, and a header naming the run command.

Assertions, positive first because several of the others are also satisfied by an empty table:

- Insert a user into `auth.users`; assert exactly **ten** cards now exist for them, that every one is owned by that user, and that every `next_review_at` is `<= now()`
- Assert the fronts and backs are non-blank and distinct — a seed list with a copy-paste duplicate is a real and silent authoring error
- Run the backfill statement again; assert the count is still ten
- Insert a **second** user; assert they get their own ten and the first learner still has exactly ten
- Redefine the function with a deliberately failing insert, insert a third user, and assert the user row exists while their card count is zero — the resilience property, proven rather than asserted in prose

Header records the run command, since nothing in `package.json` will:
`docker exec -i supabase_db_10x-astro-starter psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/seed_deck.sql`

#### 3. Adapt the RLS suite to a seeded database

**File**: `supabase/tests/cards_rls.sql`

**Intent**: The F-01 suite asserts absolute card counts, which stop being true the moment accounts arrive with ten cards. Rewrite those assertions so they test isolation rather than arithmetic — otherwise this change silently invalidates the project's only proof that learners cannot see each other's decks.

**Contract**: Every assertion counting rows takes a baseline before the fixture insert and asserts the **delta**, not the absolute. The positive assertion becomes "learner A sees exactly one more card than they started with, and every visible row is theirs"; the cross-learner read stays at zero because B's rows must never be visible whatever the baseline. Ownership assertions are unchanged — they were never count-dependent. Do not weaken any assertion to make it pass; a delta-based check must still fail when a policy is broken, so re-run the mutation checks the file's own header documents.

**Contract note**: this file's header block records what each mutation proves. Update it if the delta rewrite changes any of those outcomes.

### Success Criteria:

#### Automated Verification:

- `npx supabase db reset` applies both migrations with no error
- `npx supabase migration list --local` shows both migrations in the Local column
- `supabase/tests/seed_deck.sql` runs to completion with exit code 0
- `supabase/tests/cards_rls.sql`, rewritten to assert count deltas, still passes — the new trigger must not have disturbed F-01's isolation

#### Manual Verification:

- The positive assertion — ten cards, right owner, all due — passed. A run satisfied only by zero rows proves nothing
- The idempotency assertion passed with the count unchanged
- The resilience assertion passed: user created, deck empty, warning logged

**Implementation Note**: Everything here is disposable. If an assertion fails, fix the migration in phase 1 and re-run `db reset` — do not carry a failing assertion into phase 3.

---

## Phase 3: Deck count on the dashboard

### Overview

Make the outcome visible to a human without SQL. One query, one line of output, and the small piece of plumbing that makes the query cheap.

### Changes Required:

#### 1. Supabase client on `Astro.locals`

**File**: `src/middleware.ts`, `src/env.d.ts`

**Intent**: The middleware already builds a client to resolve the user and then discards it (`src/middleware.ts:7`). Any page wanting a query has to build a second one against the same request. Putting the existing instance on `context.locals` removes that duplication before the first consumer appears rather than after the third.

**Contract**: `App.Locals` gains a `supabase` member typed as the return of `createClient` — which is nullable, because `createClient` returns `null` when the environment variables are unset (`src/lib/supabase.ts:6-8`) and the config-status banner depends on that staying true. The middleware assigns it alongside `context.locals.user`. `PROTECTED_ROUTES` is unchanged; `/dashboard` is already in it.

This is a contract surface — `App.Locals` is consumed by every page — so it gets a row in `docs/reference/contract-surfaces.md` in phase 4.

#### 2. Deck size on the dashboard

**File**: `src/pages/dashboard.astro`

**Intent**: Report how many cards the learner has, so the seeding is verifiable by looking at the app.

**Contract**: A count query against `public.cards` using the client from `Astro.locals`, rendered as one line near the existing welcome text. The query runs as the learner under the anon key, so `cards_select_own` scopes it — no user-id predicate is written by hand, per `AGENTS.md:9`.

Three states to render, because all three are reachable: a number when the query succeeds, nothing (or the existing content unchanged) when the client is `null` because Supabase is unconfigured, and a neutral message when the query errors. Do not render a bare `0` as though it were a successful empty deck when the query actually failed — that is the difference between "you have no cards" and "we could not ask".

### Success Criteria:

#### Automated Verification:

- `npx astro sync` then `npm run lint` passes — the repo lints with type-checked rules, so a bad `Locals` type fails here
- Build still passes: `npm run build`
- Formatting is clean: `npm run format`

#### Manual Verification:

- Signing up a brand-new account against the local stack and opening `/dashboard` shows **10**
- The account used for earlier testing also shows its count, proving the backfill reached existing users
- With `SUPABASE_URL` / `SUPABASE_KEY` unset, `/` still shows the existing config banner and `/dashboard` redirects to sign-in without an error page — the guard path is unchanged, and it is the only observable one, since an unconfigured app can never reach the dashboard

**Implementation Note**: After automated verification passes, pause for manual confirmation before phase 4.

---

## Phase 4: Push to cloud and record reality

### Overview

Apply the proven migration to the live project and correct the documents that would otherwise describe a state that no longer exists.

**This phase is blocked until F-01's phase 3 has run.** The cloud database has no `public.cards` and no migration history; a migration referencing that table will fail there. Confirm `npx supabase migration list` shows `20260905163222` in the Remote column before starting.

### Changes Required:

#### 1. Migration push

**File**: none — remote schema change only

**Contract**: `npx supabase db push`. The CLI must already be linked from F-01's phase 3.

#### 2. Contract surfaces registration

**File**: `docs/reference/contract-surfaces.md`

**Intent**: Register the names this change makes load-bearing.

**Contract**: Add rows for `seed_starter_deck` / `on_auth_user_created_seed_deck` (Runtime and configuration — renaming the trigger silently stops provisioning, with no error anywhere) and for `App.Locals.supabase` (consumed by middleware and every page that queries). Leave the "per-card scheduling state (shape TBD)" row untouched — this change must not appear to settle Open Roadmap Question 5.

#### 3. AGENTS.md correction

**File**: `AGENTS.md`

**Intent**: `AGENTS.md:8` states _"Every route is behind auth. Unauthenticated requests redirect to sign-in; no public-facing content."_ The public `/` already contradicted this; a plan that adds authenticated data display while leaving the rule wrong invites the next agent to act on it.

**Contract**: Rewrite that hard rule to say what is actually true — routes listed in `PROTECTED_ROUTES` redirect unauthenticated visitors, and the marketing index is deliberately public. Touch nothing else in the file; its other staleness is out of scope and named above.

### Success Criteria:

#### Automated Verification:

- `npx supabase migration list` shows the seeding migration in the Remote column
- Build still passes: `npm run build`
- Formatting is clean: `npm run format`

#### Manual Verification:

- The trigger appears on `auth.users` in the Supabase dashboard
- Signing up a fresh account on the live Worker produces a dashboard reading 10
- Signing in with the pre-existing account also shows a non-zero count — the backfill reached the cloud
- Sign-in itself still works; this change touches the auth path only through a trigger, so any regression here means the trigger is aborting signups
- `contract-surfaces.md` still shows per-card scheduling state as undecided

**Implementation Note**: This phase writes to a live project and to the table that gates account creation. Stop before `db push` and get explicit human confirmation. After this phase, S-01 is complete and moves to `done` via `/10x-archive`, not by hand.

---

## Testing Strategy

No test framework, by the same decision F-01 made. Verification is split by what each method can prove.

### SQL-level, against the local stack (the real test):

- Ten cards, correct owner, all due now — the positive assertion
- Fronts and backs non-blank and distinct
- A second run of the backfill leaves the count unchanged
- A second learner gets their own ten without disturbing the first
- A deliberately broken seed leaves the account created and the deck empty
- `cards_rls.sql`, on delta assertions, still passes — proving the trigger did not disturb F-01's isolation

### Build-level:

- `npm run lint` with type-checked rules catches a malformed `App.Locals`
- `npm run build` guards against unrelated regressions

### Manual:

- Fresh signup on the local stack shows 10 on the dashboard
- The pre-existing account shows a count, proving the backfill
- The unconfigured-Supabase path still renders

The gap worth naming, unchanged from F-01: none of this runs in CI.

## Performance Considerations

The trigger adds one guarded insert of ten rows to account creation — a one-time cost on a path that already does more work than that. The dashboard adds one indexed count per page load; `cards_user_id_next_review_at_idx` covers the `user_id` predicate. At the PRD's stated scale (`target_scale.users: small`) nothing further is warranted. The reason seeding is not done on first page load is partly this: that design would put a "have I seeded?" read on every authenticated request, against an NFR that asks for the review path to feel immediate.

## Migration Notes

The backfill is the only part of this change that touches existing rows, and it only ever adds. Reverting locally is `npx supabase db reset`. Reverting in the cloud means a forward migration that drops the trigger and the function — and a decision about whether to delete the seeded cards, which by then may have review history against them from S-02. Dropping the trigger is safe; deleting the rows is not automatically so.

## References

- Roadmap item: `context/foundation/roadmap.md` — S-01, and F-01 for the prerequisite
- Change identity: `context/changes/seed-deck-on-first-login/change.md`
- Prerequisite plan: `context/changes/card-store-with-owner-isolation/plan.md` — its phase 3 gates phase 4 here
- Verification pattern: `supabase/tests/cards_rls.sql`
- Requirement: `prd.md` FR-005, and FR-001's resolution at `prd.md:60` for why it exists
- Isolation rule: `AGENTS.md:9`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Seeding migration in the repo

#### Automated

- [x] 1.1 A file matching `supabase/migrations/*_seed_starter_deck.sql` exists and sorts after the cards migration
- [x] 1.2 Build still passes: `npm run build`

#### Manual

- [x] 1.3 Function is `security definer` with `set search_path = ''` and fully qualified table references
- [x] 1.4 Exception handler present and returns `new`
- [x] 1.5 Backfill carries the `not exists` guard
- [x] 1.6 Exactly ten pairs, defined only in `public.starter_deck()` and selected from it by both the trigger and the backfill
- [x] 1.7 No column beyond `user_id`, `front`, `back` is written

### Phase 2: Apply and verify locally

#### Automated

- [ ] 2.1 `npx supabase db reset` applies both migrations with no error
- [ ] 2.2 `npx supabase migration list --local` shows both migrations
- [ ] 2.3 `supabase/tests/seed_deck.sql` runs to completion with exit code 0
- [ ] 2.4 `supabase/tests/cards_rls.sql`, rewritten to assert count deltas, still passes

#### Manual

- [ ] 2.5 Positive assertion — ten cards, right owner, all due — passed
- [ ] 2.6 Idempotency assertion passed with the count unchanged
- [ ] 2.7 Resilience assertion passed: user created, deck empty, warning logged

### Phase 3: Deck count on the dashboard

#### Automated

- [ ] 3.1 `npx astro sync` then `npm run lint` passes
- [ ] 3.2 Build still passes: `npm run build`
- [ ] 3.3 Formatting is clean: `npm run format`

#### Manual

- [ ] 3.4 A brand-new local account shows 10 on `/dashboard`
- [ ] 3.5 The pre-existing test account also shows its count
- [ ] 3.6 With Supabase unconfigured, `/` shows the config banner and `/dashboard` redirects cleanly

### Phase 4: Push to cloud and record reality

#### Automated

- [ ] 4.1 `npx supabase migration list` shows the seeding migration in the Remote column
- [ ] 4.2 Build still passes: `npm run build`
- [ ] 4.3 Formatting is clean: `npm run format`

#### Manual

- [ ] 4.4 The trigger appears on `auth.users` in the Supabase dashboard
- [ ] 4.5 A fresh signup on the live Worker shows 10
- [ ] 4.6 The pre-existing account shows a non-zero count
- [ ] 4.7 Sign-in on the live Worker still works
- [ ] 4.8 `contract-surfaces.md` still shows per-card scheduling state as undecided
