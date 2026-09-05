-- Card storage with per-learner isolation (roadmap F-01).
--
-- Deliberately carries no scheduling state: Open Roadmap Question 5 -- which SRS
-- scheme sets the next due date -- is unresolved and blocks S-02. Whatever
-- per-card state the chosen scheme needs arrives with that slice, not here.

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  front text not null,
  back text not null,
  next_review_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint cards_front_not_blank check (btrim(front) <> ''),
  constraint cards_back_not_blank check (btrim(back) <> '')
);

comment on table public.cards is
  'Flashcards owned by a single learner. Row access is enforced by RLS, never in application code.';

comment on column public.cards.next_review_at is
  'When the card next becomes due. Defaults to now() so a newly created or seeded card surfaces immediately.';

-- Every due-queue query is "my cards, due before now, soonest first".
create index cards_user_id_next_review_at_idx
  on public.cards (user_id, next_review_at);

-- RLS filters rows; it does not grant access to the table. Without this grant the
-- failure is "permission denied for table cards", which reads like a broken policy
-- and sends you off rewriting policies that were correct all along.
grant select, insert, update, delete on public.cards to authenticated;

alter table public.cards enable row level security;

create policy cards_select_own on public.cards
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy cards_insert_own on public.cards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Both halves matter: "using" decides which rows may be updated, "with check"
-- stops a learner from reassigning a row to somebody else.
create policy cards_update_own on public.cards
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy cards_delete_own on public.cards
  for delete
  to authenticated
  using (auth.uid() = user_id);
