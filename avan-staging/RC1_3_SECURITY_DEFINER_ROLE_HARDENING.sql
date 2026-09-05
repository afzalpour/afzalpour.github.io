-- Avan RC1.3 security completion hardening
-- Purpose:
-- 1) enforce financial-writer roles server-side for all journal mutation paths;
-- 2) prevent a future Viewer from mutating journals through SECURITY DEFINER RPCs;
-- 3) pin intentional browser-facing SECURITY DEFINER search paths to trusted schemas,
--    with pg_temp explicitly last;
-- 4) keep PUBLIC/anon execution closed and authenticated execution explicit.

begin;

create or replace function private.assert_financial_write_access(p_wid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_role := public.workspace_role(p_wid);
  if v_role is null then
    raise exception 'FORBIDDEN';
  end if;
  if v_role not in ('owner','manager','accountant') then
    raise exception 'ROLE_NOT_ALLOWED';
  end if;
end;
$$;

revoke all on function private.assert_financial_write_access(uuid) from public, anon, authenticated;

-- Central posting boundary. Any higher-level RPC that eventually posts a journal
-- (create_and_post_journal, post_financial_operation, reverse_journal_entry)
-- now inherits this role check transactionally.
create or replace function public.post_journal_entry(jid uuid)
returns public.journal_entries
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare e public.journal_entries%rowtype;
declare d numeric(20,0);
declare c numeric(20,0);
declare n bigint;
declare bad_count integer;
begin
  select * into e from public.journal_entries where id=jid for update;
  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  if not public.has_workspace_access(e.workspace_id) then raise exception 'FORBIDDEN'; end if;
  perform private.assert_financial_write_access(e.workspace_id);
  if e.status <> 'draft' then raise exception 'ENTRY_ALREADY_POSTED'; end if;

  if exists (
    select 1 from public.fiscal_periods p
    where p.workspace_id=e.workspace_id and p.status='closed'
      and e.entry_date between p.date_from and p.date_to
  ) then raise exception 'PERIOD_CLOSED'; end if;

  if not exists (
    select 1 from public.fiscal_years fy
    where fy.id=e.fiscal_year_id and fy.workspace_id=e.workspace_id
      and e.entry_date between fy.date_from and fy.date_to
      and fy.status='open'
  ) then raise exception 'FISCAL_YEAR_INVALID'; end if;

  select coalesce(sum(debit),0),coalesce(sum(credit),0),count(*)
  into d,c,bad_count
  from public.journal_lines where journal_entry_id=jid;

  if bad_count < 2 or d <= 0 or d <> c then raise exception 'ENTRY_NOT_BALANCED'; end if;

  select count(*) into bad_count
  from public.journal_lines l
  join public.accounts a on a.id=l.account_id
  where l.journal_entry_id=jid
    and (a.workspace_id<>e.workspace_id or not a.is_active or not a.is_postable);
  if bad_count > 0 then raise exception 'ACCOUNT_NOT_POSTABLE'; end if;

  n := public.next_journal_number(e.workspace_id,e.fiscal_year_id);
  update public.journal_entries
     set status='posted', journal_no=n, posted_by=auth.uid(), posted_at=now(), updated_at=now()
   where id=jid
   returning * into e;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(e.workspace_id,'post','journal_entry',e.id,'Journal posted');
  return e;
end;
$$;

create or replace function public.save_draft_journal(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_journal_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare
  jid uuid;
  item jsonb;
  idx integer := 0;
  st text;
  aid uuid;
  pid uuid;
  d numeric(20,0);
  c numeric(20,0);
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(p_workspace_id) then raise exception 'FORBIDDEN'; end if;
  perform private.assert_financial_write_access(p_workspace_id);
  if p_entry_date is null then raise exception 'ENTRY_DATE_REQUIRED'; end if;
  if p_lines is null then p_lines := '[]'::jsonb; end if;
  if jsonb_typeof(p_lines) <> 'array' then raise exception 'LINES_MUST_BE_ARRAY'; end if;

  if p_journal_id is null then
    insert into public.journal_entries(
      workspace_id,fiscal_year_id,entry_date,description,source_type,status,created_by
    ) values(
      p_workspace_id,p_fiscal_year_id,p_entry_date,
      coalesce(nullif(trim(p_description),''),'سند دستی'),
      'manual','draft',auth.uid()
    ) returning id into jid;
  else
    select status into st
    from public.journal_entries
    where id=p_journal_id and workspace_id=p_workspace_id
    for update;
    if st is null then raise exception 'ENTRY_NOT_FOUND'; end if;
    if st <> 'draft' then raise exception 'POSTED_ENTRY_IMMUTABLE'; end if;
    jid := p_journal_id;
    delete from public.journal_lines where journal_entry_id=jid;
    update public.journal_entries
       set fiscal_year_id=p_fiscal_year_id,
           entry_date=p_entry_date,
           description=coalesce(nullif(trim(p_description),''),'سند دستی'),
           updated_at=now()
     where id=jid;
  end if;

  for item in select value from jsonb_array_elements(p_lines) loop
    aid := nullif(item->>'account_id','')::uuid;
    pid := nullif(item->>'party_id','')::uuid;
    d := coalesce(nullif(item->>'debit','')::numeric,0);
    c := coalesce(nullif(item->>'credit','')::numeric,0);
    if aid is null then raise exception 'ACCOUNT_REQUIRED'; end if;
    if d < 0 or c < 0 or (d > 0 and c > 0) or (d = 0 and c = 0) then
      raise exception 'INVALID_DRAFT_LINE';
    end if;
    perform public.assert_account_postable(aid,p_workspace_id);
    if pid is not null and not exists(
      select 1 from public.parties p where p.id=pid and p.workspace_id=p_workspace_id and p.is_active
    ) then raise exception 'PARTY_NOT_FOUND'; end if;
    idx := idx + 1;
    insert into public.journal_lines(
      workspace_id,journal_entry_id,line_no,account_id,party_id,description,debit,credit
    ) values(
      p_workspace_id,jid,idx,aid,pid,nullif(item->>'description',''),d,c
    );
  end loop;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(p_workspace_id,'save_draft','journal_entry',jid,
         case when idx=0 then 'Draft journal saved without lines'
              else 'Draft journal saved with '||idx||' line(s)' end);
  return jid;
end;
$$;

create or replace function public.delete_draft_journal(jid uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, auth, pg_temp
as $$
declare e public.journal_entries%rowtype;
begin
  select * into e from public.journal_entries where id=jid for update;
  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  if not public.has_workspace_access(e.workspace_id) then raise exception 'FORBIDDEN'; end if;
  perform private.assert_financial_write_access(e.workspace_id);
  if e.status <> 'draft' then raise exception 'POSTED_ENTRY_IMMUTABLE'; end if;
  delete from public.journal_entries where id=jid;
  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(e.workspace_id,'delete_draft','journal_entry',jid,'Draft journal deleted');
  return true;
end;
$$;

-- Pin all intentional browser-facing SECURITY DEFINER RPCs that still use a trusted
-- schema path. PUBLIC and anon do not have CREATE on public/auth, and pg_temp is last.
alter function public.cancel_workspace_invitation(uuid,uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.claim_workspace_invitations() set search_path to pg_catalog, public, auth, pg_temp;
alter function public.close_fiscal_period(uuid,uuid,text,date,date) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.create_and_post_journal(uuid,uuid,date,text,text,jsonb) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.delete_draft_invoice(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.delete_draft_journal(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.get_money_display_unit(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.get_my_money_display_unit(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.get_workspace_print_profile(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.invite_workspace_member(uuid,text,text) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.list_workspace_access(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.manage_workspace_member(uuid,uuid,text,boolean) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.post_invoice(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.post_journal_entry(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.reopen_fiscal_period(uuid) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.reverse_journal_entry(uuid,date,text) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.set_money_display_unit(uuid,text) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.set_my_money_display_unit(uuid,text) set search_path to pg_catalog, public, auth, pg_temp;
alter function public.set_workspace_print_profile(uuid,jsonb) set search_path to pg_catalog, public, auth, pg_temp;

-- Reassert the intended RPC exposure. These are browser command/read boundaries,
-- not generic PUBLIC functions.
revoke all on function public.cancel_workspace_invitation(uuid,uuid) from public, anon;
revoke all on function public.claim_workspace_invitations() from public, anon;
revoke all on function public.close_fiscal_period(uuid,uuid,text,date,date) from public, anon;
revoke all on function public.create_and_post_journal(uuid,uuid,date,text,text,jsonb) from public, anon;
revoke all on function public.create_avan_company(text,text,text,date,date,jsonb) from public, anon;
revoke all on function public.delete_draft_invoice(uuid) from public, anon;
revoke all on function public.delete_draft_journal(uuid) from public, anon;
revoke all on function public.get_money_display_unit(uuid) from public, anon;
revoke all on function public.get_my_money_display_unit(uuid) from public, anon;
revoke all on function public.get_workspace_print_profile(uuid) from public, anon;
revoke all on function public.has_workspace_access(uuid) from public, anon;
revoke all on function public.invite_workspace_member(uuid,text,text) from public, anon;
revoke all on function public.list_workspace_access(uuid) from public, anon;
revoke all on function public.manage_workspace_member(uuid,uuid,text,boolean) from public, anon;
revoke all on function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) from public, anon;
revoke all on function public.post_invoice(uuid) from public, anon;
revoke all on function public.post_journal_entry(uuid) from public, anon;
revoke all on function public.rename_avan_company(uuid,text) from public, anon;
revoke all on function public.reopen_fiscal_period(uuid) from public, anon;
revoke all on function public.reverse_journal_entry(uuid,date,text) from public, anon;
revoke all on function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) from public, anon;
revoke all on function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) from public, anon;
revoke all on function public.set_money_display_unit(uuid,text) from public, anon;
revoke all on function public.set_my_money_display_unit(uuid,text) from public, anon;
revoke all on function public.set_workspace_print_profile(uuid,jsonb) from public, anon;
revoke all on function public.workspace_role(uuid) from public, anon;

grant execute on function public.cancel_workspace_invitation(uuid,uuid) to authenticated;
grant execute on function public.claim_workspace_invitations() to authenticated;
grant execute on function public.close_fiscal_period(uuid,uuid,text,date,date) to authenticated;
grant execute on function public.create_and_post_journal(uuid,uuid,date,text,text,jsonb) to authenticated;
grant execute on function public.create_avan_company(text,text,text,date,date,jsonb) to authenticated;
grant execute on function public.delete_draft_invoice(uuid) to authenticated;
grant execute on function public.delete_draft_journal(uuid) to authenticated;
grant execute on function public.get_money_display_unit(uuid) to authenticated;
grant execute on function public.get_my_money_display_unit(uuid) to authenticated;
grant execute on function public.get_workspace_print_profile(uuid) to authenticated;
grant execute on function public.has_workspace_access(uuid) to authenticated;
grant execute on function public.invite_workspace_member(uuid,text,text) to authenticated;
grant execute on function public.list_workspace_access(uuid) to authenticated;
grant execute on function public.manage_workspace_member(uuid,uuid,text,boolean) to authenticated;
grant execute on function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) to authenticated;
grant execute on function public.post_invoice(uuid) to authenticated;
grant execute on function public.post_journal_entry(uuid) to authenticated;
grant execute on function public.rename_avan_company(uuid,text) to authenticated;
grant execute on function public.reopen_fiscal_period(uuid) to authenticated;
grant execute on function public.reverse_journal_entry(uuid,date,text) to authenticated;
grant execute on function public.save_draft_invoice(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) to authenticated;
grant execute on function public.save_draft_journal(uuid,uuid,uuid,date,text,jsonb) to authenticated;
grant execute on function public.set_money_display_unit(uuid,text) to authenticated;
grant execute on function public.set_my_money_display_unit(uuid,text) to authenticated;
grant execute on function public.set_workspace_print_profile(uuid,jsonb) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
