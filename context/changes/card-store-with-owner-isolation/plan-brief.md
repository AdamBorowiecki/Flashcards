# Card Storage with Per-Learner Isolation — Plan Brief

> Full plan: `context/changes/card-store-with-owner-isolation/plan.md`

## What & Why

Roadmap item **F-01**: create the project's first database table, a card record owned by exactly one learner, with ownership enforced by Postgres row-level security rather than by application code. It exists first because per-learner isolation is the one property in this milestone that cannot be retrofitted safely — every later slice reads and writes cards, and a missed ownership rule leaks one learner's deck to another.

## Starting Point

The data layer does not exist. `supabase/` holds only `config.toml` and `.gitignore` — no migrations, no seed file, and no `.temp/`, meaning the CLI has never been linked to the cloud project the production Worker actually talks to. Everything around it is ready: auth works end to end, middleware resolves the user onto `context.locals`, and the app is live on Cloudflare Workers.

## Desired End State

A `public.cards` table exists in the cloud Supabase project with RLS enabled and four policies keyed on `auth.uid() = user_id`. A signed-in learner reads and writes only their own rows; an unauthenticated request sees nothing. The migration is committed in the repo and recorded in remote migration history, and a committed SQL script proves the isolation holds rather than asserting it.

## Key Decisions Made

| Decision                 | Choice                                         | Why (1 sentence)                                                                                                                                     |
| ------------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migration delivery       | File in repo, then `supabase link` + `db push` | Keeps repo state and database state as one truth, and lands the table where production actually reads.                                               |
| Verification method      | Committed SQL script, no test framework        | Actually exercises the policy in the database without adding a dependency to a foundation; the repo has no test runner at all.                       |
| `next_review_at` default | `not null default now()`                       | A new card is due immediately, which kills the "created card never surfaces" failure the roadmap flags on S-04 — and prejudges no scheduling scheme. |
| TypeScript surface       | `Card` type only, no data-access module        | Keeps the foundation narrow as the roadmap demands; the first slice that really queries decides the query shape.                                     |
| Scheduling state         | Deliberately excluded                          | Open Roadmap Question 5 is open and blocks S-02; this foundation must not settle it.                                                                 |
| Ownership column         | Singular `user_id` with `on delete cascade`    | `AGENTS.md:11` names multi-user ownership columns as an out-of-scope signal; cascade is correct for a personal deck.                                 |

## Scope

**In scope:** one `cards` table; four RLS policies; one index on `(user_id, next_review_at)`; a `Card` type; a SQL script proving isolation; corrections to `README.md` and `contract-surfaces.md`.

**Out of scope:** scheduling state of any kind; review history, statistics, decks; UI and API routes; a data-access module; generated Supabase types; seed data; a test framework; CI wiring for the RLS script.

## Architecture / Approach

One migration file creates the table, enables RLS, and installs the policies together — the three are inseparable, since a table with RLS and no policies is unusable and a table without RLS is unprotected. Isolation lives entirely in the database: `auth.uid()` resolves from the JWT the SSR client forwards via cookies, so application code cannot forget the predicate. The only TypeScript is a shared row type.

## Phases at a Glance

| Phase                                 | What it delivers                                                          | Key risk                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1. Schema and type in the repo        | Migration file + `Card` type; nothing applied yet                         | RLS enabled without policies, or policies missing the `with check` half on update                                  |
| 2. Apply to the cloud project         | `supabase link` + `db push` against the live project                      | Only phase with an external effect; needs project ref and DB password                                              |
| 3. Prove isolation and record reality | RLS verification script; `README.md` and `contract-surfaces.md` corrected | Script passing for the wrong reason — e.g. returning zero rows because setup failed, not because the policy worked |

**Prerequisites:** Supabase project ref and database password to hand; `npx supabase` available (already a devDependency at `supabase ^2.23.4`). Docker only if you also want the local stack aligned.

**Estimated effort:** roughly one session across three phases; phase 2 blocks on you supplying credentials interactively.

## Open Risks & Assumptions

- **The RLS script can pass vacuously.** Zero rows is the expected answer to several assertions, and it is also what a broken setup returns. The script must assert the positive case — learner A _does_ see their own row — before trusting the negative ones.
- **`service_role` bypasses RLS entirely.** The project uses only the anon key today, so isolation holds; any future service-role path silently loses this protection.
- **Verification does not run in CI.** Wiring it in needs database credentials as repository secrets — a separate decision, deliberately not taken here.
- **Local and cloud databases will diverge** unless you also run `npx supabase db reset` against the local stack.
- **`AGENTS.md` is badly stale** — it still says the project is "pre-bootstrap — no source code exists yet" and names Cloudflare Pages. Its Hard Rules are sound and this plan follows them, but the surrounding document misdescribes the project. Out of scope here; worth its own change.

## Success Criteria (Summary)

- A learner signed in as A cannot read, insert, or update cards belonging to B — proven by a script, not by inspection.
- An unauthenticated request against `cards` returns nothing.
- The migration is applied to the cloud project and recorded in remote migration history, so the next migration has a known baseline.
