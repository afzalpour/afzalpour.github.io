-- Avan RC1.4-A Inventory schema upgrade draft
-- STATUS: repository candidate only; NOT APPLIED to Production.
-- Existing Production foundation is preserved:
--   public.inventory_units
--   public.inventory_items
--   public.inventory_settings
--   public.warehouses
-- Canonical financial currency remains integer Toman at the financial Ledger boundary.

-- Composite uniqueness is required so every new FK can enforce Company identity.
create unique index if not exists inventory_items_workspace_id_uk
  on public.inventory_items(workspace_id, id);
create unique index if not exists fiscal_years_workspace_id_uk
  on public.fiscal_years(workspace_id, id);
create unique index if not exists journal_entries_workspace_id_uk
  on public.journal_entries(workspace_id, id);

create table if not exists public.inventory_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  fiscal_year_id uuid not null,
  document_no bigint,
  document_type text not null,
  document_date date not null,
  description text,
  status text not null default 'draft',
  source_type text,
  source_id uuid,
  journal_entry_id uuid,
  reversal_of uuid,
  created_by uuid default auth.uid(),
  posted_by uuid,
  reversed_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz,
  reversed_at timestamptz,
  constraint inventory_documents_type_ck
    check (document_type in ('opening','receipt','issue','transfer','adjustment','reversal')),
  constraint inventory_documents_status_ck
    check (status in ('draft','posted','reversed')),
  constraint inventory_documents_no_positive_ck
    check (document_no is null or document_no > 0),
  constraint inventory_documents_reversal_not_self_ck
    check (reversal_of is null or reversal_of <> id),
  constraint inventory_documents_workspace_id_uk unique (workspace_id, id),
  constraint inventory_documents_fiscal_year_fk foreign key (workspace_id, fiscal_year_id)
    references public.fiscal_years(workspace_id, id),
  constraint inventory_documents_journal_fk foreign key (workspace_id, journal_entry_id)
    references public.journal_entries(workspace_id, id),
  constraint inventory_documents_reversal_fk foreign key (workspace_id, reversal_of)
    references public.inventory_documents(workspace_id, id)
);

create unique index if not exists inventory_documents_no_uk
  on public.inventory_documents(workspace_id, fiscal_year_id, document_no)
  where document_no is not null;
create unique index if not exists inventory_documents_reversal_once_uk
  on public.inventory_documents(workspace_id, reversal_of)
  where reversal_of is not null;

create table if not exists public.inventory_document_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_document_id uuid not null,
  line_no integer not null,
  item_id uuid not null,
  from_warehouse_id uuid,
  to_warehouse_id uuid,
  quantity numeric(20,6) not null,
  unit_cost numeric(20,6) not null default 0,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_document_lines_line_no_positive_ck check (line_no > 0),
  constraint inventory_document_lines_quantity_positive_ck check (quantity > 0),
  constraint inventory_document_lines_unit_cost_nonnegative_ck check (unit_cost >= 0),
  constraint inventory_document_lines_warehouse_presence_ck
    check (from_warehouse_id is not null or to_warehouse_id is not null),
  constraint inventory_document_lines_transfer_distinct_ck
    check (from_warehouse_id is null or to_warehouse_id is null or from_warehouse_id <> to_warehouse_id),
  constraint inventory_document_lines_workspace_id_uk unique (workspace_id, id),
  constraint inventory_document_lines_document_line_uk unique (inventory_document_id, line_no),
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
  on public.inventory_document_lines(inventory_document_id, line_no);
create index if not exists inventory_document_lines_item_idx
  on public.inventory_document_lines(workspace_id, item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  posting_seq bigint generated always as identity,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  inventory_document_id uuid not null,
  inventory_document_line_id uuid not null,
  item_id uuid not null,
  warehouse_id uuid not null,
  movement_date date not null,
  quantity_delta numeric(20,6) not null,
  unit_cost numeric(20,6) not null,
  value_delta numeric(24,6) generated always as (quantity_delta * unit_cost) stored,
  reversal_of uuid,
  created_at timestamptz not null default now(),
  constraint inventory_movements_quantity_nonzero_ck check (quantity_delta <> 0),
  constraint inventory_movements_unit_cost_nonnegative_ck check (unit_cost >= 0),
  constraint inventory_movements_reversal_not_self_ck check (reversal_of is null or reversal_of <> id),
  constraint inventory_movements_workspace_id_uk unique (workspace_id, id),
  constraint inventory_movements_source_uk unique (inventory_document_line_id, warehouse_id),
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

create index if not exists inventory_movements_item_warehouse_seq_idx
  on public.inventory_movements(workspace_id, item_id, warehouse_id, posting_seq);
create index if not exists inventory_movements_document_idx
  on public.inventory_movements(workspace_id, inventory_document_id);

alter table public.inventory_documents enable row level security;
alter table public.inventory_document_lines enable row level security;
alter table public.inventory_movements enable row level security;

-- Existing Inventory role model is retained: owner / manager / accountant maintain drafts.
create policy inventory_documents_select on public.inventory_documents
for select to authenticated
using (public.has_workspace_access(workspace_id));

create policy inventory_documents_insert_draft on public.inventory_documents
for insert to authenticated
with check (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and status = 'draft'
  and document_type <> 'reversal'
  and document_no is null
  and journal_entry_id is null
  and reversal_of is null
  and posted_by is null
  and reversed_by is null
  and posted_at is null
  and reversed_at is null
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
  and document_type <> 'reversal'
  and document_no is null
  and journal_entry_id is null
  and reversal_of is null
  and posted_by is null
  and reversed_by is null
  and posted_at is null
  and reversed_at is null
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
      and d.document_type <> 'reversal'
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
      and d.document_type <> 'reversal'
  )
)
with check (
  public.workspace_role(workspace_id) = any (array['owner','manager','accountant'])
  and exists (
    select 1 from public.inventory_documents d
    where d.id = inventory_document_id
      and d.workspace_id = inventory_document_lines.workspace_id
      and d.status = 'draft'
      and d.document_type <> 'reversal'
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
      and d.document_type <> 'reversal'
  )
);

-- Movement ledger is browser read-only. Posting/reversal functions own writes.
create policy inventory_movements_select on public.inventory_movements
for select to authenticated
using (public.has_workspace_access(workspace_id));

-- Explicit Data API grants: future Supabase defaults will no longer auto-expose new tables.
revoke all on public.inventory_documents from anon;
revoke all on public.inventory_document_lines from anon;
revoke all on public.inventory_movements from anon;

grant select, insert, update, delete on public.inventory_documents to authenticated;
grant select, insert, update, delete on public.inventory_document_lines to authenticated;
revoke insert, update, delete on public.inventory_movements from authenticated;
grant select on public.inventory_movements to authenticated;

create or replace view public.inventory_on_hand
with (security_invoker = true)
as
select
  workspace_id,
  item_id,
  warehouse_id,
  sum(quantity_delta)::numeric(20,6) as quantity_on_hand,
  sum(value_delta)::numeric(24,6) as inventory_value,
  case
    when sum(quantity_delta) = 0 then 0::numeric
    else (sum(value_delta) / sum(quantity_delta))::numeric(24,6)
  end as average_unit_cost
from public.inventory_movements
group by workspace_id, item_id, warehouse_id;

revoke all on public.inventory_on_hand from anon;
grant select on public.inventory_on_hand to authenticated;

-- RC1.4-B owns lifecycle/posting/reversal/immutability.
-- RC1.4-D will own the exact Inventory <-> Financial Ledger bridge and invoice integration.
