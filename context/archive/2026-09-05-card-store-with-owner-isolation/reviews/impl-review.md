<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Card Storage with Per-Learner Isolation

- **Plan**: context/changes/card-store-with-owner-isolation/plan.md
- **Scope**: All phases (1-3 of 3)
- **Date**: 2026-09-10
- **Verdict**: NEEDS ATTENTION
- **Findings**: 0 critical, 4 warnings, 3 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | WARNING |
| Success Criteria    | WARNING |

Isolation holds. Every clause of the Phase 1 contract is implemented as written, all four
policies carry an explicit `to authenticated`, and `cards_update_own` has both `using` and
`with check`. No path exists by which one learner reaches another's row. The findings below
are hardening gaps and test-coverage holes, not a breach.

## Findings

### F1 — `anon` holds full privileges on `public.cards`; the migration grants but never revokes

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality / Pattern Consistency
- **Location**: supabase/migrations/20260905163222_create_cards_table.sql:31
- **Detail**: Supabase's bootstrap sets default privileges granting all table rights in `public`
  to `anon`, `authenticated` and `service_role`. Migrations run as `postgres`, so `create table`
  at line 7 handed `anon` the full set before line 31's grant ran. Verified against the live
  schema: `information_schema.role_table_grants` returns
  `anon | DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE,UPDATE`. Not a breach today — RLS is
  enabled and all four policies are scoped `to authenticated`, so default-deny leaves `anon` with
  zero rows. The hazard is compounding: the first policy anyone writes without a `to` clause
  defaults to `PUBLIC`, and the standing `anon` grant turns that slip into an unauthenticated read
  of every learner's deck.
  This is also a pattern regression. The sibling migration `20260906133232_seed_starter_deck.sql`
  documents this exact trap at lines 43-48 for functions and revokes explicitly by role name. The
  cards migration, written a day earlier, applies the opposite reflex. The project learned the
  lesson between the two migrations and never retro-applied it.
  A knock-on: `supabase/tests/cards_rls.sql:181-183` asserts in a comment that `anon` "holds no
  grant on public.cards". That premise is false. The assertion still passes, but via the RLS path,
  not the grant path its comment describes.
- **Fix A (Recommended)**: Forward migration revoking all privileges on `public.cards` from `anon`
  and `service_role`, then tighten the assertion-6 block to require `insufficient_privilege`
  rather than accepting either outcome.
  - Strength: Closes the security gap and the pattern gap in one statement, and matches the idiom
    the project already documented for functions.
  - Tradeoff: A third migration on a table that is one day old; revoking from `service_role` could
    surprise a future change that legitimately wants an admin path.
  - Confidence: HIGH — grants verified directly against the database, and the revoke idiom is
    already proven in the sibling migration.
  - Blind spot: Not verified whether any Supabase-internal tooling (dashboard table editor,
    realtime) relies on the `service_role` grant.
- **Fix B**: Leave the grants and rely on RLS plus a rule that every policy carries an explicit
  `to` clause.
  - Strength: No migration; the current posture is genuinely safe.
  - Tradeoff: Safety depends on every future author remembering an unwritten rule. The failure is
    silent and total.
  - Confidence: MEDIUM — correct today, fragile over time.
  - Blind spot: No lint or test would catch a missing `to` clause.
- **Decision**: PENDING

### F2 — `cards_delete_own` is never exercised by the verification script

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/cards_rls.sql
- **Detail**: The migration creates four policies. The script exercises select, insert and both
  halves of update. The string `delete` does not appear in the file at all — verified by grep. The
  script's own self-audit block at lines 22-34 enumerates only select/insert/update, so the gap is
  not even declared. If `cards_delete_own` were dropped or misscoped, the suite stays green. The
  plan called this script the executable proof that isolation holds; it proves it for three of the
  four verbs.
