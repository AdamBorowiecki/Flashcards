# Review a Due Card and Reschedule It by Rating — Implementation Plan

## Overview

S-02, the milestone's north star. A learner opens `/review`, sees a due card's front, reveals the back,
rates recall as missed it / got it / nailed it, and `ts-fsrs` reschedules the card. The PRD's
non-negotiable ordering — `missed_it` returns sooner than `got_it`, which returns sooner than
`nailed_it` — is proven by an executable check that runs before any database or UI code exists.

Satisfies PRD US-01, FR-003, FR-004. Closes Open Roadmap Question 5.

## Current State Analysis

Verified against HEAD `7b54dc8` (see `research.md`, follow-up section dated 2026-09-12).

- **`public.cards` carries no scheduling state.** Six columns — `id`, `user_id`, `front`, `back`,
  `next_review_at`, `created_at` — and a header comment saying the omission is deliberate pending this
  slice (`supabase/migrations/20260905163222_create_cards_table.sql:7-23`).
- **The due-queue index already exists**: `cards_user_id_next_review_at_idx (user_id, next_review_at)`
  (`:25-26`). This slice adds no index.
- **RLS is complete and needs no change.** `cards_update_own` carries both `using` and `with check`
  (`:47-51`), so the rating write is already permitted and cannot reassign a row to another learner.
- **One consumer of `cards` exists**: `src/pages/dashboard.astro:13` counts them. This slice writes the
  first mutation and the first row type.
- **`Astro.locals.supabase` exists** (`src/env.d.ts:4`, `src/middleware.ts:9`) and is typed nullable —
  but **no `/api/*` endpoint reads `locals` at all**; all three auth endpoints call `createClient`
  themselves.
- **No JSON endpoint, no `Response.json()`, no explicit status code exists anywhere in `src/`.**
- **No JS test runner, and both archived plans refuse one in terms.** Verification is hand-run scripts.
- **Seeding writes only `(user_id, front, back)`** — trigger at
  `supabase/migrations/20260906133232_seed_starter_deck.sql:67-69`, backfill at `:95-101`.

## Desired End State

A signed-in learner clicks through from the dashboard to `/review`, works through every card that is due,
and each rating moves that card's `next_review_at` by an amount `ts-fsrs` chose. Rating a card
`missed_it` demonstrably brings it back sooner than `got_it`, which comes back sooner than `nailed_it` —
asserted by a committed script, not by eye. When the queue empties, the learner sees a plain panel
saying so.

Verify by: running `node --experimental-strip-types scripts/verify-srs-ordering.ts` (exits zero), then
completing a review session on the live Worker and confirming the three ratings produced ordered
`next_review_at` values in the database.

### Key Discoveries

- **`enable_fuzz` defaults to `false`** (`ts-fsrs-docs.md`, FSRSParameters). Earlier research claimed the
  opposite and treated it as a flakiness risk for the ordering assertion. It never was. Confirmed by
  running the library.
- **`enable_short_term` defaults to `true`, and that default is wrong for this product.** Measured on
  `ts-fsrs@5.4.2` from one `createEmptyCard()`: `missed_it` +1 minute, `got_it` +10 minutes, `nailed_it`
  +8 days. Turning it off gives 1 / 3 / 8 days. See Phase 1 change #3 — this drove a plan revision, not
  just a note.
- **The three-rating ordering holds in every configuration measured** — new card with short-term on, new
  card with it off, and a Review-state card at stability 498 (`missed_it` +0.007 days, `got_it` +1348,
  `nailed_it` +2090). The invariant was never the thing at risk; the session rhythm was.
- **`TypeConvert.card()` accepts epoch numbers and ISO strings**, which is exactly what a Postgres
  round-trip produces — so no hand-written coercion layer is needed either way.
- **`allowImportingTsExtensions` and `noEmit` are already true** in the resolved tsconfig (inherited from
  `astro/tsconfigs/strict`). This is what lets the verification script import the real mapping module by
  its `.ts` path instead of duplicating it.
- **`tsconfig.json` includes every file in the repo**, so a new `scripts/` directory is covered by
  `projectService` and will be type-checked by ESLint like everything else.
