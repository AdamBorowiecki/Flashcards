-- Proof that public.cards isolates learners from each other (roadmap F-01).
--
-- This is the one property a manual click-through cannot show, so it is executable.
-- Every assertion raises an exception on failure, which makes the whole script exit
-- non-zero rather than printing a table somebody has to interpret.
--
-- Run it against the LOCAL stack only -- it creates users and rows:
--
--   npx supabase start
--   npx supabase db reset
--   docker exec -i supabase_db_10x-astro-starter \
--     psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f - < supabase/tests/cards_rls.sql
--
-- or, if psql is on PATH:
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--     -v ON_ERROR_STOP=1 -f supabase/tests/cards_rls.sql
--
-- Everything happens inside a transaction that is rolled back at the end, so a run
-- leaves no trace even on the local database.

-- What this script catches, and what it does not -- established by deliberately
-- weakening each policy in turn against a throwaway local database:
--
--   * cards_select_own broken -> assertion 1 fails; it sees 2 rows where it demands 1
--   * cards_insert_own broken -> assertion 3 fails
--   * cards_update_own broken, either half, on its own -> nothing fails
--
-- That last line is not a gap in the coverage. An UPDATE has to read the rows it
-- targets, and Postgres applies the SELECT policy both to those rows and to the row
-- the update leaves behind, so with cards_select_own intact a broken update policy
-- does not actually let a learner reach another learner's cards. The consequence
-- worth remembering: cards_select_own carries this table's isolation almost
-- single-handedly, and assertion 1 is the tripwire that catches it going wrong.
--
\set ON_ERROR_STOP on

begin;

-- ---------------------------------------------------------------------------
-- Fixtures: two learners, one card each. Created as the superuser, before any
-- role switch, because auth.users is not writable by `authenticated`.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learner-a@example.test', '', now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'learner-b@example.test', '', now(), now(), now());

insert into public.cards (user_id, front, back)
values
  ('11111111-1111-1111-1111-111111111111', 'la pomme', 'the apple'),
  ('22222222-2222-2222-2222-222222222222', 'der Apfel', 'the apple');

-- ---------------------------------------------------------------------------
-- Act as learner A. Connecting as the postgres superuser bypasses RLS entirely,
-- so without this role switch every assertion below would pass while proving
-- nothing at all.
-- ---------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- 1. POSITIVE: A sees exactly their own row.
--    This one comes first and must pass. Every assertion after it is also
--    satisfied by an empty table, so without this they prove nothing.
do $$
declare
  visible_count integer;
  visible_owner uuid;
begin
  select count(*) into visible_count from public.cards;
  if visible_count <> 1 then
    raise exception 'positive read: learner A should see exactly 1 card, saw %', visible_count;
  end if;

  select user_id into visible_owner from public.cards;
  if visible_owner <> '11111111-1111-1111-1111-111111111111'::uuid then
    raise exception 'positive read: the visible card belongs to %, not to learner A', visible_owner;
  end if;
end $$;

-- 2. Cross-learner read returns nothing.
do $$
declare
  leaked integer;
begin
  select count(*) into leaked
  from public.cards
  where user_id = '22222222-2222-2222-2222-222222222222'::uuid;

  if leaked <> 0 then
    raise exception 'cross-learner read: learner A saw % of learner B''s cards', leaked;
  end if;
end $$;

-- 3. Cross-learner insert is rejected by the insert policy's WITH CHECK.
do $$
begin
  insert into public.cards (user_id, front, back)
  values ('22222222-2222-2222-2222-222222222222', 'smuggled', 'row');

  raise exception 'cross-learner insert: RLS allowed learner A to create a card owned by learner B';
exception
  when insufficient_privilege then
    null; -- expected: "new row violates row-level security policy"
end $$;

-- 4. Cross-learner update touches no rows -- B's card is invisible to the UPDATE.
--    Defence in depth, not an independent guard: an UPDATE ... WHERE has to read
--    its target rows, so the SELECT policy applies to it too. With cards_select_own
--    intact this assertion passes even if cards_update_own's USING half is broken
--    -- both must fail before it fires. Assertion 2 is what actually proves the read
--    side; this one guards the case where a future change loosens the select policy.
do $$
declare
  affected integer;
begin
  update public.cards
  set front = 'hijacked'
  where user_id = '22222222-2222-2222-2222-222222222222'::uuid;

  get diagnostics affected = row_count;

  if affected <> 0 then
    raise exception 'cross-learner update: learner A modified % of learner B''s rows', affected;
  end if;
end $$;

-- 4b. A learner cannot hand their own card to somebody else -- the WITH CHECK half
--     of cards_update_own. Defence in depth like assertion 4, and for the same
--     reason: measured against this schema, weakening only that WITH CHECK does not
--     let the reassignment through, because cards_select_own is applied to the
--     post-update row as well. It takes a loose select policy before this one fires.
do $$
begin
  update public.cards
  set user_id = '22222222-2222-2222-2222-222222222222'::uuid
  where user_id = '11111111-1111-1111-1111-111111111111'::uuid;

  raise exception 'reassignment: RLS allowed learner A to give their card to learner B';
exception
  when insufficient_privilege then
    null; -- expected: "new row violates row-level security policy"
end $$;

-- 5. A signed-out request carries no sub claim, so auth.uid() is NULL, every
--    policy predicate is false, and the table reads as empty.
set local request.jwt.claims = '';

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.cards;
  if visible_count <> 0 then
    raise exception 'anonymous read: a claimless request saw % cards, expected 0', visible_count;
  end if;
end $$;

-- 6. The anon role is what an unauthenticated PostgREST request actually runs as.
--    It holds no grant on public.cards, so the expected outcome is a hard
--    permission denial; zero rows would also be acceptable.
set local role anon;

do $$
declare
  visible_count integer;
begin
  select count(*) into visible_count from public.cards;
  if visible_count <> 0 then
    raise exception 'anon role read: saw % cards, expected 0', visible_count;
  end if;
exception
  when insufficient_privilege then
    null; -- expected: no grant on public.cards for anon
end $$;

reset role;

rollback;

\echo 'cards_rls.sql: all assertions passed'
