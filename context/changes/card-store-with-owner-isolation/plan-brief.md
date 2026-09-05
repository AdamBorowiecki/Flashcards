# Card Storage with Per-Learner Isolation — Plan Brief

> Full plan: `context/changes/card-store-with-owner-isolation/plan.md`
> Plan review: `context/changes/card-store-with-owner-isolation/reviews/plan-review.md`

## What & Why

Roadmap item **F-01**: create the project's first database table, a card record owned by exactly one learner, with ownership enforced by Postgres row-level security rather than by application code. It exists first because per-learner isolation is the one property in this milestone that cannot be retrofitted safely — every later slice reads and writes cards, and a missed ownership rule leaks one learner's deck to another.

## Starting Point

The data layer does not exist. `supabase/` holds only `config.toml` and `.gitignore` — no migrations, no seed file, and no `.temp/`, meaning the CLI has never been linked to the cloud project the production Worker actually talks to. Everything around it is ready: auth works end to end, middleware resolves the user onto `context.locals`, and the app is live on Cloudflare Workers.

## Desired End State

A `public.cards` table exists in the cloud Supabase project with RLS enabled and four policies keyed on `auth.uid() = user_id`. A signed-in learner reads and writes only their own rows; an unauthenticated request sees nothing. The isolation is proven by a committed SQL script run against a disposable local database **before** the migration reaches the cloud, and the migration is then recorded in remote history so the next one has a known baseline.

## Key Decisions Made

| Decision                 | Choice                                                | Why (1 sentence)                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Migration delivery       | File in repo, then `supabase link` + `db push`        | Keeps repo state and database state as one truth, and lands the table where production actually reads.                                                                   |
| Verification method      | Committed SQL script, no test framework               | Actually exercises the policy in a database without adding a dependency to a foundation; the repo has no test runner at all.                                             |
| Verification target      | Local stack only, and it runs _before_ the cloud push | The script creates users and rows, so it belongs on a disposable database — and production should only ever receive a migration whose isolation has already been proven. |
| `next_review_at` default | `not null default now()`                              | A new card is due immediately, which kills the "created card never surfaces" failure the roadmap flags on S-04 — and prejudges no scheduling scheme.                     |
| TypeScript surface       | None in this change                                   | Nothing has a consumer yet, and `supabase-js` returns column names verbatim (`user_id`, not `userId`), so a row type written now would be a guess and probably wrong.    |
| Table privileges         | Explicit `grant … to authenticated` in the migration  | RLS filters rows but grants nothing; without a grant the failure is `permission denied`, which masquerades as a policy bug.                                              |
| Scheduling state         | Deliberately excluded                                 | Open Roadmap Question 5 is open and blocks S-02; this foundation must not settle it.                                                                                     |
| Ownership column         | Singular `user_id` with `on delete cascade`           | `AGENTS.md:11` names multi-user ownership columns as an out-of-scope signal; cascade is correct for a personal deck.                                                     |

## Scope

**In scope:** one `cards` table; an explicit grant; four RLS policies; one index on `(user_id, next_review_at)`; a SQL script proving isolation; corrections to `README.md` and `contract-surfaces.md`.

**Out of scope:** scheduling state of any kind; review history, statistics, decks; UI and API routes; **all TypeScript** — no row type, no data-access module, no generated types; seed data; a test framework; CI wiring; any verification run against the cloud project.

## Architecture / Approach

One migration file creates the table, grants table access to `authenticated`, enables RLS, and installs the policies — all four together, since a table with RLS and no policies is unusable, a table without RLS is unprotected, and policies without a grant are unreachable. Isolation lives entirely in the database: `auth.uid()` resolves from the JWT the SSR client forwards via cookies, so application code cannot forget the predicate. This change ships no application code at all.

## Phases at a Glance

| Phase                               | What it delivers                                                     | Key risk                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1. Migration in the repo            | The migration file; nothing applied yet                              | RLS enabled without policies, policies without the grant, or `update` missing its `with check` half |
| 2. Apply and verify locally         | Local stack up, migration applied, isolation proven                  | The script passing vacuously — every negative assertion is also satisfied by an empty database      |
| 3. Push to cloud and record reality | `link` + `db push`; `README.md` and `contract-surfaces.md` corrected | Only phase with an external effect; `db push` has no down step                                      |

**Prerequisites:** Docker with ~7 GB RAM for the local stack in Phase 2 (`README.md:79`); Supabase project ref and database password to hand for Phase 3; `npx supabase` already available as a devDependency (`supabase ^2.23.4`).

**Estimated effort:** roughly one session across three phases; Phase 2 blocks on Docker, Phase 3 on you supplying credentials interactively.

## Open Risks & Assumptions

- **The RLS script can pass vacuously.** Zero rows is the expected answer to several assertions and also what a broken setup returns. The plan requires the positive assertion — learner A _does_ see their own row — to pass first; if it is ever removed, the whole script becomes theatre.
- **Connecting as `postgres` bypasses RLS.** The script must `set local role authenticated` or the policies are ignored and everything appears to pass.
- **`service_role` bypasses RLS entirely.** The project uses only the anon key today, so isolation holds; any future service-role path silently loses this protection.
- **Verification does not run in CI.** Wiring it in needs a database and credentials as repository secrets — a separate decision, deliberately not taken here.
- **Docker is a hard prerequisite now.** If it will not run on this machine, Phase 2 has no fallback that is also safe, and the verification decision has to be revisited rather than skipped.
- **`AGENTS.md` is badly stale** — it still says the project is "pre-bootstrap — no source code exists yet" and names Cloudflare Pages. Its Hard Rules are sound and this plan follows them, but the surrounding document misdescribes the project. Out of scope here; worth its own change.

## Success Criteria (Summary)

- A learner signed in as A cannot read, insert, or update cards belonging to B — proven by a script that first proves A _can_ see their own row.
- An unauthenticated request against `cards` returns nothing.
- The migration is applied to the cloud project only after passing locally, and is recorded in remote migration history.