- **The seeding trigger swallows failures** (`…seed_starter_deck.sql:72-81`): a `not null` column without
  a default would produce accounts that are created successfully and arrive with an empty deck, logging
  only a warning. The backfill, having no handler, would instead abort the migration loudly. Column
  defaults avoid both.
- **`src/lib/card.ts` was killed in F-01's plan review** for existing without a consumer, and for being
  camelCase when `supabase-js` returns column names verbatim
  (`context/archive/2026-09-05-card-store-with-owner-isolation/reviews/plan-review.md:63-70`). This
  slice's `src/lib/srs.ts` is different on both counts: two callers import it, and it holds no row shape.

## What We're NOT Doing

- **No routing change.** `/` and the post-sign-in landing stay as they are. Entering review is an explicit
  link from the dashboard. FR-002's auto-launch is S-03's outcome.
- **No session header, no due count, no progress indicator.** Also S-03.
- **No review history or statistics table.** `reps` and `lapses` are persisted because `ts-fsrs` needs
  them as inputs; nothing surfaces them.
- **No card creation or editing.** S-04.
- **No test framework.** The ordering check is a committed script, consistent with the decision F-01 made
  and S-01 inherited.
- **No CI wiring.** Neither the SQL suites nor the new script run in CI; that still needs database
  credentials in secrets, which remains a separate decision.
- **No FSRS parameter optimizer.** Default parameters need no review history
  (`external-research.md`).
- **No `elapsed_days` column.** Deprecated upstream.
- **No column-level grant and no rating RPC.** Neither is available while the app holds only the anon
  key — see "Accepted limitation" below.

## Implementation Approach

Four phases, ordered so nothing unproven reaches production — the shape both prior changes used.

Phase 1 touches only the repository and, unusually, is where the product's core invariant gets proven:
the ordering check needs neither a database nor an endpoint, so it can pass before either exists. Phase 2
applies the migration to a disposable local database and proves the seeding path still works untouched.
Phase 3 adds the application code. Phase 4 is the only phase with an external effect.

### Accepted limitation: a learner can reschedule their own cards

The app holds only the anon key and queries as the learner (`src/lib/supabase.ts:9`), so a learner with
their own session can PATCH their own `next_review_at` through PostgREST and bypass the scheduler. A
column-level grant would also block the application's own write; a `security definer` RPC is published to
`authenticated` and so is callable directly, and could only protect the schedule if it computed intervals
in SQL, which `ts-fsrs` cannot. The only real remedy is holding a `service_role` key as a Workers secret —
a separate architectural decision, deliberately deferred.

The exposure is bounded: all four policies remain keyed on `auth.uid() = user_id`, so the blast radius is
the learner's own rows. The worst outcome is a solo learner cheating themselves out of their own
scheduling. Recorded here so a future reader finds a decision rather than an oversight.

## Critical Implementation Details

**The verification script's import path is load-bearing.** `scripts/verify-srs-ordering.ts` imports
`../src/lib/srs.ts` by its explicit `.ts` extension and runs under `node --experimental-strip-types`. For
that to work, `src/lib/srs.ts` must import **only** from `ts-fsrs` — no `@/` alias, no `astro:env`, no
Astro imports — because Node resolves neither. Putting anything Astro-shaped in that module breaks the
check silently by making it unrunnable, which is worse than not having it.

**`no-console` is a warn, not an error** (`eslint.config.js:23`), so the script would lint-pass with
console output. Use `process.stdout.write` anyway to keep `npm run lint` output clean.

---

## Phase 1: Scheduler and its proof, in the repo

### Overview

The migration, the dependency, the rating map, and the executable ordering check. Nothing runs against a
database and nothing is user-visible. At the end of this phase the invariant the PRD calls fatal-if-wrong
is proven.

### Changes Required

#### 1. Scheduling columns on `public.cards`

**File**: `supabase/migrations/<timestamp>_add_fsrs_scheduling_state.sql`

**Intent**: Give each card the memory state `ts-fsrs` needs, with defaults equal to what
`createEmptyCard()` produces, so both of S-01's inserts keep working without being touched and every card
starts life as a new card.

**Contract**: Eight new columns on `public.cards`. FSRS's `due` is **not** among them — it maps onto the
existing `next_review_at`, which stays the single source of the due date so the due-queue index and the
`cards_select_own` policy keep working unchanged.

