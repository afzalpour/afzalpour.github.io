-- Avan RC1.3-C1.2 — Company isolation hardening
-- ADR-0014: child financial rows must never point across Company/workspace.
-- Existing data was verified before this migration: all mismatch counts = 0.

begin;

-- Composite parent keys make workspace/company identity part of the FK.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'accounts_id_workspace_id_key'
  ) then
    alter table public.accounts
      add constraint accounts_id_workspace_id_key
      unique (id, workspace_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'parties_id_workspace_id_key'
  ) then
    alter table public.parties
      add constraint parties_id_workspace_id_key
      unique (id, workspace_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'journal_entries_id_workspace_id_key'
  ) then
    alter table public.journal_entries
      add constraint journal_entries_id_workspace_id_key
      unique (id, workspace_id);
  end if;
end $$;

-- Defense in depth: a line, its journal, account and optional party must all
-- belong to exactly the same Company/workspace.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'journal_lines_journal_workspace_fkey'
  ) then
    alter table public.journal_lines
      add constraint journal_lines_journal_workspace_fkey
      foreign key (journal_entry_id, workspace_id)
      references public.journal_entries(id, workspace_id)
      on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'journal_lines_account_workspace_fkey'
  ) then
    alter table public.journal_lines
      add constraint journal_lines_account_workspace_fkey
      foreign key (account_id, workspace_id)
      references public.accounts(id, workspace_id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'journal_lines_party_workspace_fkey'
  ) then
    alter table public.journal_lines
      add constraint journal_lines_party_workspace_fkey
      foreign key (party_id, workspace_id)
      references public.parties(id, workspace_id)
      on delete restrict;
  end if;
end $$;

-- Fix the legacy tautology `e.workspace_id = e.workspace_id` in direct-DML
-- Draft policies. The parent draft must be in the same workspace as the line.
drop policy if exists journal_lines_insert_draft on public.journal_lines;
create policy journal_lines_insert_draft
on public.journal_lines
for insert
to authenticated
with check (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1
    from public.journal_entries e
    where e.id = journal_lines.journal_entry_id
      and e.workspace_id = journal_lines.workspace_id
      and e.status = 'draft'
  )
);

drop policy if exists journal_lines_update_draft on public.journal_lines;
create policy journal_lines_update_draft
on public.journal_lines
for update
to authenticated
using (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1
    from public.journal_entries e
    where e.id = journal_lines.journal_entry_id
      and e.workspace_id = journal_lines.workspace_id
      and e.status = 'draft'
  )
)
with check (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1
    from public.journal_entries e
    where e.id = journal_lines.journal_entry_id
      and e.workspace_id = journal_lines.workspace_id
      and e.status = 'draft'
  )
);

drop policy if exists journal_lines_delete_draft on public.journal_lines;
create policy journal_lines_delete_draft
on public.journal_lines
for delete
to authenticated
using (
  public.has_workspace_access(workspace_id)
  and exists (
    select 1
    from public.journal_entries e
    where e.id = journal_lines.journal_entry_id
      and e.workspace_id = journal_lines.workspace_id
      and e.status = 'draft'
  )
);

commit;