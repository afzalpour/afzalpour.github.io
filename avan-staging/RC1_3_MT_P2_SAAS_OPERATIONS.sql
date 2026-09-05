begin;

alter table private.platform_tenants
  add column if not exists plan_code text not null default 'core',
  add column if not exists member_limit integer not null default 10,
  add column if not exists onboarding_state text not null default 'completed',
  add column if not exists support_state text not null default 'none',
  add column if not exists last_reason text null,
  add column if not exists last_changed_by uuid null references auth.users(id),
  add column if not exists last_changed_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='platform_tenants_plan_code_check'
  ) then
    alter table private.platform_tenants
      add constraint platform_tenants_plan_code_check
      check (plan_code in ('trial','core','pro','enterprise','custom'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='platform_tenants_member_limit_check'
  ) then
    alter table private.platform_tenants
      add constraint platform_tenants_member_limit_check
      check (member_limit between 1 and 10000);
  end if;
  if not exists (
    select 1 from pg_constraint where conname='platform_tenants_onboarding_state_check'
  ) then
    alter table private.platform_tenants
      add constraint platform_tenants_onboarding_state_check
      check (onboarding_state in ('not_started','in_progress','blocked','ready','completed'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname='platform_tenants_support_state_check'
  ) then
    alter table private.platform_tenants
      add constraint platform_tenants_support_state_check
      check (support_state in ('none','open','in_progress','waiting_customer','resolved'));
  end if;
end $$;

create or replace function private.tenant_access_allowed(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select pt.status in ('active','onboarding')
    from private.platform_tenants pt
    where pt.workspace_id=p_workspace_id
  ), false);
$$;
revoke all on function private.tenant_access_allowed(uuid) from public, anon, authenticated;

create or replace function private.has_workspace_membership(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists(
    select 1
    from public.workspace_members m
    where m.workspace_id=p_workspace_id
      and m.user_id=(select auth.uid())
      and m.is_active
  );
$$;
revoke all on function private.has_workspace_membership(uuid) from public, anon;
grant execute on function private.has_workspace_membership(uuid) to authenticated;

create or replace function public.has_workspace_access(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.tenant_access_allowed(wid)
     and exists(
       select 1
       from public.workspace_members m
       where m.workspace_id=wid
         and m.user_id=(select auth.uid())
         and m.is_active
     );
$$;
revoke execute on function public.has_workspace_access(uuid) from public, anon;
grant execute on function public.has_workspace_access(uuid) to authenticated;

create or replace function public.workspace_role(wid uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.tenant_access_allowed(wid) then (
    select m.role
    from public.workspace_members m
    where m.workspace_id=wid
      and m.user_id=(select auth.uid())
      and m.is_active
    limit 1
  ) else null end;
$$;
revoke execute on function public.workspace_role(uuid) from public, anon;
grant execute on function public.workspace_role(uuid) to authenticated;

drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select
on public.workspaces
for select
to authenticated
using ((select private.has_workspace_membership(id)));

create or replace function private.my_company_portfolio_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id',w.id,
        'name',w.name,
        'mode',w.mode,
        'base_currency',w.base_currency,
        'created_at',w.created_at,
        'role',m.role,
        'status',pt.status,
        'access_allowed',(pt.status in ('active','onboarding')),
        'plan_code',pt.plan_code,
        'display_name',coalesce(p.display_name,w.name),
        'legal_name',coalesce(p.legal_name,'')
      ) order by w.created_at asc
    )
    from public.workspace_members m
    join public.workspaces w on w.id=m.workspace_id
    join private.platform_tenants pt on pt.workspace_id=w.id
    left join public.workspace_print_profiles p on p.workspace_id=w.id
    where m.user_id=v_uid and m.is_active
  ),'[]'::jsonb);
end;
$$;
revoke all on function private.my_company_portfolio_impl() from public, anon;
grant execute on function private.my_company_portfolio_impl() to authenticated;

create or replace function public.my_company_portfolio()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.my_company_portfolio_impl(); $$;
revoke all on function public.my_company_portfolio() from public, anon;
grant execute on function public.my_company_portfolio() to authenticated;