| Column           | Type               | Null | Default |
| ---------------- | ------------------ | ---- | ------- |
| `stability`      | `double precision` | no   | `0`     |
| `difficulty`     | `double precision` | no   | `0`     |
| `scheduled_days` | `integer`          | no   | `0`     |
| `learning_steps` | `integer`          | no   | `0`     |
| `reps`           | `integer`          | no   | `0`     |
| `lapses`         | `integer`          | no   | `0`     |
| `state`          | `smallint`         | no   | `0`     |
| `last_review`    | `timestamptz`      | yes  | —       |

Plus check constraints: `state` between 0 and 3 (the four `State` enum values), and non-negative on
`stability`, `difficulty`, `scheduled_days`, `learning_steps`, `reps`, `lapses`.

Follow the house migration style: a header comment naming the roadmap item and stating that this is the
slice that lifts F-01's deferral; inline comments justifying the non-obvious choices (why `due` is absent,
why defaults rather than a trigger change); no `if not exists` guards; no policy or grant changes.

#### 2. The `ts-fsrs` dependency

**File**: `package.json`

**Intent**: Add the scheduler.

**Contract**: `ts-fsrs` at `^5.4.2` as a runtime **dependency**, not a devDependency — the rating endpoint
imports it at request time. Do not take the `6.0.0-beta` tag.

#### 3. The rating map and scheduling call

**File**: `src/lib/srs.ts` (new)

**Intent**: Hold the 3→4 rating mapping and the single call into `ts-fsrs`, in one place that both the
endpoint and the verification script import — so the script proves the mapping the application actually
uses, not a copy of it.

**Contract**: Imports **only** from `ts-fsrs` (see Critical Implementation Details). Exports:

- the three rating tokens as a const array and a type — the tokens are `missed_it`, `got_it`, `nailed_it`
  verbatim, as fixed by `CLAUDE.md` §Domain Model and `docs/reference/contract-surfaces.md:30`;
- a type guard that narrows an unknown string to that type, used by the endpoint to validate input;
- the map to `Rating`: `missed_it → Rating.Again`, `got_it → Rating.Good`, `nailed_it → Rating.Easy`.
  `Rating.Hard` is deliberately unused — rationale in `external-research.md`;
- a `schedule(state, rating, now)` function taking the card's persisted scheduling fields, returning the
  new ones. It builds the scheduler with **both** `enable_fuzz: false` and `enable_short_term: false`
  passed explicitly rather than relying on defaults, uses `TypeConvert.card()` to rebuild a `Card` from
  stored values, and calls `next()`.

  **`enable_short_term: false` is a product decision, not a tuning knob, and must not be dropped.** With
  the library default (`true`), a new card rated `missed_it` comes due in **one minute** and `got_it` in
  **ten** — measured on `ts-fsrs@5.4.2` — because FSRS repeats new cards within a session before promoting
  them to day-scale intervals. That is Anki's rhythm, not this product's: `CLAUDE.md` §Domain Model
  describes cards surfacing on app open, and this slice loads the due queue as a single snapshot, so
  minute-scale re-dues would never appear until a reload while the "nothing due" panel claimed otherwise.
  With it off, the same three ratings measure **1 day / 3 days / 8 days**, the snapshot stays correct, and
  the empty-state panel tells the truth. The cost, accepted: a card you just failed returns tomorrow
  rather than later in the same session.

The persisted-state shape is **snake_case**, mirroring the column names verbatim — `supabase-js` returns
columns unmodified, and F-01's plan review killed a camelCase type for exactly this reason.

#### 4. The executable ordering check

**File**: `scripts/verify-srs-ordering.ts` (new)

**Intent**: Prove the PRD's non-negotiable ordering against the real library and the real mapping, in a
way that exits non-zero on failure. This is the check `context/foundation/roadmap.md:103` requires.

**Contract**: Imports `../src/lib/srs.ts` by explicit `.ts` extension. It runs the same assertion block
against **two** starting states, because the invariant is claimed for the whole product, not just for a
deck's first day:

- **a new card** — `createEmptyCard()` at a fixed `now`. Covers the seeded deck and every card's first
  review.
