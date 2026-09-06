-- Avan RC1.4-L — APPLIED migration record
-- Applied to connected Supabase project on 2026-09-06.
-- Scope: atomic inventory draft save + two-level item grouping + SKU variant metadata.

create table if not exists public.inventory_item_groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  parent_group_id uuid,
  code text not null,
  name text not null,
  level smallint not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_item_groups_workspace_id_uk unique(workspace_id,id),
  constraint inventory_item_groups_code_uk unique(workspace_id,code),
  constraint inventory_item_groups_level_ck check(level in (1,2)),
  constraint inventory_item_groups_not_self_ck check(parent_group_id is null or parent_group_id<>id),
  constraint inventory_item_groups_parent_fk foreign key(workspace_id,parent_group_id)
    references public.inventory_item_groups(workspace_id,id)
);

create index if not exists inventory_item_groups_workspace_parent_idx
  on public.inventory_item_groups(workspace_id,parent_group_id);

create or replace function private.guard_inventory_item_group_hierarchy()
returns trigger
language plpgsql
set search_path=''
as $$
declare v_parent_level smallint;
begin
  new.code:=btrim(new.code);
  new.name:=btrim(new.name);
  if new.code='' or new.name='' then raise exception 'INVENTORY_GROUP_CODE_NAME_REQUIRED'; end if;
  if tg_op='UPDATE' and new.parent_group_id is distinct from old.parent_group_id then
    raise exception 'INVENTORY_GROUP_PARENT_IMMUTABLE';
  end if;
  if new.parent_group_id is null then
    new.level:=1;
  else
    select g.level into v_parent_level
    from public.inventory_item_groups g
    where g.workspace_id=new.workspace_id and g.id=new.parent_group_id;
    if v_parent_level is null then raise exception 'INVENTORY_PARENT_GROUP_INVALID'; end if;
    if v_parent_level<>1 then raise exception 'INVENTORY_GROUP_MAX_DEPTH_TWO'; end if;
    new.level:=2;
  end if;
  new.updated_at:=now();
  return new;
end;
$$;

revoke all on function private.guard_inventory_item_group_hierarchy() from public,anon,authenticated;
drop trigger if exists trg_guard_inventory_item_group_hierarchy on public.inventory_item_groups;
create trigger trg_guard_inventory_item_group_hierarchy
before insert or update on public.inventory_item_groups
for each row execute function private.guard_inventory_item_group_hierarchy();

alter table public.inventory_item_groups enable row level security;
drop policy if exists inventory_item_groups_select on public.inventory_item_groups;
create policy inventory_item_groups_select on public.inventory_item_groups
for select to authenticated using(public.has_workspace_access(workspace_id));
drop policy if exists inventory_item_groups_insert on public.inventory_item_groups;
create policy inventory_item_groups_insert on public.inventory_item_groups
for insert to authenticated with check(public.workspace_role(workspace_id)=any(array['owner','manager','accountant']));
drop policy if exists inventory_item_groups_update on public.inventory_item_groups;
create policy inventory_item_groups_update on public.inventory_item_groups
for update to authenticated
using(public.workspace_role(workspace_id)=any(array['owner','manager','accountant']))
with check(public.workspace_role(workspace_id)=any(array['owner','manager','accountant']));

revoke all on public.inventory_item_groups from anon;
grant select,insert,update on public.inventory_item_groups to authenticated;
revoke delete on public.inventory_item_groups from authenticated;

alter table public.inventory_items add column if not exists group_id uuid;
alter table public.inventory_items add column if not exists variant_label text;
create index if not exists inventory_items_workspace_group_idx on public.inventory_items(workspace_id,group_id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname='inventory_items_group_fk') then
    alter table public.inventory_items
      add constraint inventory_items_group_fk
      foreign key(workspace_id,group_id)
      references public.inventory_item_groups(workspace_id,id);
  end if;
end$$;

