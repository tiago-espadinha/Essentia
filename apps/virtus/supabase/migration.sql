-- Virtus: each signed-in user's habits and daily check-ins.
-- Run once in the Supabase SQL editor of the suite's project.
--
-- The app keeps working on the device and merges with these tables: for each
-- habit and each check-in the newer updated_at wins. Nothing is hard-deleted by
-- the app: a deleted habit keeps a deleted_at stamp and a cleared check-in is
-- stored as value 0, so other devices learn about the change.

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  category text not null check (char_length(category) between 1 and 50),
  -- 0 = Sunday ... 6 = Saturday; empty means every day.
  days smallint[] not null default '{}' check (days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  -- '' for a yes/no habit, else the unit a numeric habit is logged in.
  unit text not null default '' check (char_length(unit) <= 30),
  target numeric check (target > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index habits_user_id_idx on public.habits (user_id);

create table public.check_ins (
  habit_id uuid not null references public.habits (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- The app keeps no day before 2000 (FIRST_DAY in src/storage.ts).
  day date not null check (day >= '2000-01-01'),
  value numeric not null check (value >= 0),
  updated_at timestamptz not null default now(),
  primary key (habit_id, day)
);

create index check_ins_user_id_idx on public.check_ins (user_id);

-- Signed-in users only, and only their own rows. The anon key alone reads nothing.
alter table public.habits enable row level security;
alter table public.check_ins enable row level security;

-- Supabase's default privileges grant every right, truncate included, which
-- ignores row level security; the app needs only these four.
revoke all on public.habits, public.check_ins from anon, authenticated;
grant select, insert, update, delete on public.habits, public.check_ins to authenticated;

create policy "Users read their own habits" on public.habits
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own habits" on public.habits
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- with check stops a row from being handed to another user.
create policy "Users change their own habits" on public.habits
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users delete their own habits" on public.habits
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users read their own check-ins" on public.check_ins
  for select to authenticated using ((select auth.uid()) = user_id);

-- A check-in must also point at one of the user's own habits, so nobody can
-- log into someone else's habit by guessing its id.
create policy "Users add check-ins to their own habits" on public.check_ins
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );

create policy "Users change check-ins on their own habits" on public.check_ins
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );

create policy "Users delete their own check-ins" on public.check_ins
  for delete to authenticated using ((select auth.uid()) = user_id);
