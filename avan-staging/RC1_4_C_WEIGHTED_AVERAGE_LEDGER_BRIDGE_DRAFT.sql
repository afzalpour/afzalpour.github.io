-- Avan RC1.4-C Moving Weighted Average + Financial Ledger Bridge
-- STATUS: repository candidate only; NOT APPLIED to Production.
-- Requires RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql and RC1_4_B_INVENTORY_POSTING_ENGINE_DRAFT.sql.
-- Canonical financial Ledger remains integer Toman.

-- ============================================================
-- 1) Inventory accounting roles
-- ============================================================
create or replace function private.ensure_inventory_account_roles(p_wid uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent uuid;
  v_account uuid;
  v_count integer := 0;
  r record;
begin
  if not exists (select 1 from public.workspaces w where w.id=p_wid) then
    raise exception 'COMPANY_NOT_FOUND';
  end if;

  -- Ensure the standard level-2 headings exist first.
  perform private.ensure_standard_account_chart(p_wid);

  for r in
    select * from (values
      ('inventory_asset','130','1301','موجودی کالا','asset','debit'),
      ('inventory_cogs','520','5201','بهای تمام‌شده کالای فروش‌رفته','expense','debit'),
      ('inventory_grni','225','2251','کالای دریافت‌شده فاکتورنشده','liability','credit'),
      ('inventory_adjustment_gain','425','4251','سود تعدیل موجودی','income','credit'),
      ('inventory_adjustment_loss','570','5701','زیان تعدیل موجودی','expense','debit')
    ) as x(role_key,parent_code,code,name,category,normal_balance)
  loop
    select a.id into v_parent
    from public.accounts a
    where a.workspace_id=p_wid and a.code=r.parent_code
    limit 1;
    if v_parent is null then raise exception 'INVENTORY_ACCOUNT_PARENT_MISSING:%',r.parent_code; end if;

    -- Respect an already-configured valid role.
    select a.id into v_account
    from public.account_roles ar
    join public.accounts a on a.id=ar.account_id and a.workspace_id=ar.workspace_id
    where ar.workspace_id=p_wid and ar.role_key=r.role_key
      and a.is_active and a.is_postable
    limit 1;

    if v_account is null then
      select a.id into v_account
      from public.accounts a
      where a.workspace_id=p_wid and a.code=r.code
      limit 1;

      if v_account is null then
        insert into public.accounts(
          workspace_id,parent_id,code,name,level,category,normal_balance,is_postable,is_system,is_active
        ) values(
          p_wid,v_parent,r.code,r.name,3,r.category,r.normal_balance,true,true,true
        ) returning id into v_account;
        v_count := v_count + 1;
      else
        update public.accounts
           set parent_id=v_parent,name=r.name,level=3,category=r.category,
               normal_balance=r.normal_balance,is_postable=true,is_system=true,is_active=true,
               updated_at=now()
         where id=v_account and workspace_id=p_wid;
      end if;

      insert into public.account_roles(workspace_id,role_key,account_id)
      values(p_wid,r.role_key,v_account)
      on conflict(workspace_id,role_key) do update set account_id=excluded.account_id;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke all on function private.ensure_inventory_account_roles(uuid) from public, anon, authenticated;

-- Existing companies are prepared when this candidate is eventually migrated.
do $$
declare r record;
begin
  for r in select id from public.workspaces loop
    perform private.ensure_inventory_account_roles(r.id);
  end loop;
end;
$$;

-- ============================================================
-- 2) New-company onboarding extension
-- ============================================================
create or replace function private.create_avan_company(
  p_name text,
  p_money_unit text default 'toman',
  p_fiscal_name text default '۱۴۰۵',
  p_date_from date default date '2026-03-21',
  p_date_to date default date '2027-03-20',
  p_profile jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_wid uuid;
  v_fyid uuid;
  v_profile jsonb;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  v_name := nullif(btrim(p_name), '');
  if v_name is null then raise exception 'COMPANY_NAME_REQUIRED'; end if;
  if char_length(v_name) > 160 then raise exception 'COMPANY_NAME_TOO_LONG'; end if;
  if p_money_unit not in ('toman','rial') then raise exception 'MONEY_UNIT_INVALID'; end if;
  if p_date_from is null or p_date_to is null or p_date_from > p_date_to then raise exception 'FISCAL_DATE_RANGE_INVALID'; end if;
  if p_profile is null or jsonb_typeof(p_profile) <> 'object' then raise exception 'PROFILE_INVALID'; end if;

  v_wid := public.create_workspace(v_name, 'business', p_money_unit);
  v_fyid := private.initialize_avan_company_core(v_wid,p_fiscal_name,p_date_from,p_date_to);
  perform private.ensure_standard_account_chart(v_wid);
  perform private.ensure_inventory_account_roles(v_wid);

  v_profile := p_profile || jsonb_build_object('display_name', v_name);
  perform public.set_workspace_print_profile(v_wid, v_profile);
  insert into public.audit_logs(workspace_id, action, entity_type, entity_id, summary)
  values(v_wid, 'company_created', 'workspace', v_wid, 'Company tenant created through Avan onboarding');

  return jsonb_build_object('company_id',v_wid,'workspace_id',v_wid,'fiscal_year_id',v_fyid,'role','owner','created',true);
end;
$$;

-- ============================================================
-- 3) Inventory valuation / canonical Ledger rounding boundary
-- ============================================================
create or replace view public.inventory_valuation
with (security_invoker = true)
as
select
  m.workspace_id,
  m.item_id,
  m.warehouse_id,
  sum(m.quantity_delta)::numeric(20,6) as quantity_on_hand,
  sum(m.value_delta)::numeric(30,6) as exact_inventory_value,
  sum(round(m.value_delta,0))::numeric(30,0) as ledger_inventory_value_toman,
  case when sum(m.quantity_delta)=0 then 0::numeric
       else round(sum(m.value_delta)/sum(m.quantity_delta),6)
  end::numeric(24,6) as moving_average_unit_cost,
  (sum(m.value_delta)-sum(round(m.value_delta,0)))::numeric(30,6) as sub_toman_rounding_delta
