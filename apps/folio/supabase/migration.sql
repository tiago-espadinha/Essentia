-- Folio: what the unified notes add to the account. Run once in the Supabase SQL
-- editor of the suite's project, after apps/dictum/supabase/migration.sql.
--
-- Notes live in Dictum's documents table, so every row id, row level security
-- policy and share link keeps working without copying any data. This file only
-- adds: two columns on documents and a table for folders that hold no notes.
-- To revert, drop the two columns and the note_folders table; no note is lost.
-- Versions stay on the device that made them, as before.

-- Rows from before this change are Dictum's markdown documents, never pinned.
alter table public.documents
  add column format text not null default 'markdown' check (format in ('rich', 'markdown')),
  add column pinned boolean not null default false;

-- The table's other columns keep their grants; share_id still comes only from
-- share_document. Rich bodies are sanitized HTML and count toward the content limit.
grant insert (format, pinned) on public.documents to authenticated;
grant update (format, pinned) on public.documents to authenticated;

-- Folders a person keeps while they hold no notes. A folder that notes are in
-- needs no row: the notes carry its name. Like documents, nothing is hard-deleted:
-- a deleted folder keeps a deleted_at stamp so other devices learn about it, and
-- a rename is a deletion of the old name and a new row for the new one.
create table public.note_folders (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (user_id, name)
);

-- Signed-in users only, and only their own rows. The anon key alone reads nothing.
alter table public.note_folders enable row level security;

revoke all on public.note_folders from anon, authenticated;
grant select on public.note_folders to authenticated;
-- The app sends user_id with every row, so a write made while the session has
-- switched to another account fails the checks below instead of landing there.
grant insert (user_id, name, updated_at, deleted_at) on public.note_folders to authenticated;
grant update (user_id, name, updated_at, deleted_at) on public.note_folders to authenticated;

create policy "Users read their own folders" on public.note_folders
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Users add their own folders" on public.note_folders
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- with check stops a row from being handed to another user, user_id included.
create policy "Users change their own folders" on public.note_folders
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
