-- Avan RC1.4-C/D Inventory Cost Accounting + Financial Ledger Bridge
-- STATUS: repository candidate only; NOT APPLIED to Production.
-- Requires RC1.4-A and RC1.4-B candidates.

-- -----------------------------------------------------------------------------
-- 1) Integer-Toman financial value alongside precise inventory valuation
-- -----------------------------------------------------------------------------
alter table public.inventory_movements
  add column if not exists ledger_value_delta numeric(20,0);

update public.inventory_movements
   set ledger_value_delta=round(value_delta,0)
 where ledger_value_delta is null;

alter table public.inventory_movements
  alter column ledger_value_delta set not null;

create or replace function private.set_inventory_movement_ledger_value()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_source_value numeric(20,0);
begin
  if new.reversal_of is not null then
    select -m.ledger_value_delta into v_source_value
    from public.inventory_movements m
    where m.workspace_id=new.workspace_id and m.id=new.reversal_of;
    if v_source_value is null then raise exception 'INVENTORY_REVERSAL_LEDGER_VALUE_MISSING'; end if;
    new.ledger_value_delta:=v_source_value;
  else
    new.ledger_value_delta:=round(new.quantity_delta*new.unit_cost,0);
  end if;
  return new;
end;
$$;

revoke all on function private.set_inventory_movement_ledger_value() from public,anon;
drop trigger if exists trg_set_inventory_movement_ledger_value on public.inventory_movements;
create trigger trg_set_inventory_movement_ledger_value
before insert on public.inventory_movements
for each row execute function private.set_inventory_movement_ledger_value();

create or replace view public.inventory_on_hand
with(security_invoker=true)
as
select
  workspace_id,
  item_id,
  warehouse_id,
  sum(quantity_delta)::numeric(20,6) as quantity_on_hand,
  sum(value_delta)::numeric(24,6) as inventory_value,
  sum(ledger_value_delta)::numeric(20,0) as ledger_inventory_value_toman,
  case when sum(quantity_delta)=0 then 0::numeric
       else (sum(value_delta)/sum(quantity_delta))::numeric(24,6)
  end as average_unit_cost
from public.inventory_movements
group by workspace_id,item_id,warehouse_id;

revoke all on public.inventory_on_hand from anon;
grant select on public.inventory_on_hand to authenticated;

-- -----------------------------------------------------------------------------
-- 2) Standard postable Inventory accounting roles
-- -----------------------------------------------------------------------------
create or replace function private.ensure_inventory_account_roles(p_wid uuid)
returns integer
language plpgsql
security definer
set search_path=''
as $$
declare
  v_role text;
  p130 uuid; p520 uuid; p225 uuid; p425 uuid; p570 uuid;
  a_inventory uuid; a_cogs uuid; a_clearing uuid; a_gain uuid; a_loss uuid;
  v_count integer;
