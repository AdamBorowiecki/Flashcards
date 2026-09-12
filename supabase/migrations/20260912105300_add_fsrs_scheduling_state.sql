-- FSRS scheduling state per card (roadmap S-02, PRD US-01/FR-003/FR-004).
--
-- This is the slice that lifts F-01's deferral. Open Roadmap Question 5 is
-- closed: scheduling is ts-fsrs (FSRS v6), chosen on the evidence recorded in
-- context/changes/srs-review-and-reschedule/external-research.md.
--
-- FSRS's own "due" field is deliberately NOT a column here. It maps onto the
-- existing next_review_at, which stays the single source of the due date --
-- so cards_user_id_next_review_at_idx and cards_select_own keep working
-- untouched, and there is never a second copy of the due date to drift.
--
-- elapsed_days is also absent: it is deprecated upstream, and a database
-- round-trip through TypeConvert.card() works without it.
--
-- No grant, policy, or index changes. cards_update_own already carries both
-- using and with check, so the rating write is permitted as-is.

-- Defaults mirror what createEmptyCard() produces: State.New, every numeric
-- field zero, no last_review. This matters more than it looks. Both writers of
-- public.cards -- the seeding trigger (20260906133232:67-69) and its backfill
-- (:95-101) -- name only (user_id, front, back). A not-null column without a
-- default would make the trigger's insert fail, and its `exception when others`
-- handler would swallow that into a warning: the account is created, the deck
-- arrives empty, and nothing surfaces the failure. Defaults keep both writers
-- correct without editing them.
alter table public.cards
  add column stability double precision not null default 0,
  add column difficulty double precision not null default 0,
  add column scheduled_days integer not null default 0,
  add column learning_steps integer not null default 0,
  add column reps integer not null default 0,
  add column lapses integer not null default 0,
  add column state smallint not null default 0,
  add column last_review timestamptz;

comment on column public.cards.stability is
  'FSRS stability: days until recall probability falls to the request_retention target.';
comment on column public.cards.difficulty is
  'FSRS difficulty, bounded and mean-reverting -- this is what keeps FSRS out of SM-2 ease hell.';
comment on column public.cards.state is
  'ts-fsrs State enum: 0 New, 1 Learning, 2 Review, 3 Relearning.';
comment on column public.cards.last_review is
  'Null until the card has been reviewed once. Every other scheduling column defaults to zero instead.';

-- Range guards. state is the only one with a closed set; the rest are counters
-- and magnitudes that the scheduler never produces as negative, so a negative
-- value means something wrote this row that was not the scheduler.
alter table public.cards
  add constraint cards_state_in_range check (state between 0 and 3),
  add constraint cards_stability_non_negative check (stability >= 0),
  add constraint cards_difficulty_non_negative check (difficulty >= 0),
  add constraint cards_scheduled_days_non_negative check (scheduled_days >= 0),
  add constraint cards_learning_steps_non_negative check (learning_steps >= 0),
  add constraint cards_reps_non_negative check (reps >= 0),
  add constraint cards_lapses_non_negative check (lapses >= 0);
