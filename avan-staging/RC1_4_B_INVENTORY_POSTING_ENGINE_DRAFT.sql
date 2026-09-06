-- Avan RC1.4-B Inventory Posting Engine candidate
-- STATUS: repository candidate only; NOT APPLIED to Production.
-- Requires RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql.
-- Public RPCs stay SECURITY INVOKER; privileged implementations stay in private.

create table if not exists private.inventory_document_number_sequences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fiscal_year_id uuid not null,
  last_number bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, fiscal_year_id),
  constraint inventory_document_number_sequences_fy_fk
    foreign key (workspace_id, fiscal_year_id)
    references public.fiscal_years(workspace_id, id)
);

alter table private.inventory_document_number_sequences enable row level security;
revoke all on private.inventory_document_number_sequences from public, anon, authenticated;

create or replace function private.next_inventory_document_number(p_wid uuid, p_fyid uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_no bigint;
begin
  insert into private.inventory_document_number_sequences(workspace_id,fiscal_year_id,last_number,updated_at)
  values(p_wid,p_fyid,1,now())
  on conflict(workspace_id,fiscal_year_id)
  do update set last_number=private.inventory_document_number_sequences.last_number+1,
                updated_at=now()
  returning last_number into v_no;
  return v_no;
end;
$$;

revoke all on function private.next_inventory_document_number(uuid,uuid) from public, anon, authenticated;

create or replace function private.guard_inventory_document_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then
      raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE';
    end if;
    return old;
  end if;

  if old.status = 'draft' and new.status = 'draft' then
    return new;
  end if;

  if old.status = 'draft' and new.status = 'posted' then
    if (pg_catalog.to_jsonb(new) - array['status','document_no','posted_by','posted_at','updated_at'])
       <> (pg_catalog.to_jsonb(old) - array['status','document_no','posted_by','posted_at','updated_at'])
       or new.document_no is null
       or new.posted_by is null
       or new.posted_at is null then
      raise exception 'INVALID_INVENTORY_POST_TRANSITION';
    end if;
    return new;
  end if;

  if old.status = 'posted' and new.status = 'reversed' then
    if (pg_catalog.to_jsonb(new) - array['status','reversed_by','reversed_at','updated_at'])
       <> (pg_catalog.to_jsonb(old) - array['status','reversed_by','reversed_at','updated_at'])
       or new.reversed_by is null
       or new.reversed_at is null then
      raise exception 'INVALID_INVENTORY_REVERSE_TRANSITION';
    end if;
    return new;
  end if;

  raise exception 'POSTED_INVENTORY_DOCUMENT_IMMUTABLE';
end;
$$;

create or replace function private.guard_inventory_line_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_document_id uuid;
  v_status text;
begin
  v_document_id := case when tg_op='DELETE' then old.inventory_document_id else new.inventory_document_id end;

  select d.status into v_status
  from public.inventory_documents d
  where d.id=v_document_id;

  if v_status is distinct from 'draft' then
    raise exception 'POSTED_INVENTORY_LINE_IMMUTABLE';
  end if;

  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function private.guard_inventory_movement_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'INVENTORY_MOVEMENT_IMMUTABLE';
end;
$$;

revoke all on function private.guard_inventory_document_mutation() from public, anon;
revoke all on function private.guard_inventory_line_mutation() from public, anon;
revoke all on function private.guard_inventory_movement_mutation() from public, anon;

drop trigger if exists trg_guard_inventory_document_mutation on public.inventory_documents;
create trigger trg_guard_inventory_document_mutation
before update or delete on public.inventory_documents
for each row execute function private.guard_inventory_document_mutation();

drop trigger if exists trg_guard_inventory_line_mutation on public.inventory_document_lines;
create trigger trg_guard_inventory_line_mutation
before update or delete on public.inventory_document_lines
for each row execute function private.guard_inventory_line_mutation();

drop trigger if exists trg_guard_inventory_movement_mutation on public.inventory_movements;
create trigger trg_guard_inventory_movement_mutation
before update or delete on public.inventory_movements
for each row execute function private.guard_inventory_movement_mutation();

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
  v_lock_a bigint;
  v_lock_b bigint;
  v_no bigint;
begin
  if (select auth.uid()) is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_doc
  from public.inventory_documents
  where id=p_document_id
  for update;

  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(v_doc.workspace_id);

  if v_doc.status <> 'draft' then raise exception 'INVENTORY_DOCUMENT_NOT_DRAFT'; end if;
  if v_doc.document_type = 'reversal' then raise exception 'RESERVED_INVENTORY_DOCUMENT_TYPE'; end if;
  if v_doc.journal_entry_id is not null or v_doc.reversal_of is not null then
    raise exception 'INVALID_INVENTORY_DRAFT_SYSTEM_LINK';
  end if;

  if not exists (
    select 1 from public.fiscal_years fy
    where fy.id=v_doc.fiscal_year_id
      and fy.workspace_id=v_doc.workspace_id
      and fy.status='open'
      and v_doc.document_date between fy.date_from and fy.date_to
  ) then
    raise exception 'FISCAL_YEAR_INVALID';
  end if;

  if exists (
    select 1 from public.fiscal_periods p
    where p.workspace_id=v_doc.workspace_id
      and p.status='closed'
      and v_doc.document_date between p.date_from and p.date_to
  ) then
    raise exception 'PERIOD_CLOSED';
  end if;

  select count(*) into v_count
  from public.inventory_document_lines l
  where l.inventory_document_id=v_doc.id
    and l.workspace_id=v_doc.workspace_id;
  if v_count < 1 then raise exception 'INVENTORY_DOCUMENT_EMPTY'; end if;

  select coalesce(s.allow_negative_stock,false) into v_allow_negative
  from public.inventory_settings s
  where s.workspace_id=v_doc.workspace_id;
  v_allow_negative := coalesce(v_allow_negative,false);

  -- Validate every line before writing any movement.
  for v_line in
    select * from public.inventory_document_lines
    where inventory_document_id=v_doc.id
    order by line_no,id
  loop
    if not exists (
      select 1 from public.inventory_items i
      where i.id=v_line.item_id
        and i.workspace_id=v_doc.workspace_id
        and i.is_active
        and i.item_type='inventory'
    ) then
      raise exception 'INVENTORY_ITEM_INVALID';
    end if;

    if v_line.from_warehouse_id is not null and not exists (
      select 1 from public.warehouses w
      where w.id=v_line.from_warehouse_id and w.workspace_id=v_doc.workspace_id and w.is_active
    ) then raise exception 'SOURCE_WAREHOUSE_INVALID'; end if;

    if v_line.to_warehouse_id is not null and not exists (
      select 1 from public.warehouses w
      where w.id=v_line.to_warehouse_id and w.workspace_id=v_doc.workspace_id and w.is_active
    ) then raise exception 'DESTINATION_WAREHOUSE_INVALID'; end if;

    if v_doc.document_type in ('opening','receipt')
       and (v_line.from_warehouse_id is not null or v_line.to_warehouse_id is null) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    elsif v_doc.document_type='issue'
       and (v_line.from_warehouse_id is null or v_line.to_warehouse_id is not null) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    elsif v_doc.document_type='transfer'
       and (v_line.from_warehouse_id is null or v_line.to_warehouse_id is null
            or v_line.from_warehouse_id=v_line.to_warehouse_id) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    elsif v_doc.document_type='adjustment'
       and ((v_line.from_warehouse_id is null) = (v_line.to_warehouse_id is null)) then
      raise exception 'INVENTORY_LINE_SHAPE_INVALID';
    end if;
  end loop;

  -- Lock affected item/warehouse state in a deterministic order and post movements.
  for v_line in
    select * from public.inventory_document_lines
    where inventory_document_id=v_doc.id
    order by line_no,id
  loop
    v_lock_a := null;
    v_lock_b := null;
    if v_line.from_warehouse_id is not null then
      v_lock_a := pg_catalog.hashtextextended(
        v_doc.workspace_id::text||':'||v_line.item_id::text||':'||v_line.from_warehouse_id::text,0);
    end if;
    if v_line.to_warehouse_id is not null then
      v_lock_b := pg_catalog.hashtextextended(
        v_doc.workspace_id::text||':'||v_line.item_id::text||':'||v_line.to_warehouse_id::text,0);
    end if;

    if v_lock_a is not null and v_lock_b is not null then
      if v_lock_a <= v_lock_b then
        perform pg_catalog.pg_advisory_xact_lock(v_lock_a);
        if v_lock_b <> v_lock_a then perform pg_catalog.pg_advisory_xact_lock(v_lock_b); end if;
      else
        perform pg_catalog.pg_advisory_xact_lock(v_lock_b);
        perform pg_catalog.pg_advisory_xact_lock(v_lock_a);
      end if;
    elsif v_lock_a is not null then
      perform pg_catalog.pg_advisory_xact_lock(v_lock_a);
    elsif v_lock_b is not null then
      perform pg_catalog.pg_advisory_xact_lock(v_lock_b);
    end if;

    if v_doc.document_type in ('opening','receipt') then
      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
        movement_date,quantity_delta,unit_cost
      ) values(
        v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.to_warehouse_id,
        v_doc.document_date,v_line.quantity,v_line.unit_cost
      );

    elsif v_doc.document_type in ('issue','transfer')
       or (v_doc.document_type='adjustment' and v_line.from_warehouse_id is not null) then
      select coalesce(sum(m.quantity_delta),0),coalesce(sum(m.value_delta),0)
      into v_qty,v_value
      from public.inventory_movements m
      where m.workspace_id=v_doc.workspace_id
        and m.item_id=v_line.item_id
        and m.warehouse_id=v_line.from_warehouse_id;

      if not v_allow_negative and v_qty < v_line.quantity then
        raise exception 'NEGATIVE_STOCK_FORBIDDEN';
      end if;

      if v_qty > 0 then
        v_cost := round(v_value / v_qty,6);
      elsif v_allow_negative and v_line.unit_cost > 0 then
        v_cost := v_line.unit_cost;
      else
        raise exception 'OUTGOING_COST_UNAVAILABLE';
      end if;

      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
        movement_date,quantity_delta,unit_cost
      ) values(
        v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.from_warehouse_id,
        v_doc.document_date,-v_line.quantity,v_cost
      );

      if v_doc.document_type='transfer' then
        insert into public.inventory_movements(
          workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
          movement_date,quantity_delta,unit_cost
        ) values(
          v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.to_warehouse_id,
          v_doc.document_date,v_line.quantity,v_cost
        );
      end if;

    elsif v_doc.document_type='adjustment' and v_line.to_warehouse_id is not null then
      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
        movement_date,quantity_delta,unit_cost
      ) values(
        v_doc.workspace_id,v_doc.id,v_line.id,v_line.item_id,v_line.to_warehouse_id,
        v_doc.document_date,v_line.quantity,v_line.unit_cost
      );
    end if;
  end loop;

  v_no := private.next_inventory_document_number(v_doc.workspace_id,v_doc.fiscal_year_id);
  update public.inventory_documents
     set status='posted',document_no=v_no,posted_by=auth.uid(),posted_at=now(),updated_at=now()
   where id=v_doc.id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(v_doc.workspace_id,'post','inventory_document',v_doc.id,'Inventory document posted');

  return v_doc.id;
