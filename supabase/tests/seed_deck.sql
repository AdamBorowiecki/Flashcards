-- Proof that a new learner arrives with the starter deck, exactly once, and that
-- a broken seed cannot stop them registering (roadmap S-01, PRD FR-005).
--
-- Two of these three properties are invisible to a manual click-through: you
-- would have to contrive a double-fire to see duplication, and deliberately
-- break the seed to see the resilience path. So they are executable.
--
-- Every assertion raises an exception on failure, which makes the whole script
-- exit non-zero rather than printing a table somebody has to interpret.
--
-- Run it against the LOCAL stack only -- it creates users and rows:
--
--   npx supabase start -x edge-runtime
--   npx supabase db reset
--   docker exec -i supabase_db_10x-astro-starter \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/seed_deck.sql
--
-- Everything happens inside a transaction that is rolled back at the end, so a
-- run leaves no trace even on the local database -- including the deliberately
-- broken function definition in assertion 5.

-- What this script catches, and what it does not -- established by deliberately
-- breaking each piece in turn against a throwaway local database:
--
--   * trigger dropped                  -> assertion 1 fails (0 cards, not 10)
--   * a pair duplicated in the deck    -> assertion 2 fails (9 distinct fronts)
--   * guard removed from the BACKFILL  -> assertion 3 fails
--   * guard removed from the TRIGGER FUNCTION -> nothing fails
--
-- That last line is worth understanding before trusting this file. The trigger
-- is `after insert ... for each row` on auth.users, so it fires exactly once per
-- account and its internal `if exists` guard is never reached in normal
-- operation. Assertion 3 re-runs the backfill statement, which carries its own
-- guard -- so it proves the backfill is idempotent, not the function. The
-- function's guard is defence in depth for a future caller (a manual re-seed, a
-- second trigger) and is deliberately left untested rather than tested by a
-- contrivance that proves nothing about the real path.

\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- 1. POSITIVE: a new account arrives with the full deck, owned, and due.
--    This one comes first and must pass. Assertions 3 and 5 below are also
--    satisfied by a table where seeding never happens at all, so without this
--    they would prove nothing.
-- ---------------------------------------------------------------------------

-- Transaction-local baseline: how many cards already belong to somebody else.
-- Captured BEFORE the fixture signup, so the foreign-row assertion below is a
-- delta rather than an absolute. An absolute "no foreign rows exist" check only
-- holds on a freshly reset database and turns into a false failure the moment
-- anyone hand-tests the app against this stack -- which S-02's review hit for
-- real. Same fix S-01's plan review applied to cards_rls.sql:57-62.
select set_config(
  'seed_deck.baseline_foreign',
  (select count(*) from public.cards)::text,
  true
);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learner-one@example.test', '', now(), now(), now());

do $$
declare
  card_count integer;
  foreign_rows integer;
  baseline_foreign integer;
  not_yet_due integer;
begin
  select count(*) into card_count
  from public.cards
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

  if card_count <> 10 then
    raise exception 'seeding: a new learner should get 10 cards, got %', card_count;
  end if;

  select count(*) into foreign_rows
  from public.cards
  where user_id <> 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

  baseline_foreign := current_setting('seed_deck.baseline_foreign')::integer;

  if foreign_rows <> baseline_foreign then
    raise exception 'seeding: % card(s) landed on somebody other than the new learner (foreign rows went % -> %)',
      foreign_rows - baseline_foreign, baseline_foreign, foreign_rows;
  end if;

  select count(*) into not_yet_due
  from public.cards
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid
    and next_review_at > now();

  if not_yet_due <> 0 then
    raise exception 'seeding: % seeded card(s) are not due yet -- they would never surface', not_yet_due;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The deck itself is well formed. A copy-paste duplicate or a blank side is
--    a real authoring mistake and a silent one -- the count assertion above
--    passes just as happily with ten copies of the same card.
-- ---------------------------------------------------------------------------

do $$
declare
  pair_count integer;
  distinct_fronts integer;
  distinct_backs integer;
  blank_sides integer;
begin
  select count(*), count(distinct front), count(distinct back)
  into pair_count, distinct_fronts, distinct_backs
  from public.starter_deck();

  if pair_count <> 10 then
    raise exception 'deck: starter_deck() should hold 10 pairs, holds %', pair_count;
  end if;

  if distinct_fronts <> 10 then
    raise exception 'deck: only % distinct fronts among 10 pairs -- duplicated card', distinct_fronts;
  end if;

  if distinct_backs <> 10 then
    raise exception 'deck: only % distinct backs among 10 pairs -- duplicated card', distinct_backs;
  end if;

  select count(*) into blank_sides
  from public.starter_deck()
  where btrim(front) = '' or btrim(back) = '';

  if blank_sides <> 0 then
    raise exception 'deck: % pair(s) have a blank side', blank_sides;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 3. IDEMPOTENCY: re-running the backfill changes nothing. This is the roadmap's
--    named failure mode -- "the seeding trigger firing more than once and
--    duplicating a learner's deck".
-- ---------------------------------------------------------------------------

insert into public.cards (user_id, front, back)
select u.id, deck.front, deck.back
from auth.users u
cross join public.starter_deck() as deck
where not exists (
  select 1 from public.cards c where c.user_id = u.id
);

do $$
declare
  card_count integer;
begin
  select count(*) into card_count
  from public.cards
  where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

  if card_count <> 10 then
    raise exception 'idempotency: re-running the backfill took the deck to % cards', card_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 4. A second learner gets their own deck without disturbing the first.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learner-two@example.test', '', now(), now(), now());

do $$
declare
  first_count integer;
  second_count integer;
begin
  select count(*) into first_count
  from public.cards where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'::uuid;

  select count(*) into second_count
  from public.cards where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'::uuid;

  if second_count <> 10 then
    raise exception 'second learner: expected 10 cards, got %', second_count;
  end if;

  if first_count <> 10 then
    raise exception 'second learner: seeding them changed learner one to % cards', first_count;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 5. RESILIENCE: a broken seed must not be able to stop somebody registering.
--    The function is redefined here with an insert that violates
--    cards_front_not_blank; the rollback at the end of this script discards the
--    redefinition along with everything else.
-- ---------------------------------------------------------------------------

create or replace function public.seed_starter_deck()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.cards (user_id, front, back) values (new.id, '   ', 'broken');
  return new;
exception
  when others then
    raise warning 'seed_starter_deck: could not seed deck for %: %', new.id, sqlerrm;
    return new;
end;
$fn$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('cccccccc-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learner-three@example.test', '', now(), now(), now());

do $$
declare
  user_rows integer;
  card_count integer;
begin
  select count(*) into user_rows
  from auth.users where id = 'cccccccc-0000-0000-0000-000000000003'::uuid;

  if user_rows <> 1 then
    raise exception 'resilience: a failing seed aborted account creation -- this would block registration outright';
  end if;

  select count(*) into card_count
  from public.cards where user_id = 'cccccccc-0000-0000-0000-000000000003'::uuid;

  if card_count <> 0 then
    raise exception 'resilience: the deliberately broken seed wrote % card(s); the test is not testing what it claims', card_count;
  end if;
end $$;

rollback;

\echo 'seed_deck.sql: all assertions passed'
