# External research — scheduling scheme for S-02

- **Change**: `srs-review-and-reschedule`
- **Question**: Open Roadmap Question 5 — which scheduling scheme sets the next due date, and what per-card state does it impose?
- **Date**: 2026-09-06
- **Tools**: Exa MCP (`web_search_exa`, `web_fetch_exa`); Context7 for the winner's live API (see `ts-fsrs-docs.md`)
- **Status**: recommendation — the decision is the user's, ratified in `plan-brief.md` when `/10x-plan` runs.

## Recommendation

**We choose `ts-fsrs` (FSRS v6) over SM-2, Ebisu, and the roadmap's fixed step ladder**, because it is
the only candidate that is simultaneously (a) the algorithm a mainstream flashcard app defaults to
today, (b) shipped as a typed TypeScript package that runs on our Node 22 / Workers target, and (c)
structurally free of the "ease hell" failure mode that would quietly break the product's core promise
for exactly the learner this PRD targets.

The roadmap's working direction — a fixed step ladder with a rung index — is **not** adopted. It
satisfies the PRD's ordering guarantee by construction, which is its one real virtue, but it conflates
"how hard is this card" with "how well do I know it now", which is the same defect that produces ease
hell in SM-2 (evidence below). It is retained as the fallback if `ts-fsrs` fails integration.

## Candidates compared

| Candidate                            | Per-card state it imposes                                                                                                                        | Rating scale                                | Verdict                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | --------------------------------------------------------- |
| **`ts-fsrs`** (FSRS v6)              | `due`, `stability`, `difficulty`, `scheduled_days`, `learning_steps`, `reps`, `lapses`, `state`, `last_review?` — nine fields, JSON-serializable | 4 grades: `Again=1, Hard=2, Good=3, Easy=4` | **Chosen**                                                |
| `supermemo` (npm)                    | `interval`, `repetition`, `efactor` — three numbers                                                                                              | 6 grades, `0..5`                            | Rejected — ease hell                                      |
| `@open-spaced-repetition/sm-2`       | `Card` + `ReviewLog` objects, JSON-serializable                                                                                                  | 6 grades, `0..5`                            | Rejected — ease hell, 7 weekly downloads                  |
| `ebisu-js`                           | `[a, b, t]` Beta-model triple                                                                                                                    | successes/total (probabilistic)             | Rejected — grading model does not match a three-button UI |
| Fixed step ladder (roadmap baseline) | one rung index                                                                                                                                   | our own 3                                   | Fallback only                                             |

### Evidence

**FSRS is Anki's modern default, SM-2 the legacy one.** "As of Anki 23.10, Anki has two available
algorithms. The first one is based on the SuperMemo 2 algorithm, and the second one is called FSRS."
— Anki FAQ, `faqs.ankiweb.net/what-spaced-repetition-algorithm.html`. This matters because the PRD's
vision recap explicitly positions the product against Anki: "Anki-class apps already implement correct
scheduling" (`roadmap.md:32`). Taking Anki's own current scheduler is the cheapest way to keep that
claim honest.

**Ease hell is a structural defect of SM-2, not a tuning problem.** "If you rate a card as Hard
repeatedly — even once — the ease factor decreases and stays decreased. Over time, cards with low ease
factors receive intervals that barely grow… These cards become 'leeches'." The named root cause: "SM-2
conflates two things: current stability… and intrinsic difficulty" — `learn.neurako.com/docs/learning-science/fsrs-vs-sm2`.
FSRS avoids it because "Difficulty is bounded and can move back toward the mean. A card therefore does
not get permanently pinned at high difficulty and short intervals" — `j-compass.com/docs/.../sm2-fsrs-algorithms`.

This is the decisive argument for our persona. The PRD's learner is the one who "would either grind
through all of them and burn out, or skip the session entirely" (`roadmap.md:32`). Leeches that
resurface forever are precisely the burnout mechanism the product exists to remove.

**FSRS needs no review history to start.** "FSRS can schedule with default parameters from the
beginning. Review history is used to optimize parameters for a collection." —
`smartrecallai.com/blog/fsrs-vs-sm2-deep-dive`. So the optimizer (`@open-spaced-repetition/binding`) is
**out of scope for v1** — a later, optional refinement, not a prerequisite. Default
`request_retention: 0.9`; Anki's own guidance is that 90% "offers a good balance of retention and workload".

**`ts-fsrs` is a healthy dependency.** npm `ts-fsrs` — package version `5.4.1`, algorithm FSRS v6, MIT,
last published 2026-05-22, ~114 000 weekly downloads, requires Node `>=20.0.0`, ships ES modules +
CommonJS + UMD. Our `.nvmrc` pins `22.14.0`, so the engine constraint is already met, and the ESM build
is what an Astro/Workers bundle wants. Contrast `@open-spaced-repetition/sm-2` at **7 weekly downloads**.

**Agent-friendly docs signal.** `ts-fsrs` publishes a TypeDoc site, a README with runnable snippets, and
is indexed by Context7 — the quality signal `CLAUDE.md` §Research discipline names. That is a practical
argument, not a cosmetic one: it is why the API section of the plan can cite real signatures.

## The three-vs-four rating problem (the one real friction)

