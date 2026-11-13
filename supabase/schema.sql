-- ============================================================
-- KDS FLUX — Supabase schema
-- Run this in Supabase Studio → SQL Editor.
-- Uses the public.boards / public.folders tables for cloud sync.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Profiles
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  organization_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Existing installations: add the column created by the multi-organization update.
alter table public.profiles add column if not exists organization_name text;

-- ------------------------------------------------------------
-- Folders
-- ------------------------------------------------------------
create table if not exists public.folders (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_owner_idx on public.folders (owner_id, created_at);

-- ------------------------------------------------------------
-- Boards (document = the complete board JSON)
-- ------------------------------------------------------------
create table if not exists public.boards (
  id text primary key,
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Board sem título',
  folder_id text references public.folders (id) on delete set null,
  document jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  share_token text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists boards_owner_idx on public.boards (owner_id, updated_at desc);
create index if not exists boards_folder_idx on public.boards (folder_id);

-- ------------------------------------------------------------
-- Optional collaborators (ready for shared boards)
-- ------------------------------------------------------------
create table if not exists public.board_members (
  board_id text not null references public.boards (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'editor' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

create index if not exists board_members_user_idx on public.board_members (user_id);

-- ------------------------------------------------------------
-- API tokens for the MCP server
-- ------------------------------------------------------------
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'MCP token',
  token_hash text not null unique,
  prefix text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists api_tokens_owner_idx on public.api_tokens (owner_id, created_at desc);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists folders_touch on public.folders;
create trigger folders_touch before update on public.folders
for each row execute function public.touch_updated_at();

drop trigger if exists boards_touch on public.boards;
create trigger boards_touch before update on public.boards
for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- Auto-create a profile for every new auth user
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, organization_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'organization_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.folders enable row level security;
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.api_tokens enable row level security;

-- Security-definer helpers: these read the tables with RLS bypassed, which
-- avoids "infinite recursion detected in policy" between boards and
-- board_members (each policy would otherwise query the other table).
create or replace function public.board_is_owned_by(b_id text, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.boards b where b.id = b_id and b.owner_id = u_id
  );
$$;

create or replace function public.board_member_can_edit(b_id text, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.board_members m
    where m.board_id = b_id and m.user_id = u_id and m.role = 'editor'
  );
$$;

create or replace function public.board_member_can_read(b_id text, u_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.board_members m where m.board_id = b_id and m.user_id = u_id
  );
$$;

grant execute on function public.board_is_owned_by(text, uuid) to anon, authenticated;
grant execute on function public.board_member_can_edit(text, uuid) to anon, authenticated;
grant execute on function public.board_member_can_read(text, uuid) to anon, authenticated;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles self write" on public.profiles;
create policy "profiles self write" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "folders owner all" on public.folders;
create policy "folders owner all" on public.folders
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "boards owner all" on public.boards;
create policy "boards owner all" on public.boards
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "boards members read" on public.boards;
create policy "boards members read" on public.boards
for select using (public.board_member_can_read(boards.id, auth.uid()));

drop policy if exists "boards members write" on public.boards;
create policy "boards members write" on public.boards
for update using (public.board_member_can_edit(boards.id, auth.uid()))
with check (public.board_member_can_edit(boards.id, auth.uid()));

drop policy if exists "boards public read" on public.boards;
create policy "boards public read" on public.boards
for select using (is_public = true);

drop policy if exists "board_members read" on public.board_members;
create policy "board_members read" on public.board_members
for select using (
  user_id = auth.uid()
  or public.board_is_owned_by(board_members.board_id, auth.uid())
);

drop policy if exists "board_members owner write" on public.board_members;
create policy "board_members owner write" on public.board_members
for all using (public.board_is_owned_by(board_members.board_id, auth.uid()))
with check (public.board_is_owned_by(board_members.board_id, auth.uid()));

drop policy if exists "api_tokens owner all" on public.api_tokens;
create policy "api_tokens owner all" on public.api_tokens
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ------------------------------------------------------------
-- Grants (Supabase usually sets these; explicit for self-hosted)
-- ------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.folders to authenticated;
grant select, insert, update, delete on public.boards to authenticated;
grant select on public.boards to anon;
grant select, insert, update, delete on public.board_members to authenticated;
grant select, insert, update, delete on public.api_tokens to authenticated;

-- ------------------------------------------------------------
-- Realtime (board row changes; enable if not already published)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'boards'
  ) then
    execute 'alter publication supabase_realtime add table public.boards';
  end if;
end;
$$;
