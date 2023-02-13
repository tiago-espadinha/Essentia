-- Aurum: each signed-in user's income and expenses.
-- Run once in the Supabase SQL editor of the suite's project.
--
-- The app keeps a copy on the device and merges with this table: for each
-- transaction the newer updated_at wins. Nothing is hard-deleted by the app: a
-- deleted transaction keeps a deleted_at stamp, so other devices learn about it.

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  -- Euros; the app counts in cents, so two decimals are exact.
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  category text not null default 'other' check (char_length(category) between 1 and 40),
  -- The day the money moved, in the user's own calendar.
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index transactions_user_id_occurred_on_idx on public.transactions (user_id, occurred_on);

-- Signed-in users only, and only their own rows. The anon key alone reads nothing.
alter table public.transactions enable row level security;

revoke all on public.transactions from anon, authenticated;
grant select on public.transactions to authenticated;
-- The app sends user_id with every row, so a write made while the session has
-- switched to another account fails the checks below instead of landing there.
-- (An upsert also writes id and user_id on a conflict.) No delete grant: deletion is a stamp.
grant insert (id, user_id, description, amount, type, category, occurred_on, created_at, updated_at, deleted_at)
  on public.transactions to authenticated;
grant update (id, user_id, description, amount, type, category, occurred_on, created_at, updated_at, deleted_at)
  on public.transactions to authenticated;

create policy "Users read their own transactions" on public.transactions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own transactions" on public.transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- with check stops a row from being handed to another user, user_id included.
create policy "Users change their own transactions" on public.transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Budgets: one monthly limit per expense category. The category names the
-- budget, so two devices that set the same one meet in one row. Synced like
-- transactions: newer updated_at wins, removal is a deleted_at stamp.
create table public.budgets (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Lowercase and trimmed, as the app writes it, since it names the row.
  category text not null check (char_length(category) between 1 and 40 and category = lower(btrim(category))),
  -- Euros a month.
  amount numeric(12, 2) not null check (amount > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, category)
);

alter table public.budgets enable row level security;

revoke all on public.budgets from anon, authenticated;
grant select on public.budgets to authenticated;
grant insert (user_id, category, amount, updated_at, deleted_at) on public.budgets to authenticated;
grant update (user_id, category, amount, updated_at, deleted_at) on public.budgets to authenticated;