- **a matured card** — built in-process by replaying a handful of `got_it` ratings from the new card,
  each at its own due date, until it reaches `State.Review`. Covers the case the learner actually spends
  most of their time in. Needs no database.

For each starting state, apply each of the three rating tokens from that identical state and compare the
resulting due dates. Assertions, in this order — the first is positive by design, because every assertion
after it would also be satisfied by a scheduler that returned the same date three times, and F-01's suite
already carries an unresolved finding of exactly that shape:

1. **positive, first**: all three ratings produce a due strictly later than that state's `now`;
2. `missed_it` due < `got_it` due;
3. `got_it` due < `nailed_it` due.

The matured fixture encodes an assumption about how a card matures, which could drift from real usage —
acceptable, because a fixture that is merely unrepresentative still catches an inverted mapping, which is
the failure this check exists for.

On failure: write the offending values and exit non-zero. On success: one line naming the three intervals,
matching the `<file>: all assertions passed` convention of the SQL scripts.

**File**: `package.json`

**Intent**: Give the script a documented run command, the way the SQL scripts document theirs in their
headers.

**Contract**: a `verify:srs` script running
`node --experimental-strip-types scripts/verify-srs-ordering.ts`. This adds a script entry, not a test
framework.

### Success Criteria

#### Automated Verification

- `ts-fsrs@^5.4.2` installs and the lockfile updates
- Ordering check passes: `npm run verify:srs`
- `npx astro sync` then `npm run lint` passes
- Build passes: `npm run build`
- Formatting is clean: `npm run format`

#### Manual Verification

- The check is not vacuous: temporarily map `got_it` to `Rating.Again`, confirm `npm run verify:srs` fails
  and names the values, then revert

**Implementation Note**: After completing this phase and all automated verification passes, pause here for
manual confirmation from the human that the manual review was successful before proceeding.

---

## Phase 2: Apply and verify locally

### Overview

Apply the migration to a disposable local database and prove the thing most likely to break silently —
that S-01's seeding trigger still lands ten cards without being touched. Everything here is throwaway; if
an assertion fails, fix phase 1 and re-run `db reset`.

### Changes Required

No files change in this phase. It is verification only.

Run against the local stack, never the cloud project — the CRITICAL finding from F-01's plan review
(`context/archive/2026-09-05-card-store-with-owner-isolation/reviews/plan-review.md:25-36`).

```
npx supabase start -x edge-runtime
npx supabase db reset
docker exec -i supabase_db_10x-astro-starter \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/<file>.sql
```

`-x edge-runtime` is required on this machine; container name derives from
`project_id = "10x-astro-starter"` (`supabase/config.toml:5`).

### Success Criteria

#### Automated Verification

- `npx supabase db reset` applies all three migrations with no error
- `supabase/tests/cards_rls.sql` still passes unchanged
- `supabase/tests/seed_deck.sql` still passes unchanged

#### Manual Verification

- A brand-new local signup still lands exactly ten cards — this is what proves the column defaults work,
  since the trigger would otherwise swallow the failure into an empty deck
- Every seeded card's scheduling columns equal the `createEmptyCard()` values: zeros, `state` 0,
  `last_review` null, `next_review_at` in the past or now
- `next_review_at` is untouched by the migration on pre-existing rows

**Implementation Note**: Everything here is disposable. Do not carry a failing assertion into phase 3.

---

## Phase 3: Review screen and rating endpoint

### Overview

The only application code in the change. A page that server-renders the due queue, a JSON endpoint that
applies one rating, and a React island that walks the queue.

### Changes Required

#### 1. The rating endpoint

**File**: `src/pages/api/cards/rate.ts` (new)

**Intent**: Apply one rating to one card and persist the new scheduling state.

**Contract**: `export const POST: APIRoute`, matching the shape of the three auth endpoints. Everything
else here is a first for this repo and is therefore stated explicitly rather than claimed as convention:

- **Request**: JSON body `{ card_id: string, rating: "missed_it" | "got_it" | "nailed_it" }`. Parsed and
  validated with the type guard from `src/lib/srs.ts`; an untyped `await request.json()` would trip
  `no-unsafe-assignment` under `strictTypeChecked`.
