-- CEDA schema: profiles + projects
-- projects metadata columns mirror exactly what app/api/projects/route.ts selects.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Member',
  role text not null default 'submitter' check (role in ('submitter','judge','admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.projects (
  id text primary key,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  developer text,
  folder_key text not null,
  status text not null default 'submitted'
    check (status in ('submitted','review','feedback','approved','awarded','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists projects_created_at_idx on public.projects (created_at desc);
create index if not exists projects_owner_id_idx on public.projects (owner_id);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;

-- Own profile is readable/updatable by its owner; everything else goes through the
-- service role in server routes. Mirrors lib/supabase/auth-context.ts behaviour.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Signing up must create a profile row, otherwise getAuthContext() returns
-- profile: null and every authenticated route 401s.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(coalesce(new.email,'member'), '@', 1)),
    'submitter'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
