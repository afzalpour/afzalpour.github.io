-- AVAN RC1.6-A — Bank statement reconciliation foundation
-- Company-scoped evidence only. No autonomous financial writes.
-- Canonical money: Toman numeric(20,1), one Rial precision (ADR-0019).
-- Reconciliation is Human-controlled (ADR-0020 / ADR-0022).

create unique index if not exists financial_accounts_workspace_id_id_uidx
  on public.financial_accounts(workspace_id, id);
create unique index if not exists financial_transactions_workspace_id_id_uidx
  on public.financial_transactions(workspace_id, id);

create table if not exists public.bank_statement_imports (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  financial_account_id uuid not null,
  source_format text not null default 'csv' check (source_format in ('csv')),
  file_name text not null check (nullif(btrim(file_name), '') is not null),
  file_sha256 text not null check (file_sha256 ~ '^[0-9A-Fa-f]{64}$'),
  statement_from date,
  statement_to date,
  opening_balance numeric(20,1),
  closing_balance numeric(20,1),
  row_count integer not null default 0 check (row_count >= 0),
  status text not null default 'draft' check (status in ('draft','ready','finalized','voided')),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_statement_imports_date_range_check
    check (statement_from is null or statement_to is null or statement_from <= statement_to),
  constraint bank_statement_imports_workspace_account_fk
    foreign key (workspace_id, financial_account_id)
    references public.financial_accounts(workspace_id, id) on delete restrict,
  constraint bank_statement_imports_file_dedupe
    unique (workspace_id, financial_account_id, file_sha256)
);

create unique index if not exists bank_statement_imports_workspace_id_id_account_uidx
  on public.bank_statement_imports(workspace_id, id, financial_account_id);
create index if not exists bank_statement_imports_workspace_account_date_idx
  on public.bank_statement_imports(workspace_id, financial_account_id, statement_from desc, created_at desc);

create table if not exists public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  import_id uuid not null,
  financial_account_id uuid not null,
  line_no integer not null check (line_no > 0),
  booking_date date not null,
  value_date date,
  direction text not null check (direction in ('credit','debit')),
  amount numeric(20,1) not null check (amount > 0),
  description text not null default '',
  reference_no text,
  counterparty text,
  balance_after numeric(20,1),
  fingerprint text not null check (nullif(btrim(fingerprint), '') is not null),
  ignored_at timestamptz,
  ignored_by uuid,
  ignore_reason text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_statement_lines_import_fk
    foreign key (workspace_id, import_id, financial_account_id)
    references public.bank_statement_imports(workspace_id, id, financial_account_id) on delete cascade,
  constraint bank_statement_lines_import_line_no_key unique (import_id, line_no),
  constraint bank_statement_lines_ignore_consistency check (
    (ignored_at is null and ignored_by is null and ignore_reason is null)
    or (ignored_at is not null and ignored_by is not null and nullif(btrim(ignore_reason), '') is not null)
  )
);

create unique index if not exists bank_statement_lines_workspace_id_id_account_uidx
  on public.bank_statement_lines(workspace_id, id, financial_account_id);
create index if not exists bank_statement_lines_workspace_account_date_idx
  on public.bank_statement_lines(workspace_id, financial_account_id, booking_date desc, line_no);
create index if not exists bank_statement_lines_import_fingerprint_idx
  on public.bank_statement_lines(import_id, fingerprint);

create table if not exists public.bank_reconciliation_matches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  financial_account_id uuid not null,
  statement_line_id uuid not null,
  financial_transaction_id uuid not null,
  match_method text not null check (match_method in ('manual','exact','reference','date_amount')),
  score integer not null check (score between 0 and 100),
  reason_codes text[] not null default '{}'::text[],
  confirmed_by uuid not null default auth.uid(),
  confirmed_at timestamptz not null default now(),
  voided_by uuid,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_reconciliation_matches_line_fk
    foreign key (workspace_id, statement_line_id, financial_account_id)
    references public.bank_statement_lines(workspace_id, id, financial_account_id) on delete restrict,
  constraint bank_reconciliation_matches_tx_fk
    foreign key (workspace_id, financial_transaction_id)
    references public.financial_transactions(workspace_id, id) on delete restrict,
  constraint bank_reconciliation_matches_void_consistency check (
    (voided_at is null and voided_by is null and void_reason is null)
    or (voided_at is not null and voided_by is not null and nullif(btrim(void_reason), '') is not null)
  )
);

