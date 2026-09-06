-- Avan RC1.4-A Inventory schema upgrade draft
-- STATUS: repository candidate only; NOT APPLIED to Production.
-- Existing Production foundation preserved:
--   public.inventory_units
--   public.inventory_items
--   public.inventory_settings
--   public.warehouses
-- Canonical financial currency remains integer Toman at the financial Ledger boundary.

-- inventory_items already has workspace-scoped SKU uniqueness and a composite FK to inventory_units.
-- Add a non-partial unique index so new composite FKs can also enforce item Company identity.
create unique index if not exists inventory_items_workspace_id_uk
  on public.inventory_items(workspace_id, id);

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
  reversal_of uuid,
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
  constraint inventory_documents_reversal_not_self_ck check (reversal_of is null or reversal_of <> id),
  constraint inventory_documents_workspace_id_uk unique (workspace_id, id),
  constraint inventory_documents_reversal_fk foreign key (workspace_id, reversal_of)
    references public.inventory_documents(workspace_id, id)
);

create unique index if not exists inventory_documents_no_uk
  on public.inventory_documents(workspace_id, fiscal_year_id, document_no)
  where document_no is not null;

create table if not exists public.inventory_document_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_document_id uuid not null,
  item_id uuid not null,
  from_warehouse_id uuid,
  to_warehouse_id uuid,
  quantity numeric(20,6) not null,
  unit_cost numeric(20,6) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_document_lines_quantity_positive_ck check (quantity > 0),
  constraint inventory_document_lines_unit_cost_nonnegative_ck check (unit_cost >= 0),
  constraint inventory_document_lines_warehouse_presence_ck check (from_warehouse_id is not null or to_warehouse_id is not null),
  constraint inventory_document_lines_transfer_distinct_ck check (from_warehouse_id is null or to_warehouse_id is null or from_warehouse_id <> to_warehouse_id),
  constraint inventory_document_lines_workspace_id_uk unique (workspace_id, id),
  constraint inventory_document_lines_document_fk foreign key (workspace_id, inventory_document_id)
    references public.inventory_documents(workspace_id, id) on delete cascade,
  constraint inventory_document_lines_item_fk foreign key (workspace_id, item_id)
    references public.inventory_items(workspace_id, id),
  constraint inventory_document_lines_from_warehouse_fk foreign key (workspace_id, from_warehouse_id)
    references public.warehouses(workspace_id, id),
  constraint inventory_document_lines_to_warehouse_fk foreign key (workspace_id, to_warehouse_id)
    references public.warehouses(workspace_id, id)
);

create index if not exists inventory_document_lines_document_idx
  on public.inventory_document_lines(inventory_document_id);
create index if not exists inventory_document_lines_item_idx
  on public.inventory_document_lines(workspace_id, item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_document_id uuid not null,
  inventory_document_line_id uuid not null,
  item_id uuid not null,
  warehouse_id uuid not null,
  movement_date date not null,
  quantity_delta numeric(20,6) not null,
  unit_cost numeric(20,6) not null default 0,
  total_cost numeric(24,6) generated always as (abs(quantity_delta) * unit_cost) stored,
  reversal_of uuid,
  created_at timestamptz not null default now(),
  constraint inventory_movements_quantity_nonzero_ck check (quantity_delta <> 0),
  constraint inventory_movements_unit_cost_nonnegative_ck check (unit_cost >= 0),
  constraint inventory_movements_reversal_not_self_ck check (reversal_of is null or reversal_of <> id),
  constraint inventory_movements_workspace_id_uk unique (workspace_id, id),
  constraint inventory_movements_source_uk unique (inventory_document_line_id, warehouse_id, quantity_delta),
  constraint inventory_movements_document_fk foreign key (workspace_id, inventory_document_id)
    references public.inventory_documents(workspace_id, id),
  constraint inventory_movements_line_fk foreign key (workspace_id, inventory_document_line_id)
    references public.inventory_document_lines(workspace_id, id),
  constraint inventory_movements_item_fk foreign key (workspace_id, item_id)
    references public.inventory_items(workspace_id, id),
  constraint inventory_movements_warehouse_fk foreign key (workspace_id, warehouse_id)
    references public.warehouses(workspace_id, id),
  constraint inventory_movements_reversal_fk foreign key (workspace_id, reversal_of)
    references public.inventory_movements(workspace_id, id)
);

create index if not exists inventory_movements_item_warehouse_date_idx
  on public.inventory_movements(workspace_id, item_id, warehouse_id, movement_date, created_at);

alter table public.inventory_documents enable row level security;
alter table public.inventory_document_lines enable row level security;
alter table public.inventory_movements enable row level security;

-- Existing Inventory role model is retained: owner / manager / accountant may maintain drafts.
create policy inventory_documents_select on public.inventory_documents
for select to authenticated
using (public.has_workspace_access(workspace_id));

create policy inventory_documents_insert_draft on public.inventory_documents
for insert to authenticated
with check (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and status = 'draft'
  and journal_entry_id is null
  and reversal_of is null
  and posted_by is null
  and reversed_by is null
  and posted_at is null
  and reversed_at is null
  and exists (
    select 1 from public.fiscal_years fy
    where fy.id = fiscal_year_id
      and fy.workspace_id = inventory_documents.workspace_id
  )
);

create policy inventory_documents_update_draft on public.inventory_documents
for update to authenticated
using (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and status = 'draft'
)
with check (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and status = 'draft'
  and journal_entry_id is null
  and reversal_of is null
  and posted_by is null
  and reversed_by is null
  and posted_at is null
  and reversed_at is null
  and exists (
    select 1 from public.fiscal_years fy
    where fy.id = fiscal_year_id
      and fy.workspace_id = inventory_documents.workspace_id
  )
);

create policy inventory_documents_delete_draft on public.inventory_documents
for delete to authenticated
using (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and status = 'draft'
);

create policy inventory_document_lines_select on public.inventory_document_lines
for select to authenticated
using (public.has_workspace_access(workspace_id));

create policy inventory_document_lines_insert on public.inventory_document_lines
for insert to authenticated
with check (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
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
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and exists (
    select 1 from public.inventory_documents d
    where d.id = inventory_document_id
      and d.workspace_id = inventory_document_lines.workspace_id
      and d.status = 'draft'
  )
)
with check (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
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
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and exists (
    select 1 from public.inventory_documents d
    where d.id = inventory_document_id
      and d.workspace_id = inventory_document_lines.workspace_id
      and d.status = 'draft'
  )
);

-- Movement ledger is SELECT-only from browser. Posting/reversal RPCs will own INSERT.
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

-- Deferred to RC1.4-B/C:
-- 1) posting/reversal SECURITY INVOKER wrappers + private implementations,
-- 2) immutable triggers for posted inventory documents/lines,
-- 3) moving weighted-average cost engine,
-- 4) exact inventory ↔ journal posting bridge,
-- 5) automatic invoice integration.
