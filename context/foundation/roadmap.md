---
project: flashcards
version: 1
status: draft
created: 2026-09-03
updated: 2026-09-05
prd_version: 1
main_goal: low-complexity
top_blocker: time
milestone_id: working-srs-loop
milestone_seq: 1
milestone_status: open
---

# Roadmap: Flashcards

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Milestone

**M-1: Working SRS loop** — Status: open

- **Intent:** A signed-in learner gets a starter deck, opens the app straight into whatever is due, reveals and rates each card, has it rescheduled by that rating, and can add cards of their own. This is the loop the PRD's primary Success Criterion names — create, schedule, review, reschedule — proven end to end on the live deployment.
- **Source materials:** `context/foundation/prd.md` (v1)
- **Done when:** every F-NN and S-NN below is `done`.
- **Scope anchors:** FR-001, FR-002, FR-003, FR-004, FR-005, US-01, PRD §Access Control, PRD §Business Logic.

## Vision recap

A solo language learner has hundreds of cards and no signal for which ones need review today, so they either grind through all of them and burn out, or skip the session entirely. Anki-class apps already implement correct scheduling, but their setup cost and interface complexity drive off anyone who is not obsessive. This app keeps the scheduling logic and drops everything the learner would otherwise have to decide: they open it, review what is ready, rate their recall, and the app picks when each card comes back.

## North star

**S-02: Learner reveals a card's back, rates their recall, and the card is rescheduled by that rating** — the PRD's Guardrails section makes this the make-or-break behaviour: if a card rated "missed it" does not resurface sooner than one rated "nailed it", nothing else in the product matters.

> "North star" here means the smallest end-to-end slice whose successful delivery would show the product actually works. It is placed as early as its Prerequisites allow, because everything else in this milestone only pays off if this behaves correctly.

## At a glance

| ID   | Change ID                       | Outcome (user can …)                                                      | Prerequisites | PRD refs                         | Status   |
| ---- | ------------------------------- | ------------------------------------------------------------------------- | ------------- | -------------------------------- | -------- |
| F-01 | card-store-with-owner-isolation | (foundation) cards persist per learner, readable only by their owner      | —             | §Access Control, §Business Logic | planning |
| S-01 | seed-deck-on-first-login        | sign in for the first time and find a starter deck already in the account | F-01          | FR-005                           | proposed |
| S-02 | srs-review-and-reschedule       | reveal a card's back, rate recall, and have the card rescheduled          | F-01, S-01    | US-01, FR-003, FR-004            | blocked  |
| S-03 | review-queue-on-app-open        | open the app and land straight in the due queue, with the due count shown | S-02          | FR-002                           | proposed |
| S-04 | create-own-flashcard            | create a flashcard with a front and a back                                | F-01          | FR-001                           | proposed |

## Baseline

What's already in place in the codebase as of `2026-09-03` (auto-researched + user-confirmed).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 with React 19 islands, Tailwind 4, shadcn/ui primitives (`src/layouts/Layout.astro`, `src/components/ui/button.tsx`, `components.json`).
- **Backend / API:** partial — Astro server endpoints exist, but only for authentication (`src/pages/api/auth/{signin,signout,signup}.ts`). No domain endpoints yet.
- **Data:** absent — `supabase/` holds only `config.toml` and `.gitignore`. No migrations, no schema, no card storage, no row-level access policies.
- **Auth:** present — Supabase SSR client (`src/lib/supabase.ts`), email + password sign-up / sign-in / sign-out, confirm-email page, and route-guard middleware redirecting unauthenticated visitors (`src/middleware.ts:4,19-24`). Satisfies PRD §Access Control.
- **Deploy / infra:** present — Cloudflare Workers, live and manually verified 2026-08-31 (`context/changes/deployment/resume-checklist.md:345`). `wrangler.jsonc` configured; `.github/workflows/ci.yml` lints and builds on `master` but deliberately does not deploy.
- **Observability:** partial — Cloudflare Workers observability enabled (`wrangler.jsonc`). No application-level error tracking or structured logging anywhere in `src/`.

## Foundations

### F-01: Card storage with per-learner isolation