Our PRD fixes **three** ratings (`missed_it`, `got_it`, `nailed_it`); FSRS defines **four**
(`Again`, `Hard`, `Good`, `Easy`). This is the contract that must be settled in `plan.md`, not glossed over.

It is a solved problem, not a blocker:

- Upstream confirms the algorithm needs no modification for a reduced button set: on
  `open-spaced-repetition/fsrs4anki#281` ("[Feature Request] 3 answer buttons option") the maintainer
  answers "I think it doesn't need to modify the algorithm for this."
- A working three-way mapping in a real repo does it at the library boundary: "Grade mapping: app uses
  1 (Again) / 2 (Hard) / 4 (Good) / 5 (Easy). FSRS's `Rating` enum is 1/2/3/4. The map lives in
  `lib/srs/scheduler.ts` and is applied at the FSRS boundary." — `Frazzled-Productions/poke-memory`.

**Proposed mapping** (for `/10x-plan` to ratify, not settled here):

| Our rating  | FSRS `Rating`      | Why                                                                |
| ----------- | ------------------ | ------------------------------------------------------------------ |
| `missed_it` | `Rating.Again` (1) | the only failure grade; triggers relearning                        |
| `got_it`    | `Rating.Good` (3)  | the neutral "recalled it" grade; leaves difficulty ~unchanged      |
| `nailed_it` | `Rating.Easy` (4)  | significantly increases stability, moderately decreases difficulty |

`Rating.Hard` (2) is deliberately unused — dropping the second positive grade is exactly what the
fsrs4anki thread proposes, and Anki's own rationale for collapsing six SM-2 grades to four applies one
step further: "failure comprises a small amount of total reviews, and thus adjusting a card's ease can
be sufficiently done by simply varying the positive answers" (Anki FAQ).

**This mapping preserves the PRD's non-negotiable ordering by construction**, per the Anki FAQ's own
description of FSRS grade effects: Again → "stability significantly decreases"; Good → "stability
increases"; Easy → "stability significantly increases". The executable check S-02 owes the roadmap
(`roadmap.md:103`) asserts that ordering against the real library rather than trusting this table.

## What this costs us

- **F-01's card row grows.** `card-store-with-owner-isolation` deliberately shipped `next_review_at` and
  nothing else, leaving scheduling state to this slice (`roadmap.md:69,74`). That deferral is now called
  in: the nine FSRS fields need a home. Whether they land as typed columns or one `jsonb` blob is a
  `/10x-plan` decision — the library's `Card` is JSON-serializable, which makes the blob viable.
- **An edit policy is now required.** FSRS state is memory state, not content state, so editing a card's
  front/back does not by itself invalidate `stability`/`difficulty`. `ts-fsrs` ships
  `forget(card, now, reset_count?)` for a deliberate reset. The policy (reset vs. keep) is a
  `plan-brief.md` contract; card editing is not in this milestone, so the plan should state the stance
  and defer the code.
- **A dependency, where the roadmap baseline had none.** Accepted: 114k weekly downloads, MIT, and the
  alternative is hand-rolling a scheduler — the "sandcastle pattern" the lesson warns about.

## Open questions for `/10x-plan`

1. Typed columns vs. a single `jsonb` `review_state` column for the nine FSRS fields.
2. Whether `reps`/`lapses` are persisted in v1 at all, given "Review streak and progress statistics" is
   Parked (`roadmap.md:159`) — persisting them is cheap, surfacing them is out of scope.
3. Whether the seeded starter deck's ten cards get `createEmptyCard()` state at seed time (a migration
   change touching S-01's trigger) or lazily on first review.
4. `enable_fuzz` on or off — fuzz randomizes intervals slightly and would make the ordering test flaky
   unless the test disables it (`fsrs({ enable_fuzz: false })` is documented).

## Sources

- Anki FAQ — what spaced repetition algorithm: https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html
- FSRS vs SM-2 (ease hell, DSR model): https://learn.neurako.com/docs/learning-science/fsrs-vs-sm2
- SM-2 vs FSRS technical comparison: https://j-compass.com/docs/japanese-learning/study-methodology/spaced-repetition/sm2-fsrs-algorithms
- FSRS vs SM-2 tradeoffs / default parameters: https://smartrecallai.com/blog/fsrs-vs-sm2-deep-dive
- `ts-fsrs` on npm (version, engines, downloads): https://www.npmjs.com/package/ts-fsrs
- `ts-fsrs` `Card` / `Rating` / `State` model source: https://github.com/open-spaced-repetition/ts-fsrs/blob/main/packages/fsrs/src/models.ts
- Three-button FSRS request: https://github.com/open-spaced-repetition/fsrs4anki/issues/281
- Real-world 3→4 grade mapping at the library boundary: https://github.com/fraserbrookhouse/poke-memory/blob/main/.claude/agents/srs-expert.md
- `supermemo` npm (SM-2, `interval`/`repetition`/`efactor`, 0–5): https://www.npmjs.com/package/supermemo
- `@open-spaced-repetition/sm-2`: https://github.com/open-spaced-repetition/sm-2-ts
- `ebisu-js`: https://www.npmjs.com/package/ebisu-js
