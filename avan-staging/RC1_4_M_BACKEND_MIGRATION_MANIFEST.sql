-- Avan RC1.4-M Backend Migration Manifest
-- Applied to Supabase project dkyqsxnllvxypigxpygo on 2026-09-06.
-- Source is pinned to immutable GitHub commit:
-- 50161dbcaceeab63862d6e9ebc3d0a6765c892b0
--
-- This file records the exact migration source order and SHA-256 checks used by
-- rc1_4_m_inventory_backend_enablement, plus the follow-up FK index hardening.
-- It is retained for audit/reproducibility; it is not a browser asset.

-- Main migration precondition at execution time: http extension was not installed.
create extension if not exists http with schema extensions;

do $loader$
declare
  r record;
  v_status int;
  v_body text;
  v_hash text;
begin
  for r in
    select * from (values
      (1,'RC1_4_A_INVENTORY_SCHEMA_DRAFT.sql','e72c65c49b6b18af1174031fa65edebf4d1d2d6f63d91ab7490608a84dc19e2d'),
      (2,'RC1_4_B_INVENTORY_POSTING_ENGINE_DRAFT.sql','bd98d2bab7db259a0cbab5577be323e1a299be0fc4ab43fd82812f8b87f7cf59'),
      (3,'RC1_4_C_WEIGHTED_AVERAGE_LEDGER_BRIDGE_DRAFT.sql','4bb9a7e9d4647caf451f14a3ae1d3aa0bfb93e4ba67d715f92f6ee5caa60cfa4'),
      (4,'RC1_4_C1_WEIGHTED_AVERAGE_HARDENING.sql','65d084653cad31f8cb93a8a3722dc514b69f028ad999f307de1a2874c3af4cbc'),
      (5,'RC1_4_D0_INVOICE_QUANTITY_PRECISION.sql','a83543e1b9affff74890b7e5fa8e56f885b412fd7e7ea2b71c9620420df83466'),
      (6,'RC1_4_D_SALES_PURCHASE_INVENTORY_INTEGRATION_DRAFT.sql','c2967a5de74e417a98b73b8cc84012e2ea062e7d24a66d2b0f892e533b0ed9f4'),
      (7,'RC1_4_D1_INVOICE_INVENTORY_HARDENING.sql','3daba75d77be3af6934c5def61239a41c18174df879b30d3eb9f2ea1336284c0')
    ) x(ord,name,sha256)
    order by ord
  loop
    select (h).status,(h).content
      into v_status,v_body
    from (
      select extensions.http_get(
        'https://raw.githubusercontent.com/afzalpour/afzalpour.github.io/' ||
        '50161dbcaceeab63862d6e9ebc3d0a6765c892b0/avan-staging/' || r.name
      ) h
    ) q;

    if v_status <> 200 then
      raise exception 'RC14_M_FETCH_FAILED:%:%', r.name, v_status;
    end if;

    v_hash := encode(extensions.digest(v_body,'sha256'),'hex');
    if v_hash <> r.sha256 then
      raise exception 'RC14_M_HASH_MISMATCH:%', r.name;
    end if;

    execute v_body;
  end loop;
end
$loader$;

-- The temporary loader capability was removed immediately after migration.
drop extension http;

-- Follow-up migration: rc1_4_m_inventory_fk_index_hardening
create index if not exists inventory_document_lines_workspace_document_idx
  on public.inventory_document_lines(workspace_id, inventory_document_id);

create index if not exists inventory_document_lines_workspace_from_warehouse_idx
  on public.inventory_document_lines(workspace_id, from_warehouse_id)
  where from_warehouse_id is not null;

create index if not exists inventory_document_lines_workspace_to_warehouse_idx
  on public.inventory_document_lines(workspace_id, to_warehouse_id)
  where to_warehouse_id is not null;

create index if not exists inventory_documents_workspace_journal_idx
  on public.inventory_documents(workspace_id, journal_entry_id)
  where journal_entry_id is not null;

create index if not exists inventory_movements_workspace_line_idx
  on public.inventory_movements(workspace_id, inventory_document_line_id);

create index if not exists inventory_movements_workspace_reversal_idx
  on public.inventory_movements(workspace_id, reversal_of)
  where reversal_of is not null;

create index if not exists inventory_movements_workspace_warehouse_idx
  on public.inventory_movements(workspace_id, warehouse_id);

create index if not exists invoice_lines_workspace_unit_idx
  on public.invoice_lines(workspace_id, unit_id)
  where unit_id is not null;

create index if not exists invoice_lines_workspace_warehouse_idx
  on public.invoice_lines(workspace_id, warehouse_id)
  where warehouse_id is not null;

-- Post-apply operational step used in the gate:
-- notify pgrst, 'reload schema';