create unique index if not exists bank_reconciliation_active_line_uidx
  on public.bank_reconciliation_matches(statement_line_id)
  where voided_at is null;
create unique index if not exists bank_reconciliation_active_tx_account_uidx
  on public.bank_reconciliation_matches(financial_account_id, financial_transaction_id)
  where voided_at is null;
create index if not exists bank_reconciliation_workspace_account_idx
  on public.bank_reconciliation_matches(workspace_id, financial_account_id, confirmed_at desc);

alter table public.bank_statement_imports enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliation_matches enable row level security;

drop policy if exists bank_statement_imports_select on public.bank_statement_imports;
create policy bank_statement_imports_select on public.bank_statement_imports
for select to authenticated
using (public.has_workspace_access(workspace_id));

drop policy if exists bank_statement_imports_insert on public.bank_statement_imports;
create policy bank_statement_imports_insert on public.bank_statement_imports
for insert to authenticated
with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));

drop policy if exists bank_statement_imports_update on public.bank_statement_imports;
create policy bank_statement_imports_update on public.bank_statement_imports
for update to authenticated
using (public.workspace_role(workspace_id) in ('owner','manager','accountant'))
with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));

drop policy if exists bank_statement_lines_select on public.bank_statement_lines;
create policy bank_statement_lines_select on public.bank_statement_lines
for select to authenticated
using (public.has_workspace_access(workspace_id));

drop policy if exists bank_statement_lines_insert on public.bank_statement_lines;
create policy bank_statement_lines_insert on public.bank_statement_lines
for insert to authenticated
with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));

drop policy if exists bank_statement_lines_update on public.bank_statement_lines;
create policy bank_statement_lines_update on public.bank_statement_lines
for update to authenticated
using (public.workspace_role(workspace_id) in ('owner','manager','accountant'))
with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));

drop policy if exists bank_reconciliation_matches_select on public.bank_reconciliation_matches;
create policy bank_reconciliation_matches_select on public.bank_reconciliation_matches
for select to authenticated
using (public.has_workspace_access(workspace_id));

drop policy if exists bank_reconciliation_matches_insert on public.bank_reconciliation_matches;
create policy bank_reconciliation_matches_insert on public.bank_reconciliation_matches
for insert to authenticated
with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));

drop policy if exists bank_reconciliation_matches_update on public.bank_reconciliation_matches;
create policy bank_reconciliation_matches_update on public.bank_reconciliation_matches
for update to authenticated
using (public.workspace_role(workspace_id) in ('owner','manager','accountant'))
with check (public.workspace_role(workspace_id) in ('owner','manager','accountant'));

create or replace function private.validate_bank_statement_import()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind text;
  v_line_count integer;
  v_unresolved integer;
  v_calculated_close numeric;