create or replace function private.platform_admin_update_tenant_impl(
  p_company_id uuid,
  p_status text,
  p_plan_code text,
  p_member_limit integer,
  p_onboarding_state text,
  p_support_state text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_actor_role text;
  v_old private.platform_tenants%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
begin
  v_uid := private.require_platform_admin();

  select pa.role into v_actor_role
  from private.platform_admins pa
  where pa.user_id=v_uid and pa.is_active;

  if p_status not in ('onboarding','active','suspended','archived') then
    raise exception 'TENANT_STATUS_INVALID';
  end if;
  if p_plan_code not in ('trial','core','pro','enterprise','custom') then
    raise exception 'TENANT_PLAN_INVALID';
  end if;
  if p_member_limit is null or p_member_limit < 1 or p_member_limit > 10000 then
    raise exception 'TENANT_MEMBER_LIMIT_INVALID';
  end if;
  if p_onboarding_state not in ('not_started','in_progress','blocked','ready','completed') then
    raise exception 'TENANT_ONBOARDING_STATE_INVALID';
  end if;
  if p_support_state not in ('none','open','in_progress','waiting_customer','resolved') then
    raise exception 'TENANT_SUPPORT_STATE_INVALID';
  end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 500 then
    raise exception 'TENANT_REASON_REQUIRED';
  end if;
  if p_status='archived' and v_actor_role <> 'platform_owner' then
    raise exception 'PLATFORM_OWNER_REQUIRED';
  end if;

  select * into v_old
  from private.platform_tenants pt
  where pt.workspace_id=p_company_id
  for update;
  if not found then raise exception 'TENANT_NOT_FOUND'; end if;

  update private.platform_tenants
     set status=p_status,
         plan_code=p_plan_code,
         member_limit=p_member_limit,
         onboarding_state=p_onboarding_state,
         support_state=p_support_state,
         last_reason=v_reason,
         last_changed_by=v_uid,
         last_changed_at=now(),
         updated_at=now()
   where workspace_id=p_company_id;

  insert into private.platform_audit_logs(
    actor_user_id,action,tenant_id,summary,metadata
  ) values(
    v_uid,
    'tenant_operations_updated',
    p_company_id,
    'Tenant operational settings updated',
    jsonb_build_object(
      'reason',v_reason,
      'before',jsonb_build_object(
        'status',v_old.status,
        'plan_code',v_old.plan_code,
        'member_limit',v_old.member_limit,
        'onboarding_state',v_old.onboarding_state,
        'support_state',v_old.support_state
      ),
      'after',jsonb_build_object(
        'status',p_status,
        'plan_code',p_plan_code,
        'member_limit',p_member_limit,
        'onboarding_state',p_onboarding_state,
        'support_state',p_support_state
      )
    )
  );

  return jsonb_build_object(
    'company_id',p_company_id,
    'status',p_status,
    'plan_code',p_plan_code,
    'member_limit',p_member_limit,
    'onboarding_state',p_onboarding_state,
    'support_state',p_support_state,
    'access_allowed',(p_status in ('active','onboarding')),
    'updated',true
  );
end;
$$;
revoke all on function private.platform_admin_update_tenant_impl(uuid,text,text,integer,text,text,text) from public, anon;
grant execute on function private.platform_admin_update_tenant_impl(uuid,text,text,integer,text,text,text) to authenticated;

create or replace function public.platform_admin_update_tenant(
  p_company_id uuid,
  p_status text,
  p_plan_code text,
  p_member_limit integer,
  p_onboarding_state text,
  p_support_state text,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.platform_admin_update_tenant_impl(
    p_company_id,p_status,p_plan_code,p_member_limit,
    p_onboarding_state,p_support_state,p_reason
  );
$$;
revoke all on function public.platform_admin_update_tenant(uuid,text,text,integer,text,text,text) from public, anon;
grant execute on function public.platform_admin_update_tenant(uuid,text,text,integer,text,text,text) to authenticated;

create or replace function private.platform_admin_companies_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'company_id',w.id,
        'name',w.name,
        'display_name',coalesce(p.display_name,w.name),
        'legal_name',p.legal_name,
        'status',pt.status,
        'access_allowed',(pt.status in ('active','onboarding')),
        'plan_code',pt.plan_code,
        'member_limit',pt.member_limit,
        'onboarding_state',pt.onboarding_state,
        'support_state',pt.support_state,
        'last_reason',pt.last_reason,
        'last_changed_at',pt.last_changed_at,
        'registry_state',case
          when w.owner_user_id is null then 'missing_owner'
          when u.id is null then 'missing_owner_user'
          else 'ok'
        end,
        'owner_email',u.email,
        'active_members',(
          select count(*) from public.workspace_members m
          where m.workspace_id=w.id and m.is_active
        ),
        'created_at',w.created_at,
        'updated_at',pt.updated_at
      )
      order by w.created_at desc nulls last
    )
    from private.platform_tenants pt
    join public.workspaces w on w.id=pt.workspace_id
    left join auth.users u on u.id=w.owner_user_id
    left join public.workspace_print_profiles p on p.workspace_id=w.id
  ),'[]'::jsonb);
end;
$$;
revoke all on function private.platform_admin_companies_impl() from public, anon;
grant execute on function private.platform_admin_companies_impl() to authenticated;

create or replace function private.platform_admin_overview_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'companies_total',(select count(*) from private.platform_tenants),
    'companies_active',(select count(*) from private.platform_tenants where status='active'),
    'companies_onboarding',(select count(*) from private.platform_tenants where status='onboarding'),
    'companies_suspended',(select count(*) from private.platform_tenants where status='suspended'),
    'companies_archived',(select count(*) from private.platform_tenants where status='archived'),
    'support_open',(select count(*) from private.platform_tenants where support_state in ('open','in_progress','waiting_customer')),
    'onboarding_blocked',(select count(*) from private.platform_tenants where onboarding_state='blocked'),
    'users_total',(select count(*) from auth.users),
    'active_memberships',(select count(*) from public.workspace_members where is_active),
    'platform_admins_active',(select count(*) from private.platform_admins where is_active),
    'generated_at',now()
  );
end;
$$;
revoke all on function private.platform_admin_overview_impl() from public, anon;
grant execute on function private.platform_admin_overview_impl() to authenticated;

notify pgrst, 'reload schema';
commit;
