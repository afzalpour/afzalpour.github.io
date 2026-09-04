-- Avan Core 1.0 — RC1.1-B money display/input unit
-- Ledger canonical storage remains TOMAN. This patch only persists a workspace
-- preference for input/display conversion. Existing journals are NOT rewritten.

begin;

alter table public.workspace_settings
  add column if not exists money_display_unit text;

update public.workspace_settings
set money_display_unit = 'toman'
where money_display_unit is null;

alter table public.workspace_settings
  alter column money_display_unit set default 'toman';

alter table public.workspace_settings
  alter column money_display_unit set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workspace_settings_money_display_unit_check'
      and conrelid = 'public.workspace_settings'::regclass
  ) then
    alter table public.workspace_settings
      add constraint workspace_settings_money_display_unit_check
      check (money_display_unit in ('toman','rial'));
  end if;
end $$;

create or replace function public.get_money_display_unit(wid uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_unit text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.has_workspace_access(wid) then
    raise exception 'FORBIDDEN';
  end if;

  select money_display_unit
    into v_unit
  from public.workspace_settings
  where workspace_id = wid;

  if not found then
    raise exception 'WORKSPACE_SETTINGS_NOT_FOUND';
  end if;

  return coalesce(v_unit, 'toman');
end $$;

revoke all on function public.get_money_display_unit(uuid) from public;
grant execute on function public.get_money_display_unit(uuid) to authenticated;

create or replace function public.set_money_display_unit(
  wid uuid,
  p_unit text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if not public.has_workspace_access(wid) then
    raise exception 'FORBIDDEN';
  end if;
  if p_unit not in ('toman','rial') then
    raise exception 'MONEY_UNIT_INVALID';
  end if;

  v_role := public.workspace_role(wid);
  if v_role not in ('owner','manager') then
    raise exception 'FORBIDDEN';
  end if;

  update public.workspace_settings
     set money_display_unit = p_unit,
         updated_at = now()
   where workspace_id = wid;

  if not found then
    raise exception 'WORKSPACE_SETTINGS_NOT_FOUND';
  end if;

  insert into public.audit_logs(
    workspace_id,
    action,
    entity_type,
    entity_id,
    summary
  ) values (
    wid,
    'money_display_unit_changed',
    'workspace_settings',
    wid,
    'Money display/input unit changed to ' || p_unit
  );

  return p_unit;
end $$;

revoke all on function public.set_money_display_unit(uuid,text) from public;
grant execute on function public.set_money_display_unit(uuid,text) to authenticated;

commit;

-- Read-only verification after running the patch:
-- select workspace_id, money_display_unit from public.workspace_settings;
-- select public.get_money_display_unit('<workspace-uuid>'::uuid);
