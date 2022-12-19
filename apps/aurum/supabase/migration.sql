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
