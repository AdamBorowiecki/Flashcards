/**
 * Unit tests for the scheduling rule.
 *
 * These sit alongside scripts/verify-srs-ordering.ts rather than replacing it. The script is a
 * single executable gate wired into npm run verify:srs and referenced by roadmap S-02; this file
 * covers the same invariant plus the surrounding contract (rating tokens, the column set, fuzz and
 * short-term settings) at the granularity where a failure names which property broke.
 *
 * Imports are relative with an explicit .ts extension, not the `@/` alias: the runner is plain
 * `node --test` with type stripping, which resolves neither the alias nor astro:env. That is the
 * same constraint src/lib/srs.ts documents for itself.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { RATINGS, SCHEDULING_STATE_COLUMNS, emptySchedulingState, isCardRating, schedule } from "../src/lib/srs.ts";
import type { CardRating, CardSchedulingState } from "../src/lib/srs.ts";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const HOUR_MS = 3_600_000;

/** Apply all three ratings to one identical starting state. */
function dueDates(state: CardSchedulingState, dueAt: string, now: Date): Record<CardRating, Date> {
  return Object.fromEntries(
    RATINGS.map((rating) => [rating, new Date(schedule(state, dueAt, rating, now).next_review_at)]),
  ) as Record<CardRating, Date>;
}

/**
 * A card that has reached State.Review -- where a learner actually spends most of their time.
 *
 * Built the way scripts/verify-srs-ordering.ts builds it: replay got_it at each successive due
 * date. The fixture encodes an assumption about how a card matures and may not be representative;
 * that is acceptable, because even an unrepresentative state still catches an inverted rating map.
 */
function maturedCard(): { state: CardSchedulingState; dueAt: string; now: Date } {
  let state: CardSchedulingState = emptySchedulingState(NOW);
  let dueAt = NOW.toISOString();
  let now = NOW;

  for (let i = 0; i < 5; i++) {
    const next = schedule(state, dueAt, "got_it", now);
    state = next;
    dueAt = next.next_review_at;
    now = new Date(next.next_review_at);
  }

  return { state, dueAt, now };
}

describe("rating tokens", () => {
  it("is exactly the three tokens CLAUDE.md fixes, in escalating order", () => {
    assert.deepEqual([...RATINGS], ["missed_it", "got_it", "nailed_it"]);
  });

  it("accepts every token in RATINGS", () => {
    for (const rating of RATINGS) {
      assert.equal(isCardRating(rating), true, `${rating} should be a valid rating`);
    }
  });

  it("rejects anything else", () => {
    // "hard" matters specifically: FSRS has a fourth grade this product deliberately drops, so a
    // client sending it must be refused rather than quietly coerced.
    for (const value of ["hard", "", "GOT_IT", " got_it", "got it", null, undefined, 42, {}, [], true]) {
      assert.equal(isCardRating(value), false, `${JSON.stringify(value)} should not be a valid rating`);
    }
  });
});

describe("emptySchedulingState", () => {
  it("produces exactly the columns SCHEDULING_STATE_COLUMNS declares", () => {
    // The two are written in different places and read by different endpoints; this is what stops
    // them drifting apart silently, and it asserts both directions so neither extra nor missing
    // keys slip through.
    assert.deepEqual(Object.keys(emptySchedulingState(NOW)).sort(), [...SCHEDULING_STATE_COLUMNS].sort());
  });

  it("carries no due date", () => {
    // `due` lives in cards.next_review_at, by design. A scheduling state that also carried one
    // would give the app two sources of truth about when a card is due.
    const state = emptySchedulingState(NOW);
    assert.equal("next_review_at" in state, false);
    assert.equal("due" in state, false);
  });

  it("starts a card unreviewed", () => {
    const state = emptySchedulingState(NOW);
    assert.equal(state.reps, 0);
    assert.equal(state.lapses, 0);
    assert.equal(state.last_review, null);
  });
});

