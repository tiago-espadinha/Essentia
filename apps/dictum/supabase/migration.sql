-- Dictum: each signed-in user's documents, and read-only links to share them.
-- Run once in the Supabase SQL editor of the suite's project.
--
-- The app keeps working on the device and merges with this table: for each
-- document the newer updated_at wins. Nothing is hard-deleted by the app: a
-- deleted document keeps a deleted_at stamp, so other devices learn about it.
-- Saved versions stay on the device that made them.

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 300),
  -- Markdown source; about 1 MB, far past any one document.
  content text not null default '' check (char_length(content) <= 1000000),
  -- '' means unfiled.
  folder text not null default '' check (char_length(folder) <= 100),
  tags text[] not null default '{}' check (cardinality(tags) <= 50),
  -- Set only by share_document, below; null while the document is not shared.
  share_id uuid unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index documents_user_id_idx on public.documents (user_id);

-- Signed-in users only, and only their own rows. The anon key alone reads nothing.
alter table public.documents enable row level security;

revoke all on public.documents from anon, authenticated;
grant select on public.documents to authenticated;
-- Column grants: share_id comes from the functions below, so a client cannot set
-- it. The app sends user_id with every row, so a write made while the session has
-- switched to another account fails the checks below instead of landing there.
-- (An upsert also writes id and user_id on a conflict.)
grant insert (id, user_id, title, content, folder, tags, created_at, updated_at, deleted_at)
  on public.documents to authenticated;
grant update (id, user_id, title, content, folder, tags, created_at, updated_at, deleted_at)
  on public.documents to authenticated;

create policy "Users read their own documents" on public.documents
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own documents" on public.documents
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- with check stops a row from being handed to another user, user_id included.
create policy "Users change their own documents" on public.documents
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Sharing. There is no policy that lets anyone read shared rows: a link holder
-- gets one document through get_shared_document, and only its title, text and
-- date, never the owner or the other documents.

-- Shares one of the caller's documents and returns its link id; a shared
-- document keeps the id it has. Null when the caller has no such document.
create function public.share_document(document_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  update public.documents
  set share_id = coalesce(share_id, gen_random_uuid())
  where id = document_id and user_id = (select auth.uid()) and deleted_at is null
  returning share_id;
$$;

-- Stops sharing one of the caller's documents: the old link stops working, and
-- sharing again makes a new one.
create function public.unshare_document(document_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.documents
  set share_id = null
  where id = document_id and user_id = (select auth.uid());
$$;

-- The shared document behind a link, for anyone holding it. A deleted document
-- or a stopped share returns nothing, the same as an id that never existed.
create function public.get_shared_document(link_id uuid)
returns table (title text, content text, updated_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.title, d.content, d.updated_at
  from public.documents d
  where d.share_id = link_id and d.deleted_at is null;
$$;

-- Functions are executable by everyone unless revoked, and Supabase's default
-- privileges also grant them to anon and authenticated directly.
revoke all on function public.share_document(uuid), public.unshare_document(uuid), public.get_shared_document(uuid)
  from public, anon, authenticated;
grant execute on function public.share_document(uuid), public.unshare_document(uuid) to authenticated;
grant execute on function public.get_shared_document(uuid) to anon, authenticated;
