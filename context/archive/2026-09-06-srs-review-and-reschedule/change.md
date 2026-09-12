---
change_id: srs-review-and-reschedule
title: Review a due card and reschedule it by rating
status: archived
created: 2026-09-06
updated: 2026-09-12
archived_at: 2026-09-12T16:55:15Z
---

## Notes

S-02 from `@context/foundation/roadmap.md` — the milestone's **north star**. Satisfies PRD US-01, FR-003, FR-004.

Outcome per the roadmap: a learner sees a due card's front, reveals its back, rates their recall as
missed it / got it / nailed it, and the card is rescheduled so that "missed it" returns sooner than
"got it", which returns sooner than "nailed it".

**Open Roadmap Question 5 is closed by this change: the scheme is `ts-fsrs` (FSRS v6).** The question
was which scheduling scheme sets the next due date, and it decided three contracts at once. All three
are now settled:

- **Rating scale** — the PRD's three tokens stand. They map onto FSRS's four grades at the library
  boundary: `missed_it → Rating.Again`, `got_it → Rating.Good`, `nailed_it → Rating.Easy`.
  `Rating.Hard` is deliberately unused.
- **Per-card state** — eight typed columns on `public.cards` (`stability`, `difficulty`,
  `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review`). FSRS's own `due` is
  not among them; it maps onto the existing `next_review_at`.
- **Edit policy** — stated, not implemented: FSRS state is memory state, so editing a card's front or
  back does not invalidate it. `forget()` exists for a deliberate reset if a later slice wants one.
  Card editing is not in this milestone.

The roadmap's working direction — a step ladder of fixed intervals with a rung index — was **not**
adopted. It satisfies the ordering guarantee by construction, but conflates "how hard is this card"
with "how well do I know it now", which is the defect that produces ease hell in SM-2. Evidence in
`external-research.md`.

One decision was made during plan review rather than research: `enable_short_term: false`. The library
default repeats a new card at 1 and 10 minutes; this app surfaces cards on open and loads the queue as
one snapshot, so day-scale intervals are the right rhythm. Measured: 1 / 3 / 8 days.

The scheme was a domain decision the repository could not answer, so this change ran the full research
chain before planning: external research (Exa for candidates, Context7 for the winner's live API) plus
internal research on the existing card store, auth, and Astro endpoint conventions.

Prerequisites: F-01 (`card-store-with-owner-isolation`) and S-01 (`seed-deck-on-first-login`). Both
are complete, live in the cloud project, and archived under `context/archive/`.

The ordering guarantee needs an **executable** check inside this slice — the PRD calls a violation
fatal to the product, and it is not visible by eye during a manual click-through.

Unlocks S-03. Watch for scope creep into review history tables, streak statistics, or the routing
change that belongs to S-03.
