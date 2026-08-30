-- Avan Core 1.0 — Gate B-4 operational hardening
-- Run AFTER avan-core-schema.sql + Gate B-2 + Gate B-3 Auth fix.
-- Safe for the current staging database. No service_role key is required by the browser.

begin;

-- =========================================================
-- 1) RLS gaps / role helper
-- =========================================================
create or replace function public.workspace_role(wid uuid)
returns text
language sql stable security definer
set search_path=public
as $$
  select m.role
  from public.workspace_members m
  where m.workspace_id=wid and m.user_id=(select auth.uid())
  limit 1;
$$;
revoke all on function public.workspace_role(uuid) from public;
grant execute on function public.workspace_role(uuid) to authenticated;

-- account_roles had RLS enabled in Core 1.0 but no explicit SELECT policy.
drop policy if exists account_roles_select on public.account_roles;
create policy account_roles_select on public.account_roles
for select to authenticated
using (public.has_workspace_access(workspace_id));
revoke all on public.account_roles from authenticated;
grant select on public.account_roles to authenticated;

-- Operational source transactions are written only through controlled RPCs.
drop policy if exists financial_transactions_access on public.financial_transactions;
drop policy if exists financial_transactions_select on public.financial_transactions;
create policy financial_transactions_select on public.financial_transactions
for select to authenticated
using (public.has_workspace_access(workspace_id));
revoke insert,update,delete on public.financial_transactions from authenticated;
grant select on public.financial_transactions to authenticated;

-- Fiscal period mutation is RPC-only. Members can read locks.
drop policy if exists fiscal_periods_access on public.fiscal_periods;
drop policy if exists fiscal_periods_select on public.fiscal_periods;
create policy fiscal_periods_select on public.fiscal_periods
for select to authenticated
using (public.has_workspace_access(workspace_id));
revoke insert,update,delete on public.fiscal_periods from authenticated;
grant select on public.fiscal_periods to authenticated;

-- Draft journal mutation is also RPC-only from Gate B-4 onward.
-- RLS remains defense-in-depth, but direct browser writes lose table privileges.
revoke insert,update,delete on public.journal_entries from authenticated;
revoke insert,update,delete on public.journal_lines from authenticated;
grant select on public.journal_entries,public.journal_lines to authenticated;

-- =========================================================
-- 2) Stronger account lifecycle guards
-- =========================================================
create or replace function public.guard_account_update()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if trim(new.code)='' or trim(new.name)='' then
    raise exception 'ACCOUNT_CODE_NAME_REQUIRED';
  end if;

  -- System chart anchors must not be renamed, reparented, archived or recategorized
  -- by a browser request. Their lifecycle is migration-controlled.
  if old.is_system and (
       new.code is distinct from old.code
    or new.name is distinct from old.name
    or new.parent_id is distinct from old.parent_id
    or new.category is distinct from old.category
    or new.normal_balance is distinct from old.normal_balance
    or new.level is distinct from old.level
    or new.is_postable is distinct from old.is_postable
    or new.is_active is distinct from old.is_active
    or new.is_system is distinct from old.is_system
  ) then
    raise exception 'SYSTEM_ACCOUNT_PROTECTED';
  end if;

  if old.is_active and not new.is_active and exists(
    select 1 from public.accounts c
    where c.parent_id=old.id and c.is_active
  ) then
    raise exception 'ACCOUNT_HAS_ACTIVE_CHILDREN';
  end if;

  new.updated_at := now();
  if new.is_active then new.archived_at := null;
  elsif new.archived_at is null then new.archived_at := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_account_update on public.accounts;
create trigger trg_guard_account_update
before update on public.accounts
for each row execute function public.guard_account_update();

create or replace function public.guard_account_delete()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if old.is_system then raise exception 'SYSTEM_ACCOUNT_PROTECTED'; end if;
  if exists(select 1 from public.accounts where parent_id=old.id) then
    raise exception 'ACCOUNT_HAS_CHILDREN';
  end if;
  if exists(select 1 from public.journal_lines where account_id=old.id) then
    raise exception 'ACCOUNT_HAS_ACTIVITY';
  end if;
  return old;
end $$;

-- Existing trigger already points to this function; recreate for certainty.
drop trigger if exists trg_guard_account_delete on public.accounts;
create trigger trg_guard_account_delete
before delete on public.accounts
for each row execute function public.guard_account_delete();