create policy "Users read their own budgets" on public.budgets
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own budgets" on public.budgets
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users change their own budgets" on public.budgets
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Recurring items: rent every month, a salary, a yearly fee. Synced like
-- transactions; process_due_recurring() below posts what falls due.
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description text not null check (char_length(description) between 1 and 200),
  amount numeric(12, 2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  category text not null default 'other' check (char_length(category) between 1 and 40),
  frequency text not null check (frequency in ('weekly', 'monthly', 'yearly')),
  -- The first occurrence; every later one is counted from it, in the user's own calendar.
  start_on date not null,
  paused boolean not null default false,
  -- The last pause ran from paused_on to resumed_on (still running while paused):
  -- occurrences in it are skipped, not posted late. Ones due before it still post.
  paused_on date,
  resumed_on date,
  check (not paused or paused_on is not null),
  -- Occurrences dealt with so far. Only process_due_recurring() moves it; clients
  -- cannot write it, so no device can set it back and have old occurrences walked again.
  posted integer not null default 0 check (posted >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.recurring_transactions enable row level security;

revoke all on public.recurring_transactions from anon, authenticated;
grant select on public.recurring_transactions to authenticated;
grant insert (id, user_id, description, amount, type, category, frequency, start_on, paused, paused_on, resumed_on, created_at, updated_at, deleted_at)
  on public.recurring_transactions to authenticated;
grant update (id, user_id, description, amount, type, category, frequency, start_on, paused, paused_on, resumed_on, created_at, updated_at, deleted_at)
  on public.recurring_transactions to authenticated;

create policy "Users read their own recurring items" on public.recurring_transactions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own recurring items" on public.recurring_transactions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Users change their own recurring items" on public.recurring_transactions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Each posted occurrence names its item and the day it fell due, and an item
-- posts a given day once, whatever happens to the counter. recurring_on is not
-- the row's own date: the user may move occurred_on (a payment that went out
-- late) without freeing or taking another day. The app sends neither column.
-- The key pairs the item with its owner, so a row can only name its own user's item.
alter table public.recurring_transactions add constraint recurring_transactions_id_user_id_key unique (id, user_id);
alter table public.transactions add column recurring_id uuid;
alter table public.transactions add column recurring_on date;
alter table public.transactions add constraint transactions_recurring_fkey
  foreign key (recurring_id, user_id) references public.recurring_transactions (id, user_id);
alter table public.transactions add constraint transactions_recurring_occurrence_key unique (recurring_id, recurring_on);

-- The count-th occurrence after start (0 is start itself). Months and years are
-- counted from the start, so Jan 31 monthly gives Feb 28 (29 in a leap year),
-- then Mar 31. The app's recurring.ts steps the same way.
create function public.recurring_occurrence(start date, frequency text, count integer)
returns date
language sql
immutable
set search_path = ''
as $$
  select case frequency
    when 'weekly' then start + 7 * count
    when 'monthly' then (start + make_interval(months => count))::date
    when 'yearly' then (start + make_interval(years => count))::date
  end
$$;

-- Posts every occurrence of the signed-in user's items that has fallen due by
-- p_today, the device's own calendar day, and returns how many it posted. The
-- app calls it each time it syncs; there is no scheduled job. It runs as its
-- owner, since clients may not write posted or the recurring columns, and keeps
-- itself to the caller's items. Each item is
-- locked while it is posted, so two devices opening at once post it once (the
-- second skips it). Deleted items post nothing. Occurrences from paused_on up
-- to resumed_on are skipped; while paused, the item stops at paused_on and the
-- resume decides. Each call steps through at most 1,000 occurrences per item,
-- posted or skipped, so an old start or a long pause cannot make one call run
-- long; the next call goes on from there.
create function public.process_due_recurring(p_today date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  item public.recurring_transactions%rowtype;
  due date;
  next_count integer;
  item_posted integer;
  me uuid := (select auth.uid());
  posted_now integer := 0;
begin
  -- The day differs by time zone, never by more than a day either side of the server's.
  if p_today is null or p_today not between current_date - 1 and current_date + 1 then
    raise exception 'p_today must be the device''s calendar day' using errcode = '22023';
  end if;

  for item in
    select * from public.recurring_transactions r
    where r.user_id = me
      and r.deleted_at is null
      and public.recurring_occurrence(r.start_on, r.frequency, r.posted) <= p_today
      and (not r.paused or public.recurring_occurrence(r.start_on, r.frequency, r.posted) < r.paused_on)
    for update skip locked
  loop
    next_count := item.posted;
    item_posted := 0;
    loop
      due := public.recurring_occurrence(item.start_on, item.frequency, next_count);
      exit when due > p_today or (item.paused and due >= item.paused_on) or next_count - item.posted >= 1000;
      if item.paused_on is null or due < item.paused_on or due >= coalesce(item.resumed_on, item.paused_on) then
        insert into public.transactions (user_id, description, amount, type, category, occurred_on, recurring_id, recurring_on)
        values (item.user_id, item.description, item.amount, item.type, item.category, due, item.id, due)
        on conflict (recurring_id, recurring_on) do nothing;
        if found then
          item_posted := item_posted + 1;
        end if;
      end if;
      next_count := next_count + 1;
    end loop;
    posted_now := posted_now + item_posted;
    -- updated_at stays: the counter is not part of the item the devices sync.
    update public.recurring_transactions set posted = next_count where id = item.id;
  end loop;

  return posted_now;
end
$$;

revoke all on function public.recurring_occurrence(date, text, integer) from public, anon;
revoke all on function public.process_due_recurring(date) from public, anon;
grant execute on function public.recurring_occurrence(date, text, integer) to authenticated;
grant execute on function public.process_due_recurring(date) to authenticated;
