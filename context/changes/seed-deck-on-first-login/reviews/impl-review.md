<!-- IMPL-REVIEW-REPORT -->

# Implementation Review: Starter Deck on First Login

- **Plan**: `context/changes/seed-deck-on-first-login/plan.md`
- **Scope**: Phases 1–2 of 4 (phases 3–4 not started)
- **Date**: 2026-09-06
- **Verdict**: APPROVED — F1 fixed during triage; F2 recorded as a project rule; F3 skipped
- **Findings**: 0 critical, 1 warning, 2 observations

## Verdicts

| Dimension           | Verdict |
| ------------------- | ------- |
| Plan Adherence      | PASS    |
| Scope Discipline    | PASS    |
| Safety & Quality    | WARNING |
| Architecture        | PASS    |
| Pattern Consistency | PASS    |
| Success Criteria    | PASS    |

## Scope

Commits `c19a258`, `83531c5`, `d868b57`. Three code files:

- `supabase/migrations/20260906133232_seed_starter_deck.sql` (new)
- `supabase/tests/seed_deck.sql` (new)
- `supabase/tests/cards_rls.sql` (modified)

Plus the change folder and the roadmap status flip, both approved through the dirty-path gate and named in `c19a258`'s body.

The diff is three code files, so per this skill's own guidance pattern work was kept minimal and the analysis was done directly rather than delegated — a cold sub-agent would have re-derived context already in hand.

## Success criteria re-verified

| Criterion                         | Result                                |
| --------------------------------- | ------------------------------------- |
| 1.1 migration exists, sorts after | ✓ `20260906133232` > `20260905163222` |
| 1.2 `npm run build`               | ✓ Complete                            |
| 2.1 `db reset`                    | ✓ both migrations applied             |
| 2.2 `migration list --local`      | ✓ both listed                         |
| 2.3 `seed_deck.sql`               | ✓ exit 0                              |
| 2.4 `cards_rls.sql` (deltas)      | ✓ exit 0                              |

Manual rows 1.3–1.7 and 2.5–2.7 were confirmed by the human at the phase gates, and each has observable evidence in the diff or in the recorded run output. No rubber-stamping found.

## Findings

### F1 — `starter_deck()` is reachable unauthenticated over HTTP

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260906133232_seed_starter_deck.sql:15`
- **Detail**: The function is created without a `revoke`, so it keeps PostgreSQL's default `EXECUTE` grant to `PUBLIC`. It lives in the `public` schema, which `supabase/config.toml:12` exposes through PostgREST, so it is published as an RPC. Measured against the local stack with the anon key only:

  ```
  POST /rest/v1/rpc/starter_deck  ->  HTTP 200
  [{"front":"apple","back":"jabłko"}, {"front":"bread","back":"chleb"}, …]
  ```

  The control request confirms this is specific to the function, not a policy failure: `GET /rest/v1/cards` as anon returns `[]`, so RLS on the table is intact.

  No user data is exposed — the payload is ten static vocabulary pairs. Two reasons it still matters: the plan described three database objects and never described an API endpoint, so this is surface nobody decided to publish; and it sits against `AGENTS.md:8` ("no public-facing content"), the exact rule phase 4 was already scheduled to reword.

  Nothing needs this grant. The trigger function is `security definer` running as the owner, and the backfill runs as `postgres` during migration — both reach `starter_deck()` regardless of what `PUBLIC` holds.

- **Fix**: Add `revoke execute on function public.starter_deck() from public;` to the same migration. It has never been pushed to any remote (the CLI is still unlinked and F-01's phase 3 has not run), so editing it in place is cleaner than a follow-up migration — and it means the endpoint never exists in the cloud at all.
  - Strength: One line; removes the surface before it is ever published; verifiable by re-running the same curl and expecting 401/404.
  - Tradeoff: Rewrites an already-committed migration file, which is only safe precisely because it is unpushed.
  - Confidence: HIGH — reachability and the control case were both measured, and nothing depends on the grant.
  - Blind spot: None significant.
- **Decision**: FIXED — revoke added to the same migration. First attempt revoked from PUBLIC only and did NOT work: Supabase default privileges grant EXECUTE to anon, authenticated and service_role by name, so the ACL survived. Revoking those roles explicitly took the endpoint from HTTP 200 to HTTP 401 "permission denied for function starter_deck"; the anon control on /rest/v1/cards still returns 200 [] and both SQL suites plus the build still pass.

### F2 — Seeding failures are invisible outside the Postgres log

- **Severity**: 💡 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: `supabase/migrations/20260906133232_seed_starter_deck.sql:63-70`
- **Detail**: `exception when others` is a deliberate decision and the right one — an unhandled error here would block registration behind an opaque `Database error saving new user`. The consequence is that a learner with an empty deck is indistinguishable from a learner who deleted their cards, and the only trace is a `raise warning` nobody reads. If the seed breaks after a future schema change, every new account silently arrives empty and the first signal is a person asking why the app looks blank. `roadmap.md:160` parks application-level error tracking, so there is no place to route this today.
- **Fix**: None now — the decision stands. Worth recording as a project rule: a deliberately swallowed failure needs a defined way to be noticed, even if that way is only a documented query to run.
- **Decision**: ACCEPTED-AS-RULE: A swallowed failure needs a defined way to be noticed — appended to context/foundation/lessons.md. Code left unchanged by the user's choice; the rule applies to future work.

### F3 — The guard inside the trigger function is unreachable

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: `supabase/migrations/20260906133232_seed_starter_deck.sql:53-55`
- **Detail**: The `if exists … return new` guard cannot fire in normal operation: the trigger is `after insert … for each row` on `auth.users`, so it runs exactly once per account, at a moment when that account has no cards. Mutation testing confirmed it — removing the guard from the function trips no assertion, while removing it from the backfill does. This is already documented in `seed_deck.sql`'s header rather than papered over. It is defence in depth for a future second caller, not waste, but it is untested by construction and a reader may assume otherwise.
- **Fix**: Leave it. The header comment already says what it is and why it has no test.
- **Decision**: SKIPPED — kept as defence in depth for a future caller; already documented in seed_deck.sql's header.

## Notes

- `seed_starter_deck()` was checked for direct reachability and is safe: Postgres refuses with "trigger functions can only be called as triggers".
- Object order in the migration matches the plan's contract exactly (deck function → trigger function → trigger → backfill).
- `seed_deck.sql` follows the conventions `cards_rls.sql` established: header naming the run command, `do $$ … raise exception` assertions, transaction rolled back, closing `\echo`. Both files carry a "what this catches and what it does not" block backed by mutation runs.