begin
  select fa.kind into v_kind
  from public.financial_accounts fa
  where fa.workspace_id = new.workspace_id and fa.id = new.financial_account_id;
  if v_kind is distinct from 'bank' then
    raise exception 'BANK_ACCOUNT_REQUIRED';
  end if;

  if tg_op = 'INSERT' then
    if (select auth.uid()) is not null then new.created_by := (select auth.uid()); end if;
    new.updated_at := now();
    return new;
  end if;

  if new.workspace_id is distinct from old.workspace_id
     or new.financial_account_id is distinct from old.financial_account_id
     or new.source_format is distinct from old.source_format
     or new.file_sha256 is distinct from old.file_sha256
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'BANK_STATEMENT_IMPORT_IDENTITY_IMMUTABLE';
  end if;

  if old.status in ('finalized','voided') and new is distinct from old then
    raise exception 'BANK_STATEMENT_IMPORT_LOCKED';
  end if;

  if new.status is distinct from old.status and not (
    (old.status='draft' and new.status in ('ready','voided'))
    or (old.status='ready' and new.status in ('draft','finalized','voided'))
  ) then
    raise exception 'BANK_STATEMENT_IMPORT_INVALID_TRANSITION';
  end if;

  if new.status in ('ready','finalized') then
    select count(*) into v_line_count
    from public.bank_statement_lines l
    where l.workspace_id=new.workspace_id and l.import_id=new.id;
    new.row_count := v_line_count;
    if v_line_count = 0 then raise exception 'BANK_STATEMENT_IMPORT_EMPTY'; end if;
  end if;

  if new.status='finalized' and old.status is distinct from 'finalized' then
    select count(*) into v_unresolved
    from public.bank_statement_lines l
    where l.workspace_id=new.workspace_id and l.import_id=new.id and l.ignored_at is null
      and not exists (
        select 1 from public.bank_reconciliation_matches m
        where m.workspace_id=l.workspace_id and m.statement_line_id=l.id and m.voided_at is null
      );
    if v_unresolved > 0 then raise exception 'BANK_RECONCILIATION_UNRESOLVED_LINES'; end if;

    if new.opening_balance is not null and new.closing_balance is not null then
      select new.opening_balance + coalesce(sum(case when l.direction='credit' then l.amount else -l.amount end),0)
        into v_calculated_close
      from public.bank_statement_lines l
      where l.workspace_id=new.workspace_id and l.import_id=new.id;
      if v_calculated_close is distinct from new.closing_balance then
        raise exception 'BANK_STATEMENT_BALANCE_MISMATCH';
      end if;
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.validate_bank_statement_line()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_import_status text;
begin
  select i.status into v_import_status
  from public.bank_statement_imports i
  where i.workspace_id=new.workspace_id and i.id=new.import_id and i.financial_account_id=new.financial_account_id;
  if v_import_status is null then raise exception 'BANK_STATEMENT_IMPORT_NOT_FOUND'; end if;

  if tg_op='INSERT' then
    if v_import_status <> 'draft' then raise exception 'BANK_STATEMENT_LINES_REQUIRE_DRAFT_IMPORT'; end if;
    if (select auth.uid()) is not null then new.created_by := (select auth.uid()); end if;
    new.updated_at := now();
    return new;
  end if;

  if v_import_status not in ('draft','ready') then raise exception 'BANK_STATEMENT_IMPORT_LOCKED'; end if;

  if new.workspace_id is distinct from old.workspace_id
     or new.import_id is distinct from old.import_id
     or new.financial_account_id is distinct from old.financial_account_id
     or new.line_no is distinct from old.line_no
     or new.booking_date is distinct from old.booking_date
     or new.value_date is distinct from old.value_date
     or new.direction is distinct from old.direction
     or new.amount is distinct from old.amount
     or new.description is distinct from old.description
     or new.reference_no is distinct from old.reference_no
     or new.counterparty is distinct from old.counterparty
     or new.balance_after is distinct from old.balance_after
     or new.fingerprint is distinct from old.fingerprint
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'BANK_STATEMENT_LINE_EVIDENCE_IMMUTABLE';
  end if;

  if old.ignored_at is not null and (new.ignored_at is distinct from old.ignored_at or new.ignored_by is distinct from old.ignored_by or new.ignore_reason is distinct from old.ignore_reason) then
    raise exception 'BANK_STATEMENT_LINE_IGNORE_IMMUTABLE';
  end if;

  if old.ignored_at is null and new.ignored_at is not null then
    if exists (select 1 from public.bank_reconciliation_matches m where m.statement_line_id=old.id and m.voided_at is null) then
      raise exception 'BANK_STATEMENT_LINE_ALREADY_MATCHED';
    end if;
    new.ignored_at := now();
    new.ignored_by := (select auth.uid());
    if nullif(btrim(new.ignore_reason), '') is null then raise exception 'BANK_STATEMENT_IGNORE_REASON_REQUIRED'; end if;
  elsif new.ignored_at is distinct from old.ignored_at or new.ignored_by is distinct from old.ignored_by or new.ignore_reason is distinct from old.ignore_reason then
    raise exception 'BANK_STATEMENT_INVALID_IGNORE_CHANGE';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.validate_bank_reconciliation_match()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_line public.bank_statement_lines%rowtype;
  v_import_status text;
  v_ledger_account_id uuid;
  v_tx public.financial_transactions%rowtype;
  v_expected_direction text;