begin
  if not exists(select 1 from public.workspaces w where w.id=p_wid) then raise exception 'COMPANY_NOT_FOUND'; end if;

  if (select auth.uid()) is not null then
    v_role:=public.workspace_role(p_wid);
    if v_role not in('owner','manager') then raise exception 'ROLE_NOT_ALLOWED'; end if;
  end if;

  perform private.ensure_standard_account_chart(p_wid);

  select id into p130 from public.accounts where workspace_id=p_wid and code='130' and level=2 limit 1;
  select id into p520 from public.accounts where workspace_id=p_wid and code='520' and level=2 limit 1;
  select id into p225 from public.accounts where workspace_id=p_wid and code='225' and level=2 limit 1;
  select id into p425 from public.accounts where workspace_id=p_wid and code='425' and level=2 limit 1;
  select id into p570 from public.accounts where workspace_id=p_wid and code='570' and level=2 limit 1;
  if p130 is null or p520 is null or p225 is null or p425 is null or p570 is null then
    raise exception 'INVENTORY_STANDARD_HEADINGS_REQUIRED';
  end if;

  insert into public.accounts(workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system)
  values
   (p_wid,p130,'1301','موجودی کالا',3,'asset','debit',true,true),
   (p_wid,p520,'5201','بهای تمام‌شده کالای فروش‌رفته',3,'expense','debit',true,true),
   (p_wid,p225,'2251','کالای دریافت‌شده صورتحساب‌نشده',3,'liability','credit',true,true),
   (p_wid,p425,'4251','اضافات و تعدیلات مثبت موجودی',3,'income','credit',true,true),
   (p_wid,p570,'5701','کسری و تعدیلات منفی موجودی',3,'expense','debit',true,true)
  on conflict(workspace_id,code) do nothing;

  select id into a_inventory from public.accounts where workspace_id=p_wid and code='1301' and parent_id=p130 and level=3 and category='asset' and normal_balance='debit' and is_postable and is_system;
  select id into a_cogs from public.accounts where workspace_id=p_wid and code='5201' and parent_id=p520 and level=3 and category='expense' and normal_balance='debit' and is_postable and is_system;
  select id into a_clearing from public.accounts where workspace_id=p_wid and code='2251' and parent_id=p225 and level=3 and category='liability' and normal_balance='credit' and is_postable and is_system;
  select id into a_gain from public.accounts where workspace_id=p_wid and code='4251' and parent_id=p425 and level=3 and category='income' and normal_balance='credit' and is_postable and is_system;
  select id into a_loss from public.accounts where workspace_id=p_wid and code='5701' and parent_id=p570 and level=3 and category='expense' and normal_balance='debit' and is_postable and is_system;
  if a_inventory is null or a_cogs is null or a_clearing is null or a_gain is null or a_loss is null then
    raise exception 'INVENTORY_STANDARD_ACCOUNT_CONFLICT';
  end if;

  insert into public.account_roles(workspace_id,role_key,account_id) values
   (p_wid,'inventory_asset',a_inventory),
   (p_wid,'inventory_cogs',a_cogs),
   (p_wid,'inventory_clearing',a_clearing),
   (p_wid,'inventory_gain',a_gain),
   (p_wid,'inventory_loss',a_loss)
  on conflict(workspace_id,role_key) do update set account_id=excluded.account_id;

  select count(*) into v_count from public.account_roles
  where workspace_id=p_wid and role_key in('inventory_asset','inventory_cogs','inventory_clearing','inventory_gain','inventory_loss');
  if v_count<>5 then raise exception 'INVENTORY_ACCOUNT_ROLE_INSTALL_FAILED'; end if;
  return v_count;
end;
$$;

revoke all on function private.ensure_inventory_account_roles(uuid) from public,anon;
grant execute on function private.ensure_inventory_account_roles(uuid) to authenticated,service_role;

-- Existing Companies will be backfilled by this migration when it is eventually approved.
do $$
declare r record;
begin
  for r in select id from public.workspaces loop
    perform private.ensure_inventory_account_roles(r.id);
  end loop;
end$$;

-- Official onboarding wrapper installs Inventory roles after the normal Company core/chart.
create or replace function public.create_avan_company(
  p_name text,
  p_money_unit text default 'toman',
  p_fiscal_name text default '۱۴۰۵',
  p_date_from date default '2026-03-21',
  p_date_to date default '2027-03-20',
  p_profile jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_result jsonb;
  v_wid uuid;
begin
  v_result:=private.create_avan_company(p_name,p_money_unit,p_fiscal_name,p_date_from,p_date_to,p_profile);
  v_wid:=(v_result->>'workspace_id')::uuid;
  perform private.ensure_inventory_account_roles(v_wid);
  return v_result;
end;
$$;
revoke all on function public.create_avan_company(text,text,text,date,date,jsonb) from public,anon;
grant execute on function public.create_avan_company(text,text,text,date,date,jsonb) to authenticated,service_role;

create or replace function private.inventory_account_id(p_wid uuid,p_role text)
returns uuid
language plpgsql
security definer
stable
set search_path=''
as $$
declare v_id uuid;
begin
  select a.id into v_id
  from public.account_roles ar
  join public.accounts a on a.id=ar.account_id and a.workspace_id=ar.workspace_id
  where ar.workspace_id=p_wid and ar.role_key=p_role and a.is_active and a.is_postable;
  if v_id is null then raise exception 'INVENTORY_ACCOUNT_ROLE_MISSING:%',p_role; end if;
  return v_id;
end;
$$;
revoke all on function private.inventory_account_id(uuid,text) from public,anon,authenticated;

-- -----------------------------------------------------------------------------
-- 3) Controlled accounts cannot be used by arbitrary manual journals
-- -----------------------------------------------------------------------------
create or replace function private.guard_inventory_controlled_journal_line()
returns trigger
language plpgsql
set search_path=''
as $$
declare
  v_entry public.journal_entries%rowtype;
