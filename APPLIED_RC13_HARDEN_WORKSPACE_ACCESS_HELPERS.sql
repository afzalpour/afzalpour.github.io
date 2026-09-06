-- Applied to Avan-production on 2026-09-06
-- Supabase migration: 20260906093436 rc13_harden_workspace_access_helpers_invoker
-- Purpose: remove unnecessary exposed SECURITY DEFINER privileges from
-- public.has_workspace_access(uuid) and public.workspace_role(uuid), while
-- keeping tenant/membership lookup behind the private schema.

grant execute on function private.tenant_access_allowed(uuid) to authenticated;

create or replace function public.has_workspace_access(wid uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.tenant_access_allowed(wid)
     and private.has_workspace_membership(wid);
$$;

revoke all on function public.has_workspace_access(uuid) from public, anon;
grant execute on function public.has_workspace_access(uuid) to authenticated, service_role;

create or replace function public.workspace_role(wid uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when public.has_workspace_access(wid) then (
      select m.role
      from public.workspace_members m
      where m.workspace_id = wid
        and m.user_id = (select auth.uid())
        and m.is_active
      limit 1
    )
    else null
  end;
$$;

revoke all on function public.workspace_role(uuid) from public, anon;
grant execute on function public.workspace_role(uuid) to authenticated, service_role;

-- Verification performed after apply:
-- 1) authorized owner -> has_workspace_access = true, workspace_role = owner
-- 2) unrelated workspace -> has_workspace_access = false, workspace_role = null
-- 3) Supabase Security Advisor no longer reports either public helper as an
--    authenticated executable SECURITY DEFINER function.
