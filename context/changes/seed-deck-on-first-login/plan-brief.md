# Starter Deck on First Login — Plan Brief

> Full plan: `context/changes/seed-deck-on-first-login/plan.md`

## What & Why

Roadmap item **S-01**, PRD **FR-005**: a learner's account arrives with a built-in ten-card deck already in it, so the review loop is reachable on day one without authoring anything. It exists because FR-001's Socratic resolution judged a blank canvas the wrong first experience — a seed deck was added specifically so new users can reach the full loop before they have to create cards.

## Starting Point

`public.cards` exists locally with RLS and four policies from F-01, and `next_review_at` already defaults to `now()`, so any seeded card is due immediately. Nothing in `src/` reads or writes that table yet. There is also no authenticated surface a deck could appear on: sign-in redirects to the public marketing index, and `/dashboard` — the only protected route — shows an email address and a sign-out button.

## Desired End State

A new learner has ten cards before they see a page; an existing account with no cards has the same ten after the migration; `/dashboard` shows the deck size as a number. Running the seeding twice changes nothing, and a broken seed still lets the account be created.

## Key Decisions Made

| Decision                    | Choice                                              | Why (1 sentence)                                                                                                                                  |
| --------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provisioning mechanism      | `security definer` trigger on `auth.users`          | Fires exactly once per learner by construction, needs no service-role key (the project has none), and keeps a seeding check off the request path. |
| Idempotency                 | `not exists` guard on the learner's own cards       | Makes the routine safe to re-run and safe to backfill without introducing a table this milestone has no other use for.                            |
| Deck contents               | Ten cards, English front, Polish back               | Settles the roadmap's one open unknown for this slice; ten is a session finishable by hand when S-02 needs testing.                               |
| Existing accounts           | Backfilled by the same migration                    | The empty-deck guard makes it safe, and without it the account already used for testing cannot exercise S-02 at all.                              |
| Seed failure behaviour      | Caught, logged as a warning, signup proceeds        | An unhandled error here reaches the user as the opaque `Database error saving new user`; a convenience feature must never block registration.     |
| Visible surface             | A card count on `/dashboard`                        | Smallest thing that proves the outcome without SQL, and a count is not the browsable list FR-002's resolution ruled out.                          |
| Supabase client on `locals` | Middleware assigns the client it already builds     | It constructs one and discards it today; exposing it avoids a second client per request before the first consumer appears.                        |
| Verification                | A second SQL script, `supabase/tests/seed_deck.sql` | Directly exercises the duplication risk the roadmap names, which a manual click-through cannot show; reuses the pattern proven in F-01.           |

## Scope

**In scope:** one migration carrying the seed function, the trigger and a guarded backfill; a SQL verification script; the Supabase client on `Astro.locals`; a deck-count line on the dashboard; registration of the new names in `contract-surfaces.md`; correcting one false hard rule in `AGENTS.md`.

**Out of scope:** any scheduling state; a profiles table or `seeded_at` marker; a deck-browsing view; review UI, rating, or queue; a card creation form; a test framework; CI wiring; an error-tracking table; the rest of `AGENTS.md`'s staleness.

## Architecture / Approach

Provisioning lives in the database, continuing the stance F-01 took on isolation: the rule is enforced where it cannot be forgotten rather than trusted to call sites. A `security definer` function runs as its owner, so it writes past RLS without the project ever needing a service-role key; `set search_path = ''` hardens it, at the cost of requiring every table reference to be schema-qualified. The trigger fires on `auth.users` insert, and the same migration backfills existing accounts through one guarded `insert … select`. The only application code is a count query on the dashboard, which runs as the learner and is scoped by `cards_select_own`.

## Phases at a Glance

| Phase                               | What it delivers                                            | Key risk                                                                                   |
| ----------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1. Seeding migration in the repo    | Function, trigger and backfill; nothing applied             | A missing `set search_path = ''`, or an unqualified table name that only fails at runtime  |
| 2. Apply and verify locally         | Migration applied; deck, idempotency and resilience proven  | Assertions that pass vacuously — several are also satisfied by an empty table              |
| 3. Deck count on the dashboard      | `locals.supabase` plus one line of output                   | Rendering a bare `0` when the query actually failed, which reads as an empty deck          |
| 4. Push to cloud and record reality | `db push`; `contract-surfaces.md` and `AGENTS.md` corrected | Only phase with an external effect, and it writes a trigger onto the account-creation path |

**Prerequisites:** F-01's phase 3 must land first — the cloud database has no `public.cards` and no migration history, so phase 4 is blocked until it does. Phases 1-3 need only Docker and the local stack, started with `-x edge-runtime` on this machine.

**Estimated effort:** roughly one session across four phases; phase 4 blocks on F-01 and on interactive Supabase credentials.

## Open Risks & Assumptions

- **The trigger sits on the account-creation path.** The exception handler is what keeps a seeding bug from becoming a registration outage; if it is ever removed, the blast radius is every new signup. This was prototyped, not assumed — a deliberately broken seed left the account created and the deck empty.
- **Seeding failures are silent by design.** They reach the Postgres log and nowhere else. A learner with an empty deck looks identical to one who deleted their cards.
- **The trigger fires at signup, not at email confirmation**, so an account that never confirms still holds ten rows. Cascading delete on `user_id` cleans them up if the account is purged.
- **The dashboard line is throwaway.** S-03 routes the learner past the dashboard into the queue; this line's useful life is about two slices.

## Success Criteria (Summary)

- A brand-new account signs in and sees a deck of ten waiting, without having created anything
- The account already used for testing has one too, so S-02 has something to review
- Running the seeding again — by migration, by hand, by accident — never produces an eleventh card
