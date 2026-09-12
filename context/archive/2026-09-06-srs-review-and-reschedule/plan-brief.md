# Review a Due Card and Reschedule It by Rating — Plan Brief

> Full plan: `context/changes/srs-review-and-reschedule/plan.md`
> Research: `context/changes/srs-review-and-reschedule/research.md`
> Scheme selection: `context/changes/srs-review-and-reschedule/external-research.md`
> Library API: `context/changes/srs-review-and-reschedule/ts-fsrs-docs.md`

## What & Why

S-02 is the milestone's north star: the loop the whole product exists to deliver. A learner sees a due
card's front, reveals the back, rates recall, and the card is rescheduled by that rating. The PRD calls a
violation of the rating ordering fatal to the product — `missed_it` must return sooner than `got_it`,
which must return sooner than `nailed_it` — so this slice also owes an executable proof of it, not a
click-through.

## Starting Point

`public.cards` exists with six columns and correct RLS, populated by a seeding trigger, and deliberately
carries no scheduling state — F-01 deferred it pending Open Roadmap Question 5. One consumer exists:
`src/pages/dashboard.astro:13` counts cards. There is no mutation anywhere, no JSON endpoint, no explicit
status code, no `fetch()`, and no JS test runner. Research settled the scheme in favour of `ts-fsrs`
(FSRS v6) and closed six of its seven open questions.

## Desired End State

A signed-in learner clicks through from the dashboard to `/review`, works through everything due, and each
rating moves that card's `next_review_at` by an amount `ts-fsrs` chose. Ratings feel immediate because the
queue loads once and each rating is a background write. When the queue empties, a plain panel says so.
`npm run verify:srs` proves the ordering holds against the real library and the real mapping.

## Key Decisions Made

| Decision                 | Choice                                                         | Why (1 sentence)                                                                                                                                | Source   |
| ------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Scheduling scheme        | `ts-fsrs` (FSRS v6), `Hard` unused                             | Anki's own current default, typed, healthy, and structurally free of the ease-hell failure mode that would burn out this exact persona.         | Research |
| Where scheduling lives   | Eight typed columns; `due` maps onto existing `next_review_at` | Keeps one source of the due date so the index and RLS keep working, and lets each field carry its own default and check constraint.             | Plan     |
| Review rhythm            | `enable_short_term: false` — intervals always in days          | The library default repeats new cards at 1 and 10 minutes (measured); day-scale matches the app-open model and keeps the snapshot queue honest. | Review   |
| Rating round-trip        | `fetch()` + JSON endpoint, whole queue loaded once             | The house form-POST convention was set on one-shot auth forms; a ten-card loop is a different interaction, and `prd.md:78` names it.            | Plan     |
| Seeding                  | Column defaults mirroring `createEmptyCard()`                  | S-01's trigger and backfill keep working untouched, avoiding the silent empty-deck failure their exception handler would otherwise cause.       | Plan     |
| Ordering check           | Plain `node` script importing the real mapping module          | Catches a mapping bug directly, adds no dependency, and extends the "committed script, no framework" convention rather than breaking it.        | Plan     |
| Entry point              | A link on the dashboard to `/review`                           | Keeps S-03's routing decision out of this slice so the review loop can be hand-tested behind an explicit link first.                            | Plan     |
| Empty state              | One plain "nothing due" panel for both cases                   | Smallest thing that makes the route honest in every state; leaves the real empty-state design to S-03, which owns the session header.           | Plan     |
| Failed rating            | Keep the card, show the error, let them retry                  | A rating that silently did not land leaves the card scheduled wrongly — the swallowed failure `lessons.md:12-17` forbids.                       | Plan     |
| Tamper-proofing schedule | Not attempted; limitation stated                               | Neither a column grant nor an RPC works while the app holds only the anon key; the remedy is a `service_role` key, deliberately deferred.       | Research |

## Scope

**In scope:** eight scheduling columns with defaults · `ts-fsrs@^5.4.2` · `src/lib/srs.ts` rating map ·
`scripts/verify-srs-ordering.ts` · `POST /api/cards/rate` · `/review` page and React island ·
`PROTECTED_ROUTES` entry · dashboard link · cloud push · closing the `contract-surfaces.md` row.

**Out of scope:** routing `/` into review (S-03) · session header and due count (S-03) · card creation
(S-04) · review history or statistics tables · a test framework · CI wiring · the FSRS parameter
optimizer · `elapsed_days` · a column-level grant or rating RPC.

## Architecture / Approach

`/review` server-renders every card where `next_review_at <= now()` and hands the array to a `client:load`
React island. Revealing the back is local state, so it is instant. Each rating POSTs JSON to
`/api/cards/rate`, which guards on `locals.user`, validates the token, rebuilds the FSRS card from stored
columns via `TypeConvert.card()`, calls `next()` through `src/lib/srs.ts`, and writes back the new
scheduling columns plus `next_review_at`. That same `src/lib/srs.ts` is what the verification script
imports — so the script proves the mapping the application actually uses, not a copy of it.

## Phases at a Glance

| Phase                                | What it delivers                                                    | Key risk                                                                     |
| ------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Scheduler and its proof, in repo  | Migration, dependency, rating map, and the passing ordering check   | The script becomes unrunnable if `srs.ts` picks up an Astro-only import      |
| 2. Apply and verify locally          | Migration applied to a disposable database; seeding proven intact   | A missing default fails silently as an empty deck, not as an error           |
| 3. Review screen and rating endpoint | `/review`, the island, and the first JSON endpoint in the repo      | Three repo firsts at once — `fetch()`, JSON responses, explicit status codes |
| 4. Push to cloud and record reality  | Live migration, verified session, `contract-surfaces.md` row closed | Writes to the table that gates account creation                              |

**Prerequisites:** F-01 and S-01, both archived and live in the cloud. The Supabase CLI is already linked.
Local verification needs `npx supabase start -x edge-runtime`.
**Estimated effort:** ~3-4 sessions across four phases; phase 3 is the bulk.

## Open Risks & Assumptions

- **`prd.md:78` is verified by eye, not by a number.** "Perceptibly immediate" has no threshold in the
  PRD, so criterion 3.6 is a human judgement. The `fetch()` design was chosen to give it the best chance;
  if it still feels slow, the cause is the write latency and the fix is outside this slice.
- **The learner can reschedule their own cards.** Accepted and documented — no configuration prevents it
  while the app holds only the anon key. Blast radius is the learner's own rows.
- **The column defaults duplicate `createEmptyCard()`'s notion of an empty card in SQL.** If a future
  `ts-fsrs` changes those values, the two drift with nothing to catch it.
- **The queue is a snapshot.** A card rated in another tab stays listed in this one. Fine for a solo
  learner; S-03 owns session lifecycle.
- **`ts-fsrs` has a `6.0.0-beta` line.** Pinning `^5.4.2` means a later major migration is its own change.

## Success Criteria (Summary)

- A learner reaches `/review` from the dashboard, reveals and rates cards, and the queue advances without
  a page load between cards.
- `npm run verify:srs` exits zero, and fails loudly when the rating map is deliberately broken.
- On the live Worker, rating three cards `missed_it` / `got_it` / `nailed_it` produces `next_review_at`
  values in that ascending order.
