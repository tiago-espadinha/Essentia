-- Acta: each signed-in user's tasks.
-- Run once in the Supabase SQL editor of the suite's project.
--
-- Unlike the other apps, Acta does not merge by "newer updated_at wins". Every
-- write goes through acta_write_task with the version it was based on: the
-- server bumps the version, and a write based on an older version comes back
-- as a conflict for the person to resolve. Each write carries an operation ID,
-- so a retry after a lost response returns the first answer instead of writing
-- twice. A deleted task stays as a row with no content, so other devices learn
-- about it.

create table public.acta_tasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  id uuid not null,
  version bigint not null check (version > 0),
  -- null once deleted; otherwise { text, completed, category, due }.
  content jsonb,
  -- Orders tasks a device has not seen yet, newest first.
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  check (content is null or jsonb_typeof(content) = 'object')
);

create index acta_tasks_order_idx on public.acta_tasks (user_id, created_at desc, id);

create table public.acta_operation_receipts (
  user_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  task_id uuid not null,
  expected_version bigint not null,
  content jsonb,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

create index acta_operation_receipts_age_idx on public.acta_operation_receipts (user_id, created_at);

-- Signed-in users read only their own tasks; nobody writes the tables directly.
-- Supabase's default privileges grant every right, truncate included, which
-- ignores row level security.
alter table public.acta_tasks enable row level security;
alter table public.acta_operation_receipts enable row level security;
revoke all on public.acta_tasks, public.acta_operation_receipts from public, anon, authenticated;
grant select on public.acta_tasks to authenticated;
create policy "Users read their own Acta tasks" on public.acta_tasks
  for select to authenticated using ((select auth.uid()) = user_id);

-- p_owner is the account the device queued the write for: if the session has
-- switched to another account meanwhile, the write is refused rather than
-- landing in the wrong account.
-- A receipt binds an operation ID to its complete request, conflicts included.
-- Receipts older than 30 days are pruned; a retry that old meets the newer
-- version and comes back as a conflict, never as a duplicate.
create function public.acta_write_task(
  p_owner uuid, p_operation_id uuid, p_task_id uuid, p_expected_version bigint, p_content jsonb
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  owner_id uuid := auth.uid();
  receipt public.acta_operation_receipts%rowtype;
  current_task public.acta_tasks%rowtype;
  answer jsonb;
begin
  if owner_id is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_owner is distinct from owner_id then
    raise exception 'Wrong account' using errcode = '42501';
  end if;
  if p_operation_id is null or p_task_id is null or p_expected_version is null
     or p_expected_version < 0 or p_expected_version >= 9007199254740991 then
    raise exception 'Invalid operation' using errcode = '22023';
  end if;
  -- The same rules as isContent in src/data/syncStorage.ts; char_length counts
  -- characters, as the app does, not bytes.
  if p_content is not null and (
    jsonb_typeof(p_content) <> 'object'
    or (p_content - array['text', 'completed', 'category', 'due']) <> '{}'::jsonb
    or jsonb_typeof(p_content->'text') is distinct from 'string'
    or char_length(trim(p_content->>'text')) not between 1 and 500
    or jsonb_typeof(p_content->'completed') is distinct from 'boolean'
    or jsonb_typeof(p_content->'category') is distinct from 'string'
    or char_length(p_content->>'category') > 100
    or jsonb_typeof(p_content->'due') is distinct from 'string'
    or (p_content->>'due' <> '' and p_content->>'due' !~ '^\d{4}-\d{2}-\d{2}$')
  ) then
    raise exception 'Invalid task' using errcode = '22023';
  end if;

  -- One write per account at a time: retries and concurrent creates are serialized.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text, 0));
  delete from public.acta_operation_receipts
    where user_id = owner_id and created_at < now() - interval '30 days';

  select * into receipt from public.acta_operation_receipts
    where user_id = owner_id and operation_id = p_operation_id;
  if found then
    if receipt.task_id <> p_task_id or receipt.expected_version <> p_expected_version
       or receipt.content is distinct from p_content then
      raise exception 'Operation ID already used' using errcode = '22023';
    end if;
    return receipt.result;
  end if;

  select * into current_task from public.acta_tasks where user_id = owner_id and id = p_task_id;
  if (not found and p_expected_version <> 0)
     or (found and current_task.version <> p_expected_version) then
    answer := jsonb_build_object('status', 'conflict', 'version', coalesce(current_task.version, 0),
      'content', current_task.content, 'created_at', current_task.created_at);
  else
    insert into public.acta_tasks as task (user_id, id, version, content)
      values (owner_id, p_task_id, p_expected_version + 1, p_content)
      on conflict (user_id, id) do update set version = excluded.version, content = excluded.content
      returning * into current_task;
    answer := jsonb_build_object('status', 'applied', 'version', current_task.version,
      'content', current_task.content, 'created_at', current_task.created_at);
  end if;
  insert into public.acta_operation_receipts (user_id, operation_id, task_id, expected_version, content, result)
    values (owner_id, p_operation_id, p_task_id, p_expected_version, p_content, answer);
  return answer;
end;
$$;

revoke all on function public.acta_write_task(uuid, uuid, uuid, bigint, jsonb) from public, anon, authenticated;
grant execute on function public.acta_write_task(uuid, uuid, uuid, bigint, jsonb) to authenticated;
