-- Avan Core 1.0 RC1 — read-only database verification
-- Safe to run in Supabase SQL Editor. It does not mutate data.

-- A) Core tables must have RLS enabled.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relkind='r'
  and c.relname in (
    'workspaces','workspace_members','fiscal_years','fiscal_periods','accounts','account_roles',
    'parties','journal_entries','journal_lines','financial_accounts','financial_transactions',
    'audit_logs','workspace_settings','journal_number_sequences'
  )
order by c.relname;

-- B) Critical RPCs expected by the RC runtime.
select p.proname as function_name
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
  and p.proname in (
    'bootstrap_avan_workspace','save_draft_journal','post_journal_entry','delete_draft_journal',
    'reverse_journal_entry','post_financial_operation','close_fiscal_period','reopen_fiscal_period',
    'report_trial_balance','report_journal','report_account_statement','report_profit_loss',
    'report_balance_sheet','report_cash_bank_balances','avan_workspace_health','avan_core_integrity',
    'workspace_role'
  )
order by p.proname;

-- C) Browser must not have direct mutation privileges on accounting journals/periods/transactions.
select
  has_table_privilege('authenticated','public.journal_entries','INSERT') as journal_insert_direct,
  has_table_privilege('authenticated','public.journal_entries','UPDATE') as journal_update_direct,
  has_table_privilege('authenticated','public.journal_entries','DELETE') as journal_delete_direct,
  has_table_privilege('authenticated','public.journal_lines','INSERT') as line_insert_direct,
  has_table_privilege('authenticated','public.fiscal_periods','INSERT') as period_insert_direct,
  has_table_privilege('authenticated','public.financial_transactions','INSERT') as tx_insert_direct;
-- Expected: all six = false.

-- D) Historical actor foreign keys intentionally absent: Posted ledger must not mutate when Auth user is removed.
select conname
from pg_constraint
where conname in (
  'journal_entries_posted_by_fkey','journal_entries_reversed_by_fkey','fiscal_periods_closed_by_fkey'
);
-- Expected: 0 rows.
