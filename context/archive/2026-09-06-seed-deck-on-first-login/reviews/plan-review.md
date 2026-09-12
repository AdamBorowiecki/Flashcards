<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Starter Deck on First Login

- **Plan**: `context/changes/seed-deck-on-first-login/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-06
- **Verdict**: REVISE → **SOUND** after triage (all 4 findings fixed)
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict (at review) | After fixes |
| --------------------- | ------------------- | ----------- |
| End-State Alignment   | PASS                | PASS        |
| Lean Execution        | PASS                | PASS        |
| Architectural Fitness | PASS                | PASS        |
| Blind Spots           | FAIL                | PASS        |
| Plan Completeness     | WARNING             | PASS        |

## Grounding

7/7 paths ✓, 3/3 symbols ✓, brief↔plan ✓, 2 stale line refs (F4). Progress↔Phase contract: 4 phases matched, 28 criteria enumerated, no checkbox bullets outside `## Progress`.

Codebase verification was done directly rather than through a sub-agent — the repo is 26 source files and the riskiest claims were settled faster by executing them against the running local database than by delegating a search.

## Findings

### F1 — Trigger breaks the existing RLS test suite

- **Severity**: ❌ CRITICAL
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 2, criterion 2.4
- **Detail**: Installing the seeding trigger locally and running the F-01 suite produced `ERROR: positive read: learner A should see exactly 1 card, saw 11`. `cards_rls.sql` creates users, gives each one card, and asserts an absolute count of 1 — arithmetic that only holds when accounts arrive empty. Criterion 2.4 required that file to keep passing, which was unsatisfiable as written, and no phase touched it.
- **Fix A ⭐ Recommended**: Rewrite the suite's count assertions as deltas against a pre-fixture baseline.
  - Strength: Tests isolation rather than arithmetic; survives future changes to deck size.
  - Tradeoff: Modifies a file F-01 already shipped and verified.
  - Confidence: HIGH — both the failure and the fix shape were measured.
  - Blind spot: Every absolute count in the file needs the same treatment, not just the first.
- **Fix B**: Disable the trigger inside the test transaction.
  - Strength: `cards_rls.sql` keeps its exact current assertions.
  - Tradeoff: Test then runs against a schema production never has.
  - Confidence: MEDIUM — works, but weakens what the test proves.
  - Blind spot: `alter table … disable trigger` needs owner rights in the cloud project.
- **Decision**: FIXED via Fix A — Phase 2 gained a third Changes Required item covering the rewrite, Critical Implementation Details records the measured failure, and criteria 2.4 / Testing Strategy now say "rewritten to assert count deltas".

### F2 — Criterion 3.6 is unverifiable

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3, criterion 3.6
- **Detail**: The criterion read "with `SUPABASE_URL` / `SUPABASE_KEY` unset, the dashboard still renders". It cannot: `createClient` returns `null` (`src/lib/supabase.ts:6-8`), middleware sets `locals.user` to `null`, and `/dashboard` is in `PROTECTED_ROUTES` — so the request redirects to sign-in and the page is never reached.
- **Fix**: Replace with an observable criterion — `/` still shows the config banner and `/dashboard` redirects cleanly without an error page.
- **Decision**: FIXED

### F3 — "Define the ten pairs once" is not achievable as written

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1, contract
- **Detail**: The contract offered "define them once as a `values` list and reference it from both the function and the backfill, or accept the duplication". A `values` list cannot be shared between a function body and a separate statement, so the first option was not implementable and the implementer would have had to invent a mechanism.
- **Fix**: Name the mechanism — `public.starter_deck()` returning `setof record (front, back)`, selected from by both the trigger function and the backfill.
- **Decision**: FIXED — added as object 0 in the Phase 1 contract; criterion 1.6 and the manual check now assert the deck exists in exactly one place.

### F4 — Two stale line citations

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Key Discoveries
- **Detail**: The plan cited `roadmap.md:86` and `:87`; the real lines are `:89` (deck-contents unknown) and `:90` (duplication risk). The citations were wrong when written — the roadmap status edit replaced lines one-for-one and shifted nothing.
- **Fix**: Correct to `:89` and `:90`.
- **Decision**: FIXED

## Notes for implementation

- The seeding trigger was prototyped against the local database before the plan was written, and removed afterwards. The local stack is back to F-01 state: `cards_rls.sql` passes unmodified.
- Phase 4 remains blocked on F-01's phase 3 reaching the cloud.