-- =========================================================
-- 3) Draft journal lifecycle via RPC only
-- =========================================================
create or replace function public.delete_draft_journal(jid uuid)
returns boolean
language plpgsql security definer
set search_path=public
as $$
declare e public.journal_entries%rowtype;
begin
  select * into e from public.journal_entries where id=jid for update;
  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  if not public.has_workspace_access(e.workspace_id) then raise exception 'FORBIDDEN'; end if;
  if e.status <> 'draft' then raise exception 'POSTED_ENTRY_IMMUTABLE'; end if;
  delete from public.journal_entries where id=jid;
  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(e.workspace_id,'delete_draft','journal_entry',jid,'Draft journal deleted');
  return true;
end $$;
revoke all on function public.delete_draft_journal(uuid) from public;
grant execute on function public.delete_draft_journal(uuid) to authenticated;

-- =========================================================
-- 4) Operational transaction source document + atomic posting
-- =========================================================
create or replace function public.guard_financial_transaction_mutation()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if tg_op='DELETE' and old.status in ('posted','cancelled') then
    raise exception 'POSTED_TRANSACTION_IMMUTABLE';
  end if;
  if tg_op='UPDATE' and old.status='cancelled' then
    raise exception 'POSTED_TRANSACTION_IMMUTABLE';
  end if;
  if tg_op='UPDATE' and old.status='posted' then
    if new.status='cancelled'
       and new.workspace_id=old.workspace_id
       and new.fiscal_year_id=old.fiscal_year_id
       and new.tx_date=old.tx_date
       and new.tx_type=old.tx_type
       and new.amount=old.amount
       and new.from_account_id is not distinct from old.from_account_id
       and new.to_account_id is not distinct from old.to_account_id
       and new.counterpart_account_id is not distinct from old.counterpart_account_id
       and new.party_id is not distinct from old.party_id
       and new.description is not distinct from old.description
       and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.created_by is not distinct from old.created_by
       and new.created_at=old.created_at
    then
      new.updated_at:=now();
      return new;
    end if;
    raise exception 'POSTED_TRANSACTION_IMMUTABLE';
  end if;
  return case when tg_op='DELETE' then old else new end;
end $$;

drop trigger if exists trg_guard_financial_transaction_mutation on public.financial_transactions;
create trigger trg_guard_financial_transaction_mutation
before update or delete on public.financial_transactions
for each row execute function public.guard_financial_transaction_mutation();

