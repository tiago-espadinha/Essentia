-- Acta: tasks can carry a priority. Run once in the Supabase SQL editor of the
-- suite's project, after migration.sql in this folder.
--
-- A task's content may now hold "priority": "low", "medium" or "high". A task
-- with no priority leaves the key out, so content written before this file,
-- and by devices that have not updated yet, stays valid. Only the validation
-- in acta_write_task changes; the tables, receipts and rights are as before.
-- Run it before deploying a version of Acta that sets priorities: until then
-- such a write is refused and holds back the account's later changes. To
-- revert, first deploy a version that does not set priorities, then run the
-- acta_write_task part of migration.sql again with "create or replace".

begin;

-- p_owner is the account the device queued the write for: if the session has
-- switched to another account meanwhile, the write is refused rather than
-- landing in the wrong account.
-- A receipt binds an operation ID to its complete request, conflicts included.
-- Receipts older than 30 days are pruned; a retry that old meets the newer
-- version and comes back as a conflict, never as a duplicate.
create or replace function public.acta_write_task(
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
  -- characters, as the app does, not bytes. priority is optional: absent means none.
  if p_content is not null and (
    jsonb_typeof(p_content) <> 'object'
    or (p_content - array['text', 'completed', 'category', 'due', 'priority']) <> '{}'::jsonb
    or jsonb_typeof(p_content->'text') is distinct from 'string'
    or char_length(trim(p_content->>'text')) not between 1 and 500
    or jsonb_typeof(p_content->'completed') is distinct from 'boolean'
    or jsonb_typeof(p_content->'category') is distinct from 'string'
    or char_length(p_content->>'category') > 100
    or jsonb_typeof(p_content->'due') is distinct from 'string'
    or (p_content->>'due' <> '' and p_content->>'due' !~ '^\d{4}-\d{2}-\d{2}$')
    or (p_content ? 'priority' and (jsonb_typeof(p_content->'priority') is distinct from 'string'
        or p_content->>'priority' not in ('low', 'medium', 'high')))
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

commit;
