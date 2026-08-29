-- حساب‌یار V17 — Production-oriented Supabase/PostgreSQL schema
-- Run in a fresh Supabase project or review/migrate carefully on an existing database.
-- NEVER expose a service_role key in browser code.

create extension if not exists pgcrypto;

-- ---------- Workspace / membership ----------
create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'فضای مالی من',
  kind text not null default 'personal' check(kind in ('personal','family','business')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check(role in ('owner','financial_manager','accountant','cashier','warehouse','sales','auditor')),
  created_at timestamptz not null default now(),
  primary key(workspace_id,user_id)
);

create or replace function public.has_workspace_access(wid uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.workspace_members m where m.workspace_id=wid and m.user_id=(select auth.uid()));
$$;
create or replace function public.workspace_role(wid uuid)
returns text language sql stable security definer set search_path=public as $$
  select m.role from public.workspace_members m where m.workspace_id=wid and m.user_id=(select auth.uid()) limit 1;
$$;
create or replace function public.ensure_personal_workspace()
returns uuid language plpgsql security definer set search_path=public as $$
declare wid uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select id into wid from public.workspaces where owner_user_id=auth.uid() order by created_at limit 1;
  if wid is null then
    insert into public.workspaces(owner_user_id,name,kind) values(auth.uid(),'فضای مالی من','personal') returning id into wid;
  end if;
  insert into public.workspace_members(workspace_id,user_id,role) values(wid,auth.uid(),'owner')
  on conflict(workspace_id,user_id) do update set role='owner';
  return wid;
end $$;
grant execute on function public.has_workspace_access(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;
grant execute on function public.ensure_personal_workspace() to authenticated;

-- ---------- Base state used by current web client ----------
create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  mode text not null default 'personal' check(mode in ('personal','company')),
  currency_unit text not null default 'toman' check(currency_unit in ('toman','rial')),
  language text not null default 'fa' check(language in ('fa','en','ar','zh')),
  profile_name text,
  updated_at timestamptz not null default now()
);
create table if not exists public.accounts (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check(type in ('bank','cash','asset','liability')),
  bank_key text, icon text, bank_account_type text, account_number text, card_number text, iban text,
  branch_name text, branch_code text,
  opening_balance numeric(20,2) not null default 0,
  currency text not null default 'IRR',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(workspace_id,id)
);
create table if not exists public.chart_accounts (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null, code text not null, title text not null,
  type text not null check(type in ('asset','liability','equity','income','expense')),
  moein text, tafsili text, icon text, moein_icon text, tafsili_icon text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(workspace_id,id), unique(workspace_id,code)
);
create table if not exists public.transactions (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null, tx_date date not null,
  type text not null check(type in ('income','expense','transfer')),
  account_id text not null, coa_id text, category text, description text,
  amount numeric(20,2) not null check(amount>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(workspace_id,id),
  foreign key(workspace_id,account_id) references public.accounts(workspace_id,id) on delete restrict,
  foreign key(workspace_id,coa_id) references public.chart_accounts(workspace_id,id) on delete set null
);
create index if not exists idx_transactions_workspace_date on public.transactions(workspace_id,tx_date desc);
create table if not exists public.budgets (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  id text not null, category text not null, amount numeric(20,2) not null check(amount>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  primary key(workspace_id,id)
);
create table if not exists public.company_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  name text, activated boolean not null default false,
  customers integer not null default 0, vendors integer not null default 0, invoices integer not null default 0,
  updated_at timestamptz not null default now()
);
-- Full state snapshot keeps newer prototype modules cloud-persistent while they are progressively normalized.
create table if not exists public.workspace_state_snapshots (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  state_json jsonb not null default '{}'::jsonb,
  schema_version integer not null default 17,
  updated_at timestamptz not null default now()
);

-- ---------- Production ledger / governance ----------
create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label text not null, date_from date not null, date_to date not null,
  status text not null default 'open' check(status in ('open','closed')),
  closed_by uuid references auth.users(id), closed_at timestamptz,
  reopened_by uuid references auth.users(id), reopened_at timestamptz,
  unique(workspace_id,label), check(date_from<=date_to)
);
create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entry_date date not null, description text not null, source text, source_id text,
  status text not null default 'posted' check(status in ('draft','submitted','approved','posted','reversed')),
  reversal_of uuid references public.journal_entries(id) on delete restrict,
  created_by uuid not null default auth.uid(), created_at timestamptz not null default now(), posted_at timestamptz
);
create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  account_code text, account_name text not null,
  debit numeric(20,2) not null default 0, credit numeric(20,2) not null default 0,
  check(debit>=0 and credit>=0 and not(debit>0 and credit>0))
);
create index if not exists idx_journal_workspace_date on public.journal_entries(workspace_id,entry_date desc);
create index if not exists idx_journal_lines_entry on public.journal_lines(journal_entry_id);
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_id uuid default auth.uid(), actor_role text,
  action text not null, entity text not null, entity_id text, summary text,
  before_json jsonb, after_json jsonb, created_at timestamptz not null default now()
);
create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_type text not null, amount numeric(20,2) not null default 0, summary text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check(status in ('pending','approved','rejected','cancelled')),
  requested_by uuid default auth.uid(), requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id), decided_at timestamptz
);

