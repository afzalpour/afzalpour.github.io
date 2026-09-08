-- Applied to Avan-production as migration rc1_5_c1_3_platform_user_admin_guard.
-- Public wrappers remain SECURITY INVOKER; privileged reads/writes are private and platform-admin gated.

begin;

create or replace function private.platform_admin_user_guard_impl(p_target_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_owned integer;
  v_memberships integer;
  v_is_platform_admin boolean;
  v_exists boolean;
begin
  v_actor := private.require_platform_admin();

  select exists(select 1 from auth.users u where u.id=p_target_user_id)
    into v_exists;
  if not v_exists then
    raise exception 'PLATFORM_USER_NOT_FOUND';
  end if;

  select count(*)::integer into v_owned
  from public.workspaces w
  where w.owner_user_id=p_target_user_id;

  select count(*)::integer into v_memberships
  from public.workspace_members m
  where m.user_id=p_target_user_id and m.is_active;

  select exists(
    select 1 from private.platform_admins pa
    where pa.user_id=p_target_user_id and pa.is_active
  ) into v_is_platform_admin;

  return jsonb_build_object(
    'target_user_id',p_target_user_id,
    'is_self',(p_target_user_id=v_actor),
    'owned_companies',v_owned,
    'active_memberships',v_memberships,
    'is_platform_admin',v_is_platform_admin,
    'can_delete',(
      p_target_user_id<>v_actor
      and v_owned=0
      and not v_is_platform_admin
    )
  );
end;
$$;
revoke all on function private.platform_admin_user_guard_impl(uuid) from public, anon;
grant execute on function private.platform_admin_user_guard_impl(uuid) to authenticated;

create or replace function public.platform_admin_user_guard(p_target_user_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.platform_admin_user_guard_impl(p_target_user_id); $$;
revoke all on function public.platform_admin_user_guard(uuid) from public, anon;
grant execute on function public.platform_admin_user_guard(uuid) to authenticated;

create or replace function private.platform_admin_log_user_action_impl(
  p_target_user_id uuid,
  p_action text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_summary text;
begin
  v_actor := private.require_platform_admin();

  if p_action='platform_user_updated' then
    v_summary := 'Platform user account updated';
  elsif p_action='platform_user_deleted' then
    v_summary := 'Platform user account deleted';
  else
    raise exception 'PLATFORM_USER_ACTION_INVALID';
  end if;

  insert into private.platform_audit_logs(actor_user_id,action,summary,metadata)
  values(
    v_actor,
    p_action,
    v_summary,
    jsonb_build_object('target_user_id',p_target_user_id)
  );

  return true;
end;
$$;
revoke all on function private.platform_admin_log_user_action_impl(uuid,text) from public, anon;
grant execute on function private.platform_admin_log_user_action_impl(uuid,text) to authenticated;

create or replace function public.platform_admin_log_user_action(
  p_target_user_id uuid,
  p_action text
)
returns boolean
language sql
security invoker
set search_path = ''
as $$ select private.platform_admin_log_user_action_impl(p_target_user_id,p_action); $$;
revoke all on function public.platform_admin_log_user_action(uuid,text) from public, anon;
grant execute on function public.platform_admin_log_user_action(uuid,text) to authenticated;

notify pgrst, 'reload schema';
commit;
