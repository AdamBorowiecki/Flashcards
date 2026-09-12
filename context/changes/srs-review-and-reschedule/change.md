---
change_id: srs-review-and-reschedule
title: Review a due card and reschedule it by rating
status: implemented
created: 2026-09-06
updated: 2026-09-12
archived_at: null
---

## Notes

S-02 from `@context/foundation/roadmap.md` — the milestone's **north star**. Satisfies PRD US-01, FR-003, FR-004.

Outcome per the roadmap: a learner sees a due card's front, reveals its back, rates their recall as
missed it / got it / nailed it, and the card is rescheduled so that "missed it" returns sooner than
"got it", which returns sooner than "nailed it".

**This change is blocked by Open Roadmap Question 5** — which scheduling scheme sets the next due
date. That question decides three contracts at once:

- the rating scale this slice submits (three levels per the PRD, or four/six if a library's scale wins),
- the per-card state that gets persisted beyond `next_review_at`,
- the policy for what happens to a card's schedule when its content is edited.

The roadmap records a **working direction, not a decision**: a step ladder of fixed intervals with a
per-card rung index. SM-2 and FSRS were dismissed on a quick read, not on evidence. Research must
argue against that baseline rather than inherit it.

Because the scheme is a domain decision the repository cannot answer, this change runs the full
research chain before planning: external research (Exa for candidate schemes/libraries, Context7 for
the winner's live API) plus internal research (`/10x-research`) on the existing card store, auth, and
Astro endpoint conventions.

Prerequisites: F-01 (`card-store-with-owner-isolation`) and S-01 (`seed-deck-on-first-login`). Both
are implemented locally through their phase 2; their cloud-push phases are still pending.

The ordering guarantee needs an **executable** check inside this slice — the PRD calls a violation
fatal to the product, and it is not visible by eye during a manual click-through.

Unlocks S-03. Watch for scope creep into review history tables, streak statistics, or the routing
change that belongs to S-03.
