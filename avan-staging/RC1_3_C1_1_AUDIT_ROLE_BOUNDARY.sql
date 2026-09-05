-- Avan RC1.3-C1.1 — Role-aware Audit Log boundary
-- Fixes audit visibility so non-admin workspace roles cannot read access/user-management events.
-- Also removes broad default table privileges from anon/authenticated.
-- No Ledger, journal, invoice, accounting RLS, or financial data changes.

begin;

-- Least privilege: browser roles must not have broad table privileges.
revoke all on table public.audit_logs from anon, authenticated;

-- The operational audit UI only needs these safe/read-only columns.
grant select (
  id,
  workspace_id,
  actor_id,
  action,
  entity_type,
  entity_id,
  summary,
  created_at
) on table public.audit_logs to authenticated;

-- Replace the original "any workspace member sees every audit row" policy.
drop policy if exists audit_select on public.audit_logs;

create policy audit_select
on public.audit_logs
for select
to authenticated
using (
  public.has_workspace_access(workspace_id)
  and (
    public.workspace_role(workspace_id) in ('owner', 'manager')
    or entity_type in (
      'document',
      'journal_entry',
      'invoice',
      'fiscal_period',
      'workspace_print_profile',
      'workspace_settings'
    )
  )
);

-- Supports the settings audit feed query efficiently.
create index if not exists idx_audit_logs_workspace_created_at
  on public.audit_logs(workspace_id, created_at desc);

commit;

-- Verification helpers.
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema='public'
  and table_name='audit_logs'
  and grantee in ('anon','authenticated')
order by grantee, privilege_type;

select policyname, roles, cmd, qual
from pg_policies
where schemaname='public'
  and tablename='audit_logs';