describe("schedule", () => {
  it("returns the scheduling columns plus next_review_at, and nothing else", () => {
    const result = schedule(emptySchedulingState(NOW), NOW.toISOString(), "got_it", NOW);
    assert.deepEqual(Object.keys(result).sort(), [...SCHEDULING_STATE_COLUMNS, "next_review_at"].sort());
  });

  it("returns next_review_at as an ISO-8601 instant", () => {
    const { next_review_at } = schedule(emptySchedulingState(NOW), NOW.toISOString(), "got_it", NOW);
    assert.equal(new Date(next_review_at).toISOString(), next_review_at);
  });

  it("records the review time", () => {
    const { last_review } = schedule(emptySchedulingState(NOW), NOW.toISOString(), "got_it", NOW);
    assert.equal(last_review, NOW.toISOString());
  });

  it("counts the repetition", () => {
    const before = emptySchedulingState(NOW);
    const after = schedule(before, NOW.toISOString(), "missed_it", NOW);
    assert.equal(after.reps, before.reps + 1);
  });

  it("is deterministic, because enable_fuzz is off", () => {
    // enable_fuzz: false is passed explicitly in src/lib/srs.ts so the ordering guarantee does not
    // depend on a library default holding. With fuzz on, two identical calls can disagree.
    const state = emptySchedulingState(NOW);
    const first = schedule(state, NOW.toISOString(), "got_it", NOW);
    const second = schedule(state, NOW.toISOString(), "got_it", NOW);
    assert.deepEqual(first, second);
  });
});

/**
 * The product's core value proposition, per CLAUDE.md §Domain Model: "missed_it must produce an
 * earlier next_review_at than got_it, which must be earlier than nailed_it. A violation breaks the
 * product's core value proposition."
 */
describe("rating ordering invariant", () => {
  const fresh = emptySchedulingState(NOW);
  const cases: { label: string; state: CardSchedulingState; dueAt: string; now: Date }[] = [
    { label: "a new card", state: fresh, dueAt: NOW.toISOString(), now: NOW },
    { label: "a matured card", ...maturedCard() },
  ];

  it("builds a matured fixture that actually reached State.Review", () => {
    // Guards the fixture itself. If a ts-fsrs upgrade changes how a card matures, the ordering
    // cases below would still pass while silently testing a learning card twice.
    assert.equal(maturedCard().state.state, 2);
  });

  for (const { label, state, dueAt, now } of cases) {
    describe(label, () => {
      it("schedules every rating into the future", () => {
        // This positive assertion must hold first. Every assertion below it would also be satisfied
        // by a scheduler that returned the same date three times, so without it they prove nothing.
        const due = dueDates(state, dueAt, now);
        for (const rating of RATINGS) {
          assert.ok(
            due[rating] > now,
            `${rating} scheduled ${due[rating].toISOString()}, not after ${now.toISOString()}`,
          );
        }
      });

      it("gives the three ratings three distinct dates", () => {
        const due = dueDates(state, dueAt, now);
        const distinct = new Set(RATINGS.map((rating) => due[rating].getTime()));
        assert.equal(distinct.size, RATINGS.length);
      });

      it("schedules missed_it earlier than got_it", () => {
        const due = dueDates(state, dueAt, now);
        assert.ok(
          due.missed_it < due.got_it,
          `missed_it (${due.missed_it.toISOString()}) is not earlier than got_it (${due.got_it.toISOString()})`,
        );
      });

      it("schedules got_it earlier than nailed_it", () => {
        const due = dueDates(state, dueAt, now);
        assert.ok(
          due.got_it < due.nailed_it,
          `got_it (${due.got_it.toISOString()}) is not earlier than nailed_it (${due.nailed_it.toISOString()})`,
        );
      });
    });
  }
});

/**
 * enable_short_term: false is a product decision, documented at length in src/lib/srs.ts.
 *
 * With the library default (true), FSRS repeats a new card within the session: missed_it comes due
 * in 1 minute and got_it in 10. The review queue is loaded as a single snapshot, so minute-scale
 * re-dues would never appear until a reload while the "nothing due" panel claimed otherwise.
 */
describe("short-term scheduling is off", () => {
  it("puts even the soonest rating on a day scale, not a minute scale", () => {
    const due = dueDates(emptySchedulingState(NOW), NOW.toISOString(), NOW);
    for (const rating of RATINGS) {
      const hours = (due[rating].getTime() - NOW.getTime()) / HOUR_MS;
      assert.ok(hours >= 12, `${rating} comes due in ${hours.toFixed(2)}h, which is session-scale, not day-scale`);
    }
  });
});