- **Fix**: Add two assertions — positive (learner A deletes their own fixture card, one row
  affected) and negative (a delete targeting B's rows affects zero rows).
- **Decision**: PENDING

### F3 — the blank-card check only strips ASCII spaces

- **Severity**: WARNING
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260905163222_create_cards_table.sql:14-15
- **Detail**: The constraints use single-argument `btrim`, which removes only ASCII spaces.
  Verified in the database: a lone tab and a lone newline both pass the check and would render as
  a blank card, while a run of spaces is correctly rejected. Cards arrive from a text input, which
  makes the paste-a-newline path reachable.
- **Fix A (Recommended)**: Forward migration replacing both constraints with a regex guard that
  rejects any all-whitespace value, covering tabs, newlines and unicode whitespace.
  - Strength: The guarantee lives in the database, so it holds regardless of which call site
    writes a card — the same reasoning that put isolation in RLS rather than app code.
  - Tradeoff: Adding the constraint fails if any existing row violates it, so it needs a
    pre-flight count against the live table first.
  - Confidence: HIGH — behaviour verified directly, fix is a standard regex guard.
  - Blind spot: Not checked whether the seeded starter deck contains any such row (unlikely — the
    ten pairs are literals).
- **Fix B**: Leave the constraint and validate whitespace in the UI when card creation lands in S-04.
  - Strength: No migration now; the only writer today is the seed function, which cannot produce a
    blank card.
  - Tradeoff: Moves a data-integrity guarantee into a layer that does not yet exist, and the
    constraint's name then promises more than it delivers.
  - Confidence: MEDIUM — depends on S-04 remembering.
  - Blind spot: None significant.
- **Decision**: PENDING

### F4 — the cross-learner insert and update assertions can pass for the wrong reason

- **Severity**: WARNING
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: supabase/tests/cards_rls.sql:118-127, 135-165
- **Detail**: Assertion 3 treats SQLSTATE 42501 (`insufficient_privilege`) as a pass. That code is
  raised both by "new row violates row-level security policy" and by "permission denied for table
  cards". So the assertion is green whether `cards_insert_own` works correctly or whether INSERT is
  broken outright — a dropped policy and a missing grant both look like success. Same shape on
  assertions 4 and 4b for update: if UPDATE were denied wholesale, zero affected rows passes. The
  suite never writes a card as learner A, so the write path is proven only negatively. The file is
  honest that 4/4b are defence in depth, but does not note that they cannot distinguish "correctly
  scoped" from "entirely broken".
- **Fix**: Add a positive insert (as A, insert a row owned by A, assert it succeeds and is visible)
  and a positive update (as A, update A's own card, assert at least one row affected) before the
  negative assertions.
- **Decision**: PENDING

### F5 — policy predicates re-evaluate `auth.uid()` once per row

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: supabase/migrations/20260905163222_create_cards_table.sql:38, 43, 50, 51, 56
- **Detail**: All four predicates call `auth.uid()` directly. Postgres re-evaluates the function
  per row in that form; wrapping the call in a scalar subquery lets the planner hoist it into an
  InitPlan evaluated once per query. This is Supabase's `auth_rls_initplan` advisory. Invisible at
  the PRD's stated scale (`target_scale.users: small`) and degrades only as decks grow, which is
  why this is an observation rather than a warning.
- **Fix**: When a forward migration is written for F1 or F3, re-create the four policies with the
  subquery form in the same file. Semantics are identical, so it carries no isolation risk.
- **Decision**: PENDING

### F6 — the plan credits the wrong commit for the two documentation steps

- **Severity**: OBSERVATION
- **Impact**: LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: context/changes/card-store-with-owner-isolation/plan.md (Progress rows 3.7, 3.8)
- **Detail**: Both rows carry the p3 commit SHA, but that commit touched neither `README.md` nor
  `docs/reference/contract-surfaces.md`. The edits landed earlier, in `a088cae`. The content is
  correct in both files and the p3 commit message says so explicitly; only the attribution in the
  checklist is off. Harmless for archiving, mildly misleading for anyone tracing a row to its diff.
- **Fix**: Leave as is, or re-point rows 3.7 and 3.8 at `a088cae`.
- **Decision**: PENDING

### F7 — the blanket UPDATE grant will let a learner rewrite their own schedule once S-02 lands

- **Severity**: OBSERVATION
- **Impact**: MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Architecture
- **Location**: supabase/migrations/20260905163222_create_cards_table.sql:31
- **Detail**: The table-level `update` grant lets a learner PATCH any column of their own row
  through the anon key. Harmless while the table carries no scheduling state. But S-02 adds it, and
  `CLAUDE.md` calls the SRS ordering invariant non-negotiable: a violation "breaks the product's
  core value proposition". Once `next_review_at` is algorithm-owned, a learner can set it directly
  and bypass the scheduler. Not a defect in F-01 — the plan deliberately deferred scheduling state
  — but it is a constraint S-02's plan inherits and should decide deliberately rather than discover.
- **Fix A (Recommended)**: Record it as an input to S-02 planning; decide there between a
  column-level update grant restricted to `front` and `back`, and routing ratings through a
  `security definer` RPC.
  - Strength: Keeps the decision with the slice that has the context to make it, and both options
    stay open.
  - Tradeoff: Depends on S-02's plan actually picking it up.
  - Confidence: HIGH — S-02 is the next change and is not yet planned.
  - Blind spot: None significant.
- **Fix B**: Narrow the grant to `front` and `back` now, in the F1/F3 forward migration.
  - Strength: Closes it before the state exists, so there is no window.
  - Tradeoff: Prejudges S-02's design; if ratings go through an RPC anyway the column-level grant
    is wasted work, and it would break any direct `next_review_at` write S-02 chooses to make.
  - Confidence: MEDIUM — depends on a scheduling design that does not exist yet.
  - Blind spot: Whether S-02 writes `next_review_at` from the client or the server is undecided.
- **Decision**: PENDING

## Success criteria re-run

All automated criteria were re-executed from a clean local database during this review:

| Step      | Command                   | Result                               |
| --------- | ------------------------- | ------------------------------------ |
| 1.1       | migration file exists     | pass                                 |
| 1.2 / 3.2 | `npm run build`           | pass                                 |
| 2.1       | `npx supabase db reset`   | pass — both migrations applied       |
| 2.2       | `migration list` (local)  | pass                                 |
| 2.3       | `cards_rls.sql`           | pass — all assertions passed, exit 0 |
| 3.1       | `migration list` (remote) | pass — both present in Remote column |
| 3.3       | `npm run format`          | pass                                 |

Manual rows 3.4-3.8 were confirmed by the user during implementation: RLS and the four policies
verified through `pg_class` / `pg_policies` in the production SQL editor, and sign-in on the live
Worker still works.