from public.inventory_movements m
group by m.workspace_id,m.item_id,m.warehouse_id;

revoke all on public.inventory_valuation from anon;
grant select on public.inventory_valuation to authenticated;

-- ============================================================
-- 4) Journal creation helper
-- ============================================================
create or replace function private.create_inventory_financial_journal(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.inventory_documents%rowtype;
  v_inventory uuid;
  v_cogs uuid;
  v_grni uuid;
  v_adj_gain uuid;
  v_adj_loss uuid;
  v_opening uuid;
  v_jid uuid;
  v_debit numeric(20,0);
  v_credit numeric(20,0);
  v_pos numeric(20,0);
  v_neg numeric(20,0);
  v_line integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into d from public.inventory_documents where id=p_document_id for update;
  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(d.workspace_id);
  if d.status <> 'draft' then raise exception 'INVENTORY_DOCUMENT_NOT_DRAFT'; end if;
  if d.document_type='transfer' then return null; end if;

  perform private.ensure_inventory_account_roles(d.workspace_id);

  select ar.account_id into v_inventory from public.account_roles ar where ar.workspace_id=d.workspace_id and ar.role_key='inventory_asset';
  select ar.account_id into v_cogs from public.account_roles ar where ar.workspace_id=d.workspace_id and ar.role_key='inventory_cogs';
  select ar.account_id into v_grni from public.account_roles ar where ar.workspace_id=d.workspace_id and ar.role_key='inventory_grni';
  select ar.account_id into v_adj_gain from public.account_roles ar where ar.workspace_id=d.workspace_id and ar.role_key='inventory_adjustment_gain';
  select ar.account_id into v_adj_loss from public.account_roles ar where ar.workspace_id=d.workspace_id and ar.role_key='inventory_adjustment_loss';
  select ar.account_id into v_opening from public.account_roles ar where ar.workspace_id=d.workspace_id and ar.role_key='opening_equity';

  if v_inventory is null or v_cogs is null or v_grni is null or v_adj_gain is null or v_adj_loss is null or v_opening is null then
    raise exception 'INVENTORY_ACCOUNT_ROLE_MISSING';
  end if;

  select
    coalesce(sum(case when m.value_delta > 0 then round(m.value_delta,0) else 0 end),0),
    coalesce(sum(case when m.value_delta < 0 then round(abs(m.value_delta),0) else 0 end),0)
  into v_pos,v_neg
  from public.inventory_movements m
  where m.workspace_id=d.workspace_id and m.inventory_document_id=d.id;

  if d.document_type in ('opening','receipt') and v_pos <= 0 then
    raise exception 'INVENTORY_FINANCIAL_VALUE_REQUIRED';
  end if;
  if d.document_type='issue' and v_neg <= 0 then
    raise exception 'INVENTORY_FINANCIAL_VALUE_REQUIRED';
  end if;
  if d.document_type='adjustment' and v_pos=0 and v_neg=0 then
    raise exception 'INVENTORY_FINANCIAL_VALUE_REQUIRED';
  end if;

  insert into public.journal_entries(
    workspace_id,fiscal_year_id,entry_date,description,source_type,source_id,status,created_by
  ) values(
    d.workspace_id,d.fiscal_year_id,d.document_date,
    'ثبت مالی سند انبار — '||coalesce(d.description,d.document_type),
    'inventory_'||d.document_type,d.id,'draft',auth.uid()
  ) returning id into v_jid;

  if d.document_type='opening' then
    v_line:=1;
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
    values(d.workspace_id,v_jid,v_line,v_inventory,'موجودی افتتاحیه',v_pos,0);
    v_line:=2;
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
    values(d.workspace_id,v_jid,v_line,v_opening,'طرف حساب موجودی افتتاحیه',0,v_pos);

  elsif d.document_type='receipt' then
    v_line:=1;
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
    values(d.workspace_id,v_jid,v_line,v_inventory,'افزایش موجودی',v_pos,0);
    v_line:=2;
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
    values(d.workspace_id,v_jid,v_line,v_grni,'کالای دریافت‌شده فاکتورنشده',0,v_pos);

  elsif d.document_type='issue' then
    v_line:=1;
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
    values(d.workspace_id,v_jid,v_line,v_cogs,'بهای تمام‌شده خروج کالا',v_neg,0);
    v_line:=2;
    insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
    values(d.workspace_id,v_jid,v_line,v_inventory,'کاهش موجودی',0,v_neg);

  elsif d.document_type='adjustment' then
    if v_pos > 0 then
      v_line:=v_line+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(d.workspace_id,v_jid,v_line,v_inventory,'افزایش تعدیلی موجودی',v_pos,0);
      v_line:=v_line+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(d.workspace_id,v_jid,v_line,v_adj_gain,'سود تعدیل موجودی',0,v_pos);
    end if;
    if v_neg > 0 then
      v_line:=v_line+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(d.workspace_id,v_jid,v_line,v_adj_loss,'زیان تعدیل موجودی',v_neg,0);
      v_line:=v_line+1;
      insert into public.journal_lines(workspace_id,journal_entry_id,line_no,account_id,description,debit,credit)
      values(d.workspace_id,v_jid,v_line,v_inventory,'کاهش تعدیلی موجودی',0,v_neg);
    end if;
  else
    raise exception 'INVENTORY_FINANCIAL_DOCUMENT_TYPE_INVALID';
  end if;

  select coalesce(sum(l.debit),0),coalesce(sum(l.credit),0)
  into v_debit,v_credit
  from public.journal_lines l where l.journal_entry_id=v_jid;
  if v_debit <= 0 or v_debit <> v_credit then raise exception 'INVENTORY_JOURNAL_NOT_BALANCED'; end if;

  perform private.post_journal_entry(v_jid);
  return v_jid;
end;
$$;

revoke all on function private.create_inventory_financial_journal(uuid) from public, anon, authenticated;

-- ============================================================
-- 5) Lifecycle guard extended for atomic journal linkage
-- ============================================================
create or replace function private.guard_inventory_document_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op='DELETE' then
    if old.status <> 'draft' then raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE'; end if;
    return old;
  end if;

  if old.status='draft' and new.status='draft' then return new; end if;

  if old.status='draft' and new.status='posted' then
    if (pg_catalog.to_jsonb(new) - array['status','document_no','journal_entry_id','posted_by','posted_at','updated_at'])
       <> (pg_catalog.to_jsonb(old) - array['status','document_no','journal_entry_id','posted_by','posted_at','updated_at'])
       or new.document_no is null or new.posted_by is null or new.posted_at is null then
      raise exception 'INVALID_INVENTORY_POST_TRANSITION';
    end if;
    if new.document_type='transfer' and new.journal_entry_id is not null then
      raise exception 'TRANSFER_MUST_NOT_HAVE_JOURNAL';
    end if;
    if new.document_type not in ('transfer','reversal') and new.journal_entry_id is null then
      raise exception 'INVENTORY_JOURNAL_LINK_REQUIRED';
    end if;
    return new;
  end if;

  if old.status='posted' and new.status='reversed' then
    if (pg_catalog.to_jsonb(new) - array['status','reversed_by','reversed_at','updated_at'])
       <> (pg_catalog.to_jsonb(old) - array['status','reversed_by','reversed_at','updated_at'])
       or new.reversed_by is null or new.reversed_at is null then
      raise exception 'INVALID_INVENTORY_REVERSE_TRANSITION';
    end if;
    return new;
  end if;

  raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE';