create or replace function public.post_financial_operation(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_tx_date date,
  p_tx_type text,
  p_amount numeric,
  p_primary_account_id uuid,
  p_counterpart_account_id uuid default null,
  p_party_id uuid default null,
  p_description text default null
)
returns jsonb
language plpgsql security definer
set search_path=public
as $$
declare
  jid uuid;
  txid uuid;
  posted public.journal_entries%rowtype;
  primary_a public.accounts%rowtype;
  counter_a public.accounts%rowtype;
  opening_id uuid;
  descr text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not public.has_workspace_access(p_workspace_id) then raise exception 'FORBIDDEN'; end if;
  if p_tx_type not in ('receipt','payment','transfer','opening_balance') then raise exception 'TX_TYPE_INVALID'; end if;
  if p_amount is null or p_amount<=0 or p_amount<>trunc(p_amount) then raise exception 'AMOUNT_INVALID'; end if;

  select * into primary_a from public.accounts where id=p_primary_account_id and workspace_id=p_workspace_id;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  perform public.assert_account_postable(primary_a.id,p_workspace_id);

  if p_tx_type='opening_balance' then
    select account_id into opening_id from public.account_roles
    where workspace_id=p_workspace_id and role_key='opening_equity';
    if opening_id is null then raise exception 'OPENING_ACCOUNT_NOT_FOUND'; end if;
    select * into counter_a from public.accounts where id=opening_id;
    if opening_id=primary_a.id then raise exception 'OPENING_TARGET_INVALID'; end if;
  else
    if p_counterpart_account_id is null then raise exception 'COUNTERPART_ACCOUNT_REQUIRED'; end if;
    if p_counterpart_account_id=p_primary_account_id then raise exception 'SAME_ACCOUNT_NOT_ALLOWED'; end if;
    select * into counter_a from public.accounts where id=p_counterpart_account_id and workspace_id=p_workspace_id;
    if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
    perform public.assert_account_postable(counter_a.id,p_workspace_id);
  end if;

  -- Receipt/payment primary must be cash/bank. Transfer requires both sides cash/bank.
  if p_tx_type in ('receipt','payment','transfer') and not exists(
    select 1 from public.financial_accounts f
    where f.workspace_id=p_workspace_id and f.ledger_account_id=primary_a.id and f.is_active
  ) then raise exception 'PRIMARY_ACCOUNT_NOT_FINANCIAL'; end if;
  if p_tx_type='transfer' and not exists(
    select 1 from public.financial_accounts f
    where f.workspace_id=p_workspace_id and f.ledger_account_id=counter_a.id and f.is_active
  ) then raise exception 'COUNTERPART_ACCOUNT_NOT_FINANCIAL'; end if;
  if p_tx_type in ('receipt','payment') and exists(
    select 1 from public.financial_accounts f
    where f.workspace_id=p_workspace_id and f.ledger_account_id=counter_a.id and f.is_active
  ) then raise exception 'USE_TRANSFER_FOR_FINANCIAL_ACCOUNTS'; end if;

  if p_party_id is not null and not exists(
    select 1 from public.parties p where p.id=p_party_id and p.workspace_id=p_workspace_id and p.is_active
  ) then raise exception 'PARTY_NOT_FOUND'; end if;

  descr:=coalesce(nullif(trim(p_description),''),case p_tx_type
    when 'receipt' then 'دریافت'
    when 'payment' then 'پرداخت'
    when 'transfer' then 'انتقال'
    else 'مانده افتتاحیه' end);

  insert into public.financial_transactions(
    workspace_id,fiscal_year_id,tx_date,tx_type,amount,
    from_account_id,to_account_id,counterpart_account_id,party_id,description,status,created_by
  ) values(
    p_workspace_id,p_fiscal_year_id,p_tx_date,p_tx_type,p_amount,
    case when p_tx_type in ('payment','transfer') then primary_a.id else null end,
    case when p_tx_type='receipt' then primary_a.id when p_tx_type='transfer' then counter_a.id
         when p_tx_type='opening_balance' and primary_a.normal_balance='debit' then primary_a.id else null end,
    case when p_tx_type in ('receipt','payment','opening_balance') then counter_a.id else null end,
    p_party_id,descr,'draft',auth.uid()
  ) returning id into txid;

  insert into public.journal_entries(
    workspace_id,fiscal_year_id,entry_date,description,source_type,source_id,status,created_by
  ) values(
    p_workspace_id,p_fiscal_year_id,p_tx_date,descr,p_tx_type,txid,'draft',auth.uid()
  ) returning id into jid;

  if p_tx_type='receipt' then
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,party_id,debit,credit)
    values
      (p_workspace_id,jid,1,primary_a.id,p_party_id,p_amount,0),
      (p_workspace_id,jid,2,counter_a.id,p_party_id,0,p_amount);
  elsif p_tx_type='payment' then
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,party_id,debit,credit)
    values
      (p_workspace_id,jid,1,counter_a.id,p_party_id,p_amount,0),
      (p_workspace_id,jid,2,primary_a.id,p_party_id,0,p_amount);
  elsif p_tx_type='transfer' then
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,debit,credit)
    values
      (p_workspace_id,jid,1,counter_a.id,p_amount,0),
      (p_workspace_id,jid,2,primary_a.id,0,p_amount);
  else
    if primary_a.normal_balance='credit' then
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,debit,credit)
      values
        (p_workspace_id,jid,1,counter_a.id,p_amount,0),
        (p_workspace_id,jid,2,primary_a.id,0,p_amount);
    else
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,debit,credit)
      values
        (p_workspace_id,jid,1,primary_a.id,p_amount,0),
        (p_workspace_id,jid,2,counter_a.id,0,p_amount);
    end if;
  end if;

  select * into posted from public.post_journal_entry(jid);
  update public.financial_transactions
     set status='posted',journal_entry_id=jid,updated_at=now()
   where id=txid;

  return jsonb_build_object(
    'transaction_id',txid,'journal_entry_id',jid,'journal_no',posted.journal_no,'status',posted.status
  );
end $$;
revoke all on function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) from public;
grant execute on function public.post_financial_operation(uuid,uuid,date,text,numeric,uuid,uuid,uuid,text) to authenticated;

