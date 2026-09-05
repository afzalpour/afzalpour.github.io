begin;

create or replace function private.enforce_tenant_member_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer;
  v_count integer;
  v_status text;
begin
  if not new.is_active then return new; end if;
  if tg_op='UPDATE' and old.is_active and new.is_active then return new; end if;

  select pt.member_limit,pt.status into v_limit,v_status
  from private.platform_tenants pt
  where pt.workspace_id=new.workspace_id;

  if v_limit is null then raise exception 'TENANT_REGISTRY_REQUIRED'; end if;
  if v_status in ('suspended','archived') then raise exception 'TENANT_ACCESS_SUSPENDED'; end if;

  select count(*) into v_count
  from public.workspace_members m
  where m.workspace_id=new.workspace_id
    and m.is_active
    and (tg_op='INSERT' or m.user_id is distinct from new.user_id);

  if v_count >= v_limit then raise exception 'TENANT_MEMBER_LIMIT_REACHED'; end if;
  return new;
end;
$$;

revoke all on function private.enforce_tenant_member_limit() from public, anon, authenticated;
drop trigger if exists trg_enforce_tenant_member_limit on public.workspace_members;
create trigger trg_enforce_tenant_member_limit
before insert or update of is_active, workspace_id on public.workspace_members
for each row execute function private.enforce_tenant_member_limit();

commit;