end;
$$;

-- ============================================================
-- 6) Replace Posting Engine with atomic stock + financial posting
-- ============================================================
create or replace function private.post_inventory_document(p_document_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_doc public.inventory_documents%rowtype;
  v_line public.inventory_document_lines%rowtype;
  v_qty numeric(24,6);
  v_value numeric(30,6);
  v_cost numeric(24,6);
  v_allow_negative boolean;
  v_count integer;
  v_lock bigint;
  v_no bigint;
  v_journal_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_doc from public.inventory_documents where id=p_document_id for update;
  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(v_doc.workspace_id);
  if v_doc.status <> 'draft' then raise exception 'INVENTORY_DOCUMENT_NOT_DRAFT'; end if;
  if v_doc.document_type='reversal' then raise exception 'RESERVED_INVENTORY_DOCUMENT_TYPE'; end if;
  if v_doc.journal_entry_id is not null or v_doc.reversal_of is not null then raise exception 'INVALID_INVENTORY_DRAFT_SYSTEM_LINK'; end if;

  if not exists (
    select 1 from public.fiscal_years fy
    where fy.id=v_doc.fiscal_year_id and fy.workspace_id=v_doc.workspace_id and fy.status='open'
      and v_doc.document_date between fy.date_from and fy.date_to
  ) then raise exception 'FISCAL_YEAR_INVALID'; end if;
  if exists (
    select 1 from public.fiscal_periods p where p.workspace_id=v_doc.workspace_id and p.status='closed'
      and v_doc.document_date between p.date_from and p.date_to
  ) then raise exception 'PERIOD_CLOSED'; end if;

  select count(*) into v_count from public.inventory_document_lines l
  where l.inventory_document_id=v_doc.id and l.workspace_id=v_doc.workspace_id;
  if v_count < 1 then raise exception 'INVENTORY_DOCUMENT_EMPTY'; end if;

  select coalesce(s.allow_negative_stock,false) into v_allow_negative
  from public.inventory_settings s where s.workspace_id=v_doc.workspace_id;
  v_allow_negative:=coalesce(v_allow_negative,false);

  for v_line in
    select * from public.inventory_document_lines where inventory_document_id=v_doc.id order by line_no,id
  loop
    if not exists (
      select 1 from public.inventory_items i where i.id=v_line.item_id and i.workspace_id=v_doc.workspace_id
        and i.is_active and i.item_type='inventory'
    ) then raise exception 'INVENTORY_ITEM_INVALID'; end if;
    if v_line.from_warehouse_id is not null and not exists (
      select 1 from public.warehouses w where w.id=v_line.from_warehouse_id and w.workspace_id=v_doc.workspace_id and w.is_active
    ) then raise exception 'SOURCE_WAREHOUSE_INVALID'; end if;
    if v_line.to_warehouse_id is not null and not exists (
      select 1 from public.warehouses w where w.id=v_line.to_warehouse_id and w.workspace_id=v_doc.workspace_id and w.is_active
    ) then raise exception 'DESTINATION_WAREHOUSE_INVALID'; end if;

    if v_doc.document_type in ('opening','receipt') and (v_line.from_warehouse_id is not null or v_line.to_warehouse_id is null) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    elsif v_doc.document_type='issue' and (v_line.from_warehouse_id is null or v_line.to_warehouse_id is not null) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    elsif v_doc.document_type='transfer' and (v_line.from_warehouse_id is null or v_line.to_warehouse_id is null or v_line.from_warehouse_id=v_line.to_warehouse_id) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    elsif v_doc.document_type='adjustment' and ((v_line.from_warehouse_id is null)=(v_line.to_warehouse_id is null)) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    end if;
  end loop;

  for v_lock in
    select distinct q.lock_key from (
      select pg_catalog.hashtextextended(v_doc.workspace_id::text||':'||l.item_id::text||':'||l.from_warehouse_id::text,0) lock_key
      from public.inventory_document_lines l where l.inventory_document_id=v_doc.id and l.from_warehouse_id is not null
      union all
      select pg_catalog.hashtextextended(v_doc.workspace_id::text||':'||l.item_id::text||':'||l.to_warehouse_id::text,0) lock_key
      from public.inventory_document_lines l where l.inventory_document_id=v_doc.id and l.to_warehouse_id is not null
    ) q order by q.lock_key
  loop
    perform pg_catalog.pg_advisory_xact_lock(v_lock);
  end loop;

  for v_line in
    select * from public.inventory_document_lines where inventory_document_id=v_doc.id order by line_no,id
  loop
    if v_doc.document_type in ('opening','receipt') then
      if v_line.unit_cost <= 0 then raise exception 'INVENTORY_UNIT_COST_REQUIRED'; end if;
      insert into public.inventory_movements(workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,movement_date,quantity_delta,unit_cost)
      values(v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.to_warehouse_id,v_doc.document_date,v_line.quantity,v_line.unit_cost);

    elsif v_doc.document_type in ('issue','transfer') or (v_doc.document_type='adjustment' and v_line.from_warehouse_id is not null) then
      select coalesce(sum(m.quantity_delta),0),coalesce(sum(m.value_delta),0)
      into v_qty,v_value from public.inventory_movements m
      where m.workspace_id=v_doc.workspace_id and m.item_id=v_line.item_id and m.warehouse_id=v_line.from_warehouse_id;

      if not v_allow_negative and v_qty < v_line.quantity then raise exception 'NEGATIVE_STOCK_FORBIDDEN'; end if;
      if v_qty > 0 then
        v_cost:=round(v_value/v_qty,6);
        if v_cost < 0 then raise exception 'INVENTORY_VALUE_INVALID'; end if;
      elsif v_allow_negative and v_line.unit_cost > 0 then
        v_cost:=v_line.unit_cost;
      else
        raise exception 'OUTGOING_COST_UNAVAILABLE';
      end if;

      insert into public.inventory_movements(workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,movement_date,quantity_delta,unit_cost)
      values(v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.from_warehouse_id,v_doc.document_date,-v_line.quantity,v_cost);

      if v_doc.document_type='transfer' then
        insert into public.inventory_movements(workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,movement_date,quantity_delta,unit_cost)
        values(v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.to_warehouse_id,v_doc.document_date,v_line.quantity,v_cost);
      end if;

    elsif v_doc.document_type='adjustment' and v_line.to_warehouse_id is not null then
      if v_line.unit_cost <= 0 then raise exception 'INVENTORY_UNIT_COST_REQUIRED'; end if;
      insert into public.inventory_movements(workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,movement_date,quantity_delta,unit_cost)
      values(v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.to_warehouse_id,v_doc.document_date,v_line.quantity,v_line.unit_cost);
    end if;
  end loop;

  v_journal_id:=private.create_inventory_financial_journal(v_doc.id);
  v_no:=private.next_inventory_document_number(v_doc.workspace_id,v_doc.fiscal_year_id);

  update public.inventory_documents
     set status='posted',document_no=v_no,journal_entry_id=v_journal_id,
         posted_by=auth.uid(),posted_at=now(),updated_at=now()
   where id=v_doc.id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(v_doc.workspace_id,'post','inventory_document',v_doc.id,'Inventory document posted with financial bridge');

  return v_doc.id;
end;
$$;

-- ============================================================
-- 7) Exact inventory + journal reversal
-- ============================================================
create or replace function private.reverse_inventory_document(
  p_document_id uuid,
  p_reverse_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_src public.inventory_documents%rowtype;
  v_src_line public.inventory_document_lines%rowtype;
  v_src_move public.inventory_movements%rowtype;
  v_check record;
  v_reverse_id uuid;
  v_reverse_line_id uuid;
  v_reverse_fy uuid;
  v_fin_reverse_id uuid;
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
  if v_src.status <> 'posted' then raise exception 'INVENTORY_DOCUMENT_NOT_POSTED'; end if;
  if exists(select 1 from public.inventory_documents r where r.workspace_id=v_src.workspace_id and r.reversal_of=v_src.id) then
    raise exception 'INVENTORY_DOCUMENT_ALREADY_REVERSED';
  end if;

  select fy.id into v_reverse_fy from public.fiscal_years fy
  where fy.workspace_id=v_src.workspace_id and fy.status='open' and p_reverse_date between fy.date_from and fy.date_to
  order by fy.date_from desc limit 1;
  if v_reverse_fy is null then raise exception 'FISCAL_YEAR_INVALID'; end if;
  if exists(select 1 from public.fiscal_periods p where p.workspace_id=v_src.workspace_id and p.status='closed' and p_reverse_date between p.date_from and p.date_to) then
    raise exception 'PERIOD_CLOSED';
  end if;
  if not exists(select 1 from public.inventory_movements m where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id) then
    raise exception 'INVENTORY_MOVEMENTS_MISSING';
  end if;

  if v_src.journal_entry_id is not null and v_reverse_fy <> v_src.fiscal_year_id then
    raise exception 'INVENTORY_FINANCIAL_CROSS_YEAR_REVERSAL_NOT_SUPPORTED';
  end if;

  select coalesce(s.allow_negative_stock,false) into v_allow_negative from public.inventory_settings s where s.workspace_id=v_src.workspace_id;
  v_allow_negative:=coalesce(v_allow_negative,false);

  for v_lock in
    select distinct pg_catalog.hashtextextended(m.workspace_id::text||':'||m.item_id::text||':'||m.warehouse_id::text,0) lock_key
    from public.inventory_movements m where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id order by lock_key
  loop
    perform pg_catalog.pg_advisory_xact_lock(v_lock);
  end loop;

  if not v_allow_negative then
    for v_check in
      select m.item_id,m.warehouse_id,sum(m.quantity_delta)::numeric(24,6) qty_to_remove
      from public.inventory_movements m
      where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id and m.quantity_delta>0
      group by m.item_id,m.warehouse_id
    loop
      select coalesce(sum(m.quantity_delta),0) into v_qty from public.inventory_movements m
      where m.workspace_id=v_src.workspace_id and m.item_id=v_check.item_id and m.warehouse_id=v_check.warehouse_id;
      if v_qty < v_check.qty_to_remove then raise exception 'REVERSAL_NEGATIVE_STOCK_FORBIDDEN'; end if;
    end loop;
  end if;

  insert into public.inventory_documents(
    workspace_id,fiscal_year_id,document_type,document_date,description,status,source_type,source_id,reversal_of,created_by
  ) values(
    v_src.workspace_id,v_reverse_fy,'reversal',p_reverse_date,
    coalesce(nullif(btrim(p_reason),''),'برگشت سند انبار')||' — '||coalesce(v_src.description,''),
    'draft','inventory_reversal',v_src.id,v_src.id,auth.uid()
  ) returning id into v_reverse_id;

  for v_src_line in
    select * from public.inventory_document_lines where workspace_id=v_src.workspace_id and inventory_document_id=v_src.id order by line_no,id
  loop
    select coalesce(max(m.unit_cost),v_src_line.unit_cost) into v_cost from public.inventory_movements m
    where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id and m.inventory_document_line_id=v_src_line.id;

    insert into public.inventory_document_lines(
      workspace_id,inventory_document_id,line_no,item_id,from_warehouse_id,to_warehouse_id,quantity,unit_cost,description
    ) values(
      v_src.workspace_id,v_reverse_id,v_src_line.line_no,v_src_line.item_id,v_src_line.to_warehouse_id,v_src_line.from_warehouse_id,
      v_src_line.quantity,v_cost,v_src_line.description
    ) returning id into v_reverse_line_id;

    for v_src_move in
      select * from public.inventory_movements
      where workspace_id=v_src.workspace_id and inventory_document_id=v_src.id and inventory_document_line_id=v_src_line.id
      order by posting_seq
    loop
      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,movement_date,quantity_delta,unit_cost,reversal_of
      ) values(
        v_src.workspace_id,v_reverse_id,v_reverse_line_id,v_src_move.item_id,v_src_move.warehouse_id,p_reverse_date,
        -v_src_move.quantity_delta,v_src_move.unit_cost,v_src_move.id
      );
    end loop;
  end loop;

  if v_src.journal_entry_id is not null then
    v_fin_reverse_id:=private.reverse_journal_entry(v_src.journal_entry_id,p_reverse_date,coalesce(p_reason,'برگشت سند انبار'));
  end if;

  v_no:=private.next_inventory_document_number(v_src.workspace_id,v_reverse_fy);
  update public.inventory_documents
     set status='posted',document_no=v_no,journal_entry_id=v_fin_reverse_id,
         posted_by=auth.uid(),posted_at=now(),updated_at=now()
   where id=v_reverse_id;

  update public.inventory_documents
     set status='reversed',reversed_by=auth.uid(),reversed_at=now(),updated_at=now()
   where id=v_src.id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(v_src.workspace_id,'reverse','inventory_document',v_src.id,'Inventory document and financial journal reversed');

  return v_reverse_id;
