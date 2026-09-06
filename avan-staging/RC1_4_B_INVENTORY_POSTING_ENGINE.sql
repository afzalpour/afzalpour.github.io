-- Avan RC1.4-B Inventory Posting Engine
-- STATUS: candidate on rc1-4-inventory; NOT APPLIED to Production.
-- Depends on RC1.4-A transactional tables:
--   public.inventory_documents
--   public.inventory_document_lines
--   public.inventory_movements
-- Existing foundation retained:
--   public.inventory_items, public.inventory_units, public.inventory_settings, public.warehouses

-- ============================================================
-- 1) Immutable posted inventory contract
-- ============================================================
create or replace function private.guard_inventory_document_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE';
    end if;
    return old;
  end if;

  if old.status = 'reversed' then
    raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE';
  end if;

  if old.status = 'posted' then
    if new.status = 'reversed'
       and new.workspace_id = old.workspace_id
       and new.fiscal_year_id = old.fiscal_year_id
       and new.document_type = old.document_type
       and new.document_date = old.document_date
       and new.description is not distinct from old.description
       and new.source_type is not distinct from old.source_type
       and new.source_id is not distinct from old.source_id
       and new.journal_entry_id is not distinct from old.journal_entry_id
       and new.reversal_of is not distinct from old.reversal_of
       and new.created_by is not distinct from old.created_by
       and new.posted_by is not distinct from old.posted_by
       and new.created_at = old.created_at
       and new.posted_at is not distinct from old.posted_at
       and new.reversed_by is not null
       and new.reversed_at is not null then
      return new;
    end if;
    raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE';
  end if;

  return new;
end;
$$;

create or replace function private.guard_inventory_line_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare v_status text;
begin
  select d.status into v_status
  from public.inventory_documents d
  where d.id = coalesce(new.inventory_document_id, old.inventory_document_id)
    and d.workspace_id = coalesce(new.workspace_id, old.workspace_id);

  if v_status is distinct from 'draft' then
    raise exception 'POSTED_INVENTORY_LINE_IMMUTABLE';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.block_inventory_movement_mutation()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  raise exception 'INVENTORY_MOVEMENT_IMMUTABLE';
end;
$$;

drop trigger if exists trg_guard_inventory_document_mutation on public.inventory_documents;
create trigger trg_guard_inventory_document_mutation
before update or delete on public.inventory_documents
for each row execute function private.guard_inventory_document_mutation();

drop trigger if exists trg_guard_inventory_line_mutation on public.inventory_document_lines;
create trigger trg_guard_inventory_line_mutation
before update or delete on public.inventory_document_lines
for each row execute function private.guard_inventory_line_mutation();

drop trigger if exists trg_block_inventory_movement_update on public.inventory_movements;
create trigger trg_block_inventory_movement_update
before update or delete on public.inventory_movements
for each row execute function private.block_inventory_movement_mutation();

-- ============================================================
-- 2) Posting implementation
-- ============================================================
create or replace function private.post_inventory_document(p_document_id uuid)
returns public.inventory_documents
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $$
declare
  d public.inventory_documents%rowtype;
  ln public.inventory_document_lines%rowtype;
  v_allow_negative boolean := false;
  v_current_qty numeric(20,6);
  v_line_count integer := 0;