begin
  if not exists(
    select 1 from public.account_roles ar
    where ar.workspace_id=new.workspace_id
      and ar.account_id=new.account_id
      and ar.role_key in('inventory_asset','inventory_cogs','inventory_clearing','inventory_gain','inventory_loss')
  ) then return new; end if;

  select * into v_entry from public.journal_entries
  where id=new.journal_entry_id and workspace_id=new.workspace_id;
  if not found then raise exception 'JOURNAL_ENTRY_NOT_FOUND'; end if;

  if v_entry.source_type='inventory_document' then return new; end if;
  if v_entry.source_type='reversal' and v_entry.reversal_of is not null and exists(
    select 1 from public.journal_entries src
    where src.id=v_entry.reversal_of and src.workspace_id=v_entry.workspace_id and src.source_type='inventory_document'
  ) then return new; end if;

  raise exception 'INVENTORY_CONTROLLED_ACCOUNT_RESTRICTED';
end;
$$;
revoke all on function private.guard_inventory_controlled_journal_line() from public,anon;
drop trigger if exists trg_guard_inventory_controlled_journal_line on public.journal_lines;
create trigger trg_guard_inventory_controlled_journal_line
before insert or update of account_id,journal_entry_id,workspace_id on public.journal_lines
for each row execute function private.guard_inventory_controlled_journal_line();

