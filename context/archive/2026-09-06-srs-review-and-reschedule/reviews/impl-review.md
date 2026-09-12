<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Review a Due Card and Reschedule It by Rating

- **Plan**: `context/changes/srs-review-and-reschedule/plan.md`
- **Scope**: Full plan — phases 1–4 of 4
- **Date**: 2026-09-12
- **Verdict**: NEEDS ATTENTION → **APPROVED** after triage (F2, F3 fixed; F1 and the three observations skipped by decision)
- **Findings**: 0 critical, 3 warnings, 3 observations

## Verdicts

| Dimension           | Verdict                   |
| ------------------- | ------------------------- |
| Plan Adherence      | WARNING → PASS (F2 fixed) |
| Scope Discipline    | WARNING                   |
| Safety & Quality    | WARNING                   |
| Architecture        | PASS                      |
| Pattern Consistency | PASS                      |
| Success Criteria    | WARNING → PASS (F3 fixed) |

## Success criteria re-run (not transcribed from the plan)

| Check                          | Result                                                           |
| ------------------------------ | ---------------------------------------------------------------- |
| `npm run verify:srs`           | exit 0 — new card +1/+3/+8d, matured +7/+1559/+2409d             |
| `npm run lint`                 | exit 0, no errors                                                |
| `npm run build`                | Complete                                                         |
| `npm run format`               | 138 files, all unchanged                                         |
| `npx supabase migration list`  | `20260912105300` present in Remote                               |
| `supabase/tests/cards_rls.sql` | all assertions passed (clean DB)                                 |
| `supabase/tests/seed_deck.sql` | all assertions passed (clean DB) — but see F3                    |
| CI on `origin/main`            | green on all five commits including the epilogue                 |
| Deployed Worker vs `HEAD`      | no source diff after the deploy commit — production matches HEAD |

Manual criteria: all 13 carry observable evidence — browser-confirmed by the user (3.4, 3.6, 3.7, 3.8,
4.5, 4.6), or reproduced here against the database (2.4–2.6, 3.5, 3.9, 3.10, 4.7). No rubber-stamping found.

## Findings