begin
  select * into d
  from public.inventory_documents
  where id = p_document_id
  for update;

  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  if not public.has_workspace_access(d.workspace_id) then raise exception 'FORBIDDEN'; end if;
  perform private.assert_financial_write_access(d.workspace_id);
  if d.status <> 'draft' then raise exception 'INVENTORY_DOCUMENT_ALREADY_POSTED'; end if;

  if exists (
    select 1 from public.fiscal_periods p
    where p.workspace_id=d.workspace_id and p.status='closed'
      and d.document_date between p.date_from and p.date_to
  ) then raise exception 'PERIOD_CLOSED'; end if;

  if not exists (
    select 1 from public.fiscal_years fy
    where fy.id=d.fiscal_year_id
      and fy.workspace_id=d.workspace_id
      and d.document_date between fy.date_from and fy.date_to
      and fy.status='open'
  ) then raise exception 'FISCAL_YEAR_INVALID'; end if;

  select coalesce(s.allow_negative_stock,false)
    into v_allow_negative
  from public.inventory_settings s
  where s.workspace_id=d.workspace_id;
  v_allow_negative := coalesce(v_allow_negative,false);

  for ln in
    select * from public.inventory_document_lines
    where inventory_document_id=d.id and workspace_id=d.workspace_id
    order by created_at,id
  loop
    v_line_count := v_line_count + 1;

    if not exists (
      select 1 from public.inventory_items i
      where i.id=ln.item_id and i.workspace_id=d.workspace_id
        and i.is_active and i.item_type='inventory'
    ) then raise exception 'INVENTORY_ITEM_INVALID'; end if;

    if d.document_type in ('opening','receipt','adjustment_in') then
      if ln.to_warehouse_id is null or ln.from_warehouse_id is not null then
        raise exception 'INVENTORY_WAREHOUSE_DIRECTION_INVALID';
      end if;
      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
        movement_date,quantity_delta,unit_cost
      ) values(
        d.workspace_id,d.id,ln.id,ln.item_id,ln.to_warehouse_id,
        d.document_date,ln.quantity,ln.unit_cost
      );

    elsif d.document_type in ('issue','adjustment_out') then
      if ln.from_warehouse_id is null or ln.to_warehouse_id is not null then
        raise exception 'INVENTORY_WAREHOUSE_DIRECTION_INVALID';
      end if;

      select coalesce(sum(m.quantity_delta),0)::numeric(20,6)
        into v_current_qty
      from public.inventory_movements m
      where m.workspace_id=d.workspace_id
        and m.item_id=ln.item_id
        and m.warehouse_id=ln.from_warehouse_id;

      if not v_allow_negative and v_current_qty < ln.quantity then
        raise exception 'NEGATIVE_STOCK_FORBIDDEN';
      end if;

      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
        movement_date,quantity_delta,unit_cost
      ) values(
        d.workspace_id,d.id,ln.id,ln.item_id,ln.from_warehouse_id,
        d.document_date,-ln.quantity,ln.unit_cost
      );

    elsif d.document_type='transfer' then
      if ln.from_warehouse_id is null or ln.to_warehouse_id is null
         or ln.from_warehouse_id=ln.to_warehouse_id then
        raise exception 'INVENTORY_WAREHOUSE_DIRECTION_INVALID';
      end if;

      select coalesce(sum(m.quantity_delta),0)::numeric(20,6)
        into v_current_qty
      from public.inventory_movements m
      where m.workspace_id=d.workspace_id
        and m.item_id=ln.item_id
        and m.warehouse_id=ln.from_warehouse_id;

      if not v_allow_negative and v_current_qty < ln.quantity then
        raise exception 'NEGATIVE_STOCK_FORBIDDEN';
      end if;

      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
        movement_date,quantity_delta,unit_cost
      ) values
        (d.workspace_id,d.id,ln.id,ln.item_id,ln.from_warehouse_id,d.document_date,-ln.quantity,ln.unit_cost),
        (d.workspace_id,d.id,ln.id,ln.item_id,ln.to_warehouse_id,d.document_date,ln.quantity,ln.unit_cost);
    else
      raise exception 'INVENTORY_DOCUMENT_TYPE_INVALID';
    end if;
  end loop;

  if v_line_count = 0 then raise exception 'INVENTORY_DOCUMENT_EMPTY'; end if;

  update public.inventory_documents
     set status='posted', posted_by=auth.uid(), posted_at=now(), updated_at=now()
   where id=d.id
   returning * into d;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(d.workspace_id,'post','inventory_document',d.id,'Inventory document posted');

  return d;
end;
$$;

