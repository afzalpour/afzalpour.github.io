-- RC1.3 SECURITY DEFINER minimization / RLS hardening
-- Applied to Supabase project dkyqsxnllvxypigxpygo on 2026-09-06.

-- Workspace settings: member read only; mutations remain behind guarded RPCs.
drop policy if exists workspace_settings_access on public.workspace_settings;
drop policy if exists workspace_settings_select on public.workspace_settings;
create policy workspace_settings_select
on public.workspace_settings
for select to authenticated
using (public.has_workspace_access(workspace_id));
revoke all on public.workspace_settings from anon;
revoke insert, update, delete, truncate, references, trigger on public.workspace_settings from authenticated;
grant select on public.workspace_settings to authenticated;

-- User preference rows are private to that user and tenant.
drop policy if exists workspace_user_preferences_select_own on public.workspace_user_preferences;
drop policy if exists workspace_user_preferences_insert_own on public.workspace_user_preferences;
drop policy if exists workspace_user_preferences_update_own on public.workspace_user_preferences;
create policy workspace_user_preferences_select_own
on public.workspace_user_preferences
for select to authenticated
using (user_id=(select auth.uid()) and public.has_workspace_access(workspace_id));
create policy workspace_user_preferences_insert_own
on public.workspace_user_preferences
for insert to authenticated
with check (user_id=(select auth.uid()) and public.has_workspace_access(workspace_id));
create policy workspace_user_preferences_update_own
on public.workspace_user_preferences
for update to authenticated
using (user_id=(select auth.uid()) and public.has_workspace_access(workspace_id))
with check (user_id=(select auth.uid()) and public.has_workspace_access(workspace_id));
revoke all on public.workspace_user_preferences from anon;
grant select, insert, update on public.workspace_user_preferences to authenticated;

-- Company print profile is readable by Company members, but not directly writable from browser DML.
drop policy if exists workspace_print_profiles_select_member on public.workspace_print_profiles;
create policy workspace_print_profiles_select_member
on public.workspace_print_profiles
for select to authenticated
using (public.has_workspace_access(workspace_id));
revoke all on public.workspace_print_profiles from anon;
grant select on public.workspace_print_profiles to authenticated;
revoke insert, update, delete, truncate, references, trigger on public.workspace_print_profiles from authenticated;

create or replace function public.get_money_display_unit(wid uuid)
returns text language plpgsql stable security invoker set search_path=''
as $$
declare v_unit text;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(wid) then raise exception 'FORBIDDEN'; end if;
  select s.money_display_unit into v_unit from public.workspace_settings s where s.workspace_id=wid;
  if not found then raise exception 'WORKSPACE_SETTINGS_NOT_FOUND'; end if;
  return coalesce(v_unit,'toman');
end
$$;

create or replace function public.get_my_money_display_unit(wid uuid)
returns text language plpgsql stable security invoker set search_path=''
as $$
declare v_unit text;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(wid) then raise exception 'FORBIDDEN'; end if;
  select p.money_display_unit into v_unit
    from public.workspace_user_preferences p
   where p.workspace_id=wid and p.user_id=(select auth.uid());
  if v_unit is not null then return v_unit; end if;
  select s.money_display_unit into v_unit from public.workspace_settings s where s.workspace_id=wid;
  return coalesce(v_unit,'toman');
end
$$;

create or replace function public.set_my_money_display_unit(wid uuid,p_unit text)
returns text language plpgsql security invoker set search_path=''
as $$
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(wid) then raise exception 'FORBIDDEN'; end if;
  if p_unit not in ('toman','rial') then raise exception 'MONEY_UNIT_INVALID'; end if;
  insert into public.workspace_user_preferences(workspace_id,user_id,money_display_unit,updated_at)
  values(wid,(select auth.uid()),p_unit,now())
  on conflict(workspace_id,user_id)
  do update set money_display_unit=excluded.money_display_unit,updated_at=now();
  return p_unit;
end
$$;

create or replace function public.get_workspace_print_profile(wid uuid)
returns jsonb language plpgsql stable security invoker set search_path=''
as $$
declare
  v_workspace_name text;
  v_profile public.workspace_print_profiles%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(wid) then raise exception 'FORBIDDEN'; end if;
  select w.name into v_workspace_name from public.workspaces w where w.id=wid;
  if not found then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  select p.* into v_profile from public.workspace_print_profiles p where p.workspace_id=wid;
  return jsonb_build_object(
    'workspace_id',wid,'display_name',coalesce(v_profile.display_name,v_workspace_name),
    'legal_name',v_profile.legal_name,'entity_type',v_profile.entity_type,
    'registration_no',v_profile.registration_no,'national_id',v_profile.national_id,
    'economic_code',v_profile.economic_code,'tax_id',v_profile.tax_id,
    'phone',v_profile.phone,'email',v_profile.email,'postal_code',v_profile.postal_code,
    'province',v_profile.province,'city',v_profile.city,'address',v_profile.address,
    'invoice_footer',v_profile.invoice_footer,'logo_path',v_profile.logo_path,
    'updated_at',v_profile.updated_at
  );
end
$$;

revoke all on function public.get_money_display_unit(uuid) from public, anon;
revoke all on function public.get_my_money_display_unit(uuid) from public, anon;
revoke all on function public.set_my_money_display_unit(uuid,text) from public, anon;
revoke all on function public.get_workspace_print_profile(uuid) from public, anon;
grant execute on function public.get_money_display_unit(uuid) to authenticated;
grant execute on function public.get_my_money_display_unit(uuid) to authenticated;
grant execute on function public.set_my_money_display_unit(uuid,text) to authenticated;
grant execute on function public.get_workspace_print_profile(uuid) to authenticated;