begin
  if tg_op='UPDATE' then
    if new.workspace_id is distinct from old.workspace_id
       or new.financial_account_id is distinct from old.financial_account_id
       or new.statement_line_id is distinct from old.statement_line_id
       or new.financial_transaction_id is distinct from old.financial_transaction_id
       or new.match_method is distinct from old.match_method
       or new.score is distinct from old.score
       or new.reason_codes is distinct from old.reason_codes
       or new.confirmed_by is distinct from old.confirmed_by
       or new.confirmed_at is distinct from old.confirmed_at
       or new.created_at is distinct from old.created_at then
      raise exception 'BANK_RECONCILIATION_MATCH_IMMUTABLE';
    end if;
    if old.voided_at is not null then raise exception 'BANK_RECONCILIATION_MATCH_ALREADY_VOIDED'; end if;
    if new.voided_at is null then raise exception 'BANK_RECONCILIATION_MATCH_UPDATE_REQUIRES_VOID'; end if;
    if nullif(btrim(new.void_reason), '') is null then raise exception 'BANK_RECONCILIATION_VOID_REASON_REQUIRED'; end if;
    new.voided_at := now();
    new.voided_by := (select auth.uid());
    new.updated_at := now();
    return new;
  end if;

  select l.* into v_line
  from public.bank_statement_lines l
  where l.workspace_id=new.workspace_id and l.id=new.statement_line_id and l.financial_account_id=new.financial_account_id;
  if not found then raise exception 'BANK_STATEMENT_LINE_NOT_FOUND'; end if;
  if v_line.ignored_at is not null then raise exception 'BANK_STATEMENT_LINE_IGNORED'; end if;

  select i.status, fa.ledger_account_id into v_import_status, v_ledger_account_id
  from public.bank_statement_imports i
  join public.financial_accounts fa on fa.workspace_id=i.workspace_id and fa.id=i.financial_account_id
  where i.workspace_id=new.workspace_id and i.id=v_line.import_id and i.financial_account_id=new.financial_account_id;
  if v_import_status <> 'ready' then raise exception 'BANK_RECONCILIATION_IMPORT_NOT_READY'; end if;

  select t.* into v_tx
  from public.financial_transactions t
  where t.workspace_id=new.workspace_id and t.id=new.financial_transaction_id;
  if not found then raise exception 'FINANCIAL_TRANSACTION_NOT_FOUND'; end if;
  if v_tx.status <> 'posted' or v_tx.tx_type not in ('receipt','payment','transfer') then
    raise exception 'BANK_RECONCILIATION_POSTED_TRANSACTION_REQUIRED';
  end if;
  if v_tx.amount is distinct from v_line.amount then raise exception 'BANK_RECONCILIATION_AMOUNT_MISMATCH'; end if;

  v_expected_direction := case
    when v_tx.tx_type='receipt' and v_tx.to_account_id=v_ledger_account_id then 'credit'
    when v_tx.tx_type='payment' and v_tx.from_account_id=v_ledger_account_id then 'debit'
    when v_tx.tx_type='transfer' and v_tx.to_account_id=v_ledger_account_id and v_tx.from_account_id is distinct from v_ledger_account_id then 'credit'
    when v_tx.tx_type='transfer' and v_tx.from_account_id=v_ledger_account_id and v_tx.to_account_id is distinct from v_ledger_account_id then 'debit'
    else null
  end;
  if v_expected_direction is null or v_expected_direction is distinct from v_line.direction then
    raise exception 'BANK_RECONCILIATION_DIRECTION_MISMATCH';
  end if;

  if (select auth.uid()) is not null then new.confirmed_by := (select auth.uid()); end if;
  new.confirmed_at := now();
  new.voided_by := null;
  new.voided_at := null;
  new.void_reason := null;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.validate_bank_statement_import() from public, anon, authenticated;
revoke all on function private.validate_bank_statement_line() from public, anon, authenticated;
revoke all on function private.validate_bank_reconciliation_match() from public, anon, authenticated;

drop trigger if exists bank_statement_import_validate on public.bank_statement_imports;
create trigger bank_statement_import_validate
before insert or update on public.bank_statement_imports
for each row execute function private.validate_bank_statement_import();

drop trigger if exists bank_statement_line_validate on public.bank_statement_lines;
create trigger bank_statement_line_validate
before insert or update on public.bank_statement_lines
for each row execute function private.validate_bank_statement_line();

drop trigger if exists bank_reconciliation_match_validate on public.bank_reconciliation_matches;
create trigger bank_reconciliation_match_validate
before insert or update on public.bank_reconciliation_matches
for each row execute function private.validate_bank_reconciliation_match();

