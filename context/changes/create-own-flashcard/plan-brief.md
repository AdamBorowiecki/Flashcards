# Learner Creates Their Own Flashcard — Plan Brief

> Full plan: `context/changes/create-own-flashcard/plan.md`

## What & Why

A signed-in learner types a front and a back and the card lands in their deck, due immediately. This
is roadmap **S-04** / PRD **FR-001** — the last must-have of milestone M-1 that is not yet built.
Until it ships, every learner is stuck with the ten-card starter deck.

## Starting Point

The whole data layer already exists. `public.cards` carries front, back, owner, `next_review_at`, and
the eight FSRS scheduling columns, all `not null default`; `cards_insert_own` already permits the
insert; `src/lib/srs.ts:71` already exports `emptySchedulingState()`. `src/pages/api/cards/rate.ts`
set the JSON endpoint contract and `ReviewSession.tsx` set the client fetch pattern. What is missing
is a write path, a page, and a link. **No migration.**

## Desired End State

A learner clicks `New card` in the top bar, lands on `/cards/new`, and adds cards one after another
without a page reload — each one confirmed back from the server as it saves. The new cards are in the
next review session. Signed-out visitors to `/cards/new` are bounced to sign-in.

## Key Decisions Made

| Decision                | Choice                                                               | Why (1 sentence)                                                                                                                       | Source |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Entry point             | Link in `Topbar.astro` + `<Topbar />` on `/cards/new` + roadmap note | `Topbar` renders today only via `Welcome.astro` → `index.astro`, which S-03 owns — the written hand-off is what survives a clean merge | Plan   |
| Form location           | Dedicated page `/cards/new`                                          | Stable URL, one middleware prefix covers it, no React island loaded on the marketing page                                              | Plan   |
| After a successful save | Stay on page, clear fields, refocus, count                           | Lets a learner add several cards, and depends on no page S-03 owns                                                                     | Plan   |
| Validation              | Trim + non-blank + 500-char cap, server-authoritative                | Protects the review layout without a migration; the DB keeps only its blank guards                                                     | Plan   |
| Starting FSRS state     | Explicit `emptySchedulingState(now)`, not column defaults            | Keeps `srs.ts` the single source of the rule, so a ts-fsrs upgrade cannot drift silently from the DB defaults                          | Plan   |
| First due date          | Immediately (`next_review_at = now`)                                 | What `createEmptyCard()` and the column default already do; adding a delay would put a scheduling rule outside `srs.ts`                | Plan   |
| Duplicate fronts        | Allowed, unchecked                                                   | The same word in two senses is a legitimate card; no unique constraint exists and none is added                                        | Plan   |
| Route protection        | Prefix `"/cards"` in `PROTECTED_ROUTES`                              | Covers future card pages, and does **not** match `/api/cards/*`, so API routes keep answering 401 rather than redirecting              | Plan   |
| Response contract       | `201 { id, front, next_review_at }`                                  | The confirmation describes the row the database returned, not what was typed                                                           | Plan   |
| Executable check        | Sibling node script `npm run verify:cards`                           | Pins the eight-column contract without introducing a test runner                                                                       | Plan   |

## Scope

**In scope:** `POST /api/cards`; `/cards/new` page + React island; `"/cards"` in `PROTECTED_ROUTES`;
`New card` link in `Topbar.astro`; shared scheduling-column list lifted into `src/lib/srs.ts`;
`scripts/verify-card-scheduling-columns.ts`; roadmap hand-off note for S-03.

**Out of scope:** any migration; editing or deleting cards; a card list or deck browser; duplicate
detection; a test runner; `dashboard.astro`, `index.astro`, `review.astro`, `components/review/*`,
`api/auth/signin.ts` — all S-03's.

## Architecture / Approach

React island → `fetch('POST /api/cards')` → guard `locals.supabase`, then `locals.user`, then body →
trim + validate → insert `{ user_id, front, back, ...emptySchedulingState(now), next_review_at: now }`
under `cards_insert_own` → `201` with the inserted row. One `now` serves both the state and the due
date, so they cannot disagree. `src/lib/srs.ts` stays the only definition of what a new card's
schedule looks like, and a plain node script asserts the endpoint and the module name the same eight
columns.

## Phases at a Glance

| Phase                                   | What it delivers                                                 | Key risk                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1. Write path & starting-state contract | `POST /api/cards`, shared column list, `npm run verify:cards`    | Editing `rate.ts` and `srs.ts` touches the working rating path — `verify:srs` must stay green |
| 2. Page & route guard                   | `/cards/new`, `CreateCardForm` island, `"/cards"` protected      | A failed save that still looks successful; the island must not clear the form on error        |
| 3. Entry point & hand-off               | `New card` link, `<Topbar />` on the page, roadmap note for S-03 | The whole slice's reachability rests on a note in a file S-03 also edits                      |

**Prerequisites:** F-01 (done), S-02's FSRS columns (done, migration `20260912105300`). A local or
remote Supabase to hand-test against. S-04 merges **first**.
**Estimated effort:** ~1–2 sessions across 3 phases; Phase 3 is minutes of code and the most
consequential.

## Open Risks & Assumptions

- **Entry-point reachability across the S-03 merge is mitigated, not eliminated.** The roadmap note is
  a written instruction, not a mechanism. If S-03 drops `<Topbar />` anyway, card creation stays
  reachable only by typing `/cards/new`. Worth re-checking by hand after S-03 merges.
- The 500-character cap lives only in the application. A row inserted by any other means bypasses it.
- `verify:cards` and `verify:srs` touch neither the database nor HTTP — they catch a shape mismatch,
  not a failed write. The database write stays a manual criterion, as it already is for S-02.
- Neither verification script runs in CI today (CI is `lint` + `build`); this slice does not change
  that, so both must be run locally.

## Success Criteria (Summary)

- A learner can add several cards in a row from `/cards/new` without a reload, each confirmed by name.
- A newly created card appears in the very next review session and reschedules correctly when rated.
- Signed-out access to `/cards/new` redirects; `POST /api/cards` without a session returns 401 JSON.
