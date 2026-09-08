-- Applied migration: rc1_5_performance_hot_path_indexes
-- Applied 2026-09-08 to Avan-production.
-- Targeted hot-path/FK indexes only; no financial data or authorization semantics changed.

create index if not exists parties_workspace_active_name_idx
  on public.parties (workspace_id, is_active, name);

create index if not exists financial_transactions_workspace_date_idx
  on public.financial_transactions (workspace_id, tx_date desc, created_at desc);

create index if not exists attachments_workspace_idx
  on public.attachments (workspace_id);

create index if not exists documents_linked_journal_entry_idx
  on public.documents (linked_journal_entry_id)
  where linked_journal_entry_id is not null;

create index if not exists account_roles_account_idx
  on public.account_roles (account_id);

create index if not exists financial_accounts_ledger_account_idx
  on public.financial_accounts (ledger_account_id);

create index if not exists journal_entries_reversal_of_idx
  on public.journal_entries (reversal_of)
  where reversal_of is not null;

create index if not exists tax_profiles_rule_version_idx
  on public.tax_profiles (rule_version_id)
  where rule_version_id is not null;

create index if not exists workspace_tax_settings_default_rule_idx
  on public.workspace_tax_settings (default_rule_version_id)
  where default_rule_version_id is not null;

create index if not exists workspace_user_preferences_user_idx
  on public.workspace_user_preferences (user_id, workspace_id);

create index if not exists workspaces_owner_user_idx
  on public.workspaces (owner_user_id)
  where owner_user_id is not null;

-- account_roles_access is a PERMISSIVE FOR ALL policy with the exact same
-- SELECT predicate as account_roles_select. Keeping both causes duplicate
-- permissive-policy evaluation for SELECT.
drop policy if exists account_roles_select on public.account_roles;