end;
$$;

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
  v_reverse_id uuid;
  v_reverse_line_id uuid;
  v_reverse_fy uuid;
  v_allow_negative boolean;
  v_qty numeric(24,6);
  v_no bigint;
  v_lock bigint;
begin
  if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_reverse_date is null then raise exception 'REVERSE_DATE_REQUIRED'; end if;

  select * into v_src
  from public.inventory_documents
  where id=p_document_id
  for update;

  if not found then raise exception 'INVENTORY_DOCUMENT_NOT_FOUND'; end if;
  perform private.assert_financial_write_access(v_src.workspace_id);
  if v_src.status <> 'posted' then raise exception 'INVENTORY_DOCUMENT_NOT_POSTED'; end if;
  if v_src.journal_entry_id is not null then
    raise exception 'INVENTORY_FINANCIAL_REVERSAL_BRIDGE_REQUIRED';
  end if;
  if exists (
    select 1 from public.inventory_documents r
    where r.workspace_id=v_src.workspace_id and r.reversal_of=v_src.id
  ) then raise exception 'INVENTORY_DOCUMENT_ALREADY_REVERSED'; end if;

  select fy.id into v_reverse_fy
  from public.fiscal_years fy
  where fy.workspace_id=v_src.workspace_id
    and fy.status='open'
    and p_reverse_date between fy.date_from and fy.date_to
  order by fy.date_from desc
  limit 1;
  if v_reverse_fy is null then raise exception 'FISCAL_YEAR_INVALID'; end if;

  if exists (
    select 1 from public.fiscal_periods p
    where p.workspace_id=v_src.workspace_id
      and p.status='closed'
      and p_reverse_date between p.date_from and p.date_to
  ) then raise exception 'PERIOD_CLOSED'; end if;

  if not exists (
    select 1 from public.inventory_movements m
    where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id
  ) then raise exception 'INVENTORY_MOVEMENTS_MISSING'; end if;

  select coalesce(s.allow_negative_stock,false) into v_allow_negative
  from public.inventory_settings s
  where s.workspace_id=v_src.workspace_id;
  v_allow_negative := coalesce(v_allow_negative,false);

  -- Lock all impacted stock states before testing the reversal.
  for v_src_move in
    select m.* from public.inventory_movements m
    where m.workspace_id=v_src.workspace_id and m.inventory_document_id=v_src.id
    order by pg_catalog.hashtextextended(
      m.workspace_id::text||':'||m.item_id::text||':'||m.warehouse_id::text,0),m.posting_seq
  loop
    v_lock := pg_catalog.hashtextextended(
      v_src_move.workspace_id::text||':'||v_src_move.item_id::text||':'||v_src_move.warehouse_id::text,0);
    perform pg_catalog.pg_advisory_xact_lock(v_lock);
  end loop;

  -- Exact reversal may remove stock created by the source document. Enforce negative-stock policy.
  if not v_allow_negative then
    for v_src_move in
      select m.* from public.inventory_movements m
      where m.workspace_id=v_src.workspace_id
        and m.inventory_document_id=v_src.id
        and m.quantity_delta > 0
      order by m.posting_seq
    loop
      select coalesce(sum(m.quantity_delta),0) into v_qty
      from public.inventory_movements m
      where m.workspace_id=v_src.workspace_id
        and m.item_id=v_src_move.item_id
        and m.warehouse_id=v_src_move.warehouse_id;
      if v_qty < v_src_move.quantity_delta then
        raise exception 'REVERSAL_NEGATIVE_STOCK_FORBIDDEN';
      end if;
    end loop;
  end if;

  insert into public.inventory_documents(
    workspace_id,fiscal_year_id,document_type,document_date,description,status,
    source_type,source_id,reversal_of,created_by
  ) values(
    v_src.workspace_id,v_reverse_fy,'reversal',p_reverse_date,
    coalesce(nullif(btrim(p_reason),''),'برگشت سند انبار')||' — '||coalesce(v_src.description,''),
    'draft','inventory_reversal',v_src.id,v_src.id,auth.uid()
  ) returning id into v_reverse_id;

  for v_src_line in
    select * from public.inventory_document_lines
    where workspace_id=v_src.workspace_id and inventory_document_id=v_src.id
    order by line_no,id
  loop
    insert into public.inventory_document_lines(
      workspace_id,inventory_document_id,line_no,item_id,from_warehouse_id,to_warehouse_id,
      quantity,unit_cost,description
    ) values(
      v_src.workspace_id,v_reverse_id,v_src_line.line_no,v_src_line.item_id,
      v_src_line.to_warehouse_id,v_src_line.from_warehouse_id,
      v_src_line.quantity,v_src_line.unit_cost,v_src_line.description
    ) returning id into v_reverse_line_id;

    for v_src_move in
      select * from public.inventory_movements
      where workspace_id=v_src.workspace_id
        and inventory_document_id=v_src.id
        and inventory_document_line_id=v_src_line.id
      order by posting_seq
    loop
      insert into public.inventory_movements(
        workspace_id,inventory_document_id,inventory_document_line_id,item_id,warehouse_id,
        movement_date,quantity_delta,unit_cost,reversal_of
      ) values(
        v_src.workspace_id,v_reverse_id,v_reverse_line_id,v_src_move.item_id,v_src_move.warehouse_id,
        p_reverse_date,-v_src_move.quantity_delta,v_src_move.unit_cost,v_src_move.id
      );
    end loop;
  end loop;

  v_no := private.next_inventory_document_number(v_src.workspace_id,v_reverse_fy);
  update public.inventory_documents
     set status='posted',document_no=v_no,posted_by=auth.uid(),posted_at=now(),updated_at=now()
   where id=v_reverse_id;

  update public.inventory_documents
     set status='reversed',reversed_by=auth.uid(),reversed_at=now(),updated_at=now()
   where id=v_src.id;

  insert into public.audit_logs(workspace_id,action,entity_type,entity_id,summary)
  values(v_src.workspace_id,'reverse','inventory_document',v_src.id,'Inventory document reversed');

  return v_reverse_id;
end;
$$;

revoke all on function private.post_inventory_document(uuid) from public, anon;
revoke all on function private.reverse_inventory_document(uuid,date,text) from public, anon;
grant execute on function private.post_inventory_document(uuid) to authenticated, service_role;
grant execute on function private.reverse_inventory_document(uuid,date,text) to authenticated, service_role;

create or replace function public.post_inventory_document(p_document_id uuid)
returns uuid
language sql
security invoker
set search_path = ''
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
set search_path = ''
as $$
  select private.reverse_inventory_document(p_document_id,p_reverse_date,p_reason)
$$;

revoke all on function public.post_inventory_document(uuid) from public, anon;
revoke all on function public.reverse_inventory_document(uuid,date,text) from public, anon;
grant execute on function public.post_inventory_document(uuid) to authenticated, service_role;
grant execute on function public.reverse_inventory_document(uuid,date,text) to authenticated, service_role;

-- RC1.4-D will extend post/reversal atomically with financial journal creation/reversal.
-- Until then, any document carrying journal_entry_id is deliberately rejected by reversal.