create or replace function public.protect_closed_period() returns trigger language plpgsql set search_path=public as $$
declare d date; wid uuid;
begin
  if tg_table_name='journal_entries' then d:=coalesce(new.entry_date,old.entry_date);wid:=coalesce(new.workspace_id,old.workspace_id);
  elsif tg_table_name='transactions' then d:=coalesce(new.tx_date,old.tx_date);wid:=coalesce(new.workspace_id,old.workspace_id);
  else return coalesce(new,old); end if;
  if exists(select 1 from public.accounting_periods p where p.workspace_id=wid and p.status='closed' and d between p.date_from and p.date_to) then
    raise exception 'Accounting period is closed for date %',d;
  end if;
  return coalesce(new,old);
end $$;
drop trigger if exists trg_transactions_closed_period on public.transactions;
create trigger trg_transactions_closed_period before insert or update or delete on public.transactions for each row execute function public.protect_closed_period();
drop trigger if exists trg_journal_closed_period on public.journal_entries;
create trigger trg_journal_closed_period before insert or update or delete on public.journal_entries for each row execute function public.protect_closed_period();

create or replace function public.protect_posted_journal() returns trigger language plpgsql set search_path=public as $$
begin
  if old.status in ('posted','reversed') then raise exception 'Posted journal entries are immutable; post a reversal instead'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists trg_protect_posted_journal on public.journal_entries;
create trigger trg_protect_posted_journal before update or delete on public.journal_entries for each row execute function public.protect_posted_journal();

create or replace function public.protect_posted_journal_lines() returns trigger language plpgsql set search_path=public as $$
declare jid uuid; st text;
begin
  jid:=coalesce(new.journal_entry_id,old.journal_entry_id);
  select status into st from public.journal_entries where id=jid;
  if st in ('posted','reversed') and tg_op in ('UPDATE','DELETE') then raise exception 'Lines of posted journals are immutable'; end if;
  return case when tg_op='DELETE' then old else new end;
end $$;
drop trigger if exists trg_protect_posted_journal_lines on public.journal_lines;
create trigger trg_protect_posted_journal_lines before update or delete on public.journal_lines for each row execute function public.protect_posted_journal_lines();

create or replace function public.assert_journal_balanced() returns trigger language plpgsql set search_path=public as $$
declare jid uuid; d numeric; c numeric;
begin
  jid:=coalesce(new.journal_entry_id,old.journal_entry_id);
  select coalesce(sum(debit),0),coalesce(sum(credit),0) into d,c from public.journal_lines where journal_entry_id=jid;
  if abs(d-c) > 0.005 then raise exception 'Journal entry % is not balanced: debit %, credit %',jid,d,c; end if;
  return null;
end $$;
drop trigger if exists trg_assert_journal_balanced on public.journal_lines;
create constraint trigger trg_assert_journal_balanced after insert or update or delete on public.journal_lines deferrable initially deferred for each row execute function public.assert_journal_balanced();

