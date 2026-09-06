---
change_id: seed-deck-on-first-login
title: Starter deck present on first login
status: implementing
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

S-01 from `@context/foundation/roadmap.md`. Satisfies PRD FR-005 — "Learner can access a built-in seed deck on first login", a must-have.

Scope per the roadmap, held small by design:

- A new learner's account arrives with a built-in starter deck already in it, so the review loop is reachable without authoring anything.
- The deck is ten cards, English on the front and Polish on the back.
- Provisioning is a `security definer` trigger on `auth.users`, not application code — the same stance F-01 took on isolation: the rule lives in the database rather than being trusted to call sites.
- The same migration backfills existing accounts that have no cards, so the account already used for testing gets a deck too.
- The dashboard gains one line reporting the deck size. That is the whole UI — a count, not a browsable list, which FR-002's Socratic resolution ruled out.

**No scheduling state.** Seeded cards rely on `next_review_at`'s `default now()` and are due immediately. Open Roadmap Question 5 stays untouched and continues to block S-02.

Prerequisite: F-01. Its phase 3 (cloud push) has not run, so `public.cards` does not exist in the cloud project yet — this change's phase 4 is blocked behind it. Phases 1-3 run against the local stack and are unaffected.

Unlocks S-02 (a review session needs cards to review). Watch for scope creep into deck grouping, a card-browsing view, or a profiles table — none of them is asked for by a must-have requirement.
