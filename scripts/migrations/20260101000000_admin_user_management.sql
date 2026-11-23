-- CEDA admin RPCs: user directory + role management
--
-- components/insight-views.tsx calls these from the browser via
-- createClient().rpc(...), but they were never created in the database, so
-- JudgesView failed for EVERY user (admins included) with PGRST202 and the UI
-- showed the misleading "Judge roster is restricted to administrators." copy.
--
-- Both functions are SECURITY DEFINER so the caller only needs EXECUTE, not
-- SELECT/UPDATE on public.profiles (which is locked down by RLS to the owner).
-- The admin check happens INSIDE the function against auth.uid(), so a
-- non-admin calling them directly still gets rejected.

-- ---------------------------------------------------------------------------
-- admin_list_users(): the roster of every registered account.
-- ---------------------------------------------------------------------------
create or replace function public.admin_list_users()
returns table (
  user_id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only administrators may list users'
      using errcode = '42501';
  end if;

  return query
    select
      p.id,
      coalesce(u.email::text, ''),
      p.display_name,
      p.role,
      p.created_at
    from public.profiles p
    left join auth.users u on u.id = p.id
    order by
      case p.role when 'admin' then 0 when 'judge' then 1 else 2 end,
      p.created_at asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_set_user_role(): promote/demote an account.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only administrators may change roles'
      using errcode = '42501';
  end if;

  if p_role not in ('submitter', 'judge', 'admin') then
    raise exception 'Invalid role: %', p_role using errcode = '22023';
  end if;

  -- Never let an admin lock the last administrator out of the workflow.
  if p_role <> 'admin' and exists (
    select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin'
  ) and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Cannot demote the last administrator' using errcode = '42501';
  end if;

  update public.profiles
     set role = p_role
   where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- admin_rename_user(): fix a display name shown on the judge roster.
-- ---------------------------------------------------------------------------
create or replace function public.admin_rename_user(p_user_id uuid, p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only administrators may rename users' using errcode = '42501';
  end if;

  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Display name cannot be empty' using errcode = '22023';
  end if;

  update public.profiles set display_name = trim(p_display_name) where id = p_user_id;
end;
$;

-- ---------------------------------------------------------------------------
-- admin_remove_user(): revoke an account entirely (profile + auth user).
-- Guarded so an admin can neither delete themselves nor the last admin.
-- ---------------------------------------------------------------------------
create or replace function public.admin_remove_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) then
    raise exception 'Only administrators may remove users' using errcode = '42501';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot remove your own administrator account' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin')
     and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Cannot remove the last administrator' using errcode = '42501';
  end if;

  delete from auth.users where id = p_user_id;
end;
$;

revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
revoke all on function public.admin_rename_user(uuid, text) from public, anon;
revoke all on function public.admin_remove_user(uuid) from public, anon;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_rename_user(uuid, text) to authenticated;
grant execute on function public.admin_remove_user(uuid) to authenticated;

-- Keep the roster fresh for PostgREST's schema cache.
notify pgrst, 'reload schema';