- **Client**: reads `context.locals.supabase` rather than calling `createClient` itself — the first
  endpoint to do so, justified because middleware already built it.
- **Guard**: checks `context.locals.user` explicitly and returns **401** when absent. RLS alone is not
  enough: it reports zero rows updated, which is indistinguishable from a bad card id, so an unguarded
  endpoint cannot answer truthfully.
- **Responses**: `200` with `{ next_review_at }`; `400` on malformed body or unknown rating token; `401`
  unauthenticated; `404` when the update affects zero rows; `500` when Supabase errors. JSON in every
  case.
- **Not configured**: when `locals.supabase` is null, `500` with a JSON error — the redirect idiom the
  auth endpoints use does not apply to a JSON caller.

The update writes only the scheduling columns returned by `schedule()`, plus `next_review_at` from the new
due date. It never writes `front`, `back`, or `user_id`.

#### 2. The review page

**File**: `src/pages/review.astro` (new)

**Intent**: Server-render the whole due queue and hand it to the island, or render the empty panel.

**Contract**: Reads `Astro.locals.supabase` with the null-guard shape established at
`src/pages/dashboard.astro:11`. Selects cards where `next_review_at <= now()` ordered by
`next_review_at` — a query the existing composite index already covers. Passes the rows to the island as
props. Renders the island with `client:load`, the only mounting pattern in the repo. Uses the
`bg-cosmic flex min-h-screen items-center justify-center p-4` full-page shell every other view uses.

When the queue is empty, renders a plain panel saying nothing is due, with a link back to `/dashboard` —
the same panel the island shows when the queue runs out, so both paths look identical.

#### 3. The review island

**File**: `src/components/review/ReviewSession.tsx` (new)

**Intent**: Walk the queue, reveal backs, submit ratings, and keep the learner honest about failures.

**Contract**: Default-exported React component receiving the queue as props — the house island shape.
State: current index, whether the back is revealed, in-flight status, and an error message.

- Revealing the back is local state only, so it is instant.
- Each rating button POSTs JSON to `/api/cards/rate` and, on `200`, advances to the next card and clears
  the reveal.
- **On failure the card stays.** A visible message appears, the queue does not advance, and the buttons
  become usable again so the learner can retry. Never advance on a failed write: a rating that silently
  did not land leaves the card scheduled wrongly with nothing to show for it, which is the swallowed
  failure `context/foundation/lessons.md:12-17` forbids.
- While a request is in flight the rating buttons are disabled. `useFormStatus` does not apply here, so
  this is explicit state.
- When the index passes the last card, render the same "nothing due" panel the page renders.

Any shadcn primitive beyond `button.tsx` that this needs must be added deliberately; the directory holds
only `button.tsx` and `LibBadge.astro` today.

#### 4. Route guard and entry point

**File**: `src/middleware.ts`

**Intent**: Put `/review` behind authentication.

**Contract**: add `"/review"` to `PROTECTED_ROUTES` (`:4`). No other middleware change.

**File**: `src/pages/dashboard.astro`

**Intent**: Give the learner a way in.

**Contract**: the existing deck-count line gains a link to `/review`. Interim by design — S-03 replaces it
with routing.

### Success Criteria

#### Automated Verification

- `npx astro sync` then `npm run lint` passes
- Build passes: `npm run build`
- Formatting is clean: `npm run format`

#### Manual Verification

- `/review` shows a due card's front; revealing shows the back
- Rating three different cards `missed_it`, `got_it` and `nailed_it` produces `next_review_at` values in
  that ascending order, **days apart rather than minutes apart**, confirmed by querying the local
  database. Minute-scale gaps mean `enable_short_term: false` was dropped — see Phase 1 change #3
- Rating three cards in a row is perceptibly immediate, with no visible lag between cards — the NFR at
  `context/foundation/prd.md:78`
- The "nothing due" panel appears both after the last card is rated and on arrival with an empty queue
- A failed rating keeps the card on screen and shows an error — verify by going offline mid-session
- A signed-out visit to `/review` redirects to `/auth/signin`
- With Supabase unconfigured, `/review` behaves like `/dashboard` rather than crashing