create or replace function private.save_inventory_draft(
  p_workspace_id uuid,
  p_fiscal_year_id uuid,
  p_document_id uuid,
  p_document_type text,
  p_document_date date,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id uuid; v_line jsonb; v_item uuid; v_from uuid; v_to uuid;
  v_qty numeric(20,6); v_cost numeric(20,6); v_desc text;
  v_decimals smallint; v_ord bigint;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  perform private.assert_financial_write_access(p_workspace_id);
  if p_document_type not in ('opening','receipt','issue','transfer','adjustment') then raise exception 'INVENTORY_DOCUMENT_TYPE_INVALID'; end if;
  if p_document_date is null then raise exception 'DOCUMENT_DATE_REQUIRED'; end if;
  if not exists(
    select 1 from public.fiscal_years fy
    where fy.id=p_fiscal_year_id and fy.workspace_id=p_workspace_id
      and p_document_date between fy.date_from and fy.date_to
  ) then raise exception 'FISCAL_YEAR_INVALID'; end if;
  if jsonb_typeof(coalesce(p_lines,'null'::jsonb))<>'array' or jsonb_array_length(p_lines)<1 then raise exception 'INVENTORY_DOCUMENT_EMPTY'; end if;

  if p_document_id is null then
    insert into public.inventory_documents(workspace_id,fiscal_year_id,document_type,document_date,description,status,created_by)
    values(p_workspace_id,p_fiscal_year_id,p_document_type,p_document_date,nullif(btrim(coalesce(p_description,'')),''),'draft',auth.uid())
    returning id into v_id;
  else
    select d.id into v_id from public.inventory_documents d
    where d.id=p_document_id and d.workspace_id=p_workspace_id and d.status='draft' and d.document_type<>'reversal'
    for update;
    if v_id is null then raise exception 'INVENTORY_DRAFT_NOT_FOUND'; end if;
    update public.inventory_documents
       set fiscal_year_id=p_fiscal_year_id,document_type=p_document_type,document_date=p_document_date,
           description=nullif(btrim(coalesce(p_description,'')),''),updated_at=now()
     where id=v_id;
    delete from public.inventory_document_lines where workspace_id=p_workspace_id and inventory_document_id=v_id;
  end if;

  for v_line,v_ord in select value,ordinality from jsonb_array_elements(p_lines) with ordinality loop
    v_item:=nullif(v_line->>'item_id','')::uuid;
    v_from:=nullif(v_line->>'from_warehouse_id','')::uuid;
    v_to:=nullif(v_line->>'to_warehouse_id','')::uuid;
    v_qty:=nullif(v_line->>'quantity','')::numeric;
    v_cost:=coalesce(nullif(v_line->>'unit_cost','')::numeric,0);
    v_desc:=nullif(btrim(coalesce(v_line->>'description','')),'');

    select u.decimal_places into v_decimals
    from public.inventory_items i
    join public.inventory_units u on u.workspace_id=i.workspace_id and u.id=i.base_unit_id
    where i.workspace_id=p_workspace_id and i.id=v_item and i.is_active and i.item_type='inventory' and u.is_active;
    if v_decimals is null then raise exception 'INVENTORY_ITEM_INVALID'; end if;
    if v_qty is null or v_qty<=0 or v_qty is distinct from round(v_qty,v_decimals) then raise exception 'INVENTORY_QUANTITY_INVALID'; end if;
    if v_cost<0 then raise exception 'INVENTORY_COST_INVALID'; end if;

    if v_from is not null and not exists(select 1 from public.warehouses w where w.workspace_id=p_workspace_id and w.id=v_from and w.is_active) then raise exception 'SOURCE_WAREHOUSE_INVALID'; end if;
    if v_to is not null and not exists(select 1 from public.warehouses w where w.workspace_id=p_workspace_id and w.id=v_to and w.is_active) then raise exception 'DESTINATION_WAREHOUSE_INVALID'; end if;

    if p_document_type in ('receipt','opening') then
      if v_from is not null or v_to is null or v_cost<=0 then raise exception 'INVENTORY_LINE_SHAPE_INVALID'; end if;
    elsif p_document_type='issue' then
      if v_from is null or v_to is not null then raise exception 'INVENTORY_LINE_SHAPE_INVALID'; end if;
    elsif p_document_type='transfer' then
      if v_from is null or v_to is null or v_from=v_to then raise exception 'INVENTORY_LINE_SHAPE_INVALID'; end if;
    elsif p_document_type='adjustment' then
      if (v_from is null)=(v_to is null) then raise exception 'INVENTORY_LINE_SHAPE_INVALID'; end if;
      if v_to is not null and v_cost<=0 then raise exception 'INVENTORY_COST_INVALID'; end if;
    end if;

    insert into public.inventory_document_lines(
      workspace_id,inventory_document_id,line_no,item_id,from_warehouse_id,to_warehouse_id,quantity,unit_cost,description
    ) values(p_workspace_id,v_id,v_ord::integer,v_item,v_from,v_to,v_qty,v_cost,v_desc);
  end loop;
  return v_id;
end;
$$;

revoke all on function private.save_inventory_draft(uuid,uuid,uuid,text,date,text,jsonb) from public,anon;
grant execute on function private.save_inventory_draft(uuid,uuid,uuid,text,date,text,jsonb) to authenticated;

create or replace function public.save_inventory_draft(
  p_workspace_id uuid,p_fiscal_year_id uuid,p_document_id uuid,p_document_type text,
  p_document_date date,p_description text,p_lines jsonb
)
returns uuid
language sql
security invoker
set search_path=''
as $$
  select private.save_inventory_draft(p_workspace_id,p_fiscal_year_id,p_document_id,p_document_type,p_document_date,p_description,p_lines);
$$;

revoke all on function public.save_inventory_draft(uuid,uuid,uuid,text,date,text,jsonb) from public,anon;
grant execute on function public.save_inventory_draft(uuid,uuid,uuid,text,date,text,jsonb) to authenticated;
notify pgrst,'reload schema';
