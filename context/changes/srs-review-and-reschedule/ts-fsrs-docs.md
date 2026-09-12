# `ts-fsrs` live API — the surface this slice would touch

- **Change**: `srs-review-and-reschedule`
- **Source**: Context7, library `/open-spaced-repetition/ts-fsrs` (High reputation, 454 snippets)
- **Date pulled**: 2026-09-12
- **Status**: reference only. Fills the `(pending)` placeholder that `research.md` left under Related Research.
- **Not installed**: `ts-fsrs` is absent from `package.json` as of commit `7b54dc8`. Every signature below is
  from upstream docs, not from a local `node_modules` read.

## The four calls this slice actually needs

```typescript
import { createEmptyCard, fsrs, generatorParameters, Rating, State, TypeConvert } from "ts-fsrs";

const scheduler = fsrs(); // or fsrs(generatorParameters({ ... }))
const card = createEmptyCard(); // State.New, every numeric field 0
const result = scheduler.next(card, new Date(), Rating.Good);
// result.card — the rescheduled card;  result.log — the review log entry
```

- `scheduler.next(card, now, grade)` applies **one** rating — this is the rating endpoint's call.
- `scheduler.repeat(card, now)` returns **all four** outcomes for preview without committing. Not needed
  for a rate-and-move-on flow; potentially useful if the UI ever wants to show "next review in …" on the
  buttons before the learner picks.

### `createEmptyCard()`

```
createEmptyCard<R = Card>(now?: DateInput, afterHandler?: (card: Card) => R): R
```

Creates a new unreviewed card: `state: State.New (0)`, all numeric fields `0`, `due` defaulting to now.
The optional `afterHandler` transformer is the documented hook for reshaping before persistence.

### The `Card` object — what has to be stored

```typescript
{
  due: Date,
  stability: number,
  difficulty: number,
  scheduled_days: number,
  learning_steps: number,
  reps: number,
  lapses: number,
  state: State,          // New=0, Learning=1, Review=2, Relearning=3
  last_review?: Date,
  elapsed_days: number,  // DEPRECATED upstream — do not persist as meaningful
}
```

`due` is the field that maps onto the existing `public.cards.next_review_at`. `elapsed_days` is marked
deprecated in the upstream types doc; a plan that persists it is persisting dead state.

## Persistence — the round trip is a solved problem upstream

**Serializing out.** The `afterHandler` on `next()` is the documented place to turn `Date`s into
storable values:

```typescript
const serialized = scheduler.next(card, new Date(), Rating.Good, ({ card, log }) => ({
  card: { ...card, due: card.due.getTime(), last_review: card.last_review?.getTime() ?? null },
  log: { ...log, due: log.due.getTime(), review: log.review.getTime() },
}));
```

**Reading back in.** `TypeConvert.card()` normalizes a loose `CardInput` — numeric timestamps, ISO
strings, even a string `state` — into a real `Card` with `Date` instances and enum values:

```typescript
static card<T extends Card | CardInput>(card: T): Card
```

```typescript
const card = TypeConvert.card({
  state: "Review", // string accepted
  due: 1705276800000, // epoch ms accepted
  stability: 5.0,
  difficulty: 3.5,
  reps: 10,
  lapses: 1,
  scheduled_days: 5,
  learning_steps: 0,
  last_review: "2024-01-15T10:00:00Z", // ISO string accepted
});
card.due instanceof Date; // true
```

> **Why this matters for Open Question 1 (typed columns vs. one `jsonb` blob).** `TypeConvert.card()`
> accepting epoch numbers and ISO strings is exactly the shape a Postgres round-trip produces —
> `timestamptz` comes back as an ISO string through supabase-js, `numeric`/`int` come back as numbers.
> **Both storage shapes are supported by the library without hand-written coercion.** The decision is
> therefore a database-design decision (queryability, constraints, migration cost), not a library
> constraint. `/10x-plan` must argue it on those grounds.

## `Rating` — the four grades

```typescript
Rating.Again; // 1
Rating.Hard; // 2
Rating.Good; // 3
Rating.Easy; // 4
```

`external-research.md` proposes the 3→4 mapping `missed_it → Again`, `got_it → Good`,
`nailed_it → Easy`, leaving `Hard` unused. Nothing in the API forces a four-button UI — the grade is
just an argument to `next()`.

## `FSRSParameters` — and a correction

```typescript
interface FSRSParameters {
  request_retention: number; // default 0.9
  maximum_interval: number; // days, default 36500
  w: number[]; // 21 weights for v6
  enable_fuzz: boolean; // default FALSE
  enable_short_term: boolean; // default true
  learning_steps: Steps; // default ['1m', '10m']
  relearning_steps: Steps; // default ['10m']
}
```

Build them with `generatorParameters(partial)`, which merges over the defaults:

```typescript
const scheduler = fsrs(generatorParameters({ request_retention: 0.85, enable_fuzz: false }));
```

> **Correction to earlier research.** `research.md` Open Question 7 and `external-research.md` Open
> Question 4 both state that `enable_fuzz` is **on by default** and would make an ordering assertion
> flaky. The upstream quick-reference lists `enable_fuzz: false, // boolean, default false`. So the
> default is already the deterministic one, and **no special test configuration is required to keep the
> ordering check stable** — though a verification script should still pass it explicitly rather than
> depend on a default staying put. Both open questions can be closed on this basis.

## `forget()` — the edit-policy escape hatch

```
forget(card, now, reset_count?, afterHandler?)
```

Resets a card to `State.New` and clears learning progress; `reset_count: true` additionally zeroes
`reps` and `lapses`. The resulting `log.rating` is `Rating.Manual`.

```typescript
const hardReset = scheduler.forget(reviewedCard, new Date(), true);
hardReset.card.state; // State.New
hardReset.card.stability; // 0
hardReset.card.reps; // 0
```

Relevant only to the **stated stance**, not to code in this slice: `external-research.md` notes that
editing a card's front/back does not invalidate memory state, and card editing is not in this milestone.
The plan should record the policy and defer the implementation.

## Environment fit

- Requires Node `>=20`; `.nvmrc` pins `22.14.0` and CI runs node 22. Satisfied.
- Ships ESM + CJS + UMD; the project is `"type": "module"` with a Cloudflare Workers adapter. ESM is what
  the bundle wants. Satisfied.
- Pure computation, no I/O — nothing in the API needs a filesystem or network, so the Workers runtime
  imposes no constraint.

## Sources

- Context7 `/open-spaced-repetition/ts-fsrs`, drawn from upstream `_autodocs/` and `README.md`:
  `INDEX.md`, `01-scheduler-api.md`, `02-types.md`, `03-algorithms.md`, `05-conversion-errors.md`,
  `08-quick-reference.md`.
