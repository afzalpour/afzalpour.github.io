-- Avan RC1.4-D Sales/Purchase Inventory Integration
-- STATUS: repository candidate only; NOT APPLIED to Production.
-- Requires RC1.4-A + RC1.4-B + RC1.4-C/C1.
-- Existing public save/post invoice signatures are preserved.

-- ============================================================
-- 1) Stock-aware invoice metadata
-- ============================================================
create unique index if not exists invoices_workspace_id_uk
  on public.invoices(workspace_id,id);

alter table public.invoice_lines
  add column if not exists item_id uuid,
  add column if not exists unit_id uuid,
  add column if not exists warehouse_id uuid,
  add column if not exists receipt_line_id uuid;

alter table public.invoices
  add column if not exists inventory_document_id uuid,
  add column if not exists reversal_inventory_document_id uuid;

create unique index if not exists invoices_inventory_document_once_uk
  on public.invoices(workspace_id,inventory_document_id)
  where inventory_document_id is not null;
create unique index if not exists invoices_reversal_inventory_document_once_uk
  on public.invoices(workspace_id,reversal_inventory_document_id)
  where reversal_inventory_document_id is not null;

-- Composite FKs enforce Company identity even if a privileged path bypasses RLS.
do $$ begin
  if not exists(select 1 from pg_constraint where conname='invoice_lines_item_fk') then
    alter table public.invoice_lines add constraint invoice_lines_item_fk
      foreign key(workspace_id,item_id) references public.inventory_items(workspace_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conname='invoice_lines_unit_fk') then
    alter table public.invoice_lines add constraint invoice_lines_unit_fk
      foreign key(workspace_id,unit_id) references public.inventory_units(workspace_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conname='invoice_lines_warehouse_fk') then
    alter table public.invoice_lines add constraint invoice_lines_warehouse_fk
      foreign key(workspace_id,warehouse_id) references public.warehouses(workspace_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conname='invoice_lines_receipt_line_fk') then
    alter table public.invoice_lines add constraint invoice_lines_receipt_line_fk
      foreign key(workspace_id,receipt_line_id) references public.inventory_document_lines(workspace_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conname='invoices_inventory_document_fk') then
    alter table public.invoices add constraint invoices_inventory_document_fk
      foreign key(workspace_id,inventory_document_id) references public.inventory_documents(workspace_id,id);
  end if;
  if not exists(select 1 from pg_constraint where conname='invoices_reversal_inventory_document_fk') then
    alter table public.invoices add constraint invoices_reversal_inventory_document_fk
      foreign key(workspace_id,reversal_inventory_document_id) references public.inventory_documents(workspace_id,id);
  end if;
end $$;

create index if not exists invoice_lines_item_idx
  on public.invoice_lines(workspace_id,item_id) where item_id is not null;
create index if not exists invoice_lines_receipt_line_idx
  on public.invoice_lines(workspace_id,receipt_line_id) where receipt_line_id is not null;

-- ============================================================
-- 2) Invoice-line metadata guard
-- ============================================================
create or replace function public.guard_invoice_line_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
  v_wid uuid;
  v_type text;
  v_item_type text;
  v_base_unit uuid;
begin
  select i.status,i.workspace_id,i.invoice_type
    into v_status,v_wid,v_type
  from public.invoices i
  where i.id=coalesce(new.invoice_id,old.invoice_id);

  if tg_op='DELETE' and v_status is null then return old; end if;
  if v_status is null then raise exception 'INVOICE_NOT_FOUND'; end if;
  if v_status <> 'draft' then raise exception 'POSTED_INVOICE_IMMUTABLE'; end if;
  if tg_op='DELETE' then return old; end if;
  if new.workspace_id <> v_wid then raise exception 'INVOICE_WORKSPACE_MISMATCH'; end if;

  if new.item_id is null then
    if new.unit_id is not null or new.warehouse_id is not null or new.receipt_line_id is not null then
      raise exception 'INVOICE_STOCK_METADATA_WITHOUT_ITEM';
    end if;
    return new;
  end if;

  select ii.item_type,ii.base_unit_id
    into v_item_type,v_base_unit
  from public.inventory_items ii
  where ii.id=new.item_id and ii.workspace_id=new.workspace_id and ii.is_active;
  if v_item_type is null then raise exception 'INVENTORY_ITEM_INVALID'; end if;

  if new.unit_id is distinct from v_base_unit then
    raise exception 'INVOICE_ITEM_UNIT_MUST_BE_BASE_UNIT';
  end if;

  if v_item_type='inventory' and v_type='sale' then
    if new.warehouse_id is null or new.receipt_line_id is not null then
      raise exception 'SALE_INVENTORY_METADATA_INVALID';
    end if;
    if not exists(select 1 from public.warehouses w where w.id=new.warehouse_id and w.workspace_id=new.workspace_id and w.is_active) then
      raise exception 'SOURCE_WAREHOUSE_INVALID';
    end if;
  elsif v_item_type='inventory' and v_type='purchase' then
    if new.receipt_line_id is null or new.warehouse_id is not null then
      raise exception 'PURCHASE_INVENTORY_METADATA_INVALID';
    end if;
  else
    if new.warehouse_id is not null or new.receipt_line_id is not null then
      raise exception 'NON_INVENTORY_LINE_MUST_BE_STOCK_NEUTRAL';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================