-- ============================================================
-- 3) Reversal implementation
-- ============================================================
create or replace function private.reverse_inventory_document(
  p_document_id uuid,
  p_reverse_date date,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth','pg_temp'
as $$
declare
  src public.inventory_documents%rowtype;
  v_reversal_id uuid;
  m public.inventory_movements%rowtype;
begin
  select * into src
  from public.inventory_documents
  where id=p_document_id
  for update;

  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  if not public.has_workspace_access(src.workspace_id) then raise exception 'FORBIDDEN'; end if;
  perform private.assert_financial_write_access(src.workspace_id);
  if src.status <> 'posted' then raise exception 'INVENTORY_DOCUMENT_NOT_POSTED'; end if;
  if exists (
    select 1 from public.inventory_documents d
    where d.workspace_id=src.workspace_id and d.reversal_of=src.id
  ) then raise exception 'INVENTORY_DOCUMENT_ALREADY_REVERSED'; end if;

  if exists (
    select 1 from public.fiscal_periods p
    where p.workspace_id=src.workspace_id and p.status='closed'
      and p_reverse_date between p.date_from and p.date_to
  ) then raise exception 'PERIOD_CLOSED'; end if;

  if not exists (
    select 1 from public.fiscal_years fy
    where fy.id=src.fiscal_year_id and fy.workspace_id=src.workspace_id
      and p_reverse_date between fy.date_from and fy.date_to and fy.status='open'
  ) then raise exception 'FISCAL_YEAR_INVALID'; end if;

  insert into public.inventory_documents(
    workspace_id,fiscal_year_id,document_type,document_date,description,status,
    source_type,source_id,reversal_of,created_by,posted_by,posted_at
  ) values(
    src.workspace_id,src.fiscal_year_id,src.document_type,p_reverse_date,
    coalesce(nullif(btrim(p_reason),''),'برگشت سند انبار')||' — '||coalesce(src.description,''),
    'posted','inventory_reversal',src.id,src.id,auth.uid(),auth.uid(),now()
  ) returning id into v_reversal_id;

  for m in
    select * from public.inventory_movements
    where workspace_id=src.workspace_id and inventory_document_id=src.id
    order by created_at,id
  loop
    insert into public.inventory_movements(
      workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
      movement_date,quantity_delta,unit_cost,reversal_of
    ) values(
      src.workspace_id,v_reversal_id,m.inventory_document_line_id,m.item_id,m.warehouse_id,
      p_reverse_date,-m.quantity_delta,m.unit_cost,m.id
    );
  end loop;

  update public.inventory_documents
     set status='reversed',reversed_by=auth.uid(),reversed_at=now(),updated_at=now()
   where id=src.id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(src.workspace_id,'reverse','inventory_document',src.id,'Inventory document reversed');

  return v_reversal_id;
end;
$$;

-- ============================================================
-- 4) Browser-facing SECURITY INVOKER wrappers
-- ============================================================
create or replace function public.post_inventory_document(p_document_id uuid)
returns public.inventory_documents
language sql
security invoker
set search_path to ''
as $$
  select private.post_inventory_document(p_document_id)
$$;

create or replace function public.reverse_inventory_document(
  p_document_id uuid,
  p_reverse_date date,
  p_reason text default null
)
returns uuid
language sql
security invoker
set search_path to ''
as $$
  select private.reverse_inventory_document(p_document_id,p_reverse_date,p_reason)
$$;

revoke all on function private.guard_inventory_document_mutation() from public, anon, authenticated;
revoke all on function private.guard_inventory_line_mutation() from public, anon, authenticated;
revoke all on function private.block_inventory_movement_mutation() from public, anon, authenticated;
revoke all on function private.post_inventory_document(uuid) from public, anon;
revoke all on function private.reverse_inventory_document(uuid,date,text) from public, anon;
grant execute on function private.post_inventory_document(uuid) to authenticated;
grant execute on function private.reverse_inventory_document(uuid,date,text) to authenticated;

revoke all on function public.post_inventory_document(uuid) from public, anon;
revoke all on function public.reverse_inventory_document(uuid,date,text) from public, anon;
grant execute on function public.post_inventory_document(uuid) to authenticated;
grant execute on function public.reverse_inventory_document(uuid,date,text) to authenticated;

-- Notes:
-- * RC1.4-B deliberately does NOT create financial journal entries yet.
-- * unit_cost on outbound/transfer lines is explicit in this phase.
-- * RC1.4-C will replace outbound costing with deterministic moving weighted average.
-- * RC1.4-C/D will add exact inventory-to-financial-ledger bridge and invoice integration.
