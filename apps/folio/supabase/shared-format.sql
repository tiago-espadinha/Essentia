-- Folio: shared notes say how their body is written. Run once in the Supabase
-- SQL editor of the suite's project, after migration.sql in this folder.
--
-- A shared rich note's body is HTML, so the reader has to know to clean it
-- before showing it, and a markdown note's body is rendered as markdown. The
-- function still returns only what the link shows: never the owner, the tags,
-- the folder or the other notes. A postgres function cannot change what it
-- returns in place, so it is dropped and made again, with the same rights.
-- To revert, drop the function again and run the get_shared_document part of
-- apps/dictum/supabase/migration.sql, with its revoke and grant.

begin;

drop function public.get_shared_document(uuid);

-- The shared note behind a link, for anyone holding it. A deleted note or a
-- stopped share returns nothing, the same as an id that never existed.
create function public.get_shared_document(link_id uuid)
returns table (title text, content text, format text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.title, d.content, d.format, d.updated_at
  from public.documents d
  where d.share_id = link_id and d.deleted_at is null;
$$;

-- Functions are executable by everyone unless revoked, and Supabase's default
-- privileges also grant them to anon and authenticated directly.
revoke all on function public.get_shared_document(uuid) from public, anon, authenticated;
grant execute on function public.get_shared_document(uuid) to anon, authenticated;

commit;
