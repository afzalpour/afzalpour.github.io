-- Avan RC1.4-C1 Weighted-average hardening
-- STATUS: mandatory companion to RC1_4_C_WEIGHTED_AVERAGE_LEDGER_BRIDGE_DRAFT.sql
-- NOT APPLIED to Production.

-- 1) Prevent an inventory accounting role from being mapped to an account
-- with the wrong accounting nature or wrong standard parent heading.
-- Custom postable accounts are allowed only under the correct Company heading.
create or replace function private.guard_inventory_account_role_mapping()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_category text;
  v_normal text;
  v_postable boolean;
  v_active boolean;
  v_parent_code text;
  v_expected_category text;
  v_expected_normal text;
  v_expected_parent text;
begin
  if new.role_key not in (
    'inventory_asset','inventory_cogs','inventory_grni',
    'inventory_adjustment_gain','inventory_adjustment_loss'
  ) then
    return new;
  end if;

  v_expected_category := case new.role_key
    when 'inventory_asset' then 'asset'
    when 'inventory_cogs' then 'expense'
    when 'inventory_grni' then 'liability'
    when 'inventory_adjustment_gain' then 'income'
    when 'inventory_adjustment_loss' then 'expense'
  end;
  v_expected_normal := case new.role_key
    when 'inventory_asset' then 'debit'
    when 'inventory_cogs' then 'debit'
    when 'inventory_grni' then 'credit'
    when 'inventory_adjustment_gain' then 'credit'
    when 'inventory_adjustment_loss' then 'debit'
  end;
  v_expected_parent := case new.role_key
    when 'inventory_asset' then '130'
    when 'inventory_cogs' then '520'
    when 'inventory_grni' then '225'
    when 'inventory_adjustment_gain' then '425'
    when 'inventory_adjustment_loss' then '570'
  end;

  select a.category,a.normal_balance,a.is_postable,a.is_active,p.code
    into v_category,v_normal,v_postable,v_active,v_parent_code
  from public.accounts a
  left join public.accounts p
    on p.id=a.parent_id and p.workspace_id=a.workspace_id
  where a.id=new.account_id and a.workspace_id=new.workspace_id;

  if not found or not coalesce(v_postable,false) or not coalesce(v_active,false)
     or v_category is distinct from v_expected_category
     or v_normal is distinct from v_expected_normal
     or v_parent_code is distinct from v_expected_parent then
    raise exception 'INVENTORY_ACCOUNT_ROLE_INVALID:%',new.role_key;
  end if;
  return new;
end;
$$;

revoke all on function private.guard_inventory_account_role_mapping() from public, anon;

drop trigger if exists trg_guard_inventory_account_role_mapping on public.account_roles;
create trigger trg_guard_inventory_account_role_mapping
before insert or update on public.account_roles
for each row execute function private.guard_inventory_account_role_mapping();

-- 2) Moving weighted-average is posting-order sensitive. Rather than silently
-- recost all later movements, RC1.4 forbids posting a movement earlier than the
-- latest already-posted movement for the same Company/item/warehouse state.
-- Same-day posting remains valid and posting_seq gives deterministic order.
create or replace function private.guard_inventory_movement_chronology()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_latest date;
begin
  select max(m.movement_date) into v_latest
  from public.inventory_movements m
  where m.workspace_id=new.workspace_id
    and m.item_id=new.item_id
    and m.warehouse_id=new.warehouse_id;

  if v_latest is not null and new.movement_date < v_latest then
    raise exception 'INVENTORY_BACKDATED_POSTING_FORBIDDEN';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_inventory_movement_chronology() from public, anon;

drop trigger if exists trg_guard_inventory_movement_chronology on public.inventory_movements;
create trigger trg_guard_inventory_movement_chronology
before insert on public.inventory_movements
for each row execute function private.guard_inventory_movement_chronology();

-- 3) Correct reconciliation for reversed issues. Original issue movements remain
-- immutable; their reversal movements live on a reversal document. Both must be
-- included with their natural sign so COGS goes back to zero after reversal.
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
         coalesce(sum(-round(m.value_delta,0)),0)::numeric(30,0) as movement_cogs
  from public.inventory_documents d
  join public.inventory_movements m
    on m.inventory_document_id=d.id and m.workspace_id=d.workspace_id
  left join public.inventory_documents src
    on src.id=d.reversal_of and src.workspace_id=d.workspace_id
  where d.document_type='issue'
     or (d.document_type='reversal' and src.document_type='issue')
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