-- Keep source transaction lifecycle aligned when an operational journal is reversed.
create or replace function public.reverse_journal_entry(jid uuid, reverse_date date, reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare src public.journal_entries%rowtype;
declare rid uuid;
declare ln record;
begin
  select * into src from public.journal_entries where id=jid for update;
  if not found then raise exception 'ENTRY_NOT_FOUND'; end if;
  if not public.has_workspace_access(src.workspace_id) then raise exception 'FORBIDDEN'; end if;
  if src.status <> 'posted' then raise exception 'ENTRY_NOT_POSTED'; end if;
  if exists(select 1 from public.journal_entries where reversal_of=src.id) then raise exception 'ENTRY_ALREADY_REVERSED'; end if;

  insert into public.journal_entries(workspace_id,fiscal_year_id,entry_date,description,source_type,source_id,status,reversal_of,created_by)
  values(src.workspace_id,src.fiscal_year_id,reverse_date,coalesce(reason,'برگشت سند')||' — '||src.description,'reversal',src.id,'draft',src.id,auth.uid())
  returning id into rid;

  for ln in select * from public.journal_lines where journal_entry_id=src.id order by line_no loop
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,party_id,description,debit,credit)
    values(src.workspace_id,rid,ln.line_no,ln.account_id,ln.party_id,ln.description,ln.credit,ln.debit);
  end loop;

  perform public.post_journal_entry(rid);
  update public.journal_entries
     set status='reversed',reversed_by=auth.uid(),reversed_at=now(),updated_at=now()
   where id=src.id;

  if src.source_id is not null and src.source_type in ('receipt','payment','transfer','opening_balance') then
    update public.financial_transactions
       set status='cancelled',updated_at=now()
     where id=src.source_id and workspace_id=src.workspace_id and journal_entry_id=src.id;
  end if;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(src.workspace_id,'reverse','journal_entry',src.id,'Journal reversed');
  return rid;
end $$;
revoke all on function public.reverse_journal_entry(uuid,date,text) from public;
grant execute on function public.reverse_journal_entry(uuid,date,text) to authenticated;

-- =========================================================
-- 5) Fiscal period locking via controlled RPCs
-- =========================================================
create or replace function public.close_fiscal_period(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_name text,
  p_date_from date,
  p_date_to date
)
returns uuid
language plpgsql security definer
set search_path=public
as $$
declare pid uuid; r text; fy public.fiscal_years%rowtype;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  r:=public.workspace_role(p_workspace_id);
  if r is null then raise exception 'FORBIDDEN'; end if;
  if r not in ('owner','manager') then raise exception 'ROLE_NOT_ALLOWED'; end if;
  if p_date_from>p_date_to then raise exception 'PERIOD_RANGE_INVALID'; end if;
  if trim(coalesce(p_name,''))='' then raise exception 'PERIOD_NAME_REQUIRED'; end if;

  select * into fy from public.fiscal_years
   where id=p_fiscal_year_id and workspace_id=p_workspace_id for update;
  if not found then raise exception 'FISCAL_YEAR_INVALID'; end if;
  if fy.status<>'open' then raise exception 'FISCAL_YEAR_CLOSED'; end if;
  if p_date_from<fy.date_from or p_date_to>fy.date_to then raise exception 'PERIOD_OUTSIDE_FISCAL_YEAR'; end if;
  if exists(
    select 1 from public.fiscal_periods p
    where p.workspace_id=p_workspace_id and p.fiscal_year_id=p_fiscal_year_id
      and p.status='closed' and daterange(p.date_from,p.date_to,'[]') && daterange(p_date_from,p_date_to,'[]')
  ) then raise exception 'PERIOD_OVERLAPS_CLOSED'; end if;

  insert into public.fiscal_periods(workspace_id,fiscal_year_id,name,date_from,date_to,status,closed_by,closed_at)
  values(p_workspace_id,p_fiscal_year_id,trim(p_name),p_date_from,p_date_to,'closed',auth.uid(),now())
  returning id into pid;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(p_workspace_id,'close_period','fiscal_period',pid,'Fiscal period closed: '||trim(p_name));
  return pid;
end $$;
revoke all on function public.close_fiscal_period(uuid,uuid,text,date,date) from public;
grant execute on function public.close_fiscal_period(uuid,uuid,text,date,date) to authenticated;