-- ---------- Banking automation ----------
create table if not exists public.bank_imports (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 file_name text,format text,imported_by uuid default auth.uid(),imported_at timestamptz default now()
);
create table if not exists public.bank_lines (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 import_id uuid references public.bank_imports(id) on delete cascade,txn_date date not null,description text,amount numeric(20,2) not null,
 fingerprint text not null,status text not null default 'new',raw_json jsonb default '{}'::jsonb,unique(workspace_id,fingerprint)
);
create table if not exists public.reconciliation_matches (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 bank_line_id uuid not null references public.bank_lines(id) on delete cascade,target_type text not null,target_id text not null,
 score integer check(score between 0 and 100),reason_json jsonb default '[]'::jsonb,status text default 'suggested',
 confirmed_by uuid references auth.users(id),confirmed_at timestamptz
);
create table if not exists public.automation_rules (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 rule_type text not null default 'merchant',pattern text not null,action_json jsonb not null default '{}'::jsonb,
 active boolean not null default true,created_by uuid default auth.uid(),created_at timestamptz default now()
);

-- ---------- Controlled AI / semantic layer ----------
create table if not exists public.ai_suggestions (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 action_type text not null,target_type text,target_id text,confidence integer not null check(confidence between 0 and 100),
 risk text not null check(risk in ('low','medium','high')),payload jsonb default '{}'::jsonb,evidence jsonb default '[]'::jsonb,
 status text not null default 'pending',created_at timestamptz default now(),decided_by uuid references auth.users(id),decided_at timestamptz
);
create table if not exists public.ai_action_log (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 proposal_id uuid references public.ai_suggestions(id) on delete set null,actor_id uuid default auth.uid(),action_type text,decision text,
 result_json jsonb default '{}'::jsonb,confidence integer,evidence jsonb default '[]'::jsonb,created_at timestamptz default now()
);
create table if not exists public.semantic_metric_versions (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 version text not null,definitions jsonb not null,active boolean default true,created_at timestamptz default now(),unique(workspace_id,version)
);

-- ---------- Offline/mobile registry ----------
create table if not exists public.sync_operations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null default auth.uid(),client_operation_id text not null,operation_type text not null,payload jsonb not null default '{}'::jsonb,
 status text not null default 'pending',created_at timestamptz default now(),processed_at timestamptz,unique(workspace_id,client_operation_id)
);
create table if not exists public.push_subscriptions (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null default auth.uid(),endpoint text not null,subscription_json jsonb not null,active boolean default true,
 created_at timestamptz default now(),unique(user_id,endpoint)
);
create table if not exists public.device_registrations (
 id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null default auth.uid(),device_name text,platform text,last_seen_at timestamptz default now(),created_at timestamptz default now()
);

-- ---------- RLS ----------
do $$ declare t text; begin
 foreach t in array array[
  'workspaces','workspace_members','workspace_settings','accounts','chart_accounts','transactions','budgets','company_settings','workspace_state_snapshots',
  'accounting_periods','journal_entries','journal_lines','audit_log','approval_requests',
  'bank_imports','bank_lines','reconciliation_matches','automation_rules','ai_suggestions','ai_action_log','semantic_metric_versions',
  'sync_operations','push_subscriptions','device_registrations'
 ] loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;

-- Drop known policies so file is re-runnable.
do $$ declare t text; p text; begin
 foreach t in array array[
  'workspace_settings','accounts','chart_accounts','transactions','budgets','company_settings','workspace_state_snapshots','accounting_periods','journal_entries','journal_lines','approval_requests','bank_imports','bank_lines','reconciliation_matches','automation_rules','ai_suggestions','ai_action_log','semantic_metric_versions'
 ] loop
  execute format('drop policy if exists member_select on public.%I',t);
  execute format('drop policy if exists member_write on public.%I',t);
 end loop;
 foreach t in array array['sync_operations','push_subscriptions','device_registrations'] loop execute format('drop policy if exists own_rows on public.%I',t); end loop;
end $$;