end;
$$;

-- Existing public wrappers from RC1.4-B remain SECURITY INVOKER and resolve these replaced private implementations.

-- ============================================================
-- 8) Reconciliation view
-- ============================================================
create or replace view public.inventory_financial_reconciliation
with (security_invoker = true)
as
with movement as (
  select m.workspace_id,
         coalesce(sum(round(m.value_delta,0)),0)::numeric(30,0) as movement_ledger_value
  from public.inventory_movements m
  group by m.workspace_id
), control as (
  select ar.workspace_id,
         coalesce(sum(l.debit-l.credit),0)::numeric(30,0) as inventory_account_balance
  from public.account_roles ar
  join public.journal_lines l on l.account_id=ar.account_id and l.workspace_id=ar.workspace_id
  join public.journal_entries j on j.id=l.journal_entry_id and j.workspace_id=l.workspace_id
  where ar.role_key='inventory_asset' and j.status in ('posted','reversed')
  group by ar.workspace_id
), cogs_move as (
  select d.workspace_id,
         coalesce(sum(round(abs(m.value_delta),0)),0)::numeric(30,0) as movement_cogs
  from public.inventory_documents d
  join public.inventory_movements m on m.inventory_document_id=d.id and m.workspace_id=d.workspace_id
  where d.document_type='issue'
  group by d.workspace_id
), cogs_ledger as (
  select ar.workspace_id,
         coalesce(sum(l.debit-l.credit),0)::numeric(30,0) as cogs_account_balance
  from public.account_roles ar
  join public.journal_lines l on l.account_id=ar.account_id and l.workspace_id=ar.workspace_id
  join public.journal_entries j on j.id=l.journal_entry_id and j.workspace_id=l.workspace_id
  where ar.role_key='inventory_cogs' and j.status in ('posted','reversed')
  group by ar.workspace_id
)
select w.id as workspace_id,
       coalesce(m.movement_ledger_value,0) as movement_ledger_value,
       coalesce(c.inventory_account_balance,0) as inventory_account_balance,
       coalesce(c.inventory_account_balance,0)-coalesce(m.movement_ledger_value,0) as inventory_difference,
       coalesce(cm.movement_cogs,0) as issue_movement_cogs,
       coalesce(cl.cogs_account_balance,0) as cogs_account_balance,
       coalesce(cl.cogs_account_balance,0)-coalesce(cm.movement_cogs,0) as cogs_difference,
       (coalesce(c.inventory_account_balance,0)=coalesce(m.movement_ledger_value,0)
        and coalesce(cl.cogs_account_balance,0)=coalesce(cm.movement_cogs,0)) as is_reconciled
from public.workspaces w
left join movement m on m.workspace_id=w.id
left join control c on c.workspace_id=w.id
left join cogs_move cm on cm.workspace_id=w.id
left join cogs_ledger cl on cl.workspace_id=w.id;

revoke all on public.inventory_financial_reconciliation from anon;
grant select on public.inventory_financial_reconciliation to authenticated;

-- Release invariant:
-- inventory_account_balance == sum(round(inventory_movements.value_delta,0))
-- and COGS balance == rounded issue movement cost, including exact reversal effects.
