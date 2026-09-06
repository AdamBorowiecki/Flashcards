-- Starter deck on first login (roadmap S-01, PRD FR-005).
--
-- Every learner's account arrives with a ten-card deck already in it, so the
-- review loop is reachable without authoring anything. Provisioning lives in the
-- database rather than in application code, for the same reason isolation does:
-- a call site can forget, a trigger cannot.
--
-- Carries no scheduling state. Seeded cards take next_review_at's default of
-- now() and are therefore due immediately. Open Roadmap Question 5 -- which SRS
-- scheme sets the next due date -- stays open and still blocks S-02.

-- The deck itself, defined in exactly one place. Both the trigger and the
-- backfill below select from this function, so the vocabulary cannot drift
-- between them. Changing the starter deck later means replacing this function.
create function public.starter_deck()
returns table (front text, back text)
language sql
immutable
as $$
  select *
  from (values
    ('apple', 'jabłko'),
    ('bread', 'chleb'),
    ('water', 'woda'),
    ('house', 'dom'),
    ('dog', 'pies'),
    ('book', 'książka'),
    ('morning', 'rano'),
    ('thank you', 'dziękuję'),
    ('friend', 'przyjaciel'),
    ('to read', 'czytać')
  ) as deck(front, back)
$$;

comment on function public.starter_deck() is
  'The built-in starter deck (FR-005). Single source of the seed vocabulary -- the signup trigger and the backfill both read it.';

-- Runs as its owner, so it writes past RLS without this project ever needing a
-- service-role key. `set search_path = ''` is the standard hardening against a
-- caller shadowing a name to hijack an elevated function; the cost is that
-- nothing resolves unqualified, so every reference below is schema-qualified.
create function public.seed_starter_deck()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Idempotency. A learner who already has cards is left alone, which makes
  -- this safe to re-run and safe to backfill.
  if exists (select 1 from public.cards where user_id = new.id) then
    return new;
  end if;

  insert into public.cards (user_id, front, back)
  select new.id, deck.front, deck.back
  from public.starter_deck() as deck;

  return new;
exception
  -- The handler is the feature, not defensive noise. This function runs inside
  -- the signup transaction: an unhandled error here aborts account creation and
  -- reaches the user as "Database error saving new user", which names neither
  -- the trigger nor the constraint. A convenience feature must never be able to
  -- stop someone registering, so a failure logs and yields an empty deck.
  when others then
    raise warning 'seed_starter_deck: could not seed deck for %: %', new.id, sqlerrm;
    return new;
end;
$$;

comment on function public.seed_starter_deck() is
  'Signup trigger: gives a new learner the starter deck. Never raises -- a seeding failure logs a warning and lets account creation proceed.';

create trigger on_auth_user_created_seed_deck
  after insert on auth.users
  for each row
  execute function public.seed_starter_deck();

-- One-off backfill for accounts that predate this migration. The `not exists`
-- guard is what makes the statement idempotent, which matters less here than on
-- the day somebody re-runs it by hand against a database that already has decks.
insert into public.cards (user_id, front, back)
select u.id, deck.front, deck.back
from auth.users u
cross join public.starter_deck() as deck
where not exists (
  select 1 from public.cards c where c.user_id = u.id
);