create or replace function public.avan_bank_reconciliation_candidates(
  wid uuid,
  p_statement_line_id uuid,
  p_date_window integer default 3
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.has_workspace_access(wid) then raise exception 'WORKSPACE_ACCESS_DENIED'; end if;
  if p_date_window < 0 or p_date_window > 30 then raise exception 'BANK_RECONCILIATION_DATE_WINDOW_INVALID'; end if;

  with line_context as (
    select l.*, fa.ledger_account_id
    from public.bank_statement_lines l
    join public.financial_accounts fa on fa.workspace_id=l.workspace_id and fa.id=l.financial_account_id and fa.kind='bank'
    where l.workspace_id=wid and l.id=p_statement_line_id and l.ignored_at is null
      and not exists (
        select 1 from public.bank_reconciliation_matches m
        where m.workspace_id=l.workspace_id and m.statement_line_id=l.id and m.voided_at is null
      )
  ), candidates as (
    select t.id as transaction_id, t.tx_no, t.tx_type, t.tx_date, t.amount, t.reference, t.description,
      abs(t.tx_date-l.booking_date) as date_distance_days,
      least(100,
        70
        + case when nullif(regexp_replace(lower(coalesce(l.reference_no,'')), '[^[:alnum:]]', '', 'g'),'') is not null
                    and regexp_replace(lower(coalesce(l.reference_no,'')), '[^[:alnum:]]', '', 'g') = regexp_replace(lower(coalesce(t.reference,'')), '[^[:alnum:]]', '', 'g') then 20 else 0 end
        + case when t.tx_date=l.booking_date then 10 when abs(t.tx_date-l.booking_date)=1 then 7 when abs(t.tx_date-l.booking_date)<=3 then 3 else 0 end
      )::integer as score,
      array_remove(array[
        'EXACT_AMOUNT'::text,
        'BANK_ACCOUNT_SIDE_MATCH'::text,
        case when nullif(regexp_replace(lower(coalesce(l.reference_no,'')), '[^[:alnum:]]', '', 'g'),'') is not null
                  and regexp_replace(lower(coalesce(l.reference_no,'')), '[^[:alnum:]]', '', 'g') = regexp_replace(lower(coalesce(t.reference,'')), '[^[:alnum:]]', '', 'g') then 'EXACT_REFERENCE' end,
        case when t.tx_date=l.booking_date then 'SAME_DAY'
             when abs(t.tx_date-l.booking_date)=1 then 'DATE_WITHIN_1_DAY'
             when abs(t.tx_date-l.booking_date)<=3 then 'DATE_WITHIN_3_DAYS' end
      ], null)::text[] as reason_codes
    from line_context l
    join public.financial_transactions t on t.workspace_id=l.workspace_id
      and t.status='posted'
      and t.tx_type in ('receipt','payment','transfer')
      and t.amount=l.amount
      and abs(t.tx_date-l.booking_date) <= p_date_window
      and (
        (l.direction='credit' and (
          (t.tx_type='receipt' and t.to_account_id=l.ledger_account_id)
          or (t.tx_type='transfer' and t.to_account_id=l.ledger_account_id and t.from_account_id is distinct from l.ledger_account_id)
        ))
        or
        (l.direction='debit' and (
          (t.tx_type='payment' and t.from_account_id=l.ledger_account_id)
          or (t.tx_type='transfer' and t.from_account_id=l.ledger_account_id and t.to_account_id is distinct from l.ledger_account_id)
        ))
      )
    where not exists (
      select 1 from public.bank_reconciliation_matches m
      where m.workspace_id=t.workspace_id and m.financial_account_id=l.financial_account_id
        and m.financial_transaction_id=t.id and m.voided_at is null
    )
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'transaction_id', transaction_id,
      'tx_no', tx_no,
      'tx_type', tx_type,
      'tx_date', tx_date,
      'amount', amount,
      'reference', reference,
      'description', description,
      'date_distance_days', date_distance_days,
      'score', score,
      'reason_codes', reason_codes
    ) order by score desc, date_distance_days asc, transaction_id), '[]'::jsonb)
  into v_result
  from candidates;

  return v_result;
end;
$$;

revoke all on function public.avan_bank_reconciliation_candidates(uuid,uuid,integer) from public, anon;
grant execute on function public.avan_bank_reconciliation_candidates(uuid,uuid,integer) to authenticated;

revoke all on table public.bank_statement_imports from public, anon;
revoke all on table public.bank_statement_lines from public, anon;
revoke all on table public.bank_reconciliation_matches from public, anon;
grant select, insert, update on table public.bank_statement_imports to authenticated;
grant select, insert, update on table public.bank_statement_lines to authenticated;
grant select, insert, update on table public.bank_reconciliation_matches to authenticated;