**Implementation Note**: After automated verification passes, pause for manual confirmation before
phase 4.

---

## Phase 4: Push to cloud and record reality

### Overview

The sole phase with an external effect. It writes to the live project whose `cards` table the signup
trigger depends on.

### Changes Required

#### 1. The migration push

**Intent**: Apply the scheduling migration to the cloud project.

**Contract**: `npx supabase db push`. The CLI is already linked from F-01's phase 3. Confirm with
`npx supabase migration list` that the two existing migrations show in the Remote column before pushing.

#### 2. Close the contract-surfaces row

**File**: `docs/reference/contract-surfaces.md`

**Intent**: This slice is the one allowed to resolve the row that has been marked undecided since F-01.

**Contract**: the "per-card scheduling state (shape TBD)" row (`:33`) changes from
`undecided — blocks S-02` to the settled column names and `fixed`. The `public.cards` row (`:32`) gains
the new columns. Add a row for `src/lib/srs.ts`'s rating map — it is load-bearing and fails silently if
the three tokens drift from `CLAUDE.md` §Domain Model.

#### 3. Record reality

**File**: `context/changes/srs-review-and-reschedule/change.md`

**Intent**: Reflect what shipped.

**Contract**: status advances to `implemented`; the note recording that Open Roadmap Question 5 is closed
in favour of `ts-fsrs`.

### Success Criteria

#### Automated Verification

- `npx supabase migration list` shows the scheduling migration in the Remote column
- Build passes: `npm run build`
- Formatting is clean: `npm run format`
- Ordering check still passes: `npm run verify:srs`

#### Manual Verification

- A fresh signup on the live Worker still lands ten cards — the trigger survived the migration
- A full review session works on the live Worker: reveal, rate, advance, empty panel
- The three ratings produce ordered `next_review_at` values in the cloud database
- `contract-surfaces.md` no longer describes per-card scheduling state as undecided

**Implementation Note**: This phase writes to a live project and to the table that gates account creation.
Stop before `db push` and get explicit human confirmation.

**If criterion 4.5 fails** — a fresh signup that does not land ten cards — the seeding trigger is breaking
on the new columns and is swallowing it into an empty deck. Recovery: write a follow-up migration dropping
the eight columns and push it, restoring the pre-change table shape. The columns are purely additive and
nothing outside this change reads them, so the drop is safe; fix the defaults locally and re-run phase 2
before pushing again. Do not leave a broken trigger in place while debugging — it silently costs every
account created in the meantime its starter deck.

After this phase, S-02 moves to `done` via
`/10x-archive`, not by hand.

---

## Testing Strategy

There is no JS test runner in this repo and this change deliberately does not add one, consistent with the
decision F-01 made and S-01 inherited. Verification is committed scripts run by hand, plus manual criteria.

### The ordering check (`scripts/verify-srs-ordering.ts`)

Proves the rating map and the library together: that `missed_it`, `got_it` and `nailed_it` produce strictly
increasing due dates from an identical starting card. Catches the failure that matters most — someone
mapping `got_it` to `Rating.Hard`, or inverting two tokens — fast and without a database.

It does **not** prove that the endpoint wires the mapping up correctly. That is a manual criterion in
phase 3 and again in phase 4, where the resulting `next_review_at` values are read back from the database.

### The existing SQL suites

`cards_rls.sql` and `seed_deck.sql` are run unchanged in phase 2 as regression checks. They are the reason
the seeding path's silent-failure mode gets caught rather than discovered later.

### Manual testing steps

1. `npm run verify:srs` — expect a zero exit and three increasing intervals.
2. Break the map deliberately, re-run, confirm a loud failure, revert.
3. Local: `db reset`, sign up fresh, confirm ten cards with zeroed scheduling columns.
4. Local: review three cards with the three different ratings; query the database and confirm the ordering.
5. Local: go offline mid-session, rate a card, confirm the card stays and an error shows.
6. Live: repeat steps 3 and 4 on the Worker.

## Performance Considerations

The due-queue query is covered by `cards_user_id_next_review_at_idx` and needs no new index. The whole
queue loads once per session, so each rating is a single background write rather than a page load — the
shape chosen to satisfy `context/foundation/prd.md:78`. The queue is a snapshot: a card rated in another
tab stays listed in this one. Acceptable for a single-learner app with a ten-card starter deck; if it ever
matters, S-03 owns the session's lifecycle.

