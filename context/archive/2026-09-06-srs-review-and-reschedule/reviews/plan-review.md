<!-- PLAN-REVIEW-REPORT -->

# Plan Review: Review a Due Card and Reschedule It by Rating

- **Plan**: `context/changes/srs-review-and-reschedule/plan.md`
- **Mode**: Deep
- **Date**: 2026-09-12
- **Verdict**: REVISE → **SOUND** after triage
- **Findings**: 1 critical, 2 warnings, 1 observation

## Verdicts

| Dimension             | Verdict (as reviewed) | After triage |
| --------------------- | --------------------- | ------------ |
| End-State Alignment   | WARNING               | PASS         |
| Lean Execution        | WARNING               | WARNING      |
| Architectural Fitness | PASS                  | PASS         |
| Blind Spots           | FAIL                  | PASS         |
| Plan Completeness     | WARNING               | PASS         |

## Grounding

6/6 existing paths ✓, 4/4 new paths clear of collisions ✓, `PROTECTED_ROUTES` ✓,
Progress↔Phase 4/4 phases and 26/26 criteria mapped ✓, brief↔plan ✓.

**Verified empirically**: `ts-fsrs@5.4.2` was installed in a scratch directory and exercised directly
rather than reasoned about. That is what produced F1 and the measurements in F2. Two of the plan's own
claims were confirmed the same way: `enable_fuzz` does default to `false`, and a database round-trip
through `TypeConvert.card()` works **without** an `elapsed_days` column — so the plan's decision to omit
that column is correct, and its table of SQL defaults matches `createEmptyCard()` field for field.

## Findings

### F1 — Default short-term scheduling makes the whole product minute-scale

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Phase 1, change #3 (`src/lib/srs.ts`) — and every phase downstream
- **Detail**: The plan passed only `enable_fuzz: false` explicitly and silently inherited
  `enable_short_term: true`. Measured on `ts-fsrs@5.4.2` from one `createEmptyCard()`: `missed_it`
  +1 minute, `got_it` +10 minutes, `nailed_it` +8 days. After a first session on the ten-card starter
  deck, nine of ten cards are due again within ten minutes — while the "nothing due" panel renders and the
  snapshot queue, by design, never picks them up until a reload. `CLAUDE.md` §Domain Model describes a
  daily app-open rhythm; the library default is Anki's within-session rhythm. The ordering invariant was
  never at risk in any configuration measured; the session model was.
- **Fix A ⭐ Recommended**: pass `enable_short_term: false` explicitly
  - Strength: Measured result becomes 1 / 3 / 8 days, matching the model CLAUDE.md and the PRD describe;
    makes the snapshot queue correct and the empty-state panel honest, with no extra code.
  - Tradeoff: Loses within-session relearning; a just-failed card returns tomorrow.
  - Confidence: HIGH — measured directly in both configurations.
  - Blind spot: Long-term-only scheduling for brand-new cards is less studied than FSRS's default path.
- **Fix B**: keep short-term on, re-query the queue when it empties
  - Strength: Preserves FSRS's intended behaviour, which is also how Anki behaves.
  - Tradeoff: Needs a queue-refresh path and a real session lifecycle — scope the plan assigned to S-03.
  - Confidence: HIGH — mechanism is clear.
  - Blind spot: Where a short-step session should stop is undesigned.
- **Decision**: FIXED via Fix A. Four edits: the `src/lib/srs.ts` contract now requires both flags
  explicitly with the measured rationale and a "must not be dropped" note; Key Discoveries records the
  measurement; the brief's decision table gains a "Review rhythm" row; and criterion 3.5 now requires the
  three intervals to be **days apart rather than minutes apart**, so the setting cannot be dropped during
  implementation without a manual check failing.

### F2 — The ordering check proves the invariant only for new cards

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Completeness
- **Location**: Phase 1, change #4 — `scripts/verify-srs-ordering.ts`
- **Detail**: Desired End State claims the ordering as a property of the product; the script asserted it
  from one starting state, `createEmptyCard()`. Every seeded card is new, so day one was covered, but the
  invariant matters most for mature cards and nothing would catch a regression there. Measured on a
  Review-state card at stability 498: `missed_it` +0.007 days, `got_it` +1348, `nailed_it` +2090 —
  ordering holds today, untested tomorrow.
- **Fix**: assert from two starting states — a fresh card and a Review-state card built by replaying a few
  `got_it` ratings.
  - Strength: Covers both ends of a card's life for a few extra lines; the replay needs no database.
  - Tradeoff: The mature fixture encodes an assumption about how a card matures.
  - Confidence: HIGH — measured both paths.
  - Blind spot: Relearning-state cards remain untested.
- **Decision**: FIXED. The contract now specifies both starting states and states the fixture's limitation
  explicitly rather than implying it is representative.

### F3 — Review page ships scheduling internals to the browser

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3, change #2 — `src/pages/review.astro`
- **Detail**: The page selects the due queue and passes rows to the island. The island needs `id`, `front`
  and `back`; it would also receive `stability`, `difficulty`, `reps`, `lapses` and `state` — payload
  nobody reads, and an invitation for a later change to start computing schedules client-side, which is
  the one thing this design keeps server-only.
- **Fix**: select only `id, front, back` for the queue; the endpoint reads the scheduling columns itself.
- **Decision**: SKIPPED — user judged `select *` simpler for this slice. Left open deliberately; if a
  later change starts reading scheduling fields in the island, this is where it began.

### F4 — No stated action if the cloud push breaks signup

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Blind Spots
- **Location**: Phase 4
- **Detail**: Criterion 4.5 detects the failure but the plan named no action. The trigger swallows a
  failed insert into an empty deck, so every account created while debugging silently loses its starter
  deck.
- **Fix**: add a rollback line to Phase 4 — drop the eight columns in a follow-up migration and push.
- **Decision**: FIXED. Phase 4's implementation note now carries the recovery path and says explicitly not
  to leave a broken trigger in place while debugging.

## Triage summary

| Outcome | Findings           |
| ------- | ------------------ |
| Fixed   | F1 (Fix A), F2, F4 |
| Skipped | F3                 |

**Verdict after fixes: SOUND.** The critical finding was a product-behaviour decision hidden in a library
default, not a structural flaw — the plan's phases, contracts and success criteria held up under
verification. One warning remains open by choice (F3).