create or replace function public.reopen_fiscal_period(pid uuid)
returns boolean
language plpgsql security definer
set search_path=public
as $$
declare p public.fiscal_periods%rowtype; r text;
begin
  select * into p from public.fiscal_periods where id=pid for update;
  if not found then raise exception 'PERIOD_NOT_FOUND'; end if;
  r:=public.workspace_role(p.workspace_id);
  if r is null then raise exception 'FORBIDDEN'; end if;
  if r not in ('owner','manager') then raise exception 'ROLE_NOT_ALLOWED'; end if;
  if p.status='open' then return true; end if;
  update public.fiscal_periods set status='open',closed_by=null,closed_at=null where id=pid;
  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(p.workspace_id,'reopen_period','fiscal_period',pid,'Fiscal period reopened: '||p.name);
  return true;
end $$;
revoke all on function public.reopen_fiscal_period(uuid) from public;
grant execute on function public.reopen_fiscal_period(uuid) to authenticated;

-- =========================================================
-- 6) Core reports added for Gate B-4
-- =========================================================
create or replace function public.report_journal(wid uuid, dfrom date, dto date)
returns table(
  journal_entry_id uuid,journal_no bigint,entry_date date,entry_description text,source_type text,
  line_no integer,account_id uuid,account_code text,account_name text,party_name text,
  line_description text,debit numeric,credit numeric
)
language sql stable security definer set search_path=public as $$
  select l.journal_entry_id,l.journal_no,l.entry_date,l.entry_description,l.source_type,
         l.line_no,a.id,a.code,a.name,p.name,l.line_description,l.debit,l.credit
  from public.v_posted_ledger l
  join public.accounts a on a.id=l.account_id
  left join public.parties p on p.id=l.party_id
  where l.workspace_id=wid and l.entry_date between dfrom and dto
    and public.has_workspace_access(wid)
  order by l.entry_date,l.journal_no,l.line_no;
$$;
revoke all on function public.report_journal(uuid,date,date) from public;
grant execute on function public.report_journal(uuid,date,date) to authenticated;

create or replace function public.report_cash_bank_balances(wid uuid, as_of date)
returns table(financial_account_id uuid,kind text,account_id uuid,account_code text,account_name text,amount numeric)
language sql stable security definer set search_path=public as $$
  select f.id,f.kind,a.id,a.code,a.name,coalesce(sum(l.debit-l.credit),0) as amount
  from public.financial_accounts f
  join public.accounts a on a.id=f.ledger_account_id
  left join public.v_posted_ledger l on l.account_id=a.id and l.entry_date<=as_of
  where f.workspace_id=wid and f.is_active and public.has_workspace_access(wid)
  group by f.id,f.kind,a.id,a.code,a.name
  order by f.kind,a.code;
$$;
revoke all on function public.report_cash_bank_balances(uuid,date) from public;
grant execute on function public.report_cash_bank_balances(uuid,date) to authenticated;

create or replace function public.avan_core_integrity(wid uuid)
returns jsonb
language sql stable security definer set search_path=public as $$
  with posted as (
    select e.id,
      coalesce((select sum(l.debit) from public.journal_lines l where l.journal_entry_id=e.id),0) d,
      coalesce((select sum(l.credit) from public.journal_lines l where l.journal_entry_id=e.id),0) c
    from public.journal_entries e
    where e.workspace_id=wid and e.status in ('posted','reversed')
  )
  select case when public.has_workspace_access(wid) then jsonb_build_object(
    'workspace_id',wid,
    'role',public.workspace_role(wid),
    'posted_or_reversed_journals',(select count(*) from posted),
    'unbalanced_journals',(select count(*) from posted where d<>c or d<=0),
    'orphan_lines',(select count(*) from public.journal_lines l left join public.journal_entries e on e.id=l.journal_entry_id where l.workspace_id=wid and e.id is null),
    'accounts',(select count(*) from public.accounts where workspace_id=wid),
    'financial_accounts',(select count(*) from public.financial_accounts where workspace_id=wid and is_active),
    'closed_periods',(select count(*) from public.fiscal_periods where workspace_id=wid and status='closed')
  ) else null end;
$$;
revoke all on function public.avan_core_integrity(uuid) from public;
grant execute on function public.avan_core_integrity(uuid) to authenticated;

commit;