## Migration Notes

Existing rows gain the new columns with their defaults, so every card already in the database becomes a
new card in FSRS terms with its existing `next_review_at` preserved. No backfill is needed and none is
written. The migration is additive and does not touch S-01's trigger, its backfill, the grant, RLS, or any
policy.

## References

- Internal research: `context/changes/srs-review-and-reschedule/research.md`
- Scheme selection: `context/changes/srs-review-and-reschedule/external-research.md`
- Library API: `context/changes/srs-review-and-reschedule/ts-fsrs-docs.md`
- Prior plan shape and phase ordering: `context/archive/2026-09-06-seed-deck-on-first-login/plan.md`
- The grant constraint this slice inherits:
  `context/archive/2026-09-05-card-store-with-owner-isolation/reviews/impl-review.md:166-177`
- The vacuous-assertion finding a new script must not repeat:
  `context/archive/2026-09-05-card-store-with-owner-isolation/reviews/impl-review.md:120-131`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step
> titles.

### Phase 1: Scheduler and its proof, in the repo

#### Automated

- [x] 1.1 `ts-fsrs@^5.4.2` installs and the lockfile updates — c1608bd
- [x] 1.2 Ordering check passes: `npm run verify:srs` — c1608bd
- [x] 1.3 `npx astro sync` then `npm run lint` passes — c1608bd
- [x] 1.4 Build passes: `npm run build` — c1608bd
- [x] 1.5 Formatting is clean: `npm run format` — c1608bd

#### Manual

- [x] 1.6 The check is not vacuous: break the map, confirm a loud failure, revert — c1608bd

### Phase 2: Apply and verify locally

#### Automated

- [x] 2.1 `npx supabase db reset` applies all three migrations with no error — a305dfa
- [x] 2.2 `supabase/tests/cards_rls.sql` still passes unchanged — a305dfa
- [x] 2.3 `supabase/tests/seed_deck.sql` still passes unchanged — a305dfa

#### Manual

- [x] 2.4 A brand-new local signup still lands exactly ten cards — a305dfa
- [x] 2.5 Seeded cards' scheduling columns equal the `createEmptyCard()` values — a305dfa
- [x] 2.6 `next_review_at` is untouched on pre-existing rows — a305dfa

### Phase 3: Review screen and rating endpoint

#### Automated

- [x] 3.1 `npx astro sync` then `npm run lint` passes — b06314e
- [x] 3.2 Build passes: `npm run build` — b06314e
- [x] 3.3 Formatting is clean: `npm run format` — b06314e

#### Manual

- [x] 3.4 `/review` shows a due card's front; revealing shows the back — b06314e
- [x] 3.5 Three ratings produce ascending `next_review_at`, days apart not minutes, confirmed in the local database — b06314e
- [x] 3.6 Rating three cards in a row is perceptibly immediate (`prd.md:78`) — b06314e
- [x] 3.7 The "nothing due" panel appears after the last card and on an empty arrival — b06314e
- [x] 3.8 A failed rating keeps the card and shows an error — b06314e
- [x] 3.9 A signed-out visit to `/review` redirects to `/auth/signin` — b06314e
- [x] 3.10 With Supabase unconfigured, `/review` degrades like `/dashboard` — b06314e

### Phase 4: Push to cloud and record reality

#### Automated

- [x] 4.1 `npx supabase migration list` shows the scheduling migration in the Remote column — dc7e42d
- [x] 4.2 Build passes: `npm run build` — dc7e42d
- [x] 4.3 Formatting is clean: `npm run format` — dc7e42d
- [x] 4.4 Ordering check still passes: `npm run verify:srs` — dc7e42d

#### Manual

- [x] 4.5 A fresh signup on the live Worker still lands ten cards — dc7e42d
- [x] 4.6 A full review session works on the live Worker — dc7e42d
- [x] 4.7 The three ratings produce ordered `next_review_at` values in the cloud database — dc7e42d
- [x] 4.8 `contract-surfaces.md` no longer describes per-card scheduling state as undecided — dc7e42d