drop policy if exists workspace_select on public.workspaces;
drop policy if exists workspace_insert on public.workspaces;
drop policy if exists workspace_update on public.workspaces;
drop policy if exists members_select on public.workspace_members;
drop policy if exists members_manage on public.workspace_members;
create policy workspace_select on public.workspaces for select to authenticated using(public.has_workspace_access(id) or owner_user_id=(select auth.uid()));
create policy workspace_insert on public.workspaces for insert to authenticated with check(owner_user_id=(select auth.uid()));
create policy workspace_update on public.workspaces for update to authenticated using(public.workspace_role(id) in ('owner','financial_manager')) with check(public.workspace_role(id) in ('owner','financial_manager'));
create policy members_select on public.workspace_members for select to authenticated using(public.has_workspace_access(workspace_id));
create policy members_manage on public.workspace_members for all to authenticated using(public.workspace_role(workspace_id)='owner') with check(public.workspace_role(workspace_id)='owner');

-- General member read; non-auditor write. Sensitive actions are narrowed below by application workflow and DB triggers.
do $$ declare t text; begin
 foreach t in array array['workspace_settings','accounts','chart_accounts','transactions','budgets','company_settings','workspace_state_snapshots','approval_requests','bank_imports','bank_lines','reconciliation_matches','automation_rules'] loop
  execute format('create policy member_select on public.%I for select to authenticated using(public.has_workspace_access(workspace_id))',t);
  execute format('create policy member_write on public.%I for all to authenticated using(public.has_workspace_access(workspace_id) and public.workspace_role(workspace_id) <> ''auditor'') with check(public.has_workspace_access(workspace_id) and public.workspace_role(workspace_id) <> ''auditor'')',t);
 end loop;
end $$;

-- Periods only owner / financial manager can write.
create policy member_select on public.accounting_periods for select to authenticated using(public.has_workspace_access(workspace_id));
create policy member_write on public.accounting_periods for all to authenticated using(public.workspace_role(workspace_id) in ('owner','financial_manager')) with check(public.workspace_role(workspace_id) in ('owner','financial_manager'));
-- Ledger read for members; write for finance roles. DB triggers enforce immutability and closed periods.
do $$ declare t text; begin foreach t in array array['journal_entries','journal_lines'] loop
 execute format('create policy member_select on public.%I for select to authenticated using(public.has_workspace_access(workspace_id))',t);
 execute format('create policy member_write on public.%I for all to authenticated using(public.workspace_role(workspace_id) in (''owner'',''financial_manager'',''accountant'')) with check(public.workspace_role(workspace_id) in (''owner'',''financial_manager'',''accountant''))',t);
end loop; end $$;
-- Audit is append-only to finance roles; everyone in workspace may read.
drop policy if exists audit_select on public.audit_log;drop policy if exists audit_insert on public.audit_log;
create policy audit_select on public.audit_log for select to authenticated using(public.has_workspace_access(workspace_id));
create policy audit_insert on public.audit_log for insert to authenticated with check(public.has_workspace_access(workspace_id) and public.workspace_role(workspace_id)<>'auditor');
-- AI suggestions/actions finance-only write; workspace read.
do $$ declare t text; begin foreach t in array array['ai_suggestions','ai_action_log','semantic_metric_versions'] loop
 execute format('create policy member_select on public.%I for select to authenticated using(public.has_workspace_access(workspace_id))',t);
 execute format('create policy member_write on public.%I for all to authenticated using(public.workspace_role(workspace_id) in (''owner'',''financial_manager'',''accountant'')) with check(public.workspace_role(workspace_id) in (''owner'',''financial_manager'',''accountant''))',t);
end loop; end $$;
-- Device/sync rows belong to the signed-in user.
do $$ declare t text; begin foreach t in array array['sync_operations','push_subscriptions','device_registrations'] loop
 execute format('create policy own_rows on public.%I for all to authenticated using(public.has_workspace_access(workspace_id) and user_id=(select auth.uid())) with check(public.has_workspace_access(workspace_id) and user_id=(select auth.uid()))',t);
end loop; end $$;