-- 3) Draft-save compatibility wrapper
-- ============================================================
create or replace function private.save_draft_invoice_with_inventory(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_invoice_id uuid,
  p_invoice_type text,
  p_invoice_date date,
  p_due_date date,
  p_party_id uuid,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lines jsonb := coalesce(p_lines,'[]'::jsonb);
  v_fin_lines jsonb := '[]'::jsonb;
  v_item jsonb;
  v_norm jsonb;
  v_iid uuid;
  v_idx integer := 0;
  v_item_id uuid;
  v_unit_id uuid;
  v_warehouse_id uuid;
  v_receipt_line_id uuid;
  v_item_type text;
  v_base_unit uuid;
  v_inventory_asset uuid;
  v_grni uuid;
begin
  if jsonb_typeof(v_lines) <> 'array' then raise exception 'LINES_MUST_BE_ARRAY'; end if;
  perform private.assert_financial_write_access(p_workspace_id);
  perform private.ensure_inventory_account_roles(p_workspace_id);

  select ar.account_id into v_inventory_asset from public.account_roles ar
   where ar.workspace_id=p_workspace_id and ar.role_key='inventory_asset';
  select ar.account_id into v_grni from public.account_roles ar
   where ar.workspace_id=p_workspace_id and ar.role_key='inventory_grni';
  if v_inventory_asset is null or v_grni is null then raise exception 'INVENTORY_ACCOUNT_ROLE_MISSING'; end if;

  for v_item in select value from jsonb_array_elements(v_lines) loop
    v_norm:=v_item;
    v_item_id:=nullif(v_item->>'item_id','')::uuid;
    v_unit_id:=nullif(v_item->>'unit_id','')::uuid;
    v_warehouse_id:=nullif(v_item->>'warehouse_id','')::uuid;
    v_receipt_line_id:=nullif(v_item->>'receipt_line_id','')::uuid;

    if v_item_id is not null then
      select ii.item_type,ii.base_unit_id into v_item_type,v_base_unit
      from public.inventory_items ii
      where ii.id=v_item_id and ii.workspace_id=p_workspace_id and ii.is_active;
      if v_item_type is null then raise exception 'INVENTORY_ITEM_INVALID'; end if;
      v_unit_id:=coalesce(v_unit_id,v_base_unit);
      if v_unit_id is distinct from v_base_unit then raise exception 'INVOICE_ITEM_UNIT_MUST_BE_BASE_UNIT'; end if;

      if v_item_type='inventory' and p_invoice_type='sale' then
        if v_warehouse_id is null or v_receipt_line_id is not null then raise exception 'SALE_INVENTORY_METADATA_INVALID'; end if;
      elsif v_item_type='inventory' and p_invoice_type='purchase' then
        if v_receipt_line_id is null or v_warehouse_id is not null then raise exception 'PURCHASE_INVENTORY_METADATA_INVALID'; end if;
        -- Legacy financial validator expects purchase lines to point at an Asset/Expense.
        -- Feed it the inventory Asset temporarily; after the draft is saved the line is
        -- switched to GRNI, which is the correct debit when the supplier invoice is posted.
        v_norm:=jsonb_set(v_norm,'{account_id}',to_jsonb(v_inventory_asset::text),true);
      else
        if v_warehouse_id is not null or v_receipt_line_id is not null then raise exception 'NON_INVENTORY_LINE_MUST_BE_STOCK_NEUTRAL'; end if;
      end if;
    else
      if v_unit_id is not null or v_warehouse_id is not null or v_receipt_line_id is not null then
        raise exception 'INVOICE_STOCK_METADATA_WITHOUT_ITEM';
      end if;
    end if;

    v_fin_lines:=v_fin_lines||jsonb_build_array(v_norm);
  end loop;

  v_iid:=private.save_draft_invoice(
    p_workspace_id,p_fiscal_year_id,p_invoice_id,p_invoice_type,p_invoice_date,p_due_date,
    p_party_id,p_description,v_fin_lines
  );

  for v_item in select value from jsonb_array_elements(v_lines) loop
    v_idx:=v_idx+1;
    v_item_id:=nullif(v_item->>'item_id','')::uuid;
    v_unit_id:=nullif(v_item->>'unit_id','')::uuid;
    v_warehouse_id:=nullif(v_item->>'warehouse_id','')::uuid;
    v_receipt_line_id:=nullif(v_item->>'receipt_line_id','')::uuid;
    v_item_type:=null;
    v_base_unit:=null;

    if v_item_id is not null then
      select ii.item_type,ii.base_unit_id into v_item_type,v_base_unit
      from public.inventory_items ii where ii.id=v_item_id and ii.workspace_id=p_workspace_id;
      v_unit_id:=coalesce(v_unit_id,v_base_unit);
    end if;

    update public.invoice_lines l
       set item_id=v_item_id,
           unit_id=v_unit_id,
           warehouse_id=v_warehouse_id,
           receipt_line_id=v_receipt_line_id,
           account_id=case when p_invoice_type='purchase' and v_item_type='inventory' then v_grni else l.account_id end
     where l.invoice_id=v_iid and l.workspace_id=p_workspace_id and l.line_no=v_idx;
  end loop;

  return v_iid;
end;
$$;

revoke all on function private.save_draft_invoice_with_inventory(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) from public,anon;
grant execute on function private.save_draft_invoice_with_inventory(uuid,uuid,uuid,text,date,date,uuid,text,jsonb) to authenticated,service_role;

create or replace function public.save_draft_invoice(
  p_workspace_id uuid,p_fiscal_year_id uuid,p_invoice_id uuid,p_invoice_type text,p_invoice_date date,
  p_due_date date,p_party_id uuid,p_description text,p_lines jsonb
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select private.save_draft_invoice_with_inventory(
    p_workspace_id,p_fiscal_year_id,p_invoice_id,p_invoice_type,p_invoice_date,p_due_date,p_party_id,p_description,p_lines
  )
$$;

-- ============================================================
-- 4) Atomic invoice posting wrapper
-- ============================================================
create or replace function private.post_invoice_with_inventory(p_invoice_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices%rowtype;
  v_line record;
  v_issue_id uuid;
  v_result jsonb;
  v_grni uuid;
  v_receipt_doc_id uuid;
  v_receipt_doc_date date;
  v_receipt_doc_status text;
  v_receipt_doc_type text;
  v_receipt_item uuid;
  v_receipt_qty numeric(20,6);
  v_receipt_value numeric(30,0);
  v_lock bigint;
begin
  select * into v_inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(v_inv.workspace_id);
  if v_inv.status <> 'draft' then raise exception 'POSTED_INVOICE_IMMUTABLE'; end if;

  perform private.ensure_inventory_account_roles(v_inv.workspace_id);
  select ar.account_id into v_grni from public.account_roles ar
   where ar.workspace_id=v_inv.workspace_id and ar.role_key='inventory_grni';
  if v_grni is null then raise exception 'INVENTORY_ACCOUNT_ROLE_MISSING'; end if;

  if v_inv.invoice_type='sale' and exists(
    select 1 from public.invoice_lines l join public.inventory_items i
      on i.id=l.item_id and i.workspace_id=l.workspace_id
    where l.invoice_id=v_inv.id and i.item_type='inventory'
  ) then
    if v_inv.inventory_document_id is not null then raise exception 'INVOICE_INVENTORY_DOCUMENT_ALREADY_LINKED'; end if;

    insert into public.inventory_documents(
      workspace_id,fiscal_year_id,document_type,document_date,description,status,source_type,source_id,created_by
    ) values(
      v_inv.workspace_id,v_inv.fiscal_year_id,'issue',v_inv.invoice_date,
      'حواله خودکار فاکتور فروش','draft','sales_invoice',v_inv.id,auth.uid()
    ) returning id into v_issue_id;

    for v_line in
      select l.* from public.invoice_lines l join public.inventory_items i
        on i.id=l.item_id and i.workspace_id=l.workspace_id
      where l.invoice_id=v_inv.id and l.workspace_id=v_inv.workspace_id and i.item_type='inventory'
      order by l.line_no
    loop
      if v_line.warehouse_id is null or v_line.receipt_line_id is not null then raise exception 'SALE_INVENTORY_METADATA_INVALID'; end if;
      insert into public.inventory_document_lines(
        workspace_id,inventory_document_id,line_no,item_id,from_warehouse_id,to_warehouse_id,quantity,unit_cost,description
      ) values(
        v_inv.workspace_id,v_issue_id,v_line.line_no,v_line.item_id,v_line.warehouse_id,null,v_line.quantity,0,
        coalesce(v_line.description,'حواله فروش')
      );
    end loop;

    perform private.post_inventory_document(v_issue_id);
    update public.invoices set inventory_document_id=v_issue_id where id=v_inv.id and status='draft';
  end if;

  if v_inv.invoice_type='purchase' then
    for v_line in
      select l.* from public.invoice_lines l join public.inventory_items i
        on i.id=l.item_id and i.workspace_id=l.workspace_id
      where l.invoice_id=v_inv.id and l.workspace_id=v_inv.workspace_id and i.item_type='inventory'
      order by l.line_no
    loop
      if v_line.receipt_line_id is null or v_line.warehouse_id is not null then raise exception 'PURCHASE_INVENTORY_METADATA_INVALID'; end if;
      if v_line.account_id is distinct from v_grni then raise exception 'PURCHASE_INVENTORY_LINE_MUST_CLEAR_GRNI'; end if;

      v_lock:=pg_catalog.hashtextextended('invoice-receipt:'||v_inv.workspace_id::text||':'||v_line.receipt_line_id::text,0);
      perform pg_catalog.pg_advisory_xact_lock(v_lock);

      select d.id,d.document_date,d.status,d.document_type,rl.item_id,rl.quantity,
             coalesce(sum(round(m.value_delta,0)),0)::numeric(30,0)
        into v_receipt_doc_id,v_receipt_doc_date,v_receipt_doc_status,v_receipt_doc_type,
             v_receipt_item,v_receipt_qty,v_receipt_value
      from public.inventory_document_lines rl
      join public.inventory_documents d on d.id=rl.inventory_document_id and d.workspace_id=rl.workspace_id
      left join public.inventory_movements m on m.inventory_document_line_id=rl.id and m.workspace_id=rl.workspace_id
      where rl.id=v_line.receipt_line_id and rl.workspace_id=v_inv.workspace_id
      group by d.id,d.document_date,d.status,d.document_type,rl.item_id,rl.quantity;

      if v_receipt_doc_id is null or v_receipt_doc_status<>'posted' or v_receipt_doc_type<>'receipt' then
        raise exception 'PURCHASE_RECEIPT_NOT_POSTED';
      end if;
      if v_receipt_doc_date > v_inv.invoice_date then raise exception 'PURCHASE_RECEIPT_AFTER_INVOICE'; end if;
      if v_receipt_item is distinct from v_line.item_id or v_receipt_qty is distinct from v_line.quantity then
        raise exception 'PURCHASE_RECEIPT_QUANTITY_ITEM_MISMATCH';
      end if;
      if v_receipt_value is distinct from v_line.line_total then raise exception 'PURCHASE_RECEIPT_VALUE_MISMATCH'; end if;

      if exists(
        select 1
        from public.invoice_lines x
        join public.invoices xi on xi.id=x.invoice_id and xi.workspace_id=x.workspace_id
        where x.workspace_id=v_inv.workspace_id
          and x.receipt_line_id=v_line.receipt_line_id
          and xi.id<>v_inv.id
          and xi.invoice_type='purchase'
          and xi.status='posted'
      ) then raise exception 'PURCHASE_RECEIPT_ALREADY_INVOICED'; end if;

      if (select count(*) from public.invoice_lines x where x.invoice_id=v_inv.id and x.receipt_line_id=v_line.receipt_line_id) <> 1 then
        raise exception 'PURCHASE_RECEIPT_DUPLICATE_IN_INVOICE';
      end if;
    end loop;
  end if;

  v_result:=private.post_invoice(v_inv.id);
  return v_result||jsonb_build_object('inventory_document_id',(select inventory_document_id from public.invoices where id=v_inv.id));
end;
$$;

revoke all on function private.post_invoice_with_inventory(uuid) from public,anon;
grant execute on function private.post_invoice_with_inventory(uuid) to authenticated,service_role;

create or replace function public.post_invoice(iid uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.post_invoice_with_inventory(iid) $$;

-- ============================================================
-- 5) Invoice lifecycle guard with inventory links
-- ============================================================
create or replace function public.guard_invoice_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op='DELETE' and old.status<>'draft' then raise exception 'POSTED_INVOICE_IMMUTABLE'; end if;

  if tg_op='UPDATE' and old.status='posted' then
    if new.status='reversed'
       and new.workspace_id=old.workspace_id
       and new.fiscal_year_id=old.fiscal_year_id
       and new.invoice_no is not distinct from old.invoice_no
       and new.invoice_type=old.invoice_type
       and new.invoice_date=old.invoice_date
       and new.due_date is not distinct from old.due_date
       and new.party_id=old.party_id
       and new.description is not distinct from old.description
       and new.total_amount=old.total_amount
       and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.inventory_document_id is not distinct from old.inventory_document_id
       and new.created_by is not distinct from old.created_by
       and new.created_at=old.created_at
       and new.posted_at is not distinct from old.posted_at
       and new.reversal_journal_entry_id is not null
       and exists(select 1 from public.journal_entries r where r.id=new.reversal_journal_entry_id and r.workspace_id=old.workspace_id and r.reversal_of=old.journal_entry_id and r.status='posted')
       and (
         (old.inventory_document_id is null and new.reversal_inventory_document_id is null)
         or
         (old.inventory_document_id is not null and new.reversal_inventory_document_id is not null and exists(
            select 1 from public.inventory_documents rd where rd.id=new.reversal_inventory_document_id
              and rd.workspace_id=old.workspace_id and rd.reversal_of=old.inventory_document_id and rd.status='posted'
         ))
       )
    then
      new.updated_at:=now(); return new;
    end if;
    raise exception 'POSTED_INVOICE_IMMUTABLE';
  end if;

  if tg_op='UPDATE' and old.status='reversed' then
    if new.status='reversed'
       and new.workspace_id=old.workspace_id and new.fiscal_year_id=old.fiscal_year_id
       and new.invoice_no is not distinct from old.invoice_no and new.invoice_type=old.invoice_type
       and new.invoice_date=old.invoice_date and new.due_date is not distinct from old.due_date
       and new.party_id=old.party_id and new.description is not distinct from old.description
       and new.total_amount=old.total_amount and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.inventory_document_id is not distinct from old.inventory_document_id
       and new.created_by is not distinct from old.created_by and new.created_at=old.created_at
       and new.posted_at is not distinct from old.posted_at and new.reversed_at is not distinct from old.reversed_at
       and (old.reversal_journal_entry_id is not null or new.reversal_journal_entry_id is not null)
       and (old.reversal_inventory_document_id is not null or new.reversal_inventory_document_id is not null or old.inventory_document_id is null)
    then
      new.updated_at:=now(); return new;
    end if;
    raise exception 'POSTED_INVOICE_IMMUTABLE';
  end if;

  if tg_op='UPDATE' then new.updated_at:=now(); end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

-- ============================================================
-- 6) Harden journal->invoice status sync
-- ============================================================
create or replace function public.sync_invoice_status_from_journal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reversal_id uuid;
  v_invoice public.invoices%rowtype;
  v_inventory_reversal_id uuid;
begin
  if old.status is distinct from new.status
     and new.status='reversed'
     and new.source_id is not null
     and new.source_type in ('sales_invoice','purchase_invoice') then

    select r.id into v_reversal_id
    from public.journal_entries r
    where r.workspace_id=new.workspace_id and r.reversal_of=new.id and r.status='posted'
    order by r.created_at desc limit 1;
    if v_reversal_id is null then raise exception 'INVOICE_REVERSAL_JOURNAL_MISSING'; end if;

    select * into v_invoice from public.invoices i
    where i.id=new.source_id and i.workspace_id=new.workspace_id and i.journal_entry_id=new.id
    for update;
    if not found then raise exception 'INVOICE_SOURCE_LINK_MISSING'; end if;

    if v_invoice.inventory_document_id is not null then
      if not exists(select 1 from public.inventory_documents d where d.id=v_invoice.inventory_document_id and d.workspace_id=v_invoice.workspace_id and d.status='reversed') then
        raise exception 'INVOICE_INVENTORY_REVERSAL_REQUIRED';
      end if;
      select rd.id into v_inventory_reversal_id
      from public.inventory_documents rd
      where rd.workspace_id=v_invoice.workspace_id and rd.reversal_of=v_invoice.inventory_document_id and rd.status='posted'
      order by rd.created_at desc limit 1;
      if v_inventory_reversal_id is null then raise exception 'INVOICE_INVENTORY_REVERSAL_LINK_MISSING'; end if;
    end if;

    if v_invoice.status='posted' then
      update public.invoices i
         set status='reversed',reversal_journal_entry_id=v_reversal_id,
             reversal_inventory_document_id=v_inventory_reversal_id,
             reversed_at=coalesce(i.reversed_at,now()),updated_at=now()
       where i.id=v_invoice.id;
    elsif v_invoice.status='reversed' then
      if v_invoice.reversal_journal_entry_id is distinct from v_reversal_id
         or v_invoice.reversal_inventory_document_id is distinct from v_inventory_reversal_id then
        raise exception 'INVOICE_REVERSAL_LINK_FAILED';
      end if;
    else
      raise exception 'INVOICE_STATUS_INVALID_FOR_REVERSAL';
    end if;
  end if;
  return new;
end;
$$;

-- ============================================================
-- 7) Atomic invoice reversal API
-- ============================================================
create or replace function private.reverse_invoice(
  p_invoice_id uuid,p_reverse_date date,p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices%rowtype;
  v_rev_inventory uuid;
  v_rev_journal uuid;
begin
  if p_reverse_date is null then raise exception 'REVERSE_DATE_REQUIRED'; end if;
  select * into v_inv from public.invoices where id=p_invoice_id for update;
  if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(v_inv.workspace_id);
  if v_inv.status<>'posted' then raise exception 'INVOICE_NOT_POSTED'; end if;
  if v_inv.journal_entry_id is null then raise exception 'INVOICE_JOURNAL_LINK_MISSING'; end if;

  if v_inv.inventory_document_id is not null then
    v_rev_inventory:=private.reverse_inventory_document(v_inv.inventory_document_id,p_reverse_date,coalesce(p_reason,'برگشت فاکتور'));
  end if;

  v_rev_journal:=private.reverse_journal_entry(v_inv.journal_entry_id,p_reverse_date,coalesce(p_reason,'برگشت فاکتور'));

  select * into v_inv from public.invoices where id=p_invoice_id;
  if v_inv.status<>'reversed' or v_inv.reversal_journal_entry_id is distinct from v_rev_journal
     or v_inv.reversal_inventory_document_id is distinct from v_rev_inventory then
    raise exception 'INVOICE_REVERSAL_ATOMICITY_FAILED';
  end if;

  return jsonb_build_object(
    'invoice_id',v_inv.id,'status',v_inv.status,
    'reversal_journal_entry_id',v_rev_journal,
    'reversal_inventory_document_id',v_rev_inventory
  );
end;
$$;

revoke all on function private.reverse_invoice(uuid,date,text) from public,anon;
grant execute on function private.reverse_invoice(uuid,date,text) to authenticated,service_role;

create or replace function public.reverse_invoice(p_invoice_id uuid,p_reverse_date date,p_reason text default null)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.reverse_invoice(p_invoice_id,p_reverse_date,p_reason) $$;
revoke all on function public.reverse_invoice(uuid,date,text) from public,anon;
grant execute on function public.reverse_invoice(uuid,date,text) to authenticated,service_role;

-- Direct financial reversal of a stock sale is now intentionally blocked by
-- sync_invoice_status_from_journal until its linked inventory document has been reversed.
-- Purchase invoice reversal does NOT reverse the receipt: goods remain in stock and the
-- reversed AP journal restores the GRNI balance, making that receipt unmatched again.
