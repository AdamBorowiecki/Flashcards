<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Card Storage with Per-Learner Isolation

- **Plan**: `context/changes/card-store-with-owner-isolation/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-05
- **Verdict**: REVISE → **SOUND after fixes**
- **Findings**: 1 critical, 3 warnings, 0 observations — all 4 resolved

## Verdicts

| Dimension             | Verdict (at review) | After fixes |
| --------------------- | ------------------- | ----------- |
| End-State Alignment   | WARNING             | PASS        |
| Lean Execution        | WARNING             | PASS        |
| Architectural Fitness | PASS                | PASS        |
| Blind Spots           | FAIL                | PASS        |
| Plan Completeness     | WARNING             | PASS        |

## Grounding

8/8 paths ✓, 7/7 line citations ✓, brief↔plan ✓, Progress↔Phase 3/3 phases and 15/15 criteria mapped ✓.

Confirmed against the CLI: `supabase test` is documented as _"Tests local Supabase containers"_ with pgTAP — it cannot target a cloud project.

## Findings

### F1 — Verification script has no target database, and the only one the plan provisions is production

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 3 — RLS verification script
- **Detail**: The script creates two users in `auth.users` and inserts cards. The original Phase 2 linked and pushed only to the cloud project, so at the moment verification ran, the only database with a `cards` table was production — the script would have written synthetic users into the live auth table. Meanwhile the location `supabase/tests/` implies the runner `supabase test db`, which is local-only, needs Docker and pgTAP, and was never set up. Success criterion 3.1 shipped with no runnable command for what the Testing Strategy itself called "the real test".
- **Fix A ⭐ Recommended**: Provision a local stack and run verification there; never point the script at cloud.
  - Strength: The script's design — create users, insert rows, roll back — is safe only on a throwaway database, and this is the environment the tooling targets. Also resolves F2.
  - Tradeoff: Adds Docker (~7 GB) as a real prerequisite, against a stated `top_blocker: time`.
  - Confidence: HIGH — CLI help confirms local-only; `config.toml` already supports the local stack.
  - Blind spot: Whether Docker runs comfortably on this machine is unverified.
- **Fix B**: Run against cloud inside a rolled-back transaction via `psql`.
  - Strength: No Docker; verifies the exact database production reads.
  - Tradeoff: Creates auth users in a live project even transiently; an aborted session leaves junk in production.
  - Confidence: MEDIUM — mechanically workable, but the failure mode is bad.
  - Blind spot: Supabase may apply triggers on `auth.users` insert.
- **Decision**: FIXED via Fix A. Consequence accepted: phases 2 and 3 swapped, so verification now precedes the cloud push and production only ever receives a proven migration.

### F2 — Desired End State promises a local migration no phase performs

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: End-State Alignment
- **Location**: Desired End State vs Phase 2
- **Detail**: The end state claimed the migration would be "applied both locally and remotely", but the only phase that applied anything pushed to remote, criterion 2.1 checked only the remote column, and Migration Notes made local explicitly conditional. Every success criterion could pass while the stated end state was unmet.
- **Fix**: Resolves as a consequence of F1 Fix A — local apply is now a real phase with its own criteria.
- **Decision**: FIXED via F1.

### F3 — `Card` type is speculative, and its field names won't match any query in this codebase

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Lean Execution
- **Location**: Phase 1, change #2 — `src/lib/card.ts`
- **Detail**: Nothing imported it; "What We're NOT Doing" defers the data-access module to the first consuming slice, so it had no caller until S-01 or S-04. It appeared in no success criterion beyond "build passes" and was absent from the Desired End State. Its fields were camelCase (`userId`, `nextReviewAt`) while `supabase-js` returns column names verbatim (`user_id`, `next_review_at`), so the type described a shape nothing here would produce.
- **Fix A ⭐ Recommended**: Drop `src/lib/card.ts`; let the first consuming slice define the row type against a query that actually runs.
  - Strength: Restores the "SQL only" interview answer, keeps the foundation to one table plus its policy, and removes a type that is currently wrong.
  - Tradeoff: S-01 and S-04 each declare a shape until one factors it out.
  - Confidence: HIGH — verifiable from `supabase-js` behaviour; roadmap F-01 wants minimum surface.
  - Blind spot: None significant.
- **Fix B**: Keep the type but mirror the columns exactly in snake_case.
  - Strength: Gives S-01/S-04 a ready shape and one place to correct.
  - Tradeoff: Still an unused export merged ahead of its consumer.
  - Confidence: MEDIUM — depends on a later mapping layer that is undecided.
  - Blind spot: Whether consumers want the raw row or a mapped domain object.
- **Decision**: FIXED via Fix A. The change now ships no TypeScript at all.

### F4 — Table-level privileges for `anon` / `authenticated` are never mentioned

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1, change #1 — migration contract
- **Detail**: RLS filters which rows a role may touch; it does not grant table access. A new table in `public` is reachable only with a `GRANT`. Supabase's bootstrap sets default privileges so this usually works silently, but when it does not the error is `permission denied for table cards` — which reads like a broken policy and sends the implementer off rewriting correct policies.
- **Fix**: Add an explicit `grant select, insert, update, delete on public.cards to authenticated;` to the migration — idempotent and harmless if default privileges already cover it — plus a note in Critical Implementation Details on how the failure presents.
- **Decision**: FIXED. The grant is now step 1 of the migration's ordered contract, ahead of enabling RLS.

## Triage Summary

| Outcome   | Findings                                      |
| --------- | --------------------------------------------- |
| Fixed     | F1 (Fix A), F2 (via F1), F3 (Fix A), F4 (Fix) |
| Skipped   | —                                             |
| Accepted  | —                                             |
| Dismissed | —                                             |

**Verdict after fixes: SOUND.** The plan may proceed to implementation.

### What changed in the plan

- Phases 2 and 3 swapped: verification against a disposable local database now precedes the cloud push.
- Phase 1 renamed to "Migration in the repo"; the `Card` type and `src/lib/card.ts` removed entirely.
- The migration contract gained an explicit grant, ordered before `enable row level security`.
- Critical Implementation Details gained two entries: RLS-is-not-a-grant, and connecting as `postgres` bypassing RLS.
- The positive assertion (learner A sees their own row) is now a required, first-position step in the script contract and its own manual criterion, guarding against a vacuous pass.
- Success criteria and the `## Progress` block rebuilt for the new phase order: 5 + 5 + 8 items.