### F1 — Rating endpoint has no concurrency control and never checks that the write landed

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/api/cards/rate.ts:66-86`
- **Detail**: The endpoint reads scheduling state, computes the next state in-process, then writes with a
  bare `.update(next).eq("id", cardId)` — no optimistic-concurrency predicate and no affected-row check.
  Two overlapping requests for the same card (a double-click that outruns React's `pending` re-render, a
  second browser tab, or a client retry after a request that actually succeeded but timed out) both
  compute from the same pre-image and the second write overwrites the first. The practical outcome is a
  silently **lost rating**, not corruption: the surviving write is a valid FSRS transition from the
  original state, so `reps` increments once where it should have twice. Separately, `writeError == null`
  is the only success signal — PostgREST does not error when an RLS-filtered update matches zero rows, so
  if ownership could ever change between the read and the write the endpoint would answer
  `200 { next_review_at }` for a rating that never persisted. That second half is unreachable today
  (nothing deletes or reassigns cards) but becomes live the moment deletion ships.
- **Fix A ⭐ Recommended**: Chain `.select().single()` onto the update and treat zero rows as a conflict
  - Strength: One call site; makes the write self-verifying and closes the "update silently matched
    nothing" hole permanently, before deletion arrives to make it reachable.
  - Tradeoff: Does not by itself prevent the lost-update race — it detects a vanished row, not a stale
    pre-image.
  - Confidence: HIGH — the library supports it directly; verified in `postgrest-js`.
  - Blind spot: Whether a distinct conflict status is worth surfacing to the island, or whether silence
    is fine for a solo-learner app.
- **Fix B**: Add an optimistic-concurrency predicate, e.g. `.eq("next_review_at", card.next_review_at)`
  - Strength: Closes the lost-update race itself, not just the vanished-row case.
  - Tradeoff: Needs a conflict response and retry semantics in the island; more moving parts for a race
    whose worst outcome today is one lost rating on the learner's own card.
  - Confidence: MEDIUM — correct in principle, but `next_review_at` as the version column is a
    convenience rather than a designed one.
  - Blind spot: Not measured how often the double-click actually outruns the `pending` disable.
- **Decision**: SKIPPED — the practical worst case today is one lost rating on the learner's own card; revisit when deletion ships or traffic becomes concurrent.

### F2 — `change.md` still says this change is blocked by the question it closed

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: `context/changes/srs-review-and-reschedule/change.md:18,34`
- **Detail**: Phase 4, change #3 of the plan required "the note recording that Open Roadmap Question 5 is
  closed in favour of `ts-fsrs`". Only the YAML frontmatter was touched across all five commits; the Notes
  body is byte-identical to its first version. It still reads, in the present tense, "**This change is
  blocked by Open Roadmap Question 5**", and line 34 still claims the prerequisites' "cloud-push phases
  are still pending" — both false since `dc7e42d`. Everything else records the closure correctly
  (`contract-surfaces.md`, the roadmap, the commit messages), which makes `change.md` the single
  document that would mislead a future reader about the state of the milestone.
- **Fix**: Rewrite the two stale passages — state that OQ5 is closed in favour of `ts-fsrs` (FSRS v6) with
  the 3→4 mapping, and that both prerequisites are archived and live in the cloud.
- **Decision**: FIXED — both stale passages rewritten; the Notes body now records OQ5 closed in favour of ts-fsrs with the 3->4 mapping, the eight persisted columns, the stated edit policy, and the enable_short_term decision.

### F3 — `seed_deck.sql` carries an absolute assertion that breaks on a used database

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Success Criteria
- **Location**: `supabase/tests/seed_deck.sql:67-73`
- **Detail**: The suite counts every card **not** belonging to its fixture learner and raises unless the
  count is zero. That holds only on a freshly reset database. Re-running criterion 2.3 during this review,
  against a local database holding the accounts created while hand-testing the review loop, produced
  `ERROR: seeding: 20 card(s) landed on somebody other than the new learner` — a false failure. After
  `db reset` it passes. This is the exact defect class S-01's own plan review escalated to CRITICAL for
  `cards_rls.sql`, which was fixed there with a `set_config` baseline and delta counting
  (`cards_rls.sql:57-62`); `seed_deck.sql` kept an absolute assertion. It was harmless until now because
  nothing routinely left extra learners behind — S-02 is the first change whose normal manual testing
  does exactly that. Not introduced by this change, but surfaced by it.
- **Fix**: Rewrite the foreign-row assertion as a delta against a baseline captured before the fixture
  signup, mirroring `cards_rls.sql:57-62`.
- **Decision**: FIXED — foreign-row assertion rewritten as a delta against a set_config baseline. Verified twice: passes on a clean database, and passes on one holding 20 foreign cards — the exact state that produced the false failure.

### F4 — Two files/branches shipped that the plan never named

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: `src/components/review/EmptyQueue.tsx`, `src/pages/review.astro:13-14,40`
- **Detail**: The plan described the empty state as behaviour ("the same panel the island shows") without
  naming a file. Extracting `EmptyQueue.tsx` is what actually makes the "same panel" claim true rather
  than aspirational — both `review.astro:3` and `ReviewSession.tsx:4` import it. Similarly,
  `review.astro` grew a third `queueUnavailable` branch the plan did not specify, mirroring
  `dashboard.astro`'s existing tri-state convention so a failed query never renders as "nothing is due".
  Both are faithful to intent and arguably required by it; recorded so the plan is not treated as a
  complete inventory in a later audit.
- **Fix**: None needed. Recorded for the archive.
- **Decision**: SKIPPED — both additions are faithful to the plan's intent; recorded, not changed.

### F5 — The due queue is unbounded and ships entirely as hydration props

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `src/pages/review.astro:17-25,45`
- **Detail**: The page selects every due card with no `.limit()` and passes the whole array into a
  `client:load` island, so it is serialized into the initial HTML and re-parsed client-side. The database
  side is cheap — `cards_user_id_next_review_at_idx` covers the query exactly. The cost is payload and
  hydration. Worth noting that `enable_short_term: false` makes "the entire deck is due at once" the
  **normal** state for a learner returning after a break, not a tail case. Irrelevant at a ten-card seed
  deck; becomes real in the low thousands, which is plausible for a long-term learner even though no bulk
  import ships here.
- **Fix**: Add a `.limit()` with incremental fetch as the queue drains — but only once S-04 makes large
  decks reachable. Premature today.
- **Decision**: SKIPPED — premature at a ten-card deck; revisit when S-04 makes large decks reachable.

### F6 — Check constraints validate under an exclusive lock

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260912105300_add_fsrs_scheduling_state.sql:48-55`
- **Detail**: The eight column adds are metadata-only in Postgres because every default is constant, so
  they are free. The seven `check` constraints in the same migration are not: each triggers a full-table
  validation scan holding `ACCESS EXCLUSIVE`. At the current forty rows this is unmeasurable, and the push
  already happened without incident. Worth knowing before any future migration adds a constraint to a
  populated table.
- **Fix**: For future constraint-adding migrations on populated tables, use `NOT VALID` followed by a
  separate `VALIDATE CONSTRAINT`.
- **Decision**: SKIPPED — free at current scale; recorded as guidance for future constraint-adding migrations.

## What held up

Recorded because a review that only lists problems misrepresents the work.

- **Every scope boundary in "What We're NOT Doing" was respected** — no routing change, no session header,
  no history table, no card authoring, no test framework, no CI wiring, no optimizer, no `elapsed_days`,
  no column grant or RPC. Verified file-by-file across all five commits.
- **The migration matches its planned table column-for-column**, including nullability, defaults and all
  seven constraints, and its defaults were verified against `emptySchedulingState()` field by field.
- **No `any`, no `eslint-disable`, no `@ts-ignore`, no non-null assertions** anywhere in the six new source
  files. The single type assertion (`rate.ts:55`) widens to `Record<string, unknown>` after a real `object`
  narrowing, and every field stays `unknown` until a genuine guard narrows it.
- **Cross-learner isolation confirmed safe by reading the policies**, not assumed: the read returns `null`
  through `cards_select_own` → 404, and `cards_update_own` carries both `using` and `with check`, so a
  supplied foreign `card_id` cannot be written even with the app's own anon key.
- **The three deviations from house convention** — JSON responses, explicit status codes, `fetch()` — are
  each argued in the code's own header comments rather than drifted into.
