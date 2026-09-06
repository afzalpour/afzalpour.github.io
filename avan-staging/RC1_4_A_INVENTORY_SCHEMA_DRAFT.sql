-- Avan RC1.4-A Inventory schema draft
-- STATUS: repository candidate only; NOT APPLIED to Production.
-- Canonical financial currency remains integer Toman at the financial Ledger boundary.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sku text not null,
  name text not null,
  base_unit text not null default 'عدد',
  allow_negative_stock boolean not null default false,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_sku_nonempty check (length(btrim(sku)) > 0),
  constraint inventory_items_name_nonempty check (length(btrim(name)) > 0),
  constraint inventory_items_unit_nonempty check (length(btrim(base_unit)) > 0),
  constraint inventory_items_workspace_sku_uk unique (workspace_id, sku)
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint warehouses_code_nonempty check (length(btrim(code)) > 0),
  constraint warehouses_name_nonempty check (length(btrim(name)) > 0),
  constraint warehouses_workspace_code_uk unique (workspace_id, code)
);

create table if not exists public.inventory_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fiscal_year_id uuid not null references public.fiscal_years(id),
  document_no bigint,
  document_type text not null,
  document_date date not null,
  description text,
  status text not null default 'draft',
  source_type text,
  source_id uuid,
  journal_entry_id uuid references public.journal_entries(id),
  reversal_of uuid references public.inventory_documents(id),
  created_by uuid default auth.uid(),
  posted_by uuid,
  reversed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz,
  reversed_at timestamptz,
  constraint inventory_documents_type_ck check (document_type in ('opening','receipt','issue','transfer','adjustment')),
  constraint inventory_documents_status_ck check (status in ('draft','posted','reversed')),
  constraint inventory_documents_no_positive_ck check (document_no is null or document_no > 0),
  constraint inventory_documents_reversal_not_self_ck check (reversal_of is null or reversal_of <> id)
);

create unique index if not exists inventory_documents_no_uk
  on public.inventory_documents(workspace_id, fiscal_year_id, document_no)
  where document_no is not null;

create table if not exists public.inventory_document_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_document_id uuid not null references public.inventory_documents(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  from_warehouse_id uuid references public.warehouses(id),
  to_warehouse_id uuid references public.warehouses(id),
  quantity numeric(20,6) not null,
  unit_cost numeric(20,6) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_document_lines_quantity_positive_ck check (quantity > 0),
  constraint inventory_document_lines_unit_cost_nonnegative_ck check (unit_cost >= 0),
  constraint inventory_document_lines_warehouse_presence_ck check (from_warehouse_id is not null or to_warehouse_id is not null),
  constraint inventory_document_lines_transfer_distinct_ck check (from_warehouse_id is null or to_warehouse_id is null or from_warehouse_id <> to_warehouse_id)
);

create index if not exists inventory_document_lines_document_idx
  on public.inventory_document_lines(inventory_document_id);
create index if not exists inventory_document_lines_item_idx
  on public.inventory_document_lines(workspace_id, item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_document_id uuid not null references public.inventory_documents(id),
  inventory_document_line_id uuid not null references public.inventory_document_lines(id),
  item_id uuid not null references public.inventory_items(id),
  warehouse_id uuid not null references public.warehouses(id),
  movement_date date not null,
  quantity_delta numeric(20,6) not null,
  unit_cost numeric(20,6) not null default 0,
  total_cost numeric(24,6) generated always as (abs(quantity_delta) * unit_cost) stored,
  reversal_of uuid references public.inventory_movements(id),
  created_at timestamptz not null default now(),
  constraint inventory_movements_quantity_nonzero_ck check (quantity_delta <> 0),
  constraint inventory_movements_unit_cost_nonnegative_ck check (unit_cost >= 0),
  constraint inventory_movements_reversal_not_self_ck check (reversal_of is null or reversal_of <> id),
  constraint inventory_movements_source_uk unique (inventory_document_line_id, warehouse_id, quantity_delta)
);

create index if not exists inventory_movements_item_warehouse_date_idx
  on public.inventory_movements(workspace_id, item_id, warehouse_id, movement_date, created_at);

alter table public.inventory_items enable row level security;
alter table public.warehouses enable row level security;
alter table public.inventory_documents enable row level security;
alter table public.inventory_document_lines enable row level security;
alter table public.inventory_movements enable row level security;

-- Master data: Company-scoped access. Role-specific tightening can be layered in RC1.4-A2.
create policy inventory_items_access on public.inventory_items
for all to authenticated
using (public.has_workspace_access(workspace_id))
with check (public.has_workspace_access(workspace_id));

create policy warehouses_access on public.warehouses
for all to authenticated
using (public.has_workspace_access(workspace_id))
with check (public.has_workspace_access(workspace_id));

-- Draft inventory documents may be created/edited/deleted by authorized Company users.
create policy inventory_documents_select on public.inventory_documents
for select to authenticated
using (public.has_workspace_access(workspace_id));

create policy inventory_documents_insert_draft on public.inventory_documents
for insert to authenticated
with check (public.has_workspace_access(workspace_id) and status = 'draft');

create policy inventory_documents_update_draft on public.inventory_documents
for update to authenticated
using (public.has_workspace_access(workspace_id) and status = 'draft')
with check (public.has_workspace_access(workspace_id) and status = 'draft');

create policy inventory_documents_delete_draft on public.inventory_documents
for delete to authenticated
using (public.has_workspace_access(workspace_id) and status = 'draft');

create policy inventory_document_lines_select on public.inventory_document_lines
for select to authenticated
using (public.has_workspace_access(workspace_id));

create policy inventory_document_lines_insert on public.inventory_document_lines
for insert to authenticated
with check (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1 from public.inventory_documents d
    where d.id = inventory_document_id
      and d.workspace_id = inventory_document_lines.workspace_id
      and d.status = 'draft'
  )
);

create policy inventory_document_lines_update on public.inventory_document_lines
for update to authenticated
using (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1 from public.inventory_documents d
    where d.id = inventory_document_id
      and d.workspace_id = inventory_document_lines.workspace_id
      and d.status = 'draft'
  )
)
with check (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1 from public.inventory_documents d
    where d.id = inventory_document_id
      and d.workspace_id = inventory_document_lines.workspace_id
      and d.status = 'draft'
  )
);

create policy inventory_document_lines_delete on public.inventory_document_lines
for delete to authenticated
using (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1 from public.inventory_documents d
    where d.id = inventory_document_id
      and d.workspace_id = inventory_document_lines.workspace_id
      and d.status = 'draft'
  )
);

-- Movement ledger is read-only from browser. Posting/reversal RPCs will own INSERT.
create policy inventory_movements_select on public.inventory_movements
for select to authenticated
using (public.has_workspace_access(workspace_id));

create or replace view public.inventory_on_hand
with (security_invoker = true)
as
select
  workspace_id,
  item_id,
  warehouse_id,
  sum(quantity_delta)::numeric(20,6) as quantity_on_hand,
  sum(case when quantity_delta > 0 then total_cost else -total_cost end)::numeric(24,6) as movement_value_net
from public.inventory_movements
group by workspace_id, item_id, warehouse_id;

-- Deliberately deferred from RC1.4-A draft:
-- 1) posting/reversal SECURITY INVOKER wrappers + private implementations,
-- 2) immutable triggers for posted inventory documents/lines,
-- 3) moving weighted-average cost engine,
-- 4) exact inventory ↔ journal posting bridge,
-- 5) automatic invoice integration,
-- 6) role-specific write permissions beyond workspace membership.
