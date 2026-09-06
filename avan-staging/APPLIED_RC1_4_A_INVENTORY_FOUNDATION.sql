-- Avan RC1.4-A — Inventory foundation
-- Applied to Supabase project Avan-production on 2026-09-06.
-- Additive foundation only: no stock ledger or accounting posting in this gate.

create table if not exists public.inventory_units (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  symbol text,
  decimal_places smallint not null default 3 check (decimal_places between 0 and 6),
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_units_code_not_blank check (btrim(code) <> ''),
  constraint inventory_units_name_not_blank check (btrim(name) <> ''),
  constraint inventory_units_workspace_code_key unique (workspace_id, code),
  constraint inventory_units_workspace_id_id_key unique (workspace_id, id)
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  description text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_code_not_blank check (btrim(code) <> ''),
  constraint warehouses_name_not_blank check (btrim(name) <> ''),
  constraint warehouses_workspace_code_key unique (workspace_id, code),
  constraint warehouses_workspace_id_id_key unique (workspace_id, id)
);

create unique index if not exists warehouses_one_default_per_workspace_idx
  on public.warehouses(workspace_id) where is_default;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku text not null,
  barcode text,
  name text not null,
  item_type text not null default 'inventory' check (item_type in ('inventory','service','non_inventory')),
  base_unit_id uuid not null,
  min_stock numeric(24,6) not null default 0 check (min_stock >= 0),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_sku_not_blank check (btrim(sku) <> ''),
  constraint inventory_items_name_not_blank check (btrim(name) <> ''),
  constraint inventory_items_barcode_not_blank check (barcode is null or btrim(barcode) <> ''),
  constraint inventory_items_workspace_sku_key unique (workspace_id, sku),
  constraint inventory_items_workspace_unit_fk foreign key (workspace_id, base_unit_id)
    references public.inventory_units(workspace_id, id) on update restrict on delete restrict
);

create unique index if not exists inventory_items_workspace_barcode_key
  on public.inventory_items(workspace_id, barcode) where barcode is not null;
create index if not exists inventory_items_workspace_active_idx
  on public.inventory_items(workspace_id, is_active, name);

create table if not exists public.inventory_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  costing_method text not null default 'weighted_average' check (costing_method in ('weighted_average')),
  allow_negative_stock boolean not null default false,
  quantity_scale smallint not null default 3 check (quantity_scale between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger inventory_units_touch_updated_at before update on public.inventory_units
for each row execute function public.touch_avan_document_updated_at();
create trigger warehouses_touch_updated_at before update on public.warehouses
for each row execute function public.touch_avan_document_updated_at();
create trigger inventory_items_touch_updated_at before update on public.inventory_items
for each row execute function public.touch_avan_document_updated_at();
create trigger inventory_settings_touch_updated_at before update on public.inventory_settings
for each row execute function public.touch_avan_document_updated_at();

alter table public.inventory_units enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_settings enable row level security;

create policy inventory_units_select on public.inventory_units for select to authenticated using (public.has_workspace_access(workspace_id));
create policy inventory_units_insert on public.inventory_units for insert to authenticated with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));
create policy inventory_units_update on public.inventory_units for update to authenticated using (public.workspace_role(workspace_id) in ('owner','manager','accountant')) with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));
create policy warehouses_select on public.warehouses for select to authenticated using (public.has_workspace_access(workspace_id));
create policy warehouses_insert on public.warehouses for insert to authenticated with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));
create policy warehouses_update on public.warehouses for update to authenticated using (public.workspace_role(workspace_id) in ('owner','manager','accountant')) with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));
create policy inventory_items_select on public.inventory_items for select to authenticated using (public.has_workspace_access(workspace_id));
create policy inventory_items_insert on public.inventory_items for insert to authenticated with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));
create policy inventory_items_update on public.inventory_items for update to authenticated using (public.workspace_role(workspace_id) in ('owner','manager','accountant')) with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));
create policy inventory_settings_select on public.inventory_settings for select to authenticated using (public.has_workspace_access(workspace_id));
create policy inventory_settings_insert on public.inventory_settings for insert to authenticated with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));
create policy inventory_settings_update on public.inventory_settings for update to authenticated using (public.workspace_role(workspace_id) in ('owner','manager','accountant')) with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));

revoke all on table public.inventory_units, public.warehouses, public.inventory_items, public.inventory_settings from anon, authenticated;
grant select, insert, update on table public.inventory_units, public.warehouses, public.inventory_items, public.inventory_settings to authenticated;

create or replace function private.ensure_inventory_foundation(p_wid uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.workspaces w where w.id = p_wid) then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  insert into public.inventory_units(workspace_id, code, name, symbol, decimal_places, is_system) values
    (p_wid,'EA','عدد','عدد',0,true),(p_wid,'KG','کیلوگرم','kg',3,true),(p_wid,'G','گرم','g',3,true),
    (p_wid,'M','متر','m',3,true),(p_wid,'L','لیتر','L',3,true),(p_wid,'PK','بسته','بسته',0,true),(p_wid,'CTN','کارتن','کارتن',0,true)
  on conflict (workspace_id, code) do nothing;
  insert into public.warehouses(workspace_id, code, name, is_default) values (p_wid,'MAIN','انبار اصلی',true)
  on conflict (workspace_id, code) do nothing;
  insert into public.inventory_settings(workspace_id, costing_method, allow_negative_stock, quantity_scale)
  values (p_wid,'weighted_average',false,3) on conflict (workspace_id) do nothing;
end; $$;
revoke all on function private.ensure_inventory_foundation(uuid) from public, anon, authenticated;

create or replace function private.bootstrap_inventory_foundation()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.ensure_inventory_foundation(new.id); return new; end; $$;
revoke all on function private.bootstrap_inventory_foundation() from public, anon, authenticated;

drop trigger if exists trg_bootstrap_inventory_foundation on public.workspaces;
create trigger trg_bootstrap_inventory_foundation after insert on public.workspaces
for each row execute function private.bootstrap_inventory_foundation();

do $$ declare r record; begin for r in select id from public.workspaces loop perform private.ensure_inventory_foundation(r.id); end loop; end $$;
