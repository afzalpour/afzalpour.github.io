-- Avan Core 1.0 — RC1.1-E per-user money display preference
-- Keeps Ledger canonical storage unchanged. Each active member may choose
-- Rial/Toman for their own display/input experience inside each Workspace.

begin;

create table if not exists public.workspace_user_preferences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  money_display_unit text not null default 'toman'
    check (money_display_unit in ('toman','rial')),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_user_preferences enable row level security;
revoke all on public.workspace_user_preferences from anon, authenticated;

create or replace function public.get_my_money_display_unit(wid uuid)
returns text
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_unit text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(wid) then raise exception 'FORBIDDEN'; end if;

  select p.money_display_unit
    into v_unit
  from public.workspace_user_preferences p
  where p.workspace_id=wid
    and p.user_id=auth.uid();

  if v_unit is not null then return v_unit; end if;

  select s.money_display_unit
    into v_unit
  from public.workspace_settings s
  where s.workspace_id=wid;

  return coalesce(v_unit,'toman');
end $$;

revoke all on function public.get_my_money_display_unit(uuid) from public;
grant execute on function public.get_my_money_display_unit(uuid) to authenticated;

create or replace function public.set_my_money_display_unit(
  wid uuid,
  p_unit text
)
returns text
language plpgsql
security definer
set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(wid) then raise exception 'FORBIDDEN'; end if;
  if p_unit not in ('toman','rial') then raise exception 'MONEY_UNIT_INVALID'; end if;

  insert into public.workspace_user_preferences(
    workspace_id,user_id,money_display_unit,updated_at
  ) values (
    wid,auth.uid(),p_unit,now()
  )
  on conflict(workspace_id,user_id)
  do update set
    money_display_unit=excluded.money_display_unit,
    updated_at=now();

  return p_unit;
end $$;

revoke all on function public.set_my_money_display_unit(uuid,text) from public;
grant execute on function public.set_my_money_display_unit(uuid,text) to authenticated;

commit;