-- -----------------------------------------------------------------------------
-- 4) Create and post the balanced financial Journal for a posted stock document
-- -----------------------------------------------------------------------------
create or replace function private.create_inventory_journal(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_doc public.inventory_documents%rowtype;
  v_positive numeric(20,0);
  v_negative numeric(20,0);
  v_net numeric(20,0);
  v_jid uuid;
  v_line integer:=0;
  a_inventory uuid;
  a_counter uuid;
begin
  select * into v_doc from public.inventory_documents where id=p_document_id for update;
  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  if v_doc.status<>'posted' then raise exception 'INVENTORY_DOCUMENT_NOT_POSTED'; end if;
  if v_doc.journal_entry_id is not null then raise exception 'INVENTORY_JOURNAL_ALREADY_LINKED'; end if;
  if v_doc.document_type='reversal' then raise exception 'INVENTORY_REVERSAL_JOURNAL_USE_REVERSE_ENGINE'; end if;

  perform private.ensure_inventory_account_roles(v_doc.workspace_id);
  a_inventory:=private.inventory_account_id(v_doc.workspace_id,'inventory_asset');

  select
    coalesce(sum(case when ledger_value_delta>0 then ledger_value_delta else 0 end),0),
    coalesce(-sum(case when ledger_value_delta<0 then ledger_value_delta else 0 end),0),
    coalesce(sum(ledger_value_delta),0)
  into v_positive,v_negative,v_net
  from public.inventory_movements
  where workspace_id=v_doc.workspace_id and inventory_document_id=v_doc.id;

  if v_doc.document_type='transfer' then
    if v_net<>0 then raise exception 'TRANSFER_LEDGER_VALUE_NOT_ZERO'; end if;
    return null;
  elsif v_doc.document_type in('opening','receipt') then
    if v_negative<>0 then raise exception 'INVENTORY_VALUE_SIGN_INVALID'; end if;
    if v_positive=0 then return null; end if;
  elsif v_doc.document_type='issue' then
    if v_positive<>0 then raise exception 'INVENTORY_VALUE_SIGN_INVALID'; end if;
    if v_negative=0 then return null; end if;
  elsif v_doc.document_type='adjustment' then
    if v_positive=0 and v_negative=0 then return null; end if;
  else
    raise exception 'INVENTORY_DOCUMENT_TYPE_INVALID';
  end if;

  insert into public.journal_entries(workspace_id,fiscal_year_id,entry_date,description,source_type,source_id,status,created_by)
  values(v_doc.workspace_id,v_doc.fiscal_year_id,v_doc.document_date,
         'سند مالی انبار — '||coalesce(v_doc.description,v_doc.document_type),
         'inventory_document',v_doc.id,'draft',auth.uid())
  returning id into v_jid;

  if v_doc.document_type='opening' then
    a_counter:=private.inventory_account_id(v_doc.workspace_id,'opening_equity');
    v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_inventory,'افزایش موجودی افتتاحیه',v_positive,0);
    v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_counter,'طرف حساب موجودی افتتاحیه',0,v_positive);
  elsif v_doc.document_type='receipt' then
    a_counter:=private.inventory_account_id(v_doc.workspace_id,'inventory_clearing');
    v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_inventory,'رسید موجودی',v_positive,0);
    v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_counter,'کالای دریافت‌شده صورتحساب‌نشده',0,v_positive);
  elsif v_doc.document_type='issue' then
    a_counter:=private.inventory_account_id(v_doc.workspace_id,'inventory_cogs');
    v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_counter,'بهای تمام‌شده خروج کالا',v_negative,0);
    v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_inventory,'کاهش موجودی بابت خروج کالا',0,v_negative);
  elsif v_doc.document_type='adjustment' then
    if v_positive>0 then
      a_counter:=private.inventory_account_id(v_doc.workspace_id,'inventory_gain');
      v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_inventory,'تعدیل مثبت موجودی',v_positive,0);
      v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_counter,'درآمد تعدیل مثبت موجودی',0,v_positive);
    end if;
    if v_negative>0 then
      a_counter:=private.inventory_account_id(v_doc.workspace_id,'inventory_loss');
      v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_counter,'هزینه تعدیل منفی موجودی',v_negative,0);
      v_line:=v_line+1; insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit) values(v_doc.workspace_id,v_jid,v_line,a_inventory,'کاهش موجودی بابت تعدیل',0,v_negative);
    end if;
  end if;

  perform private.post_journal_entry(v_jid);
  return v_jid;
end;
$$;
revoke all on function private.create_inventory_journal(uuid) from public,anon,authenticated;

-- Allow exactly one system journal link to be attached after stock posting, still inside the transaction.
create or replace function private.guard_inventory_document_mutation()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE'; end if;
    return old;
  end if;

  if old.status='draft' and new.status='draft' then return new; end if;

  if old.status='draft' and new.status='posted' then
    if (pg_catalog.to_jsonb(new)-array['status','document_no','posted_by','posted_at','updated_at'])<>(pg_catalog.to_jsonb(old)-array['status','document_no','posted_by','posted_at','updated_at'])
       or new.document_no is null or new.posted_by is null or new.posted_at is null then
      raise exception 'INVALID_INVENTORY_POST_TRANSITION';
    end if;
    return new;
  end if;

  if old.status='posted' and new.status='posted' and old.journal_entry_id is null and new.journal_entry_id is not null then
    if (pg_catalog.to_jsonb(new)-array['journal_entry_id','updated_at'])<>(pg_catalog.to_jsonb(old)-array['journal_entry_id','updated_at']) then
      raise exception 'INVALID_INVENTORY_JOURNAL_LINK_TRANSITION';
    end if;
    if not exists(
      select 1 from public.journal_entries j
      where j.id=new.journal_entry_id and j.workspace_id=new.workspace_id
        and j.status='posted' and j.source_type='inventory_document' and j.source_id=new.id
    ) then raise exception 'INVENTORY_JOURNAL_LINK_INVALID'; end if;
    return new;
  end if;

  if old.status='posted' and new.status='reversed' then
    if (pg_catalog.to_jsonb(new)-array['status','reversed_by','reversed_at','updated_at'])<>(pg_catalog.to_jsonb(old)-array['status','reversed_by','reversed_at','updated_at'])
       or new.reversed_by is null or new.reversed_at is null then
      raise exception 'INVALID_INVENTORY_REVERSE_TRANSITION';
    end if;
    return new;
  end if;

  raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE';
