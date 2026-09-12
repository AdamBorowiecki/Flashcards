/**
 * verify-srs-ordering: proves the PRD's non-negotiable rating ordering.
 *
 * CLAUDE.md §Domain Model: "missed_it must produce an earlier next_review_at than got_it,
 * which must be earlier than nailed_it. A violation breaks the product's core value
 * proposition." roadmap.md S-02 requires that guarantee to have an EXECUTABLE check, because
 * it is not visible by eye during a manual click-through.
 *
 * Run it:
 *   npm run verify:srs
 *
 * What this catches: an inverted or mis-typed rating map in src/lib/srs.ts (say got_it wired
 * to Rating.Hard), and any future ts-fsrs upgrade that stops honouring the ordering. It
 * imports the real module, so it cannot drift from what the endpoint does.
 *
 * What this does NOT catch: whether the rating endpoint wires the module up correctly, or
 * whether the values reach the database. Those are manual criteria in the plan's phases 3
 * and 4. This script never touches a database or a network.
 *
 * Exits non-zero on the first failed assertion, like the SQL suites in supabase/tests/.
 */
import { RATINGS, emptySchedulingState, schedule } from "../src/lib/srs.ts";
import type { CardRating, CardSchedulingState } from "../src/lib/srs.ts";

const NOW = new Date("2026-01-01T12:00:00.000Z");
const DAY_MS = 86_400_000;

function fail(message: string): never {
  process.stderr.write(`verify-srs-ordering: ${message}\n`);
  process.exit(1);
}

function days(from: Date, iso: string): number {
  return (new Date(iso).getTime() - from.getTime()) / DAY_MS;
}

/**
 * Apply each of the three ratings to one identical starting state and assert the ordering.
 *
 * The positive assertion comes FIRST and must pass. Every assertion after it would also be
 * satisfied by a scheduler that returned the same date three times, so without it they prove
 * nothing -- the vacuous-pass shape F-01's suite still carries as an open finding.
 */
function assertOrdering(label: string, state: CardSchedulingState, dueAt: string, now: Date): void {
  const due = Object.fromEntries(
    RATINGS.map((rating: CardRating) => [rating, schedule(state, dueAt, rating, now).next_review_at]),
  ) as Record<CardRating, string>;

  for (const rating of RATINGS) {
    if (new Date(due[rating]).getTime() <= now.getTime()) {
      fail(`${label}: "${rating}" scheduled ${due[rating]}, which is not after ${now.toISOString()}`);
    }
  }

  if (new Date(due.missed_it) >= new Date(due.got_it)) {
    fail(`${label}: "missed_it" (${due.missed_it}) is not earlier than "got_it" (${due.got_it})`);
  }

  if (new Date(due.got_it) >= new Date(due.nailed_it)) {
    fail(`${label}: "got_it" (${due.got_it}) is not earlier than "nailed_it" (${due.nailed_it})`);
  }

  const intervals = RATINGS.map((rating) => `${rating} +${days(now, due[rating]).toFixed(2)}d`).join(", ");
  process.stdout.write(`  ${label}: ${intervals}\n`);
}

// A new card: the seeded starter deck, and every card's first review.
const fresh = emptySchedulingState(NOW);
assertOrdering("new card", fresh, NOW.toISOString(), NOW);

// A matured card: where a learner actually spends most of their time. Built by replaying
// got_it at each successive due date until the card reaches State.Review (2). The fixture
// encodes an assumption about how a card matures and may not be representative -- that is
// acceptable, because even an unrepresentative starting state still catches an inverted map.
let matured = fresh;
let maturedDue = NOW.toISOString();
let maturedNow = NOW;
for (let i = 0; i < 5; i++) {
  const next = schedule(matured, maturedDue, "got_it", maturedNow);
  matured = next;
  maturedDue = next.next_review_at;
  maturedNow = new Date(next.next_review_at);
}

if (matured.state !== 2) {
  fail(`matured fixture never reached State.Review -- state is ${matured.state}. The replay needs revisiting.`);
}

assertOrdering("matured card", matured, maturedDue, maturedNow);

process.stdout.write("verify-srs-ordering: all assertions passed\n");
