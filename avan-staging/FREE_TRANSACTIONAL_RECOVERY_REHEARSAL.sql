-- Avan RC1.3 — Free transactional recovery rehearsal
-- Purpose: zero-cost recovery rehearsal against the connected Supabase database.
-- Safety: creates TEMP tables only, performs no permanent data mutation, and rolls back.
-- Scope: table copy/count/hash integrity, accounting invariants, RLS tenant isolation,
--        and SECURITY DEFINER exposure contract.
-- Important: this is NOT a substitute for restoring an external logical dump + Storage
-- object bytes into an isolated target. It is a free data-layer recovery rehearsal.

begin;

-- =========================================================
-- 1) Copy every public/private base table to TEMP and verify
--    deterministic row-count + content hashes.
-- =========================================================
create temporary table avan_restore_manifest(
  schema_name text,
  table_name text,
  source_rows bigint,
  restored_rows bigint,
  source_hash text,
  restored_hash text,
  matched boolean
) on commit drop;

do $$
declare
  r record;
  tname text;
  src_count bigint;
  dst_count bigint;
  src_hash text;
  dst_hash text;
begin
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private')
      and c.relkind='r'
    order by n.nspname,c.relname
  loop
    tname := 'avan_drill_' ||
      case when r.schema_name='private' then 'priv_' else 'pub_' end ||
      r.table_name;

    execute format(
      'create temporary table %I on commit drop as table %I.%I',
      tname,r.schema_name,r.table_name
    );

    execute format(
      'select count(*)::bigint,
              md5(coalesce(string_agg(md5(row_to_json(x)::text),'''' order by md5(row_to_json(x)::text)),''''))
         from %I.%I x',
      r.schema_name,r.table_name
    ) into src_count,src_hash;

    execute format(
      'select count(*)::bigint,
              md5(coalesce(string_agg(md5(row_to_json(x)::text),'''' order by md5(row_to_json(x)::text)),''''))
         from %I x',
      tname
    ) into dst_count,dst_hash;

    insert into avan_restore_manifest
    values(
      r.schema_name,r.table_name,
      src_count,dst_count,
      src_hash,dst_hash,
      src_count=dst_count and src_hash=dst_hash
    );
  end loop;
end $$;

select
  count(*) as tables_copied,
  count(*) filter (where matched) as tables_checksum_pass,
  count(*) filter (where not matched) as tables_checksum_fail,
  sum(source_rows) as total_rows_copied,
  bool_and(matched) as copy_checksum_pass
from avan_restore_manifest;

-- =========================================================
-- 2) Accounting/data integrity on the recovered TEMP copies.
-- =========================================================
with journal_totals as (
  select journal_entry_id,
         coalesce(sum(debit),0) as debit,
         coalesce(sum(credit),0) as credit
  from avan_drill_pub_journal_lines
  group by journal_entry_id
),
checks as (
  select
    (select coalesce(sum(debit),0) from avan_drill_pub_journal_lines) as total_debit,
    (select coalesce(sum(credit),0) from avan_drill_pub_journal_lines) as total_credit,
    (select count(*)
       from avan_drill_pub_journal_lines l
       left join avan_drill_pub_journal_entries e on e.id=l.journal_entry_id
      where e.id is null) as orphan_lines,
    (select count(*)
       from avan_drill_pub_journal_entries e
       left join journal_totals t on t.journal_entry_id=e.id
      where e.status in ('posted','reversed')
        and (coalesce(t.debit,0)<>coalesce(t.credit,0) or coalesce(t.debit,0)<=0)
    ) as unbalanced_posted_reversed,
    (select count(*)
       from avan_drill_pub_invoices i
      where i.status in ('posted','reversed')
        and i.journal_entry_id is null
    ) as posted_reversed_invoices_without_journal,
    (select count(*)
       from avan_drill_pub_account_roles r
       left join avan_drill_pub_accounts a on a.id=r.account_id
      where a.id is null or a.workspace_id<>r.workspace_id
    ) as broken_account_roles,
    (select count(*)
       from avan_drill_pub_workspaces w
      where (
        select count(*)
        from avan_drill_pub_accounts a
        where a.workspace_id=w.id
          and a.level=2
          and a.is_system
      )<>52
    ) as companies_without_52_standard_level2
)
select *,
       (
         total_debit=total_credit
         and orphan_lines=0
         and unbalanced_posted_reversed=0
         and posted_reversed_invoices_without_journal=0
         and broken_account_roles=0
         and companies_without_52_standard_level2=0
       ) as recovery_integrity_pass
from checks;

-- =========================================================
-- 3) RLS tenant-isolation test with an authenticated role.
--    IDs stay in transaction-local GUCs and are not returned.
-- =========================================================
with chosen as (
  select
    m.user_id,
    m.workspace_id as own_workspace,
    (
      select w.id
      from public.workspaces w
      join private.platform_tenants pt
        on pt.workspace_id=w.id
       and pt.status in ('active','onboarding')
      where not exists (
        select 1
        from public.workspace_members mx
        where mx.workspace_id=w.id
          and mx.user_id=m.user_id
          and mx.is_active
      )
      order by w.id
      limit 1
    ) as foreign_workspace
  from public.workspace_members m
  join private.platform_tenants ownpt
    on ownpt.workspace_id=m.workspace_id
   and ownpt.status in ('active','onboarding')
  where m.is_active
  order by m.user_id,m.workspace_id
  limit 1
)
select
  set_config('request.jwt.claim.sub',user_id::text,true),
  set_config('avan.drill.own_workspace',own_workspace::text,true),
  set_config('avan.drill.foreign_workspace',foreign_workspace::text,true)
from chosen
where foreign_workspace is not null;

set local role authenticated;

select
  public.has_workspace_access(current_setting('avan.drill.own_workspace')::uuid) as own_workspace_allowed,
  public.has_workspace_access(current_setting('avan.drill.foreign_workspace')::uuid) as foreign_workspace_allowed_expected_false,
  (select count(*) from public.workspaces
    where id=current_setting('avan.drill.own_workspace')::uuid) as own_workspace_rows_visible,
  (select count(*) from public.workspaces
    where id=current_setting('avan.drill.foreign_workspace')::uuid) as foreign_workspace_rows_visible,
  (select count(*) from public.accounts
    where workspace_id=current_setting('avan.drill.own_workspace')::uuid) as own_account_rows_visible,
  (select count(*) from public.accounts
    where workspace_id=current_setting('avan.drill.foreign_workspace')::uuid) as foreign_account_rows_visible,
  (
    public.has_workspace_access(current_setting('avan.drill.own_workspace')::uuid)
    and not public.has_workspace_access(current_setting('avan.drill.foreign_workspace')::uuid)
    and (select count(*) from public.workspaces
          where id=current_setting('avan.drill.own_workspace')::uuid)=1
    and (select count(*) from public.workspaces
          where id=current_setting('avan.drill.foreign_workspace')::uuid)=0
    and (select count(*) from public.accounts
          where workspace_id=current_setting('avan.drill.own_workspace')::uuid)>0
    and (select count(*) from public.accounts
          where workspace_id=current_setting('avan.drill.foreign_workspace')::uuid)=0
  ) as rls_tenant_isolation_pass;

reset role;

-- =========================================================
-- 4) SECURITY DEFINER exposure contract.
-- =========================================================
select
  (select count(*)
     from pg_proc p
     join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.prosecdef
      and has_function_privilege('authenticated',p.oid,'EXECUTE')
  ) as public_authenticated_security_definers,
  (select count(*)
     from pg_proc p
     join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and not p.prosecdef
      and p.proname in (
        'cancel_workspace_invitation','claim_workspace_invitations','close_fiscal_period',
        'create_and_post_journal','create_avan_company','delete_draft_invoice',
        'delete_draft_journal','invite_workspace_member','list_workspace_access',
        'manage_workspace_member','post_financial_operation','post_invoice',
        'post_journal_entry','rename_avan_company','reopen_fiscal_period',
        'reverse_journal_entry','save_draft_invoice','save_draft_journal',
        'set_money_display_unit','set_workspace_print_profile'
      )
  ) as hardened_public_invoker_wrappers,
  (select count(*)
     from pg_proc p
     join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private'
      and p.prosecdef
      and p.proname in (
        'cancel_workspace_invitation','claim_workspace_invitations','close_fiscal_period',
        'create_and_post_journal','create_avan_company','delete_draft_invoice',
        'delete_draft_journal','invite_workspace_member','list_workspace_access',
        'manage_workspace_member','post_financial_operation','post_invoice',
        'post_journal_entry','rename_avan_company','reopen_fiscal_period',
        'reverse_journal_entry','save_draft_invoice','save_draft_journal',
        'set_money_display_unit','set_workspace_print_profile'
      )
  ) as private_privileged_implementations;

rollback;