- **Outcome:** (foundation) a card record persists with its front, its back, its owning learner, and the timestamp at which it next becomes due; a learner can read and write only their own cards, enforced at the database layer rather than in application code.
- **Change ID:** `card-store-with-owner-isolation`
- **PRD refs:** §Access Control, §Business Logic
- **Unlocks:** S-01 (needs somewhere to put the starter deck), S-02 (needs a due timestamp to move), S-04 (needs somewhere to put a created card). It deliberately does **not** settle Open Roadmap Question 5 — the scheduling scheme and any state it needs stay open until research closes them, so this foundation can ship without prejudging it.
- **Prerequisites:** —
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - What scheduling state the card record needs beyond the next-due timestamp — depends on Open Roadmap Question 5, which is not settled yet. Owner: user. Block: no; this foundation carries front, back, owner, and the due timestamp only, and whatever additional state the chosen scheme needs arrives with S-02. Keeping it out of F-01 is the point — see Risk.
- **Risk:** Sequenced first because per-learner isolation is the one property in this milestone that cannot be retrofitted safely — every later slice reads and writes cards, and a missed ownership rule leaks one learner's deck to another. Kept deliberately narrow: one card record and its access rule, not a general data layer. The failure mode to watch is scope creep into review history, statistics tables, or deck grouping that no must-have requirement asks for.
- **Status:** planning

## Slices

### S-01: Starter deck present on first login

- **Outcome:** A learner signing in for the first time finds a built-in starter deck already in their account, so they can reach the review loop without authoring anything.
- **Change ID:** `seed-deck-on-first-login`
- **PRD refs:** FR-005
- **Prerequisites:** F-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - What the starter deck actually contains — which language, how many cards. Owner: user. Block: no.
- **Risk:** Sequenced before the review slice because reviewing needs cards to exist, and provisioning them is cheaper than building authoring first. Small by design. The thing that could go wrong is the seeding trigger firing more than once and duplicating a learner's deck.
- **Status:** proposed

### S-02: Review a due card and reschedule it by rating

- **Outcome:** A learner sees a due card's front, reveals its back, rates their recall as missed it / got it / nailed it, and the card is rescheduled so that "missed it" returns sooner than "got it", which returns sooner than "nailed it".
- **Change ID:** `srs-review-and-reschedule`
- **PRD refs:** US-01, FR-003, FR-004
- **Prerequisites:** F-01, S-01
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - Which scheduling scheme sets the next due date, and what per-card state it imposes — see Open Roadmap Question 5. Owner: user. Block: **yes**; the scheme decides the rating scale this slice submits, the state it persists, and what happens to a card's schedule when it is edited. Answering it is a design question, not something reading this repo can settle, so it needs dedicated research before this slice is planned.
- **Risk:** This is the slice the whole milestone exists to deliver, so it is placed as early as its Prerequisites allow. The scheduling rule lives here rather than in a separate foundation, because pulling it out ahead of the interface that exercises it would build a rule with nothing to check it against. The ordering guarantee between the three ratings needs an executable check inside this slice — the PRD calls a violation fatal to the product, and it is not visible by eye during a manual click-through.
- **Status:** blocked

### S-03: App opens straight into the due queue

- **Outcome:** A learner who opens the app is routed directly into a review session for whatever is due, with the number of due cards shown as a session header rather than as a separate list to browse.
- **Change ID:** `review-queue-on-app-open`
- **PRD refs:** FR-002
- **Prerequisites:** S-02
- **Parallel with:** S-04
- **Blockers:** —
- **Unknowns:**
  - What a learner with nothing due should see on open. Owner: user. Block: no.
- **Risk:** Deliberately split from S-02 so the review interaction can be reached by an explicit link and hand-tested before routing behaviour is changed. Sequenced after it because there is no session to route into until reviewing works. The risk is turning the session header into the separate due-list view that FR-002's own resolution ruled out.
- **Status:** proposed

### S-04: Learner creates their own flashcard

