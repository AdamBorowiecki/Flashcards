---
project: "# TODO: project name — see Open Questions"
version: 1
status: draft
created: 2026-05-26
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: "# TODO: qps estimate — see Open Questions"
  data_volume: "# TODO: data volume estimate — see Open Questions"
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: true
---

## Vision & Problem Statement

A solo language learner sits down to study but has no signal for which of their hundreds of cards actually need review today — so they either go through all of them (burning out) or skip the session entirely. The cost is a broken habit and stalled progress.

The insight: apps like Anki implement the correct scheduling algorithm but their setup cost and interface complexity drive away everyone who isn't obsessive. The scheduling logic is sound; the experience around it is not built for casual, self-directed learners.

## User & Persona

**Primary persona:** A solo language learner — someone studying a foreign language independently, without a teacher or structured course. Self-motivated but not technical. They reach for the app when they have a short window to study and want to make it count without having to decide what to study.

## Success Criteria

### Primary

- A logged-in learner can create a flashcard and, when they return later, see that card surfaced for review at the time the SRS algorithm scheduled it. Rating the card (missed it / got it / nailed it) reschedules it correctly. The full loop — create, schedule, review, reschedule — works end to end.

### Secondary

- A learner can see their review streak or progress stats to track momentum over time.

### Guardrails

- SRS scheduling must be accurate: a card rated "missed it" must reappear sooner than one rated "nailed it." A violation here breaks the product's core value proposition regardless of how well the rest of the UI works.

## User Stories

### US-01: Learner reviews due cards

- **Given** a logged-in learner who has at least one card due for review
- **When** they open the app
- **Then** they see the card front, can reveal the back, rate their recall, and the app reschedules the card based on their rating

#### Acceptance Criteria

- A card rated "missed it" is rescheduled to reappear sooner than one rated "nailed it"
- A card with no due date yet (just created) appears in the review queue at the time the SRS algorithm first schedules it
- The session ends with visible confirmation that the review was recorded

## Functional Requirements

- FR-001: Learner can create a flashcard with a front and a back. Priority: must-have

  > Socrates: Counter-argument considered: curated/seed decks let users experience the review loop before burning out on blank-canvas creation. Resolution: FR-001 kept; a seed deck is added as FR-005 so day-one users can experience the full loop before creating their own cards.

- FR-002: Learner can start a review session that auto-launches on app open when cards are due. Priority: must-have

  > Socrates: Counter-argument considered: a separate due-list view is redundant if the app auto-launches the review queue. Resolution: revised — app routes the learner directly into the review queue on open; due count surfaces as a session header rather than a separate list view.

- FR-003: Learner can review a due card by seeing the front, then revealing the back. Priority: must-have

  > Socrates: Counter-argument considered: front-then-reveal tests recognition, not production recall — the SRS may be scheduling based on the wrong signal. Resolution: kept; recognition-based review is the industry standard for language flashcards. Active-recall mode (type before reveal) noted in Open Questions for v2.

- FR-004: Learner can rate their recall on a reviewed card (missed it / got it / nailed it). Priority: must-have

  > Socrates: Counter-argument considered: three ratings add cognitive load — binary is faster and sufficient for v1. Resolution: three ratings preserved for SRS scheduling fidelity; labels changed from "forgot / hard / easy" to "missed it / got it / nailed it" to reduce friction and Anki association.

- FR-005: Learner can access a built-in seed deck on first login. Priority: must-have

## Non-Functional Requirements

- Core review interactions (card flip, rating submission) are perceptibly immediate — no visible lag on the critical path.

## Business Logic

The app schedules each card's next review date based on the learner's recall rating — a card rated "missed it" comes back sooner than one rated "nailed it" — so the learner opens the app and reviews whatever is due without having to decide what to study.

The learner's recall rating is the sole user-provided input to the scheduling decision. The app produces one output: a due date for each card, invisible to the learner, that determines when the card surfaces again. The learner encounters the rule passively — they open the app, review whatever is ready, rate each card, and the app handles the rest.

## Access Control

Account-based login via email + password or OAuth. A logged-in learner sees only their own cards and progress. Flat user model — one role (learner); no admin panel, no teacher view, no guest tier. An unauthenticated user is redirected to sign-in; there is no public-facing content.

## Non-Goals

- No shared or collaborative decks — single-user personal decks only; no sharing, importing, or studying another learner's deck in v1.
- No offline-first support — the app requires a live connection; no service worker or local-first sync in v1.
- No native mobile app — web-only in v1; a native iOS/Android app is out of scope.
- No AI-generated card content — learner creates every card manually; no LLM-generated flashcards or auto-fill in v1.

## Open Questions

1. **What is the project name?** — TBD by user. Block: no (app is functional without a name, but needed before launch).
2. **Expected requests-per-second load?** — TBD by user. Block: no (small scale assumed; relevant for hosting decisions downstream in tech-stack-selector).
3. **Expected data volume per user?** — TBD by user. Block: no (small scale assumed; relevant for storage decisions downstream in tech-stack-selector).
4. **Active-recall mode (type answer before reveal)** — surfaced during Socrates challenge on FR-003. Recognition-based review accepted for v1. Consider for v2 if learner feedback indicates scheduling feels inaccurate. Block: no.
