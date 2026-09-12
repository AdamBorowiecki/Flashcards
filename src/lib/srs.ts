/**
 * The scheduling rule, in one place.
 *
 * Both the rating endpoint and scripts/verify-srs-ordering.ts import this module, so the
 * ordering check proves the mapping the application actually uses rather than a copy of it.
 *
 * That is also why this file imports ONLY from "ts-fsrs". The verification script runs it
 * under plain `node --experimental-strip-types`, which resolves neither the `@/` alias nor
 * `astro:env`. Adding an Astro-shaped import here would not break the build -- it would
 * silently make the check unrunnable, which is worse than not having it.
 */
import { Rating, TypeConvert, createEmptyCard, fsrs, generatorParameters } from "ts-fsrs";

/** The learner-facing rating tokens, fixed by CLAUDE.md §Domain Model. */
export const RATINGS = ["missed_it", "got_it", "nailed_it"] as const;

export type CardRating = (typeof RATINGS)[number];

export function isCardRating(value: unknown): value is CardRating {
  return typeof value === "string" && (RATINGS as readonly string[]).includes(value);
}

/**
 * Three buttons onto FSRS's four grades. Rating.Hard is deliberately unused: dropping the
 * second positive grade is what upstream proposes for a three-button UI, and the PRD fixes
 * three ratings. See external-research.md for the evidence.
 */
const FSRS_GRADE: Record<CardRating, Rating.Again | Rating.Good | Rating.Easy> = {
  missed_it: Rating.Again,
  got_it: Rating.Good,
  nailed_it: Rating.Easy,
};

/**
 * The scheduling state persisted on a card row, in snake_case because supabase-js returns
 * column names verbatim. `due` is absent by design -- it lives in cards.next_review_at.
 */
export interface CardSchedulingState {
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: number;
  last_review: string | null;
}

/** What a rating produces: the new scheduling state plus the new due date. */
export interface ScheduledCard extends CardSchedulingState {
  next_review_at: string;
}

/**
 * enable_short_term: false is a PRODUCT DECISION and must not be dropped.
 *
 * With the library default (true), FSRS repeats a new card within the session before promoting
 * it to day-scale intervals: measured on ts-fsrs@5.4.2, missed_it comes due in 1 minute and
 * got_it in 10. That is Anki's rhythm. CLAUDE.md §Domain Model describes cards surfacing on app
 * open, and the review queue is loaded as a single snapshot -- so minute-scale re-dues would
 * never appear until a reload, while the "nothing due" panel claimed otherwise. With it off the
 * same three ratings measure 1 / 3 / 8 days. The accepted cost: a card you just failed returns
 * tomorrow rather than later in the same session.
 *
 * enable_fuzz: false is already the library default; it is passed explicitly so the ordering
 * check does not depend on that default holding.
 */
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, enable_short_term: false }));

/** The state a card starts life with -- what the migration's column defaults mirror. */
export function emptySchedulingState(now: Date): CardSchedulingState {
  const card = createEmptyCard(now);
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: null,
  };
}

/**
 * Apply one rating to one card's stored state.
 *
 * `dueAt` is the card's current next_review_at -- FSRS's `due` for the card being rebuilt.
 */
export function schedule(state: CardSchedulingState, dueAt: string, rating: CardRating, now: Date): ScheduledCard {
  const card = TypeConvert.card({
    due: dueAt,
    stability: state.stability,
    difficulty: state.difficulty,
    scheduled_days: state.scheduled_days,
    learning_steps: state.learning_steps,
    reps: state.reps,
    lapses: state.lapses,
    state: state.state,
    last_review: state.last_review ?? undefined,
  });

  const next = scheduler.next(card, now, FSRS_GRADE[rating]).card;

  return {
    stability: next.stability,
    difficulty: next.difficulty,
    scheduled_days: next.scheduled_days,
    learning_steps: next.learning_steps,
    reps: next.reps,
    lapses: next.lapses,
    state: next.state,
    last_review: next.last_review?.toISOString() ?? null,
    next_review_at: next.due.toISOString(),
  };
}