- **Outcome:** A learner enters a front and a back and the new card is saved to their deck, entering the review queue at the time the scheduler first sets for it.
- **Change ID:** `create-own-flashcard`
- **PRD refs:** FR-001
- **Prerequisites:** F-01
- **Parallel with:** S-01, S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Depends only on F-01, so it shares no dependency with the review chain and can be run alongside any of it — the one place in this milestone where work can genuinely proceed on two fronts. Sequenced after the review chain rather than before it because the starter deck already removes the need to author cards in order to reach the loop. What could go wrong is a newly created card landing without a due timestamp and never surfacing.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                       | Suggested issue title                         | Ready for `/10x-plan` | Notes                                              |
| ---------- | ------------------------------- | --------------------------------------------- | --------------------- | -------------------------------------------------- |
| F-01       | card-store-with-owner-isolation | Card storage with per-learner isolation       | yes                   | Run `/10x-plan card-store-with-owner-isolation`    |
| S-01       | seed-deck-on-first-login        | Starter deck present on first login           | no                    | Waiting on F-01                                    |
| S-02       | srs-review-and-reschedule       | Review a due card and reschedule it by rating | no                    | Waiting on F-01, S-01. North star.                 |
| S-03       | review-queue-on-app-open        | App opens straight into the due queue         | no                    | Waiting on S-02                                    |
| S-04       | create-own-flashcard            | Learner creates their own flashcard           | no                    | Waiting on F-01; runs parallel to the review chain |

## Open Roadmap Questions

1. **What is the project name?** — Owner: user. Block: no (the app works unnamed; needed before any public launch). Carried from PRD Open Question 1; the repository and Worker both currently use `flashcards`.
2. **Expected requests-per-second load?** — Owner: user. Block: no (small scale assumed). Carried from PRD Open Question 2; already absorbed by the platform decision in `infrastructure.md`.
3. **Expected data volume per learner?** — Owner: user. Block: no (small scale assumed). Carried from PRD Open Question 3.
4. **Active-recall mode — typing the answer before revealing it?** — Owner: user. Block: no. Carried from PRD Open Question 4; explicitly deferred past v1, revisit only if scheduling feels inaccurate to a real learner.
5. **Which scheduling scheme sets the next due date?** — **OPEN — needs dedicated research.** Owner: user. Blocks: **S-02** (and therefore S-03 behind it). The PRD fixes only the ordering between the three ratings, never an algorithm. This is not a question the repository can answer: the scheme decides the rating scale S-02 submits, the per-card state that gets persisted, and the policy for what happens to a card's schedule when its content is edited.

   **Working direction (not a decision):** a step ladder of fixed intervals — card carries a rung index, "missed it" returns it to the first rung, "got it" advances one, "nailed it" advances two. It satisfies the ordering guarantee by construction rather than by tuning, and needs no library. Recorded here so the research has a baseline to argue against, **not** as a settled contract — SM-2 and FSRS were dismissed on a quick read, not on evidence.

   Settle this with dedicated research before S-02 is planned. Deliberately kept out of `prd.md` and `CLAUDE.md` so nothing downstream treats it as fixed.

## Parked

- **Shared or collaborative decks** — Why parked: PRD §Non-Goals; single-user personal decks only in v1.
- **Offline-first support** — Why parked: PRD §Non-Goals; the app requires a live connection, no service worker or local-first sync in v1.
- **Native mobile app** — Why parked: PRD §Non-Goals; web-only in v1.
- **AI-generated card content** — Why parked: PRD §Non-Goals; every card is authored by the learner in v1.
- **Review streak and progress statistics** — Why parked: named in PRD §Success Criteria as a secondary outcome but backed by no functional requirement, so it has no anchor to trace a slice to. Raise it as a requirement in the PRD if it should ship, rather than letting it arrive as unscoped work.
- **Application-level error tracking and structured logging** — Why parked: no non-functional requirement calls for it, and Cloudflare Workers observability already covers the platform layer. Deferred consistent with the `low-complexity` sequencing goal.
- **OAuth sign-in** — Why parked: PRD §Access Control accepts email and password _or_ OAuth, and email with password already ships and is verified in production. Adding a second identity path buys nothing this milestone needs.

## Milestone History

(Append-only. Empty on the first milestone.)

## Done

(Empty on first generation. `/10x-archive` appends entries here when a change whose Change ID matches a roadmap item is archived. Do NOT pre-populate.)
