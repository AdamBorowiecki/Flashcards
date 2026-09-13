/**
 * verify-card-scheduling-columns: proves a newly created card starts in the state FSRS defines.
 *
 * roadmap.md S-04 creates the second writer of the scheduling columns. src/pages/api/cards/index.ts
 * spreads emptySchedulingState() straight into the insert, and src/pages/api/cards/rate.ts selects
 * the same columns back out -- both via SCHEDULING_STATE_COLUMNS. If that list and what
 * emptySchedulingState() actually returns ever disagree, a created card gets a partial scheduling
 * state and nothing fails: the insert succeeds, the column defaults quietly fill the gap, and the
 * card is scheduled from a state no part of the application chose. That is the swallowed failure
 * lessons.md forbids, so this is the way it gets noticed.
 *
 * Run it:
 *   npm run verify:cards
 *
 * What this catches: a column added to CardSchedulingState but missing from
 * SCHEDULING_STATE_COLUMNS (or the reverse), and a ts-fsrs upgrade that changes what
 * createEmptyCard() produces for a brand-new card.
 *
 * What this does NOT catch: whether the creation endpoint wires the module up correctly, or whether
 * the values reach the database. Those are manual criteria in the plan's phases 1 and 2. Like
 * verify-srs-ordering.ts, this script never touches a database or a network -- which is also why it
 * may import only from src/lib/srs.ts, the one module that resolves under plain node.
 *
 * Exits non-zero on the first failed assertion.
 */
import { SCHEDULING_STATE_COLUMNS, emptySchedulingState } from "../src/lib/srs.ts";

const NOW = new Date("2026-01-01T12:00:00.000Z");

function fail(message: string): never {
  process.stderr.write(`verify-card-scheduling-columns: ${message}\n`);
  process.exit(1);
}

const fresh = emptySchedulingState(NOW);
const produced = Object.keys(fresh);
const declared: readonly string[] = SCHEDULING_STATE_COLUMNS;

// Both directions. A one-way check passes happily when emptySchedulingState() returns a field the
// endpoints never write -- which is the same silent partial-state bug seen from the other side.
for (const column of declared) {
  if (!produced.includes(column)) {
    fail(`SCHEDULING_STATE_COLUMNS names "${column}", but emptySchedulingState() does not return it`);
  }
}

for (const column of produced) {
  if (!declared.includes(column)) {
    fail(`emptySchedulingState() returns "${column}", but SCHEDULING_STATE_COLUMNS does not name it`);
  }
}

// A new card is State.New with nothing reviewed yet. These two are the fields whose wrong value
// would not look wrong: a card claiming State.Review with no history is scheduled as if mature.
if (fresh.state !== 0) {
  fail(`a new card must start at State.New (0) -- emptySchedulingState() returned state ${fresh.state}`);
}

if (fresh.last_review !== null) {
  fail(`a new card has not been reviewed -- last_review should be null, got ${fresh.last_review}`);
}

// Everything else is a counter or a magnitude the migration constrains to non-negative numbers
// (20260912105300:56-64). A NaN or a string here would be rejected by the database, not by FSRS.
for (const column of declared) {
  if (column === "last_review") continue;

  // Through unknown deliberately: the point of this loop is to distrust the declared type and
  // check what the object actually holds at runtime.
  const value = (fresh as unknown as Record<string, unknown>)[column];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    fail(`"${column}" must be a finite number on a new card, got ${String(value)}`);
  }
  if (value < 0) {
    fail(
      `"${column}" must be non-negative on a new card, got ${String(value)} -- the check constraint would reject it`,
    );
  }
}

process.stdout.write(`  new card: ${declared.length} scheduling columns, state ${fresh.state}, last_review null\n`);
process.stdout.write("verify-card-scheduling-columns: all assertions passed\n");