end;
$$;

create or replace function private.post_inventory_document_accounted(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare v_jid uuid;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  perform private.post_inventory_document(p_document_id);
  v_jid:=private.create_inventory_journal(p_document_id);
  if v_jid is not null then
    update public.inventory_documents
       set journal_entry_id=v_jid,updated_at=now()
     where id=p_document_id;
  end if;
  return p_document_id;
end;
$$;

-- The stock-only helper is now internal-only; browser command path must include accounting.
revoke execute on function private.post_inventory_document(uuid) from public,anon,authenticated,service_role;
revoke all on function private.post_inventory_document_accounted(uuid) from public,anon;
grant execute on function private.post_inventory_document_accounted(uuid) to authenticated,service_role;

create or replace function public.post_inventory_document(p_document_id uuid)
returns uuid
language sql
security invoker
set search_path=''
as $$ select private.post_inventory_document_accounted(p_document_id) $$;
revoke all on function public.post_inventory_document(uuid) from public,anon;
grant execute on function public.post_inventory_document(uuid) to authenticated,service_role;

-- -----------------------------------------------------------------------------
-- 5) Inventory reversal + exact Financial Journal reversal in one transaction
-- -----------------------------------------------------------------------------
create or replace function private.reverse_inventory_document(
  p_document_id uuid,
  p_reverse_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_src public.inventory_documents%rowtype;
  v_src_line public.inventory_document_lines%rowtype;
  v_src_move public.inventory_movements%rowtype;
  v_check record;
  v_reverse_id uuid;
  v_reverse_line_id uuid;
  v_reverse_fy uuid;
  v_reverse_journal uuid;
  v_allow_negative boolean;
  v_qty numeric(24,6);
  v_cost numeric(24,6);
  v_no bigint;
  v_lock bigint;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reverse_date is null then raise exception 'REVERSE_DATE_REQUIRED'; end if;

  select * into v_src from public.inventory_documents where id=p_document_id for update;
  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(v_src.workspace_id);
  if v_src.status<>'posted' then raise exception 'INVENTORY_DOCUMENT_NOT_POSTED'; end if;
  if exists(select 1 from public.inventory_documents r where r.workspace_id=v_src.workspace_id and r.reversal_of=v_src.id) then raise exception 'INVENTORY_DOCUMENT_ALREADY_REVERSED'; end if;

  if v_src.journal_entry_id is not null and not exists(
    select 1 from public.journal_entries j
    where j.id=v_src.journal_entry_id and j.workspace_id=v_src.workspace_id
      and j.status='posted' and j.source_type='inventory_document' and j.source_id=v_src.id
  ) then raise exception 'INVENTORY_FINANCIAL_LINK_INVALID'; end if;

  select fy.id into v_reverse_fy from public.fiscal_years fy
  where fy.workspace_id=v_src.workspace_id and fy.status='open' and p_reverse_date between fy.date_from and fy.date_to
  order by fy.date_from desc limit 1;
  if v_reverse_fy is null then raise exception 'FISCAL_YEAR_INVALID'; end if;
  if v_src.journal_entry_id is not null and v_reverse_fy<>v_src.fiscal_year_id then raise exception 'INVENTORY_FINANCIAL_REVERSE_FY_MISMATCH'; end if;

  if exists(select 1 from public.fiscal_periods p where p.workspace_id=v_src.workspace_id and p.status='closed' and p_reverse_date between p.date_from and p.date_to) then raise exception 'PERIOD_CLOSED'; end if;
  if not exists(select 1 from public.inventory_movements m where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id) then raise exception 'INVENTORY_MOVEMENTS_MISSING'; end if;

  select coalesce(s.allow_negative_stock,false) into v_allow_negative from public.inventory_settings s where s.workspace_id=v_src.workspace_id;
  v_allow_negative:=coalesce(v_allow_negative,false);

  for v_lock in
    select distinct pg_catalog.hashtextextended(m.workspace_id::text||':'||m.item_id::text||':'||m.warehouse_id::text,0) lock_key
    from public.inventory_movements m
    where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id
    order by lock_key
  loop perform pg_catalog.pg_advisory_xact_lock(v_lock); end loop;

  if not v_allow_negative then
    for v_check in
      select m.item_id,m.warehouse_id,sum(m.quantity_delta)::numeric(24,6) qty_to_remove
      from public.inventory_movements m
      where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id and m.quantity_delta>0
      group by m.item_id,m.warehouse_id
    loop
      select coalesce(sum(m.quantity_delta),0) into v_qty from public.inventory_movements m
      where m.workspace_id=v_src.workspace_id and m.item_id=v_check.item_id and m.warehouse_id=v_check.warehouse_id;
      if v_qty<v_check.qty_to_remove then raise exception 'REVERSAL_NEGATIVE_STOCK_FORBIDDEN'; end if;
    end loop;
  end if;

  insert into public.inventory_documents(workspace_id,fiscal_year_id,document_type,document_date,description,status,source_type,source_id,reversal_of,created_by)
  values(v_src.workspace_id,v_reverse_fy,'reversal',p_reverse_date,
         coalesce(nullif(btrim(p_reason),''),'برگشت سند انبار')||' — '||coalesce(v_src.description,''),
         'draft','inventory_reversal',v_src.id,v_src.id,auth.uid())
  returning id into v_reverse_id;

  for v_src_line in
    select * from public.inventory_document_lines where workspace_id=v_src.workspace_id and inventory_document_id=v_src.id order by line_no,id
  loop
    select coalesce(max(m.unit_cost),v_src_line.unit_cost) into v_cost from public.inventory_movements m
    where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id and m.inventory_document_line_id=v_src_line.id;

    insert into public.inventory_document_lines(workspace_id,inventory_document_id,line_no,item_id,from_warehouse_id,to_warehouse_id,quantity,unit_cost,description)
    values(v_src.workspace_id,v_reverse_id,v_src_line.line_no,v_src_line.item_id,v_src_line.to_warehouse_id,v_src_line.from_warehouse_id,v_src_line.quantity,v_cost,v_src_line.description)
    returning id into v_reverse_line_id;

    for v_src_move in
      select * from public.inventory_movements
      where workspace_id=v_src.workspace_id and inventory_document_id=v_src.id and inventory_document_line_id=v_src_line.id
      order by posting_seq
    loop
      insert into public.inventory_movements(workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,movement_date,quantity_delta,unit_cost,reversal_of)
      values(v_src.workspace_id,v_reverse_id,v_reverse_line_id,v_src_move.item_id,v_src_move.warehouse_id,p_reverse_date,-v_src_move.quantity_delta,v_src_move.unit_cost,v_src_move.id);
    end loop;
  end loop;

  if v_src.journal_entry_id is not null then
    v_reverse_journal:=private.reverse_journal_entry(v_src.journal_entry_id,p_reverse_date,coalesce(p_reason,'برگشت سند انبار'));
    update public.inventory_documents set journal_entry_id=v_reverse_journal,updated_at=now() where id=v_reverse_id;
  end if;

  v_no:=private.next_inventory_document_number(v_src.workspace_id,v_reverse_fy);
  update public.inventory_documents set status='posted',document_no=v_no,posted_by=auth.uid(),posted_at=now(),updated_at=now() where id=v_reverse_id;
  update public.inventory_documents set status='reversed',reversed_by=auth.uid(),reversed_at=now(),updated_at=now() where id=v_src.id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(v_src.workspace_id,'reverse','inventory_document',v_src.id,'Inventory document + financial journal reversed');
  return v_reverse_id;
end;
$$;

revoke all on function private.reverse_inventory_document(uuid,date,text) from public,anon;
grant execute on function private.reverse_inventory_document(uuid,date,text) to authenticated,service_role;

-- Public reverse wrapper from RC1.4-B remains SECURITY INVOKER and calls this enhanced implementation.
